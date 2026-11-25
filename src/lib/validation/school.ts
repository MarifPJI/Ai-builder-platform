/**
 * Validasi bentuk (shape) `school_id` untuk fitur identity-tenancy.
 *
 * Lingkup berkas ini SENGAJA dibatasi pada validasi bentuk saja:
 * memastikan sebuah nilai berbentuk UUID yang sah. Berkas ini TIDAK melakukan
 * query basis data apa pun.
 *
 * Validasi referensial — yakni apakah `school_id` benar-benar TERDAFTAR pada
 * tabel `schools` (Requirements 5.2, 5.3) — memerlukan akses basis data dan
 * dilakukan di domain service `schoolService.schoolExists(...)`
 * (lihat task 10.1, `src/lib/domain/school-service.ts`) yang dijalankan di
 * bawah RLS melalui `withTenantTransaction`. Jangan menambahkan query DB di
 * berkas ini.
 *
 * _Requirements: 5.2, 5.3_
 */

import { z } from 'zod';

/**
 * Pesan kesalahan berbahasa Indonesia untuk validasi `school_id`.
 * Diekspor agar dapat dipakai ulang (mis. oleh validasi baris CSV).
 */
export const SCHOOL_ID_MESSAGES = {
  required: 'ID sekolah wajib diisi.',
  invalidUuid: 'ID sekolah harus berupa UUID yang valid.',
} as const;

/**
 * Skema bentuk `school_id`: string UUID yang sah.
 *
 * Catatan: ini hanya memeriksa BENTUK (format UUID), bukan keberadaan baris
 * pada tabel `schools`. Pemeriksaan referensial dilakukan di schoolService.
 */
export const schoolIdSchema = z
  .string({ required_error: SCHOOL_ID_MESSAGES.required })
  .trim()
  .uuid({ message: SCHOOL_ID_MESSAGES.invalidUuid });

/**
 * Tipe `school_id` yang sudah tervalidasi bentuknya (UUID).
 */
export type SchoolId = z.infer<typeof schoolIdSchema>;

/**
 * Hasil validasi bentuk `school_id`.
 * - `valid: true`  → `value` berisi UUID yang sudah dipangkas (trim).
 * - `valid: false` → `reason` berisi alasan penolakan berbahasa Indonesia.
 */
export type SchoolIdShapeResult =
  | { valid: true; value: SchoolId }
  | { valid: false; reason: string };

/**
 * Memvalidasi BENTUK sebuah `school_id` tanpa menyentuh basis data.
 *
 * Gunakan fungsi ini untuk menolak input yang jelas tidak berbentuk UUID
 * sebelum melakukan pemeriksaan referensial yang lebih mahal (DB) di
 * schoolService.
 */
export function validateSchoolIdShape(input: unknown): SchoolIdShapeResult {
  const result = schoolIdSchema.safeParse(input);
  if (result.success) {
    return { valid: true, value: result.data };
  }
  const firstIssue = result.error.issues[0];
  return {
    valid: false,
    reason: firstIssue?.message ?? SCHOOL_ID_MESSAGES.invalidUuid,
  };
}
