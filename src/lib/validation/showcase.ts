/**
 * Validasi formulir publik Kirim Proyek (public-showcase R4). Hanya bentuk (zod);
 * tanpa DB. Kategori bebas (string) agar fleksibel; batas panjang ditegakkan.
 *
 * _Requirements: 4.1, 4.3_
 */

import { z } from 'zod';

export const submitProjectSchema = z.object({
  name: z
    .string({ required_error: 'Nama siswa/tim wajib diisi.' })
    .trim()
    .min(1, { message: 'Nama siswa/tim wajib diisi.' })
    .max(120, { message: 'Nama maksimum 120 karakter.' }),
  schoolName: z
    .string({ required_error: 'Asal sekolah wajib diisi.' })
    .trim()
    .min(1, { message: 'Asal sekolah wajib diisi.' })
    .max(120, { message: 'Asal sekolah maksimum 120 karakter.' }),
  title: z
    .string({ required_error: 'Judul proyek wajib diisi.' })
    .trim()
    .min(1, { message: 'Judul proyek wajib diisi.' })
    .max(160, { message: 'Judul maksimum 160 karakter.' }),
  category: z
    .string({ required_error: 'Kategori wajib diisi.' })
    .trim()
    .min(1, { message: 'Kategori wajib diisi.' })
    .max(80, { message: 'Kategori maksimum 80 karakter.' }),
  mentor: z.string().trim().max(160).optional(),
  demoUrl: z
    .string()
    .trim()
    .url({ message: 'Tautan demo tidak valid.' })
    .max(2048)
    .optional()
    .or(z.literal('')),
  summary: z
    .string({ required_error: 'Ringkasan solusi AI wajib diisi.' })
    .trim()
    .min(1, { message: 'Ringkasan solusi AI wajib diisi.' })
    .max(4000, { message: 'Ringkasan maksimum 4000 karakter.' }),
});

export type SubmitProjectInput = z.infer<typeof submitProjectSchema>;

/** Tipe entri showcase: proyek siswa atau inovasi guru. */
export const showcaseTypeSchema = z.enum(['student', 'teacher']);
export type ShowcaseType = z.infer<typeof showcaseTypeSchema>;
