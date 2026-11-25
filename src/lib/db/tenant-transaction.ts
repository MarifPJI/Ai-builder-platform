/**
 * `withTenantTransaction` — pembungkus transaksi RLS untuk isolasi tenancy
 * (lihat design.md > Model Tenancy Dua Lapis > Lapis 2).
 *
 * Kontrak (R4.1, R4.2, R4.8):
 *   BEGIN
 *   -> SET LOCAL app.current_user_role  dari klaim  (SEBELUM statement data pertama)
 *   -> SET LOCAL app.current_school_id  dari klaim  (SEBELUM statement data pertama)
 *   -> jalankan fn(tx)
 *   -> COMMIT
 *   -> ROLLBACK pada error ATAU klaim invalid, TANPA menetapkan nilai default
 *      (deny-by-default).
 *
 * Deny-by-default:
 *   Jika `claims.role` bukan `admin`/`teacher`, atau `teacher` namun `schoolId`
 *   `null`/bukan UUID, transaksi di-rollback SEBELUM query data apa pun berjalan
 *   dan error dilempar. Tidak ada konteks tenancy default yang ditetapkan,
 *   sehingga RLS akan menolak (variabel sesi tidak terset → `current_setting`
 *   mengembalikan NULL → policy gagal).
 *
 * Keamanan terhadap injeksi:
 *   Nilai konteks sesi ditetapkan memakai `set_config($1, $2, true)` yang
 *   diparameterisasi (parameter ke-3 `true` = berlaku lokal untuk transaksi,
 *   setara `SET LOCAL`). Kita TIDAK menginterpolasi nilai klaim ke dalam string
 *   SQL untuk mencegah injeksi.
 *
 * _Requirements: 4.1, 4.2, 4.8_
 */

import 'server-only';

import type { PoolClient } from 'pg';

import { getPool } from './pool';
import type { Role, SessionClaims } from './types';

/**
 * Nama variabel sesi yang diperiksa oleh kebijakan RLS.
 * Konsisten dengan `db/migrations/0002_rls_policies.sql`.
 */
const SESSION_VAR_ROLE = 'app.current_user_role';
const SESSION_VAR_SCHOOL_ID = 'app.current_school_id';

/**
 * Nilai sentinel non-tenant untuk `app.current_school_id` ketika peran `admin`
 * memiliki `schoolId === null` (admin lintas sekolah).
 *
 * Alasan pemilihan nilai:
 * - Kebijakan RLS admin HANYA memeriksa `role = 'admin'`, sehingga akses admin
 *   tidak bergantung pada `app.current_school_id`.
 * - Kebijakan RLS teacher mencocokkan `school_id = current_setting(...)::uuid`.
 *   Sentinel ini adalah UUID valid secara sintaksis (agar cast `::uuid` tidak
 *   gagal) namun berupa UUID all-zero yang SENGAJA tidak pernah dipakai sebagai
 *   `school_id` sekolah mana pun (PK sekolah dibuat via `gen_random_uuid()`),
 *   sehingga tidak cocok dengan baris sekolah mana pun.
 *
 * Dengan kata lain: untuk admin kita menetapkan konteks peran, dan nilai school
 * yang TIDAK cocok dengan tenant mana pun (bukan default yang membuka akses).
 */
const NON_TENANT_SCHOOL_SENTINEL =
  '00000000-0000-0000-0000-000000000000';

/** Pola UUID (RFC 4122, 8-4-4-4-12 heksadesimal). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Memeriksa apakah sebuah nilai berupa string UUID yang sah. */
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Memeriksa apakah sebuah peran termasuk peran yang diizinkan. */
function isValidRole(role: unknown): role is Role {
  return role === 'admin' || role === 'teacher';
}

/**
 * Error yang dilempar ketika klaim sesi tidak memenuhi syarat untuk membuka
 * konteks tenancy. Dipakai agar pemanggil dapat membedakan kegagalan klaim
 * (deny-by-default) dari kegagalan basis data biasa.
 */
