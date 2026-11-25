'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/guard';
import { promoteSubmissionToKarya } from '@/lib/domain/karya-service';
import { moderate } from '@/lib/domain/showcase-service';

/**
 * Aksi tinjau kiriman siswa (review/record). Admin menandai status kiriman
 * (approved/rejected) untuk pencatatan. Kiriman TIDAK otomatis tampil publik —
 * konten publik berasal dari Showcase Karya terpisah.
 */
export async function setSubmissionStatusAction(
  id: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  const claims = await requireSession({ requireRole: 'admin' });
  await moderate(claims, id, decision);
  revalidatePath('/admin/submissions');
}

/**
 * Aksi Option A: terbitkan kiriman yang sudah 'approved' ke Showcase Karya
 * publik (satu klik, tanpa mengetik ulang). Hanya admin. Menyegarkan kotak
 * masuk, daftar Karya admin, dan halaman publik `/` agar karya baru tampil.
 */
export async function promoteSubmissionAction(id: string): Promise<void> {
  const claims = await requireSession({ requireRole: 'admin' });
  await promoteSubmissionToKarya(claims, id);
  revalidatePath('/admin/submissions');
  revalidatePath('/admin/karya');
  revalidatePath('/');
}
