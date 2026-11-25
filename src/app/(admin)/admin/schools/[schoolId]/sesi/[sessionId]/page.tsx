import { notFound } from 'next/navigation';

import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { requireSession } from '@/lib/auth/guard';
import {
  getSessionAttendanceDetail,
  presignSchoolSessionPhotos,
} from '@/lib/domain/admin-school-detail-service';

import { AdminFotoActions } from './AdminFotoActions';
import { AdminJurnalEditor } from './AdminJurnalEditor';
import { AdminPresensiEditor } from './AdminPresensiEditor';

/**
 * Detail Presensi Sesi Admin (A02 → [schoolId] → sesi/[sessionId], Fase 1,
 * READ-ONLY).
 *
 * Server Component di dalam grup rute (admin): mewarisi guard admin & error.tsx.
 * Mengonsumsi service FEAT-001 (getSessionAttendanceDetail/
 * presignSchoolSessionPhotos) secara fail-soft via `safe()`. TANPA aksi mutasi
 * apa pun (edit/hapus/kelola = Fase 2). Format waktu WAJIB WIB (Asia/Jakarta).
 */
export const dynamic = 'force-dynamic';

/** Fail-soft generik (meniru src/app/(admin)/admin/page.tsx): gagal → `null`. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Format jadwal sesi WAJIB WIB (Asia/Jakarta). */
const dateFmt = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

export default async function SessionAttendanceDetailPage({
  params,
}: {
  params: { schoolId: string; sessionId: string };
}) {
  const claims = await requireSession({ requireRole: 'admin' });

  const detail = await safe(() =>
    getSessionAttendanceDetail(claims, params.sessionId),
  );

  // Sesi tak ada / tak terlihat di bawah RLS → 404.
  if (detail === null || detail === undefined) {
    notFound();
  }

  // Presign foto di server; gagal → `null` (anggap foto tak dapat dimuat).
  const photos = await safe(() => presignSchoolSessionPhotos(detail.photos));

  return (
    <AppShell
      brand="AI Builder"
      nav={adminNav('/admin/schools')}
      schoolLabel="Program Nasional"
      avatarInitials="AD"
    >
      <div className="mb-4">
        <a
          href={`/admin/schools/${params.schoolId}`}
          className="text-sm text-muted hover:text-ink"
        >
          ← Kembali ke Detail Sekolah
        </a>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">{detail.sessionName}</h1>
        <p className="mt-1 text-sm text-muted">
          {detail.className} · {dateFmt.format(detail.scheduledAt)}
        </p>
      </div>

      <Card>
        <CardHead title="Presensi" />
        <CardBody className="p-0">
          <AdminPresensiEditor
            sessionId={detail.sessionId}
            schoolId={params.schoolId}
            students={detail.students}
          />
        </CardBody>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHead title="Jurnal" />
          <CardBody>
            <AdminJurnalEditor
              sessionId={detail.sessionId}
              schoolId={params.schoolId}
              journalNotes={detail.journalNotes}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHead title="Foto Dokumentasi" />
          <CardBody>
            {photos === null ? (
              <p className="text-sm text-muted">
                Foto tidak dapat dimuat saat ini.
              </p>
            ) : photos.length === 0 ? (
              <p className="text-sm text-muted">
                Belum ada foto dokumentasi.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p) => (
                  <AdminFotoActions
                    key={p.id}
                    photoId={p.id}
                    schoolId={params.schoolId}
                    sessionId={detail.sessionId}
                    url={p.url}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
