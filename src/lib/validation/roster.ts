/**
 * Validasi daftar siswa kelas (T02) — fitur course-class-publishing.
 *
 * Mendukung dua mode input (R4.3, R4.4):
 *  - Roster_Bulk: tempel daftar baris `NIS, Nama` atau CSV (maks 1.000 baris).
 *  - Roster_Manual: satu siswa (NIS + Nama Lengkap).
 *
 * Hanya validasi bentuk (zod/parsing); tidak menyentuh basis data. Mengembalikan
 * hasil valid/invalid + alasan agar pemanggil (rosterService) dapat melewati
 * baris invalid dan menyusun ringkasan (R4.5).
 *
 * _Requirements: 4.3, 4.4, 4.5_
 */

import { z } from 'zod';

/** Batas maksimum baris roster pada satu impor (R4.3). */
export const MAX_ROSTER_ROWS = 1000 as const;

export const FULL_NAME_MIN = 1;
export const FULL_NAME_MAX = 150;

export const studentSchema = z.object({
  nis: z
    .string({ required_error: 'NIS wajib diisi.' })
    .trim()
    .min(1, { message: 'NIS wajib diisi.' })
    .max(50, { message: 'NIS maksimum 50 karakter.' }),
  fullName: z
    .string({ required_error: 'Nama lengkap wajib diisi.' })
    .trim()
    .min(FULL_NAME_MIN, { message: 'Nama lengkap wajib diisi.' })
    .max(FULL_NAME_MAX, { message: `Nama lengkap maksimum ${FULL_NAME_MAX} karakter.` }),
});
export type StudentInput = z.infer<typeof studentSchema>;

export interface RawStudentRow {
  nis?: unknown;
  fullName?: unknown;
}

export type StudentRowResult =
  | { valid: true; value: StudentInput }
  | { valid: false; reason: string };

/** Memvalidasi satu baris siswa tanpa menyentuh DB (R4.4). */
export function parseStudentRow(input: RawStudentRow): StudentRowResult {
  const result = studentSchema.safeParse(input);
  if (result.success) {
    return { valid: true, value: result.data };
  }
  const reason = result.error.issues.map((i) => i.message).join(' ') || 'Baris tidak valid.';
  return { valid: false, reason };
}

/**
 * Mem-parse teks roster `Input Sekaligus` menjadi baris mentah. Format tiap baris:
 * `NIS, Nama` (pemisah koma; Nama boleh mengandung spasi). Mendukung pemisah
 * tab juga. Baris kosong dilewati (tidak dihitung). Penomoran `line` berbasis-1
 * atas baris non-kosong.
 */
export function parseRosterText(text: string): RawStudentRow[] {
  const rows: RawStudentRow[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (line === '') {
      continue;
    }
    // Pisah pada koma atau tab pertama → NIS, sisanya Nama.
    const sep = line.search(/[,\t]/);
    if (sep === -1) {
      rows.push({ nis: line, fullName: undefined });
      continue;
    }
    const nis = line.slice(0, sep).trim();
    const fullName = line.slice(sep + 1).trim();
    rows.push({ nis, fullName });
  }
  return rows;
}
