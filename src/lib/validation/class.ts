/**
 * Validasi masukan Kelas & Sesi (T02) — fitur course-class-publishing.
 *
 * Hanya validasi bentuk (zod); tidak menyentuh basis data. `school_id` TIDAK
 * divalidasi di sini karena ditetapkan server dari klaim Session_Guard (bukan
 * input klien) — lihat classService.
 *
 * _Requirements: 4.2, 6.1_
 */

import { z } from 'zod';

import { schoolIdSchema } from './school';

export const CLASS_NAME_MAX = 120;
export const SESSION_NAME_MAX = 160;

/** Skema pembuatan Kelas (R4.2). `materialId` opsional (Materi published). */
export const createClassSchema = z.object({
  name: z
    .string({ required_error: 'Nama kelas wajib diisi.' })
    .trim()
    .min(1, { message: 'Nama kelas wajib diisi.' })
    .max(CLASS_NAME_MAX, { message: `Nama kelas maksimum ${CLASS_NAME_MAX} karakter.` }),
  gradeLevel: z.string().trim().max(50).optional(),
  materialId: z.string().uuid({ message: 'Materi tidak valid.' }).optional(),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

/**
 * Skema penjadwalan Sesi (R6.1). `scheduledAt` ISO 8601 → disimpan timestamptz UTC.
 *
 * Dua bentuk masukan:
 *   - `sessionKind` diisi (form baru): nama sesi DIBUAT server dari tipe + judul
 *     Materi; `name` diabaikan.
 *   - `sessionKind` kosong (kompatibilitas lama): `name` teks bebas wajib diisi.
 * Nilai tipe sengaja ditulis literal (bukan impor dari session-plan) untuk
 * menghindari impor melingkar.
 */
export const scheduleSessionSchema = z
  .object({
    classId: z.string().uuid({ message: 'Kelas tidak valid.' }),
    materialId: z.string().uuid({ message: 'Materi tidak valid.' }),
    sessionKind: z
      .enum(['full', 'part', 'final', 'extra'], {
        errorMap: () => ({ message: 'Jenis sesi tidak valid.' }),
      })
      .optional(),
    name: z
      .string()
      .trim()
      .max(SESSION_NAME_MAX, { message: `Nama sesi maksimum ${SESSION_NAME_MAX} karakter.` })
      .optional(),
    scheduledAt: z
      .string({ required_error: 'Tanggal & jam sesi wajib diisi.' })
      .datetime({ offset: true, message: 'Tanggal & jam sesi tidak valid.' }),
  })
  .superRefine((value, ctx) => {
    if (!value.sessionKind && !value.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Nama sesi wajib diisi.' });
    }
  });
export type ScheduleSessionInput = z.infer<typeof scheduleSessionSchema>;

// Re-ekspor agar pemanggil punya satu tempat impor validasi school_id bentuk.
export { schoolIdSchema };
