/**
 * Session_Guard — `requireSession` deny-by-default.
 *
 * Dipanggil di AWAL setiap Server Action / Route Handler sebelum logika bisnis
 * apa pun berjalan (lihat design.md > Components and Interfaces > Session_Guard
 * dan > Model Tenancy Dua Lapis > Lapis 1). Guard ini adalah lapis pertama dari
 * model tenancy dua lapis; lapis kedua adalah RLS pada PostgreSQL yang
 * ditegakkan oleh `withTenantTransaction`.
 *
 * Kontrak perilaku (deny-by-default menyeluruh):
 *   1. Ambil JWT dari sumber sesi server (cookie httpOnly). Bila JWT tidak ada
 *      → perlakukan sebagai TIDAK terautentikasi → redirect ke Login_Screen
 *      (`U01`) (R1.10).
 *   2. `verifyToken(jwt)` via Auth_Service. JWT invalid/kedaluwarsa → `verify`
 *      melempar → ditangani sebagai TIDAK terautentikasi → redirect ke `U01`
 *      (R1.10). Klaim `role`/`school_id` hilang/tak lengkap juga melempar di
 *      `verifyToken` → deny-by-default (R4.2, R4.8).
 *   3. Cek aktivasi: untuk `teacher`, buka `withTenantTransaction(claims, ...)`
 *      dan `SELECT activation_status` dari baris `profiles` miliknya (via
 *      `cognito_sub`) DI BAWAH RLS. Bila `!= 'active'` (termasuk `pending` atau
 *      baris tak terbaca) → tolak & arahkan hubungi Admin (R2.1, R2.2). Admin
 *      TIDAK perlu cek aktivasi (lihat catatan "Kebijakan aktivasi" di bawah).
 *   4. `requireRole`: bila `opts.requireRole` ada dan `role` klaim `!=`
 *      `requireRole` → `Access_Denied_Screen` (`X04`) (R3.12).
 *   5. Isolasi lintas sekolah: `teacher` yang mengakses sumber daya di luar
 *      `school_id` miliknya → `X04` (R4.6). Lihat opsi `resourceSchoolId`.
 *
 * ── Pembacaan token (dapat di-inject / di-mock) ─────────────────────────────
 * Mekanisme penyimpanan token akan dirangkai di layar `U01` (task 13.x).
 * Agar guard dapat diuji (PBT task 8.2) tanpa bergantung pada implementasi
 * penyimpanan, token dibaca melalui helper `SessionTokenReader` yang DAPAT
 * DI-INJECT. Default produksi (`defaultSessionTokenReader`) membaca cookie
 * httpOnly bernama `SESSION_COOKIE_NAME` via `next/headers` `cookies()`. Task
 * 13.x cukup menuliskan token ke cookie tersebut saat login berhasil.
 *
 * ── Kontrak penolakan (X04 & U01 belum ada) ─────────────────────────────────
 * Layar `X04` (task 16.1) dan `U01` (task 13.x) belum diimplementasikan.
 * Agar tidak memutus kompilasi dan tetap testable, guard memakai dua handler
 * yang dapat di-inject:
 *   - `onUnauthenticated()` — default memanggil `redirect(LOGIN_PATH)` dari
 *     `next/navigation`. `redirect()` melempar secara internal sehingga eksekusi
 *     Server Action berhenti (tipe kembalian `never`).
 *   - `onAccessDenied(reason)` — default MELEMPAR `AccessDeniedError`. Task 16.1
 *     akan memetakan error ini ke render `Access_Denied_Screen` (`X04`),
 *     mis. melalui `error.tsx` boundary atau penangkap di Route Handler.
 * Guru `pending`/non-aktif ditangani sebagai kasus "arahkan hubungi Admin"
 * melalui `onInactiveTeacher()` yang default-nya MELEMPAR
 * `InactiveAccountError` (dipetakan task 13.x/16.1 ke pesan berbahasa Indonesia).
 *
 * ── Kebijakan aktivasi (admin vs teacher) ───────────────────────────────────
 * Hanya `teacher` yang memiliki siklus aktivasi (`pending` → `active`, R2.1,
 * R3.9). Admin dibuat/di-provision oleh proses administratif dan TIDAK melewati
 * alur aktivasi Guru, sehingga guard TIDAK memeriksa `activation_status` admin.
 * Keputusan ini selaras dengan constraint `teacher_requires_school` dan
 * kebijakan RLS (admin membaca lintas sekolah; teacher terikat `school_id`).
 *
 * ── Isolasi lintas sekolah (R4.6) ───────────────────────────────────────────
 * Penegakan utama isolasi tenancy berada pada RLS (`withTenantTransaction`
 * menyetel `app.current_school_id`; baris sekolah lain tidak pernah terbaca).
 * Namun untuk entry point yang menerima `school_id` sumber daya secara eksplisit
 * (mis. parameter path/route), guard menyediakan validasi dini opsional via
 * `opts.resourceSchoolId`: bila peran `teacher` dan `resourceSchoolId !=`
 * `claims.schoolId` → `X04` (R4.6) SEBELUM menyentuh DB. Bila `resourceSchoolId`
 * tidak diberikan, isolasi tetap ditegakkan oleh RLS pada lapis kedua.
 *
 * TypeScript strict; `import 'server-only'` memastikan modul ini tidak pernah
 * masuk bundel klien.
 *
 * _Requirements: 1.10, 2.1, 2.2, 2.3, 3.12, 4.2, 4.6, 4.7, 4.8_
 */

