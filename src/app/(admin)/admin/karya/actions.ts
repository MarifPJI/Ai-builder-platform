'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/guard';
import { requestGalleryImageUpload } from '@/lib/domain/gallery-service';
import { createKarya, setKaryaPublished } from '@/lib/domain/karya-service';
import {
  ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES,
  publicObjectUrl,
  type PublicImageContentType,
} from '@/lib/s3/presign';

/**
 * Server Actions kelola Showcase Karya (admin). Semua diawali
 * requireSession({requireRole:'admin'}). Unggah thumbnail ke bucket publik S3.
 */
export interface KaryaFormState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/** Hasil presign yang dikirim ke klien, termasuk URL publik final. */
export interface KaryaPresignResult {
  url: string;
  bucket: string;
  s3Key: string;
  publicUrl: string;
}

/**
 * Menerbitkan Presigned PUT URL untuk unggah thumbnail Karya (bucket publik).
 * Hanya admin. Memakai kembali jalur unggah gambar publik yang sama dengan Galeri.
 */
export async function requestKaryaImageUploadAction(
  contentType: PublicImageContentType,
): Promise<KaryaPresignResult> {
  const claims = await requireSession({ requireRole: 'admin' });
  const allowed = Object.values(ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES) as string[];
  if (!allowed.includes(contentType)) {
    throw new Error('Tipe gambar tidak didukung. Gunakan JPEG, PNG, atau WebP.');
  }
  const presign = await requestGalleryImageUpload(claims, contentType);
  return {
    url: presign.url,
    bucket: presign.bucket,
    s3Key: presign.s3Key,
    publicUrl: publicObjectUrl(presign.bucket, presign.s3Key),
  };
}

export async function createKaryaAction(
  _prev: KaryaFormState,
  formData: FormData,
): Promise<KaryaFormState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const type = String(formData.get('type') ?? 'student');
  const input = {
    type: type === 'teacher' ? ('teacher' as const) : ('student' as const),
    title: String(formData.get('title') ?? '').trim(),
    category: String(formData.get('category') ?? '').trim(),
    schoolName: String(formData.get('schoolName') ?? '').trim(),
    mentor: String(formData.get('mentor') ?? '').trim() || undefined,
    demoUrl: String(formData.get('demoUrl') ?? '').trim() || undefined,
    summary: String(formData.get('summary') ?? '').trim(),
    detail: String(formData.get('detail') ?? '').trim() || undefined,
    // Thumbnail (opsional) diisi klien setelah unggah ke S3 berhasil.
    imageUrl: String(formData.get('imageUrl') ?? '').trim() || undefined,
    imageBucket: String(formData.get('imageBucket') ?? '').trim() || undefined,
    imageKey: String(formData.get('imageKey') ?? '').trim() || undefined,
  };

  if (!input.title || !input.category || !input.schoolName || !input.summary) {
    return { status: 'error', message: 'Judul, kategori, sekolah, dan ringkasan wajib diisi.' };
  }
  if ((input.imageBucket || input.imageKey) && !input.imageUrl) {
    return { status: 'error', message: 'Unggah thumbnail belum selesai. Coba lagi.' };
  }

  try {
    await createKarya(claims, input);
    revalidatePath('/admin/karya');
    revalidatePath('/');
    return { status: 'ok', message: 'Karya berhasil diterbitkan.' };
  } catch {
    return { status: 'error', message: 'Gagal menerbitkan karya. Silakan coba lagi.' };
  }
}

export async function toggleKaryaAction(id: string, published: boolean): Promise<void> {
  const claims = await requireSession({ requireRole: 'admin' });
  await setKaryaPublished(claims, id, published);
  revalidatePath('/admin/karya');
  revalidatePath('/');
}
