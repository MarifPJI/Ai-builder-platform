/**
 * `schoolService` — typed domain service untuk entitas `schools`
 * (fitur identity-tenancy).
 *
 * Kontrak (design.md > Components and Interfaces > Typed domain services):
 *
 *   interface SchoolService {
 *     listSchools(claims): Promise<School[]>;               // R5.4 (admin)
 *     schoolExists(claims, schoolId): Promise<boolean>;     // R5.2, R5.3
 *   }
 *
 * Tanggung jawab:
 * - `listSchools(claims)`  — mengembalikan daftar sekolah (hingga 50 sekolah
 *   mitra) beserta zona waktu IANA untuk layar A02. Ditujukan untuk `admin`
 *   (RLS admin membaca lintas sekolah).
 * - `schoolExists(claims, schoolId)` — validasi REFERENSIAL: memeriksa apakah
 *   sebuah `school_id` benar-benar terdaftar pada tabel `schools`. Dipakai
 *   sebelum pembuatan akun Guru (R5.2/R5.3). Berbeda dari validasi BENTUK UUID
 *   di `src/lib/validation/school.ts` yang tidak menyentuh basis data.
 *
 * KONTRAK SESI (penting):
 *   Service ini MENERIMA `claims` yang SUDAH terverifikasi dan TIDAK memanggil
 *   `requireSession` sendiri. Pemanggilan `requireSession` dilakukan di lapisan
 *   UI / Server Action (lihat task 14.1 untuk A02 dan task 15.1 untuk A03)
 *   SEBELUM memanggil service ini. Pemisahan ini menjaga service tetap murni
 *   dari dependensi HTTP/redirect dan mudah diuji.
 *
 * Semua operasi WAJIB dijalankan melalui `withTenantTransaction(claims, ...)`
 * sehingga query berjalan di bawah PostgreSQL Row-Level Security (RLS) dengan
 * konteks tenancy (`SET LOCAL app.current_user_role` / `app.current_school_id`)
 * yang diturunkan dari klaim. Query memakai parameterisasi (`$1`) — tidak ada
 * interpolasi string — untuk mencegah injeksi SQL.
 *
 * _Requirements: 5.2, 5.3, 5.4_
 */

import 'server-only';

import type { PoolClient } from 'pg';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';

/**
 * Representasi sebuah sekolah di lapisan domain/TypeScript.
 *
 * Nama field memakai camelCase hasil pemetaan dari kolom DB snake_case:
 *   school_id      -> schoolId
 *   name           -> name
 *   iana_timezone  -> ianaTimezone
 *   created_at     -> createdAt
 *
 * `createdAt` adalah `Date` (timestamptz UTC; driver `pg` mengembalikan `Date`).
 * Tampilan per zona waktu sekolah dilakukan di lapisan UI memakai
 * `ianaTimezone` (R5.5).
 */
export interface School {
  /** UUID primary key sekolah (`schools.school_id`). */
  schoolId: string;
  /** Nama sekolah (`schools.name`). */
  name: string;
  /**
   * Zona waktu IANA sekolah (`schools.iana_timezone`), salah satu dari
   * `'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura'` (ditegakkan oleh
   * CHECK constraint pada skema).
   */
  ianaTimezone: string;
  /** Waktu pembuatan baris (`schools.created_at`), timestamptz UTC. */
  createdAt: Date;
}

/**
 * Kontrak typed untuk layanan sekolah. Implementasi konkret diekspor sebagai
 * objek `schoolService` di bawah.
 */
export interface SchoolService {
  /** R5.4 — admin melihat daftar sekolah + zona waktu (layar A02). */
  listSchools(claims: SessionClaims): Promise<School[]>;
  /** R5.2, R5.3 — validasi referensial `school_id` terhadap tabel `schools`. */
  schoolExists(claims: SessionClaims, schoolId: string): Promise<boolean>;
  /** teacher-ui — nama sekolah untuk kapsul topbar (label terkunci). */
  getSchoolName(claims: SessionClaims, schoolId: string): Promise<string | null>;
}

/**
 * Bentuk baris mentah dari tabel `schools` sebagaimana dikembalikan `pg`.
 * Kolom memakai snake_case sesuai DDL (`db/migrations/0001_init_schema.sql`).
 */
