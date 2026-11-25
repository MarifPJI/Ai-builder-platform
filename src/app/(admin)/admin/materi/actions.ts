'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';

import { requireSession } from '@/lib/auth/guard';
import {
  createMaterialWithResources,
  deleteMaterial,
  getWithResourcesForAdmin,
  MaterialError,
  presignResourceForAdmin,
  requestResourceUpload,
  unpublishMaterial,
  updateMaterialWithResources,
  type MaterialResource,
} from '@/lib/domain/material-service';
import { ALLOWED_UPLOAD_CONTENT_TYPES, type PresignPutResult } from '@/lib/s3/presign';
import type { MaterialResourceInput } from '@/lib/validation/material';

/**
 * Server Actions layar Admin "Materi" (A07) — redesign multi-sumber.
 * Setiap aksi diawali `requireSession({ requireRole: 'admin' })`, memanggil
 * material-service, lalu `revalidatePath('/admin/materi')` setelah mutasi.
 */

export interface MateriActionResult {
  ok: boolean;
  message?: string;
  materialId?: string;
}

function toIndonesianMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? 'Masukan tidak valid.';
  }
  if (err instanceof MaterialError) {
    return err.message;
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}

interface SaveMaterialPayload {
  title: string;
  timeAllocation?: string;
  summary?: string;
  keyPoints?: string;
  resources: MaterialResourceInput[];
  publish: boolean;
}

/** Membuat Materi baru + seluruh sumber dalam satu transaksi. */
export async function createMaterialWithResourcesAction(
  payload: SaveMaterialPayload,
): Promise<MateriActionResult> {
  const claims = await requireSession({ requireRole: 'admin' });
  try {
    const materialId = await createMaterialWithResources(
      claims,
      {
        title: payload.title,
        timeAllocation: payload.timeAllocation,
        summary: payload.summary,
        keyPoints: payload.keyPoints,
      },
      payload.resources,
      payload.publish,
    );
    revalidatePath('/admin/materi');
    return { ok: true, message: 'Materi berhasil disimpan.', materialId };
  } catch (err) {
    return { ok: false, message: toIndonesianMessage(err) };
  }
}

/** Memperbarui Materi + mengganti seluruh sumbernya (kelola sumber). */
export async function updateMaterialWithResourcesAction(
  materialId: string,
  payload: SaveMaterialPayload,
): Promise<MateriActionResult> {
  const claims = await requireSession({ requireRole: 'admin' });
  try {
    await updateMaterialWithResources(
      claims,
      materialId,
      {
        title: payload.title,
        timeAllocation: payload.timeAllocation,
        summary: payload.summary,
        keyPoints: payload.keyPoints,
      },
      payload.resources,
      payload.publish,
    );
    revalidatePath('/admin/materi');
    return { ok: true, message: 'Perubahan Materi tersimpan.' };
  } catch (err) {
    return { ok: false, message: toIndonesianMessage(err) };
  }
}

/** Membatalkan terbit Materi (kembali ke draf). */
export async function unpublishMaterialAction(materialId: string): Promise<MateriActionResult> {
  const claims = await requireSession({ requireRole: 'admin' });
  try {
    await unpublishMaterial(claims, materialId);
    revalidatePath('/admin/materi');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: toIndonesianMessage(err) };
  }
}

/** Menghapus Materi (cascade ke sumber/berkas/penanda-baca). Destruktif. */
export async function deleteMaterialAction(materialId: string): Promise<MateriActionResult> {
  const claims = await requireSession({ requireRole: 'admin' });
  try {
    await deleteMaterial(claims, materialId);
    revalidatePath('/admin/materi');
    return { ok: true, message: 'Materi dihapus.' };
  } catch (err) {
    return { ok: false, message: toIndonesianMessage(err) };
  }
}

/** Presigned PUT untuk unggah berkas sumber (pdf/pptx) saat menyusun form. */
export async function requestResourceUploadAction(
  kind: 'pdf' | 'pptx',
): Promise<PresignPutResult> {
  const claims = await requireSession({ requireRole: 'admin' });
  const contentType =
    kind === 'pdf'
      ? ALLOWED_UPLOAD_CONTENT_TYPES.pdf
      : ALLOWED_UPLOAD_CONTENT_TYPES.pptx;
  return requestResourceUpload(claims, contentType);
}

/** Memuat detail Materi + sumber untuk mode "Kelola Sumber" di form kiri. */
export async function loadMaterialForEditAction(
  materialId: string,
): Promise<{
  ok: boolean;
  message?: string;
  material?: {
    id: string;
    title: string;
    timeAllocation: string | null;
    summary: string | null;
    keyPoints: string | null;
    publishStatus: 'draft' | 'published';
    resources: MaterialResource[];
  };
}> {
  const claims = await requireSession({ requireRole: 'admin' });
  try {
    const m = await getWithResourcesForAdmin(claims, materialId);
    return {
      ok: true,
      material: {
        id: m.id,
        title: m.title,
        timeAllocation: m.timeAllocation,
        summary: m.summary,
        keyPoints: m.keyPoints,
        publishStatus: m.publishStatus,
        resources: m.resources,
      },
    };
  } catch (err) {
    return { ok: false, message: toIndonesianMessage(err) };
  }
}

/** Presigned GET untuk pratinjau berkas sumber milik Admin. */
export async function presignResourceForAdminAction(resourceId: string): Promise<string> {
  const claims = await requireSession({ requireRole: 'admin' });
  return presignResourceForAdmin(claims, resourceId);
}
