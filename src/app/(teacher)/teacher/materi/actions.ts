'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/guard';
import { MaterialError, markRead, presignDownload } from '@/lib/domain/material-service';

/**
 * Server Actions Materi (T03) — READ-ONLY untuk Guru. Diawali
 * requireSession({ requireRole: 'teacher' }); service dipanggil claims-first.
 */
export interface PresignResult {
  status: 'ok' | 'error';
  url?: string;
  message?: string;
}

export async function presignDownloadAction(fileId: string): Promise<PresignResult> {
  const claims = await requireSession({ requireRole: 'teacher' });
  try {
    const url = await presignDownload(claims, fileId);
    return { status: 'ok', url };
  } catch (err) {
    if (err instanceof MaterialError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menyiapkan unduhan. Silakan coba lagi.' };
  }
}

export async function markReadAction(materialId: string): Promise<PresignResult> {
  const claims = await requireSession({ requireRole: 'teacher' });
  try {
    await markRead(claims, materialId);
    revalidatePath('/teacher/materi');
    return { status: 'ok' };
  } catch {
    return { status: 'error', message: 'Gagal menandai materi. Silakan coba lagi.' };
  }
}
