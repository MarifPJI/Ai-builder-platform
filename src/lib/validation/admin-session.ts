/**
 * Validasi bentuk untuk edit SESI oleh Admin (feat-002-admin-school-write).
 *
 * Hanya validasi bentuk (zod); tidak menyentuh basis data dan TIDAK ber-`server-only`
 * agar dapat diuji unit tanpa menjalankan modul service. `scheduleSessionSchema`
 * (class.ts) tidak dapat dipakai untuk nama saja karena ia objek wajib penuh
 * ({classId, materialId, name, scheduledAt}); karena itu `sessionNameSchema`
 * didefinisikan berdiri sendiri, hanya mengimpor konstanta `SESSION_NAME_MAX`.
 */

import { z } from 'zod';

import { SESSION_NAME_MAX } from './class';

/** Skema nama sesi untuk edit admin (trim, wajib, maksimum SESSION_NAME_MAX). */
export const sessionNameSchema = z
  .string({ required_error: 'Nama sesi wajib diisi.' })
  .trim()
  .min(1, { message: 'Nama sesi wajib diisi.' })
  .max(SESSION_NAME_MAX, { message: `Nama sesi maksimum ${SESSION_NAME_MAX} karakter.` });
