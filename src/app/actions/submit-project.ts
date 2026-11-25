'use server';

import { submitProject } from '@/lib/domain/showcase-service';
import { submitProjectSchema } from '@/lib/validation/showcase';

/**
 * Server Action formulir publik Kirim Proyek (public-showcase R4). Tanpa login.
 * Menyimpan kiriman berstatus `pending` (RLS memastikan tidak bisa `approved`).
 * Mengembalikan state untuk useFormState (konfirmasi / pesan kesalahan ID).
 *
 * Catatan rate-limit (R4.4): batas laju sederhana per-proses diterapkan sebagai
 * mitigasi awal spam. Untuk multi-instance produksi, pindahkan ke store terbagi.
 */
export interface SubmitState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

// Rate limit in-memory sederhana (per proses). Catatan: tidak terbagi antar task.
const lastSubmitAt = new Map<string, number>();
const MIN_INTERVAL_MS = 10_000;

export async function submitProjectAction(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    schoolName: String(formData.get('schoolName') ?? ''),
    title: String(formData.get('title') ?? ''),
    category: String(formData.get('category') ?? ''),
    mentor: String(formData.get('mentor') ?? ''),
    demoUrl: String(formData.get('demoUrl') ?? ''),
    summary: String(formData.get('summary') ?? ''),
  };

  // Validasi bentuk (R4.3).
  const parsed = submitProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(' ');
    return { status: 'error', message: msg || 'Data tidak valid.' };
  }

  // Rate limit kasar berbasis nama+sekolah (mitigasi awal, R4.4).
  const key = `${parsed.data.name}|${parsed.data.schoolName}`.toLowerCase();
  const now = Date.now();
  const prev = lastSubmitAt.get(key);
  if (prev && now - prev < MIN_INTERVAL_MS) {
    return {
      status: 'error',
      message: 'Terlalu cepat. Mohon tunggu sebentar sebelum mengirim lagi.',
    };
  }

  try {
    await submitProject(parsed.data);
    lastSubmitAt.set(key, now);
    return {
      status: 'ok',
      message:
        'Terima kasih! Proyek Anda telah dikirim dan akan tampil di Showcase ' +
        'setelah ditinjau Admin.',
    };
  } catch {
    return {
      status: 'error',
      message: 'Gagal mengirim proyek. Silakan coba lagi.',
    };
  }
}
