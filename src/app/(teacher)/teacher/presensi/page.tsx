import { AppShell } from '@/components/shared/AppShell';
import { teacherNav } from '@/components/shared/teacherNav';
import { Card, CardBody } from '@/components/ui/Card';
import { requireSession } from '@/lib/auth/guard';
import { listAttendance, type AttendanceRow } from '@/lib/domain/attendance-service';
import { listClasses } from '@/lib/domain/class-service';
import { getSchoolName } from '@/lib/domain/school-service';
import { listSessionRecap, listSessionsWithStatus } from '@/lib/domain/session-service';

import { CameraCapture } from './CameraCapture';
import { PresensiJurnal } from './PresensiJurnal';
import { PresensiOverview } from './PresensiOverview';

/**
 * T06B Presensi & Jurnal (`/teacher/presensi`) — Server Component.
 *
 * Empat bagian berbasis status waktu (status dihitung di SQL server): Daftar
 * Kelas (filter via `?classId=`), Sesi Aktif (isDue && !hasAttendance), Sesi
 * Terjadwal terkunci (!isDue, read-only), dan Rekap per Sesi. Membuka
 * `?sessionId=` me-render UI pengisian T06B yang sudah ada (PresensiJurnal +
 * CameraCapture) TANPA perubahan pada komponen tersebut. Mengikuti aturan ketat
 * AGENTS.md §3.
 */
export const dynamic = 'force-dynamic';

export default async function TeacherPresensiPage({
  searchParams,
}: {
  searchParams?: { sessionId?: string; classId?: string };
}) {
  const claims = await requireSession({ requireRole: 'teacher' });
  const schoolName = (await getSchoolName(claims, claims.schoolId!)) ?? 'Sekolah Anda';

  const classId = searchParams?.classId ?? null;
  const selectedSessionId = searchParams?.sessionId ?? null;

  const [classes, sessions, recaps] = await Promise.all([
    listClasses(claims),
    listSessionsWithStatus(claims),
    listSessionRecap(claims),
  ]);

  // Tautan "Kembali ke daftar sesi" mempertahankan filter kelas bila ada.
  const backHref = classId ? `/teacher/presensi?classId=${classId}` : '/teacher/presensi';

  let rows: AttendanceRow[] = [];
  let loadError: string | null = null;
  if (selectedSessionId) {
    try {
      rows = await listAttendance(claims, selectedSessionId);
    } catch {
      loadError = 'Sesi tidak ditemukan atau bukan milik sekolah Anda.';
    }
  }

  return (
    <AppShell
      brand="AI Builder"
      nav={teacherNav('/teacher/presensi')}
      schoolLabel={schoolName}
      avatarInitials="GU"
    >
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Presensi &amp; Jurnal</h1>
        <p className="mt-1 text-sm text-muted">
          Tandai kehadiran siswa, ambil foto dokumentasi, dan catat jurnal sesi.
        </p>
      </div>

      {selectedSessionId ? (
        <>
          <div className="mb-4">
            <a
              href={backHref}
              className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-ink hover:bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              ← Kembali ke daftar sesi
            </a>
          </div>
          {loadError ? (
            <Card>
              <CardBody>
                <p className="text-sm text-alfa">{loadError}</p>
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
              <PresensiJurnal
                sessionId={selectedSessionId}
                rows={rows.map((r) => ({
                  studentId: r.studentId,
                  nis: r.nis,
                  fullName: r.fullName,
                  status: r.status,
                }))}
              />
              <CameraCapture sessionId={selectedSessionId} />
            </div>
          )}
        </>
      ) : (
        <PresensiOverview
          classes={classes}
          sessions={sessions}
          recaps={recaps}
          classId={classId}
        />
      )}
    </AppShell>
  );
}
