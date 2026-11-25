/**
 * Validasi masukan Materi (A07) — fitur course-class-publishing.
 *
 * Hanya validasi bentuk (zod); tidak menyentuh basis data. Tipe berkas yang
 * diizinkan untuk unggah hanya `pptx` dan `pdf` (R1.4); `video` disediakan
 * sebagai URL (bukan unggahan).
 *
 * _Requirements: 1.2, 1.4_
 */

import { z } from 'zod';

export const TITLE_MAX = 200;

/** Skema pembuatan Materi (R1.2). */
export const createMaterialSchema = z.object({
  title: z
    .string({ required_error: 'Judul Materi wajib diisi.' })
    .trim()
    .min(1, { message: 'Judul Materi wajib diisi.' })
    .max(TITLE_MAX, { message: `Judul Materi maksimum ${TITLE_MAX} karakter.` }),
  timeAllocation: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(5000).optional(),
  keyPoints: z.string().trim().max(5000).optional(),
});
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

/** Jenis berkas Materi yang valid. */
export const materialFileKindSchema = z.enum(['pptx', 'pdf', 'video']);
export type MaterialFileKind = z.infer<typeof materialFileKindSchema>;

/** Tipe konten unggah yang diizinkan (R1.4) — pptx/pdf saja. */
export const uploadContentTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
export type UploadContentTypeInput = z.infer<typeof uploadContentTypeSchema>;

/** Validasi URL video (untuk kind 'video'). */
export const videoUrlSchema = z
  .string({ required_error: 'URL video wajib diisi.' })
  .trim()
  .url({ message: 'URL video tidak valid.' })
  .max(2048);

/* ──────────────────────────────────────────────────────────────────────────
 * Sumber Materi multi-sumber (material_resources) — redesign A07/T03.
 * 1 Materi -> N sumber: canva_embed | video_link | pdf_file | pptx_file.
 * ────────────────────────────────────────────────────────────────────────── */

export const RESOURCE_TITLE_MAX = 255;

/** Jenis sumber Materi. */
export const resourceTypeSchema = z.enum([
  'canva_embed',
  'video_link',
  'pdf_file',
  'pptx_file',
  'web_link',
]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

/** URL umum (Canva/Video) — divalidasi bentuk; normalisasi dilakukan terpisah. */
const resourceUrlSchema = z
  .string({ required_error: 'URL wajib diisi.' })
  .trim()
  .url({ message: 'URL tidak valid.' })
  .max(2048);

const resourceTitleSchema = z
  .string({ required_error: 'Judul sumber wajib diisi.' })
  .trim()
  .min(1, { message: 'Judul sumber wajib diisi.' })
  .max(RESOURCE_TITLE_MAX, {
    message: `Judul sumber maksimum ${RESOURCE_TITLE_MAX} karakter.`,
  });

/**
 * Satu sumber Materi (untuk pembuatan). Sumber tautan (canva/video) WAJIB
 * `externalUrl`; sumber berkas (pdf/pptx) WAJIB `s3Bucket` + `s3Key` (hasil
 * unggah presigned). `sortOrder` opsional (diisi urutan oleh layanan).
 */
export const materialResourceInputSchema = z
  .object({
    resourceType: resourceTypeSchema,
    title: resourceTitleSchema,
    externalUrl: resourceUrlSchema.optional(),
    s3Bucket: z.string().trim().max(255).optional(),
    s3Key: z.string().trim().max(1024).optional(),
    mimeType: z.string().trim().max(120).optional(),
    fileSizeBytes: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().positive().optional(),
  })
  .superRefine((val, ctx) => {
    const isLink =
      val.resourceType === 'canva_embed' ||
      val.resourceType === 'video_link' ||
      val.resourceType === 'web_link';
    if (isLink) {
      if (!val.externalUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['externalUrl'],
          message: 'URL wajib diisi untuk sumber Canva, Video, atau Tautan Web.',
        });
      }
    } else {
      // pdf_file / pptx_file
      if (!val.s3Key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['s3Key'],
          message: 'Berkas harus diunggah lebih dulu (s3Key wajib).',
        });
      }
    }
  });
export type MaterialResourceInput = z.infer<typeof materialResourceInputSchema>;

/** Array sumber pada satu Materi (boleh kosong saat membuat Materi). */
export const materialResourcesSchema = z
  .array(materialResourceInputSchema)
  .max(100, { message: 'Terlalu banyak sumber pada satu Materi.' });
