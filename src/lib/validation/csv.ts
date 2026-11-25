/**
 * Validasi baris CSV impor akun Guru untuk fitur identity-tenancy.
 *
 * Berkas ini menyediakan:
 * - Skema satu baris CSV Guru (`teacherCsvRowSchema`): email (format valid,
 *   maks 254), nama lengkap (1–150 karakter), dan `school_id` (UUID).
 * - Fungsi parse satu baris (`parseTeacherCsvRow`) yang mengembalikan hasil
 *   valid/invalid beserta alasan penolakan berbahasa Indonesia — untuk
 *   menopang pembuatan `ImportSummary`/`RejectedRow` pada domain service
 *   (task 10.4, `importTeachersCsv`).
 * - Konstanta `MAX_CSV_ROWS = 1000` sebagai batas jumlah baris CSV. Penegakan
 *   batas ini dilakukan di domain service; di sini konstanta hanya diekspor
 *   sebagai sumber kebenaran tunggal.
 *
 * Berkas ini TIDAK melakukan query basis data. Validasi referensial
 * `school_id` (apakah terdaftar di tabel `schools`) dilakukan di schoolService
 * (task 10.1). Validasi di sini hanya bentuk/format.
 *
 * _Requirements: 3.6, 3.7, 5.2, 5.3_
 */

import { z } from 'zod';

import { schoolIdSchema } from './school';

/**
 * Batas maksimum jumlah baris pada satu berkas CSV impor Guru (Requirement 3.5).
 * Penegakan jumlah baris dilakukan di domain service (`importTeachersCsv`,
 * task 10.4); konstanta ini adalah sumber kebenaran tunggal batas tersebut.
 */
export const MAX_CSV_ROWS = 1000 as const;

/** Batas panjang kolom email resmi (Requirement 3.6, sejalan R1.1). */
export const EMAIL_MAX_LENGTH = 254 as const;

/** Batas panjang kolom nama lengkap (Requirement 3.6). */
export const FULL_NAME_MIN_LENGTH = 1 as const;
export const FULL_NAME_MAX_LENGTH = 150 as const;

/**
 * Pesan kesalahan berbahasa Indonesia untuk tiap kolom baris CSV.
 */
export const CSV_ROW_MESSAGES = {
  emailRequired: 'Email resmi wajib diisi.',
  emailInvalid: 'Format email resmi tidak valid.',
  emailTooLong: `Email resmi maksimum ${EMAIL_MAX_LENGTH} karakter.`,
  fullNameRequired: 'Nama lengkap wajib diisi.',
  fullNameTooShort: `Nama lengkap minimum ${FULL_NAME_MIN_LENGTH} karakter.`,
  fullNameTooLong: `Nama lengkap maksimum ${FULL_NAME_MAX_LENGTH} karakter.`,
} as const;

/**
 * Skema satu baris CSV Guru.
 *
 * - `email`: dipangkas, format alamat email valid, maksimum 254 karakter.
 * - `fullName`: dipangkas, panjang 1–150 karakter.
 * - `schoolId`: UUID yang sah (bentuk saja; referensial dicek di schoolService).
 */
export const teacherCsvRowSchema = z.object({
  email: z
    .string({ required_error: CSV_ROW_MESSAGES.emailRequired })
    .trim()
    .min(1, { message: CSV_ROW_MESSAGES.emailRequired })
    .max(EMAIL_MAX_LENGTH, { message: CSV_ROW_MESSAGES.emailTooLong })
    .email({ message: CSV_ROW_MESSAGES.emailInvalid }),
  fullName: z
    .string({ required_error: CSV_ROW_MESSAGES.fullNameRequired })
    .trim()
    .min(FULL_NAME_MIN_LENGTH, { message: CSV_ROW_MESSAGES.fullNameTooShort })
    .max(FULL_NAME_MAX_LENGTH, { message: CSV_ROW_MESSAGES.fullNameTooLong }),
  schoolId: schoolIdSchema,
});

/**
 * Baris CSV Guru yang sudah tervalidasi (bentuk).
 */
export type TeacherCsvRow = z.infer<typeof teacherCsvRowSchema>;

/**
 * Masukan mentah satu baris CSV sebelum validasi. Semua kolom opsional/`unknown`
 * karena berasal dari sumber eksternal yang tidak tepercaya.
 */
export interface RawTeacherCsvRow {
  email?: unknown;
  fullName?: unknown;
  schoolId?: unknown;
}

/**
 * Hasil parse satu baris CSV.
 *
 * - `valid: true`  → `value` berisi baris yang sudah tervalidasi & dipangkas.
 * - `valid: false` → `reason` berisi alasan penolakan gabungan (Bahasa
 *   Indonesia); `reasons` berisi daftar alasan per kolom untuk keperluan
 *   diagnostik. Bentuk ini menopang `RejectedRow { line, reason }` di
 *   `importTeachersCsv` (task 10.4).
 */
export type TeacherCsvRowResult =
  | { valid: true; value: TeacherCsvRow }
  | { valid: false; reason: string; reasons: string[] };

/**
 * Memvalidasi (parse) satu baris CSV Guru tanpa menyentuh basis data.
 *
 * Mengembalikan hasil valid/invalid, bukan melempar exception, sehingga
 * pemanggil (domain service) dapat melewati baris invalid dan tetap memproses
 * baris valid (Requirement 3.7).
 */
export function parseTeacherCsvRow(input: RawTeacherCsvRow): TeacherCsvRowResult {
  const result = teacherCsvRowSchema.safeParse(input);
  if (result.success) {
    return { valid: true, value: result.data };
  }

  const reasons = result.error.issues.map((issue) => issue.message);
  // Jaga agar `reason` tidak pernah kosong meski (secara teori) tak ada issue.
  const reason = reasons.length > 0 ? reasons.join(' ') : 'Baris CSV tidak valid.';
  return { valid: false, reason, reasons };
}
