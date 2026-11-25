/**
 * Tipe inti identitas & klaim sesi — SATU SUMBER KEBENARAN (single source of
 * truth) untuk `Role` dan `SessionClaims` di seluruh aplikasi.
 *
 * Bentuk tipe ini PERSIS mengikuti kontrak pada design.md
 * (> Components and Interfaces > Auth_Service):
 *
 *   type Role = 'admin' | 'teacher';
 *   interface SessionClaims {
 *     cognitoSub: string;
 *     email: string;
 *     role: Role;
 *     schoolId: string | null;
 *   }
 *
 * Lapisan lain WAJIB mengimpor tipe ini dari sini, bukan mendefinisikan ulang.
 * Khususnya `src/lib/db/types.ts` kini melakukan re-export dari modul ini agar
 * konteks tenancy (`SET LOCAL`) pada lapisan DB memakai bentuk klaim yang sama.
 *
 * Catatan sisi-server: file ini HANYA berisi deklarasi tipe (dihapus saat
 * kompilasi) sehingga aman diimpor dari mana pun. Konfigurasi dan klien Cognito
 * yang mengandung logika sisi-server berada di `./cognito.ts`.
 *
 * _Requirements: 1.6, 2.4_
 */

/**
 * Peran pengguna di sistem. Hanya dua peran yang diizinkan (aturan
 * non-negotiable): `admin` dan `teacher`. Nilainya selaras dengan dua grup
 * Cognito User Pool dan CHECK constraint `role` pada tabel `profiles`.
 *
 * Peran selalu ditentukan server dari klaim token JWT, tidak pernah dari input
 * klien (R1.2/R1.3).
 */
export type Role = 'admin' | 'teacher';

/**
 * Klaim sesi terverifikasi yang diekstrak dari token JWT Cognito oleh
 * Session_Guard. Nilai-nilai ini menjadi sumber konteks tenancy (`SET LOCAL`)
 * pada lapisan transaksi DB.
 *
 * Invarian penting:
 * - Untuk `role === 'teacher'`, `schoolId` WAJIB berupa string UUID non-null.
 *   Guru tanpa `schoolId` adalah klaim invalid → deny-by-default (R4.2, R4.8).
 * - Untuk `role === 'admin'`, `schoolId` BOLEH `null` (admin lintas sekolah).
 */
export interface SessionClaims {
  /**
   * ID pengguna Supabase Auth (`sub`, = `auth.users.id`). Nama `cognitoSub` dan
   * kolom `profiles.cognito_sub` dipertahankan dari era Cognito agar tidak
   * mengubah banyak pemanggil/kebijakan RLS; isinya kini UUID Supabase.
   */
  cognitoSub: string;
  /** Email resmi pengguna sesuai klaim token. */
  email: string;
  /** Peran efektif pengguna, diambil dari grup/klaim token. */
  role: Role;
  /**
   * `school_id` (UUID) milik Guru; `null` hanya untuk admin.
   * Untuk teacher, nilai `null` menandakan klaim invalid.
   */
  schoolId: string | null;
}
