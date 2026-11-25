'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/guard';
import {
  adminDeleteSession,
  AdminMutationError,
} from '@/lib/domain/admin-school-mutations-service';

import type { AdminWriteState } from './sesi/[sessionId]/actions';

/**
 * Server Action WRITE Admin level Detail Sekolah (/admin/schools/[schoolId]).
 * Hanya `deleteSessionAction` — dipakai tombol Hapus Sesi per baris pada tabel
 * Sesi. Setelah sukses revalidate halaman Detail Sekolah dan kembalikan state
 * (TIDAK redirect — halaman detail sekolah tetap ditampilkan). `AdminWriteState`
 * diimpor dari file action level sesi agar satu definisi tipe.
 */
export async function deleteSessionAction(
  _prev: AdminWriteState,
  formData: FormData,
): Promise<AdminWriteState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const schoolId = String(formData.get('schoolId') ?? '').trim();

  try {
    await adminDeleteSession(claims, sessionId);
    revalidatePath(`/admin/schools/${schoolId}`);
    return { status: 'ok', message: 'Sesi berhasil dihapus.' };
  } catch (err) {
    if (err instanceof AdminMutationError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menghapus sesi. Silakan coba lagi.' };
  }
}