export class InvalidTenantClaimsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidTenantClaimsError';
  }
}

/**
 * Hasil validasi klaim menjadi pasangan nilai konteks sesi.
 * Dihitung SEBELUM transaksi dimulai sehingga klaim invalid tidak pernah
 * membuka koneksi/transaksi data.
 */
interface TenantContext {
  role: Role;
  /** Nilai untuk `app.current_school_id` (UUID milik Guru atau sentinel admin). */
  schoolId: string;
}

/**
 * Memvalidasi klaim dan menurunkan konteks tenancy (deny-by-default).
 *
 * Melempar `InvalidTenantClaimsError` bila:
 * - peran bukan `admin`/`teacher`;
 * - peran `teacher` namun `schoolId` `null`/kosong/bukan UUID yang sah.
 */
function deriveTenantContext(claims: SessionClaims): TenantContext {
  if (!isValidRole(claims.role)) {
    throw new InvalidTenantClaimsError(
      'Peran pada klaim sesi tidak valid; akses ditolak (deny-by-default).',
    );
  }

  if (claims.role === 'teacher') {
    const schoolId = claims.schoolId;
    if (schoolId === null || !isUuid(schoolId)) {
      throw new InvalidTenantClaimsError(
        'Klaim Guru tidak memiliki school_id yang valid; akses ditolak ' +
          '(deny-by-default).',
      );
    }
    return { role: 'teacher', schoolId };
  }

  // role === 'admin': schoolId boleh null → pakai sentinel non-tenant.
  // Bila admin kebetulan membawa schoolId, nilainya tetap harus berupa UUID sah;
  // jika tidak, tolak agar tidak menetapkan nilai konteks yang ambigu.
  if (claims.schoolId !== null && !isUuid(claims.schoolId)) {
    throw new InvalidTenantClaimsError(
      'school_id pada klaim admin tidak berbentuk UUID yang valid; akses ' +
        'ditolak (deny-by-default).',
    );
  }
  return {
    role: 'admin',
    schoolId: claims.schoolId ?? NON_TENANT_SCHOOL_SENTINEL,
  };
}

/**
 * Menjalankan `fn` di dalam satu transaksi dengan konteks tenancy RLS terset.
 *
 * Alur:
 * 1. Validasi klaim (deny-by-default) — jika invalid, lempar TANPA menyentuh DB.
 * 2. Ambil koneksi dari pool, `BEGIN`.
 * 3. `set_config(app.current_user_role, ...)` dan
 *    `set_config(app.current_school_id, ...)` — keduanya lokal transaksi,
 *    ditetapkan SEBELUM statement data pertama.
 * 4. Jalankan `fn(tx)`; `COMMIT` bila sukses.
 * 5. `ROLLBACK` pada error apa pun lalu lempar ulang.
 *
 * @typeParam T Tipe nilai hasil `fn`.
 * @param claims Klaim sesi terverifikasi (dari Session_Guard).
 * @param fn Callback yang menerima klien transaksi untuk menjalankan query.
 */
export async function withTenantTransaction<T>(
  claims: SessionClaims,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  // 1. Deny-by-default: klaim invalid tidak pernah membuka transaksi data.
  const context = deriveTenantContext(claims);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // 2. Set konteks sesi SEBELUM statement data pertama, via parameterisasi
    //    aman (bukan interpolasi string). Argumen ke-3 `true` = SET LOCAL.
    //    Kedua variabel disetel dalam SATU query (hemat satu round-trip).
    await client.query(
      'SELECT set_config($1, $2, true), set_config($3, $4, true)',
      [SESSION_VAR_ROLE, context.role, SESSION_VAR_SCHOOL_ID, context.schoolId],
    );

    // 3. Jalankan logika pemanggil di bawah RLS.
    const result = await fn(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    // 4. ROLLBACK pada error apa pun; tidak menetapkan konteks default.
    try {
      await client.query('ROLLBACK');
    } catch {
      // Abaikan error rollback agar error asli tidak tertutupi.
    }
    throw error;
  } finally {
    client.release();
  }
}
