import { PageIntro } from '@/components/shared/PageIntro';
import { AppShell } from '@/components/shared/AppShell';
import { teacherNav } from '@/components/shared/teacherNav';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireSession } from '@/lib/auth/guard';
import { listClasses, type ClassSummary } from '@/lib/domain/class-service';
import { listPublished, type Material } from '@/lib/domain/material-service';
import { getSchoolName } from '@/lib/domain/school-service';
import { listSessionsWithStatus, type SessionWithStatus } from '@/lib/domain/session-service';

/**
 * T01 Dashboard Guru (`/teacher`) — Server Component murni.
 *
 * Ringkasan kelas, jadwal sesi mengajar, dan materi pegangan Guru
 * (AGENTS.md §3). TANPA banner "3 Langkah Manual", tanpa duplikasi tombol,
 * kapsul sekolah terkunci. Statcard dari data nyata; menonjolkan "Sesi Aktif
 * (perlu presensi)" sebagai CTA ke /teacher/presensi. Fail-soft: pengambilan
 * data dibungkus Promise.allSettled sehingga satu query gagal tidak meruntuhkan
 * halaman. Seluruh teks Bahasa Indonesia.
 */
export const dynamic = 'force-dynamic';

// WIB (Asia/Jakarta) WAJIB di-set: server produksi berjalan di UTC; tanpa ini
// jadwal sesi tampil dalam UTC (bergeser -7 jam dari WIB).
const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export default async function TeacherDashboardPage() {
  const claims = await requireSession({ requireRole: 'teacher' });

  // Nama sekolah diambil paralel dengan data lain (sebelumnya berurutan).
  const [schoolRes, classesRes, sessionsRes, materialsRes] = await Promise.allSettled([
    getSchoolName(claims, claims.schoolId!),
    listClasses(claims),
    listSessionsWithStatus(claims),
    listPublished(claims),
  ]);

  const schoolName = settled(schoolRes, null) ?? 'Sekolah Anda';
  const classes: ClassSummary[] = settled(classesRes, []);
  const sessions: SessionWithStatus[] = settled(sessionsRes, []);
  const materials: Material[] = settled(materialsRes, []);

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const activeSessions = sessions.filter((s) => s.isDue && !s.hasAttendance).length;

  return (
    <AppShell
      brand="AI Builder"
      nav={teacherNav('/teacher')}
      schoolLabel={schoolName}
      avatarInitials="GU"
    >
      <PageIntro role="RUANG GURU">
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Ringkasan kelas, jadwal sesi mengajar, dan materi pegangan Guru.
        </p>
      </PageIntro>

      <div className="app-stats mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sesi Aktif (perlu presensi)"
          value={activeSessions}
          hint={activeSessions > 0 ? 'Isi presensi sekarang →' : 'Tidak ada yang perlu diisi'}
          href="/teacher/presensi"
          highlight
        />
        <StatCard label="Jumlah Kelas" value={classes.length} hint={`${totalStudents} siswa`} href="/teacher/kelas" />
        <StatCard
          label="Jadwal Sesi Mengajar"
          value={sessions.length}
          hint="sesi terjadwal"
          href="/teacher/sesi"
        />
        <StatCard
          label="Materi Pegangan"
          value={materials.length}
          hint="materi terbit"
          href="/teacher/materi"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHead title="Jadwal Sesi Mengajar" />
          <CardBody className="p-0">
            {sessions.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted">
                Belum ada sesi terjadwal. Jadwalkan di menu Sesi.
              </p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Sesi</TH>
                    <TH>Kelas</TH>
                    <TH>Jadwal</TH>
                  </TR>
                </THead>
                <TBody>
                  {sessions.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-medium">{s.name}</TD>
                      <TD>{s.className}</TD>
                      <TD className="text-muted">{DATE_FMT.format(s.scheduledAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Materi Pegangan Guru" />
          <CardBody className="p-0">
            {materials.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted">
                Belum ada materi yang diterbitkan Admin.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{m.title}</p>
                      {m.timeAllocation ? (
                        <p className="text-xs text-muted">Alokasi waktu: {m.timeAllocation}</p>
                      ) : null}
                    </div>
                    <a
                      href={`/teacher/materi?materialId=${m.id}`}
                      className="shrink-0 text-sm text-teal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                    >
                      Buka →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
  highlight,
}: {
  label: string;
  value: number;
  hint: string;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <CardBody>
      <p className={highlight ? 'text-sm font-medium text-primary' : 'text-sm text-muted'}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </CardBody>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      >
        <Card
          className={
            highlight
              ? 'border-primary bg-primary-soft transition hover:opacity-90'
              : 'transition hover:bg-soft'
          }
        >
          {body}
        </Card>
      </a>
    );
  }

  return <Card>{body}</Card>;
}
