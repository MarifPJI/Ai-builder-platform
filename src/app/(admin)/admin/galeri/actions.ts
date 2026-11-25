'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/guard';
import {
  createGalleryItem,
  deleteGalleryItem,
  requestGalleryImageUpload,
  updateGalleryItem,
  type GalleryImageAction,
} from '@/lib/domain/gallery-service';
import {
  ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES,
  publicObjectUrl,
  type PublicImageContentType,
} from '@/lib/s3/presign';

/** Hasil presign yang dikirim ke klien, termasuk URL publik final. */
export interface GaleriPresignResult {
  url: string;
  bucket: string;
  s3Key: string;
  publicUrl: string;
}

export interface GaleriFormState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/**
 * Menerbitkan Presigned PUT URL untuk unggah foto Galeri (bucket publik).
 * Hanya admin. Dipanggil dari klien sebelum PUT byte langsung ke S3.
 */
export async function requestGaleriImageUploadAction(
  contentType: PublicImageContentType,
): Promise<GaleriPresignResult> {
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

export async function createGaleriAction(
  _prev: GaleriFormState,
  formData: FormData,
): Promise<GaleriFormState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const year = Number(formData.get('year'));
  const title = String(formData.get('title') ?? '').trim();
  const caption = String(formData.get('caption') ?? '').trim() || undefined;
  // Field gambar (opsional) diisi klien setelah unggah ke S3 berhasil.
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || undefined;
  const imageBucket = String(formData.get('imageBucket') ?? '').trim() || undefined;
  const imageKey = String(formData.get('imageKey') ?? '').trim() || undefined;

  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return { status: 'error', message: 'Tahun tidak valid.' };
  }
  if (!title) {
    return { status: 'error', message: 'Judul wajib diisi.' };
  }
  // Jika salah satu field gambar ada, pastikan URL publik ikut terisi.
  if ((imageBucket || imageKey) && !imageUrl) {
    return { status: 'error', message: 'Unggah gambar belum selesai. Coba lagi.' };
  }

  try {
    await createGalleryItem(claims, {
      year,
      title,
      caption,
      imageBucket,
      imageKey,
      imageUrl,
    });
    revalidatePath('/admin/galeri');
    revalidatePath('/');
    return { status: 'ok', message: 'Item galeri berhasil diterbitkan.' };
  } catch {
    return { status: 'error', message: 'Gagal menerbitkan item galeri.' };
  }
}

/**
 * ADMIN: ubah item galeri. `imageAction` menentukan perlakuan foto
 * (keep/replace/remove). Untuk 'replace', field image* diisi klien setelah
 * unggah ke S3 berhasil. Id dikirim via hidden field.
 */
export async function updateGaleriAction(
  _prev: GaleriFormState,
  formData: FormData,
): Promise<GaleriFormState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const id = String(formData.get('id') ?? '').trim();
  const year = Number(formData.get('year'));
  const title = String(formData.get('title') ?? '').trim();
  const caption = String(formData.get('caption') ?? '').trim() || undefined;
  const imageActionRaw = String(formData.get('imageAction') ?? 'keep');
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || undefined;
  const imageBucket = String(formData.get('imageBucket') ?? '').trim() || undefined;
  const imageKey = String(formData.get('imageKey') ?? '').trim() || undefined;

  const validActions: GalleryImageAction[] = ['keep', 'replace', 'remove'];
  const imageAction = (validActions as string[]).includes(imageActionRaw)
    ? (imageActionRaw as GalleryImageAction)
    : 'keep';

  if (!id) {
    return { status: 'error', message: 'Item tidak valid.' };
  }
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return { status: 'error', message: 'Tahun tidak valid.' };
  }
  if (!title) {
    return { status: 'error', message: 'Judul wajib diisi.' };
  }
  if (imageAction === 'replace' && !imageUrl) {
    return { status: 'error', message: 'Unggah gambar belum selesai. Coba lagi.' };
  }

  try {
    await updateGalleryItem(claims, id, {
      year,
      title,
      caption,
      imageAction,
      imageBucket,
      imageKey,
      imageUrl,
    });
    revalidatePath('/admin/galeri');
    revalidatePath('/');
    return { status: 'ok', message: 'Item galeri berhasil diperbarui.' };
  } catch {
    return { status: 'error', message: 'Gagal memperbarui item galeri.' };
  }
}

/** ADMIN: hapus item galeri (termasuk foto S3 best-effort). */
export async function deleteGaleriAction(id: string): Promise<void> {
  const claims = await requireSession({ requireRole: 'admin' });
  await deleteGalleryItem(claims, id);
  revalidatePath('/admin/galeri');
  revalidatePath('/');
}