import 'server-only';

import { redirect } from 'next/navigation';
import type { PoolClient } from 'pg';

import { withTenantTransaction } from '@/lib/db/tenant-transaction';

import { getAuthService, type AuthService } from './auth-service';
import type { Role, SessionClaims } from './types';

/* ──────────────────────────────────────────────────────────────────────────
 * Konstanta
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Path layar login (`U01`). Guard mengarahkan ke sini saat permintaan tidak
 * terautentikasi (JWT hilang/invalid/kedaluwarsa) — R1.10.
 */
export const LOGIN_PATH = '/login' as const;

/**
 * Nama cookie httpOnly yang menyimpan JWT (ID token). Task 13.x (`U01`) menulis
 * cookie ini saat login berhasil; guard membacanya saat memverifikasi sesi.
 */
export const SESSION_COOKIE_NAME = 'id_token' as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Error khusus (dipetakan ke layar oleh task 13.x / 16.1)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Dilempar ketika akses ditolak karena peran/isolasi tenancy tidak terpenuhi.
 * Task 16.1 memetakan error ini ke `Access_Denied_Screen` (`X04`).
 * (R3.12, R4.6)
 */
export class AccessDeniedError extends Error {
  public constructor(message = 'Akses ditolak.') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

/**
 * Dilempar ketika akun Guru belum/aktif tidak lagi (`activation_status !=
 * 'active'`, termasuk baris tak terbaca). Dipetakan ke pesan berbahasa Indonesia
 * yang mengarahkan menghubungi Admin. (R2.1, R2.2)
 */
export class InactiveAccountError extends Error {
  public constructor(
    message = 'Akun Anda belum aktif. Silakan hubungi Admin sekolah Anda.',
  ) {
    super(message);
    this.name = 'InactiveAccountError';
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dependensi yang dapat di-inject (agar testable — PBT task 8.2)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Pembaca token sesi. Mengembalikan JWT mentah atau `null` bila tidak ada sesi.
 * Default produksi membaca cookie httpOnly via `next/headers`.
 */
export type SessionTokenReader = () => Promise<string | null>;

/**
 * Fungsi pengecek aktivasi: menerima klaim terverifikasi dan mengembalikan
 * `activation_status` dari baris `profiles` milik pengguna (via `cognito_sub`)
 * yang dibaca DI BAWAH RLS, atau `null` bila baris tidak terbaca/tidak ada.
 * Dibuat injectable agar PBT dapat memvariasikan status tanpa DB nyata.
 */
export type ActivationStatusReader = (
  claims: SessionClaims,
) => Promise<string | null>;

/**
 * Dependensi `requireSession`. Seluruhnya opsional dengan default produksi.
 */
export interface GuardDeps {
  /** Auth_Service untuk `verifyToken`. Default: singleton produksi. */
  readonly authService?: AuthService;
  /** Pembaca token sesi. Default: cookie httpOnly via `next/headers`. */
  readonly readToken?: SessionTokenReader;
  /** Pembaca `activation_status`. Default: query `profiles` via RLS. */
  readonly readActivationStatus?: ActivationStatusReader;
  /**
   * Dipanggil saat tidak terautentikasi (R1.10). Default: `redirect(LOGIN_PATH)`
   * (melempar; tipe `never`).
   */
  readonly onUnauthenticated?: () => never;
  /**
   * Dipanggil saat akses ditolak (peran/isolasi). Default: lempar
   * `AccessDeniedError` (dipetakan ke `X04`).
   */
  readonly onAccessDenied?: (reason: string) => never;
  /**
   * Dipanggil saat Guru tidak aktif. Default: lempar `InactiveAccountError`
   * (arahkan hubungi Admin).
   */
  readonly onInactiveTeacher?: () => never;
}

/**
 * Opsi `requireSession`.
 */
export interface GuardOptions {
  /** Bila diset, peran klaim WAJIB sama dengan nilai ini; selain itu `X04`. */
  readonly requireRole?: Role;
  /**
   * `school_id` sumber daya yang sedang diakses (opsional). Bila diberikan dan
   * peran `teacher` namun `!= claims.schoolId` → `X04` (R4.6). Untuk admin
   * diabaikan (admin lintas sekolah).
   */
  readonly resourceSchoolId?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Default dependensi produksi
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Pembaca token default: membaca cookie httpOnly `SESSION_COOKIE_NAME` via
 * `next/headers` `cookies()`. Diimpor secara dinamis agar modul `next/headers`
 * (khusus Server Component/Action) tidak dievaluasi saat guard diuji dengan
 * reader yang di-inject.
 */
export const defaultSessionTokenReader: SessionTokenReader = async () => {
  const { cookies } = await import('next/headers');
  const store = cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  return value && value.length > 0 ? value : null;
};

/**
 * Pembaca `activation_status` default: membuka `withTenantTransaction(claims)`
 * dan membaca baris `profiles` milik `cognito_sub` DI BAWAH RLS (R2.3).
 *
 * Untuk `teacher`, RLS membatasi baris pada `school_id` miliknya; baris Guru
 * tsb terbaca hanya bila konteks tenancy valid. Mengembalikan `null` bila baris
 * tidak terbaca/tidak ada (diperlakukan sebagai tidak aktif → deny-by-default).
 */
export const defaultActivationStatusReader: ActivationStatusReader = async (
  claims,
) =>
  withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<{ activation_status: string }>(
      'SELECT activation_status FROM profiles WHERE cognito_sub = $1 LIMIT 1',
      [claims.cognitoSub],
    );
    const row = result.rows[0];
    return row ? row.activation_status : null;
  });

/** Handler default: tidak terautentikasi → redirect ke `U01` (R1.10). */
function defaultOnUnauthenticated(): never {
  // `redirect` melempar internal (NEXT_REDIRECT) untuk menghentikan eksekusi.
  redirect(LOGIN_PATH);
}

/** Handler default: akses ditolak → `AccessDeniedError` (dipetakan ke `X04`). */
function defaultOnAccessDenied(reason: string): never {
  throw new AccessDeniedError(reason);
}

/** Handler default: Guru tidak aktif → `InactiveAccountError` (hubungi Admin). */
function defaultOnInactiveTeacher(): never {
  throw new InactiveAccountError();
}

/* ──────────────────────────────────────────────────────────────────────────
 * requireSession
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Memverifikasi sesi dan menegakkan deny-by-default sebelum logika bisnis.
 *
 * Mengembalikan `SessionClaims` terverifikasi HANYA bila seluruh pemeriksaan
 * lolos. Jika tidak, salah satu handler penolakan dipanggil (redirect ke `U01`,
 * `X04`, atau arahan hubungi Admin), yang masing-masing menghentikan eksekusi
 * (melempar). Dengan demikian pemanggil dapat mengasumsikan nilai balik selalu
 * berupa klaim yang valid & berhak.
 *
 * @param opts Opsi guard (`requireRole`, `resourceSchoolId`).
 * @param deps Dependensi injektabel (default produksi) — dipakai pengujian.
 */
export async function requireSession(
  opts: GuardOptions = {},
  deps: GuardDeps = {},
): Promise<SessionClaims> {
  const authService = deps.authService ?? getAuthService();
  const readToken = deps.readToken ?? defaultSessionTokenReader;
  const readActivationStatus =
    deps.readActivationStatus ?? defaultActivationStatusReader;
  const onUnauthenticated = deps.onUnauthenticated ?? defaultOnUnauthenticated;
  const onAccessDenied = deps.onAccessDenied ?? defaultOnAccessDenied;
  const onInactiveTeacher =
    deps.onInactiveTeacher ?? defaultOnInactiveTeacher;

  // 1. Ambil JWT dari sumber sesi server. Tidak ada token → tidak terautentikasi.
  const jwt = await readToken();
  if (!jwt) {
    return onUnauthenticated();
  }

  // 2. Verifikasi token & ekstrak klaim (peran/school_id SELALU dari token).
  //    JWT invalid/kedaluwarsa ATAU klaim tak lengkap → `verifyToken` melempar.
  //    Keduanya diperlakukan sebagai TIDAK terautentikasi → redirect `U01`
  //    (R1.10, R4.2, R4.8 — deny-by-default).
  let claims: SessionClaims;
  try {
    claims = await authService.verifyToken(jwt);
  } catch {
    return onUnauthenticated();
  }

  // 3. requireRole (R3.12): peran klaim harus sama dengan yang diminta.
  if (opts.requireRole !== undefined && claims.role !== opts.requireRole) {
    return onAccessDenied(
      `Peran '${claims.role}' tidak berhak mengakses sumber daya ini.`,
    );
  }

  // 4. Isolasi lintas sekolah dini (R4.6): teacher tak boleh mengakses
  //    sumber daya di luar school_id miliknya. (Lapis utama tetap RLS.)
  if (
    opts.resourceSchoolId !== undefined &&
    claims.role === 'teacher' &&
    opts.resourceSchoolId !== claims.schoolId
  ) {
    return onAccessDenied(
      'Guru tidak berhak mengakses sumber daya di luar sekolahnya.',
    );
  }

  // 5. Cek aktivasi untuk teacher (R2.1, R2.2). Admin tidak melewati aktivasi.
  if (claims.role === 'teacher') {
    let status: string | null;
    try {
      status = await readActivationStatus(claims);
    } catch {
      // Kegagalan/indeterminate saat membaca status → deny-by-default
      // (perlakukan sebagai tidak aktif) alih-alih membuka akses.
      return onInactiveTeacher();
    }
    if (status !== 'active') {
      return onInactiveTeacher();
    }
  }

  // Seluruh pemeriksaan lolos: kembalikan klaim terverifikasi & berhak.
  return claims;
}
