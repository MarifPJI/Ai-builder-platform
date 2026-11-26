import { AppShell } from '@/components/shared/AppShell';
import { teacherNav } from '@/components/shared/teacherNav';
import { requireSession } from '@/lib/auth/guard';
import { listClasses, listStudents, type ClassStudent } from '@/lib/domain/class-service';
import { getSchoolName } from '@/lib/domain/school-service';

import { KelasSesiPanels } from './KelasSesiPanels';

/**
 * Kelas (`/teacher/kelas`) — Server Component.
 *
 * Mengambil daftar kelas dan (jika `?classId=` ada) daftar siswa
 * kelas terpilih. Merender KelasSesiPanels ('use client') untuk form pembuatan
 * kelas dan penambahan roster (Input Sekaligus / Satu per Satu). Penjadwalan sesi
 * dipindah ke halaman /teacher/sesi.
 */
export const dynamic = 'force-dynamic';

export default async function TeacherKelasPage({
  searchParams,
}: {
  searchParams?: { classId?: string };
}) {
  const claims = await requireSession({ requireRole: 'teacher' });
  const schoolName = (await getSchoolName(claims, claims.schoolId!)) ?? 'Sekolah Anda';

  const classes = await listClasses(claims);

  const selectedClassId = searchParams?.classId ?? classes[0]?.id ?? null;
  let students: ClassStudent[] = [];
  if (selectedClassId) {
    students = await listStudents(claims, selectedClassId);
  }

  return (
    <AppShell
      brand="AI Builder"
      nav={teacherNav('/teacher/kelas')}
      schoolLabel={schoolName}
      avatarInitials="GU"
    >
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Kelas</h1>
        <p className="mt-1 text-sm text-muted">Buat kelas dan isi daftar siswa.</p>
      </div>
      <KelasSesiPanels
        classes={classes}
        selectedClassId={selectedClassId}
        students={students}
      />
    </AppShell>
  );
}
