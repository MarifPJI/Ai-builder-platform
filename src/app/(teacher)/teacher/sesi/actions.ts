'use server';

import { revalidatePath } from 'next/cache';

import { ZodError } from 'zod';

import { requireSession } from '@/lib/auth/guard';
import { isSessionKind, type SessionKind } from '@/lib/domain/session-plan';
import { scheduleSession, SessionError } from '@/lib/domain/session-service';

/**
 * Server Action halaman Sesi (/teacher/sesi). Menjadwalkan sesi pertemuan
 * terhadap kelas (butuh Materi terbit; backend menegakkan). Mengikuti pola
 * TeacherFormState dari halaman Kelas: requireSession -> service -> revalidatePath.
 */
export interface SesiFormState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/**
 * Offset Waktu Indonesia Barat (WIB = Asia/Jakarta) terhadap UTC, dalam menit.
 * WIB = UTC+7 (tanpa DST). Seluruh sekolah program berada di WIB.
 */
const WIB_OFFSET_MINUTES = 7 * 60;

/**
 * Mengubah nilai `datetime-local` ("YYYY-MM-DDTHH:mm", TANPA zona) menjadi ISO
 * 8601 UTC ber-offset, dengan MEMPERLAKUKAN input sebagai waktu WIB (Asia/Jakarta,
 * UTC+7) — BUKAN waktu lokal server.
 *
 * Kenapa penting: server produksi (ECS Fargate) berjalan di UTC. Memakai
 * `new Date(raw).toISOString()` akan menafsirkan input sebagai UTC, sehingga
 * "09:35" yang dimaksud guru (WIB) tersimpan sebagai 09:35Z (= 16:35 WIB),
 * bergeser +7 jam. Akibatnya perbandingan `scheduled_at <= now()` (UTC) menilai
 * sesi belum lewat sehingga tetap "terkunci" walau jam dinding WIB sudah lewat.
 *
 * Solusi: parse komponen tanggal/jam secara eksplisit, bentuk instant UTC via
 * `Date.UTC(...)` lalu KURANGI offset WIB agar jam dinding WIB → instant UTC yang
 * benar. Tidak bergantung pada zona waktu mesin server.
 */
function toIso(raw: string): string | null {
  // Terima "YYYY-MM-DDTHH:mm" atau dengan detik "YYYY-MM-DDTHH:mm:ss".
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  // Jam dinding WIB (UTC+7) → instant UTC sebenarnya = dikurangi 7 jam.
  const instant = new Date(utcMs - WIB_OFFSET_MINUTES * 60 * 1000);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString();
}

export async function scheduleSessionAction(
  _prev: SesiFormState,
  formData: FormData,
): Promise<SesiFormState> {
  const claims = await requireSession({ requireRole: 'teacher' });
  const classId = String(formData.get('classId') ?? '').trim();
  const materialId = String(formData.get('materialId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const sessionKindRaw = String(formData.get('sessionKind') ?? '').trim();
  const scheduledAtRaw = String(formData.get('scheduledAt') ?? '').trim();

  const scheduledAt = scheduledAtRaw ? toIso(scheduledAtRaw) : null;
  if (!scheduledAt) {
    return { status: 'error', message: 'Tanggal & jam sesi tidak valid.' };
  }
  if (sessionKindRaw && !isSessionKind(sessionKindRaw)) {
    return { status: 'error', message: 'Jenis sesi tidak valid.' };
  }

  try {
    await scheduleSession(claims, {
      classId,
      materialId,
      scheduledAt,
      ...(sessionKindRaw ? { sessionKind: sessionKindRaw as SessionKind } : { name }),
    });
    revalidatePath('/teacher/sesi');
    revalidatePath('/teacher');
    return { status: 'ok', message: 'Sesi berhasil dijadwalkan.' };
  } catch (err) {
    if (err instanceof SessionError) return { status: 'error', message: err.message };
    if (err instanceof ZodError) {
      return { status: 'error', message: err.issues[0]?.message ?? 'Masukan sesi tidak valid.' };
    }
    return { status: 'error', message: 'Gagal menjadwalkan sesi. Silakan coba lagi.' };
  }
}
