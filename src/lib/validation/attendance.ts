/**
 * Validasi presensi & jurnal sesi (T06B) — fitur teacher-ui.
 *
 * Hanya validasi bentuk (zod/parsing); tidak menyentuh basis data. Konsisten
 * dengan `roster.ts`/`class.ts` (form-only). Dipakai oleh `attendance-service`
 * dan Server Actions presensi.
 *
 * Status "belum ditandai" TIDAK dimodelkan di sini: ia direpresentasikan oleh
 * ketiadaan baris `session_attendance` (Decision 2), bukan nilai sentinel.
 * Karena itu enum hanya memuat empat nilai status nyata.
 */

import { z } from 'zod';

/** Empat nilai status kehadiran nyata (selaras CHECK constraint di 0013). */
export const ATTENDANCE_STATUSES = ['hadir', 'sakit', 'izin', 'alfa'] as const;

/** Skema satu nilai status kehadiran. */
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);

/** Tipe status kehadiran (`'hadir' | 'sakit' | 'izin' | 'alfa'`). */
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

/** Batas maksimum entri presensi pada satu simpan (selaras MAX_ROSTER_ROWS). */
export const MAX_ATTENDANCE_ENTRIES = 1000 as const;

/** Skema satu entri presensi: siswa (UUID) + status. */
export const attendanceEntrySchema = z.object({
  studentId: z.string().uuid({ message: 'Siswa tidak valid.' }),
  status: attendanceStatusSchema,
});

/** Skema array entri presensi dengan batas MAX_ATTENDANCE_ENTRIES. */
export const attendanceEntriesSchema = z
  .array(attendanceEntrySchema)
  .max(MAX_ATTENDANCE_ENTRIES, { message: 'Jumlah entri presensi melebihi batas.' });

/** Batas maksimum panjang catatan jurnal sesi. */
export const JOURNAL_NOTES_MAX = 2000;

/** Skema catatan jurnal sesi: string opsional (boleh null). */
export const journalNotesSchema = z
  .string()
  .trim()
  .max(JOURNAL_NOTES_MAX, { message: `Catatan maksimum ${JOURNAL_NOTES_MAX} karakter.` })
  .nullable();
