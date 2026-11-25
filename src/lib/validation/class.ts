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

/** Skema penjadwalan Sesi (R6.1). `scheduledAt` ISO 8601 → disimpan timestamptz UTC. */
export const scheduleSessionSchema = z.object({
  classId: z.string().uuid({ message: 'Kelas tidak valid.' }),
  materialId: z.string().uuid({ message: 'Materi tidak valid.' }),
  name: z
    .string({ required_error: 'Nama sesi wajib diisi.' })
    .trim()
    .min(1, { message: 'Nama sesi wajib diisi.' })
    .max(SESSION_NAME_MAX, { message: `Nama sesi maksimum ${SESSION_NAME_MAX} karakter.` }),
  scheduledAt: z
    .string({ required_error: 'Tanggal & jam sesi wajib diisi.' })
    .datetime({ offset: true, message: 'Tanggal & jam sesi tidak valid.' }),
});
export type ScheduleSessionInput = z.infer<typeof scheduleSessionSchema>;

// Re-ekspor agar pemanggil punya satu tempat impor validasi school_id bentuk.
export { schoolIdSchema };
