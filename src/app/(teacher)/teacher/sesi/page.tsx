import { AppShell } from '@/components/shared/AppShell';
import { teacherNav } from '@/components/shared/teacherNav';
import { requireSession } from '@/lib/auth/guard';
import { listClasses } from '@/lib/domain/class-service';
import { listPublished } from '@/lib/domain/material-service';
import { getSchoolName } from '@/lib/domain/school-service';
import { listSessions } from '@/lib/domain/session-service';

import { SesiPanels } from './SesiPanels';

/**
 * Sesi (`/teacher/sesi`) — Server Component.
 *
 * Mengambil daftar kelas, materi terbit, dan sesi terjadwal lalu merender
 * SesiPanels ('use client') untuk form penjadwalan sesi (kelas + Materi terbit +
 * nama + waktu) dan daftar sesi terjadwal. Penjadwalan butuh Materi terbit
 * (backend menegakkan).
 */
export const dynamic = 'force-dynamic';

export default async function TeacherSesiPage() {
  const claims = await requireSession({ requireRole: 'teacher' });
  const schoolName = (await getSchoolName(claims, claims.schoolId!)) ?? 'Sekolah Anda';

  const [classes, materials, sessions] = await Promise.all([
    listClasses(claims),
    listPublished(claims),
    listSessions(claims),
  ]);

  return (
    <AppShell
      brand="AI Builder"
      nav={teacherNav('/teacher/sesi')}
      schoolLabel={schoolName}
      avatarInitials="GU"
    >
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Sesi</h1>
        <p className="mt-1 text-sm text-muted">Jadwalkan sesi pertemuan terhadap kelas.</p>
      </div>
      <SesiPanels
        classes={classes}
        materials={materials.map((m) => ({ id: m.id, title: m.title }))}
        sessions={sessions.map((s) => ({
          id: s.id,
          name: s.name,
          className: s.className,
          classId: s.classId,
          materialId: s.materialId,
          sessionKind: s.sessionKind,
          partNumber: s.partNumber,
          scheduledAt: s.scheduledAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
