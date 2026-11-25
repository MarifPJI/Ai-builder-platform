'use server';

import { requireSession } from '@/lib/auth/guard';
import {
  AttendanceError,
  type AttendanceEntry,
  confirmSessionPhoto,
  requestSessionPhotoUpload,
  saveAttendance,
  saveJournal,
} from '@/lib/domain/attendance-service';
import type { ImageContentType, PresignPutResult } from '@/lib/s3/presign';
import { journalNotesSchema } from '@/lib/validation/attendance';

/**
 * Server Actions Presensi & Jurnal (T06B). Setiap action diawali
 * requireSession({ requireRole: 'teacher' }) lalu memanggil service claims-first.
 */
export interface SaveResult {
  status: 'ok' | 'error';
  message?: string;
}

/**
 * Simpan presensi + jurnal dalam satu aksi (tombol "✓ Simpan Presensi & Jurnal").
 * `entries` hanya berisi baris yang ditandai eksplisit (Decision 2).
 */
export async function saveAttendanceAndJournalAction(
  sessionId: string,
  entries: AttendanceEntry[],
  notes: string | null,
): Promise<SaveResult> {
  const claims = await requireSession({ requireRole: 'teacher' });

  const trimmed = notes && notes.trim() !== '' ? notes : null;
  const parsedNotes = journalNotesSchema.safeParse(trimmed);
  if (!parsedNotes.success) {
    return {
      status: 'error',
      message: parsedNotes.error.issues[0]?.message ?? 'Catatan sesi tidak valid.',
    };
  }

  try {
    await saveAttendance(claims, sessionId, entries);
    await saveJournal(claims, sessionId, parsedNotes.data);
    return { status: 'ok', message: 'Presensi & jurnal berhasil disimpan.' };
  } catch (err) {
    if (err instanceof AttendanceError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menyimpan presensi & jurnal. Silakan coba lagi.' };
  }
}

/** Minta presigned PUT URL untuk foto dokumentasi sesi (image/jpeg saja). */
export async function requestSessionPhotoUploadAction(
  sessionId: string,
  contentType: ImageContentType,
): Promise<PresignPutResult> {
  const claims = await requireSession({ requireRole: 'teacher' });
  return requestSessionPhotoUpload(claims, sessionId, contentType);
}

/** Catat foto sesi setelah unggah S3 sukses. */
export async function confirmSessionPhotoAction(
  sessionId: string,
  bucket: string,
  s3Key: string,
): Promise<SaveResult> {
  const claims = await requireSession({ requireRole: 'teacher' });
  try {
    await confirmSessionPhoto(claims, sessionId, bucket, s3Key);
    return { status: 'ok', message: 'Foto dokumentasi tersimpan.' };
  } catch (err) {
    if (err instanceof AttendanceError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menyimpan foto. Silakan coba lagi.' };
  }
}
