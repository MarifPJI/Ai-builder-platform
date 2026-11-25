'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/auth/guard';
import {
  adminDeleteAttendance,
  adminDeleteJournal,
  adminDeletePhoto,
  adminDeleteSession,
  adminSaveAttendance,
  adminSaveJournal,
  adminUpdateSession,
  AdminMutationError,
  type AdminAttendanceEntry,
} from '@/lib/domain/admin-school-mutations-service';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/validation/attendance';
import { toIso } from '@/lib/time/wib';

/**
 * Server Actions WRITE Admin level Detail Sesi
 * (/admin/schools/[schoolId]/sesi/[sessionId]). `'use server'`; tiap aksi
 * memanggil `requireSession({requireRole:'admin'})` DULU → service → revalidate
 * → kembalikan state (Bahasa Indonesia). `schoolId`/`sessionId`/`studentId`/
 * `photoId` dari hidden input dipakai untuk revalidate/target DELETE — BUKAN
 * untuk menurunkan `school_id` DB (itu tetap dari baris sesi di service).
 *
 * `updateSessionAction` adalah SATU-SATUNYA definisi edit sesi; ia me-revalidate
 * KEDUA path (Detail Sekolah + Detail Sesi) sehingga melayani form edit dari
 * kedua halaman.
 */
export interface AdminWriteState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/** Konversi string FormData status presensi ke `AttendanceStatus` yang sah. */
function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export async function updateSessionAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<AdminWriteState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const schoolId = String(formData.get('schoolId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const scheduledAtRaw = String(formData.get('scheduledAt') ?? '').trim();

  const scheduledAt = scheduledAtRaw ? toIso(scheduledAtRaw) : null;
  if (!scheduledAt) {
    return { status: 'error', message: 'Tanggal & jam sesi tidak valid.' };
  }

  try {
    await adminUpdateSession(claims, sessionId, { name, scheduledAt });
    revalidatePath(`/admin/schools/${schoolId}`);
    revalidatePath(`/admin/schools/${schoolId}/sesi/${sessionId}`);
    return { status: 'ok', message: 'Sesi berhasil diperbarui.' };
  } catch (err) {
    if (err instanceof AdminMutationError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal memperbarui sesi. Silakan coba lagi.' };
  }
}

export async function deleteSessionAndRedirectAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<void> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();

  const { schoolId } = await adminDeleteSession(claims, sessionId);
  revalidatePath(`/admin/schools/${schoolId}`);
  // `redirect` melempar NEXT_REDIRECT & menavigasi (halaman sesi tak ada lagi).
  redirect(`/admin/schools/${schoolId}`);
}

export async function saveAttendanceAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<AdminWriteState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const schoolId = String(formData.get('schoolId') ?? '').trim();

  // Entri dikirim sebagai JSON pada field `entries` ([{studentId,status}]).
  const entries: AdminAttendanceEntry[] = [];
  try {
    const raw = String(formData.get('entries') ?? '[]');
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const studentId = String((item as { studentId?: unknown }).studentId ?? '');
        const status = String((item as { status?: unknown }).status ?? '');
        if (studentId && isAttendanceStatus(status)) {
          entries.push({ studentId, status });
        }
      }
    }
  } catch {
    return { status: 'error', message: 'Data presensi tidak valid.' };
  }

  try {
    await adminSaveAttendance(claims, sessionId, entries);
    revalidatePath(`/admin/schools/${schoolId}/sesi/${sessionId}`);
    return { status: 'ok', message: 'Presensi berhasil disimpan.' };
  } catch (err) {
    if (err instanceof AdminMutationError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menyimpan presensi. Silakan coba lagi.' };
  }
}

export async function deleteAttendanceAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<AdminWriteState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const schoolId = String(formData.get('schoolId') ?? '').trim();
  const studentId = String(formData.get('studentId') ?? '').trim();

  try {
    await adminDeleteAttendance(claims, sessionId, studentId);
    revalidatePath(`/admin/schools/${schoolId}/sesi/${sessionId}`);
    return { status: 'ok', message: 'Presensi siswa berhasil dihapus.' };
  } catch (err) {
    if (err instanceof AdminMutationError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menghapus presensi. Silakan coba lagi.' };
  }
}

export async function saveJournalAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<AdminWriteState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const schoolId = String(formData.get('schoolId') ?? '').trim();
  const notesRaw = String(formData.get('notes') ?? '').trim();

  try {
    await adminSaveJournal(claims, sessionId, notesRaw || null);
    revalidatePath(`/admin/schools/${schoolId}/sesi/${sessionId}`);
    return { status: 'ok', message: 'Jurnal berhasil disimpan.' };
  } catch (err) {
    if (err instanceof AdminMutationError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menyimpan jurnal. Silakan coba lagi.' };
  }
}

export async function deleteJournalAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<AdminWriteState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const schoolId = String(formData.get('schoolId') ?? '').trim();

  try {
    await adminDeleteJournal(claims, sessionId);
    revalidatePath(`/admin/schools/${schoolId}/sesi/${sessionId}`);
    return { status: 'ok', message: 'Jurnal berhasil dihapus.' };
  } catch (err) {
    if (err instanceof AdminMutationError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menghapus jurnal. Silakan coba lagi.' };
  }
}

export async function deletePhotoAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<AdminWriteState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const schoolId = String(formData.get('schoolId') ?? '').trim();
  const photoId = String(formData.get('photoId') ?? '').trim();

  try {
    await adminDeletePhoto(claims, photoId);
    revalidatePath(`/admin/schools/${schoolId}/sesi/${sessionId}`);
    return { status: 'ok', message: 'Foto berhasil dihapus.' };
  } catch (err) {
    if (err instanceof AdminMutationError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menghapus foto. Silakan coba lagi.' };
  }
}