interface SchoolRow {
  school_id: string;
  name: string;
  iana_timezone: string;
  created_at: Date;
}

/** Memetakan satu baris DB (snake_case) ke tipe domain `School` (camelCase). */
function mapSchoolRow(row: SchoolRow): School {
  return {
    schoolId: row.school_id,
    name: row.name,
    ianaTimezone: row.iana_timezone,
    createdAt: row.created_at,
  };
}

/**
 * Mengembalikan daftar sekolah beserta zona waktu IANA (R5.4).
 *
 * Dijalankan di bawah RLS via `withTenantTransaction`: untuk `admin`, kebijakan
 * RLS admin mengizinkan baca lintas sekolah. Untuk peran lain, RLS akan
 * membatasi/menolak baris sesuai kebijakan tenancy — service ini tidak
 * menambahkan pengecekan peran tersendiri karena otorisasi akhir ditegakkan
 * oleh RLS + Session_Guard di lapisan pemanggil.
 *
 * Hasil diurutkan berdasarkan `name` agar tampilan A02 stabil/konsisten.
 *
 * @param claims Klaim sesi terverifikasi (dari `requireSession` di pemanggil).
 * @returns Daftar `School` (bisa kosong bila RLS tidak mengizinkan baris apa pun).
 */
export async function listSchools(
  claims: SessionClaims,
): Promise<School[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SchoolRow>(
      `SELECT school_id, name, iana_timezone, created_at
         FROM schools
        ORDER BY name ASC`,
    );
    return result.rows.map(mapSchoolRow);
  });
}

/**
 * Memeriksa apakah sebuah `school_id` terdaftar pada tabel `schools` — validasi
 * referensial yang dipakai sebelum pembuatan akun Guru (R5.2/R5.3).
 *
 * Memakai `SELECT 1 ... WHERE school_id = $1 LIMIT 1` yang terparameterisasi
 * (tanpa interpolasi string). Query berjalan di bawah RLS via
 * `withTenantTransaction`.
 *
 * @param claims   Klaim sesi terverifikasi (dari `requireSession` di pemanggil).
 * @param schoolId UUID sekolah yang hendak divalidasi keberadaannya.
 * @returns `true` jika sekolah terdaftar (dan terlihat di bawah RLS), selain
 *          itu `false`.
 */
export async function schoolExists(
  claims: SessionClaims,
  schoolId: string,
): Promise<boolean> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `SELECT 1
         FROM schools
        WHERE school_id = $1
        LIMIT 1`,
      [schoolId],
    );
    return result.rowCount !== null && result.rowCount > 0;
  });
}

/**
 * Mengembalikan nama sekolah berdasarkan `schoolId` untuk label kapsul topbar
 * (teacher-ui, Decision 3). Berjalan di bawah RLS via `withTenantTransaction`:
 * `schools_teacher_scope` (0002) mengizinkan Guru membaca baris sekolahnya
 * sendiri, sehingga tidak pernah mengekspos lookup lintas sekolah.
 *
 * Memakai `SELECT name FROM schools WHERE school_id = $1 LIMIT 1` yang
 * terparameterisasi. Mengembalikan `row.name` bila ada, selain itu `null`.
 *
 * @param claims   Klaim sesi terverifikasi (dari `requireSession` di pemanggil).
 * @param schoolId UUID sekolah yang namanya hendak diambil.
 * @returns Nama sekolah, atau `null` bila RLS tidak mengembalikan baris.
 */
export async function getSchoolName(
  claims: SessionClaims,
  schoolId: string,
): Promise<string | null> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<{ name: string }>(
      `SELECT name
         FROM schools
        WHERE school_id = $1
        LIMIT 1`,
      [schoolId],
    );
    return result.rows[0]?.name ?? null;
  });
}

/**
 * Implementasi konkret `SchoolService` sebagai objek tunggal agar dapat
 * dipanggil dengan gaya `schoolService.listSchools(...)` sesuai kontrak desain,
 * sembari tetap mengekspor fungsi individual di atas untuk kemudahan impor/uji.
 */
export const schoolService: SchoolService = {
  listSchools,
  schoolExists,
  getSchoolName,
};
