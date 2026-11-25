import { PageIntro } from '@/components/shared/PageIntro';
import { AppShell } from '@/components/shared/AppShell';
import { ExportGlobalButton } from './ExportGlobalButton';
import { adminNav } from '@/components/shared/adminNav';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { requireSession } from '@/lib/auth/guard';
import {
  getContentCounts,
  getTeacherActivitySummary,
  listSchoolActivity,
} from '@/lib/domain/admin-metrics-service';

/**
 * Dashboard Admin (`A01`) — ringkasan + pintasan ke modul. Diawali
 * requireSession({requireRole:'admin'}). Server Component; data ringkas via
 * domain services (fail-soft agar satu kegagalan tak meruntuhkan dashboard).
 */
export const dynamic = 'force-dynamic';

/** Fail-soft generik sejajar `safeCount`: query gagal → `null` (bukan crash). */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const claims = await requireSession({ requireRole: 'admin' });

  // 3 transaksi paralel (sebelumnya 7): hitungan konten digabung satu query.
  const [counts, summary, schoolActivity] = await Promise.all([
    safe(() => getContentCounts(claims)),
    safe(() => getTeacherActivitySummary(claims)),
    safe(() => listSchoolActivity(claims)),
  ]);

  const schools = counts?.schools ?? null;
  const karya = counts?.karya ?? null;
  const galeri = counts?.galeri ?? null;
  const submissions = counts?.submissions ?? null;
  const pendingSubmissions = counts?.pendingSubmissions ?? null;

  const stats = [
    { label: 'Sekolah Mitra', value: schools, href: '/admin/schools', note: null },
    { label: 'Showcase Karya', value: karya, href: '/admin/karya', note: null },
    { label: 'Item Galeri', value: galeri, href: '/admin/galeri', note: null },
    {
      label: 'Kiriman Proyek',
      value: submissions,
      href: '/admin/submissions',
      note:
        pendingSubmissions === null
          ? null
          : `${pendingSubmissions} menunggu tinjauan`,
    },
  ];

  return (
    <AppShell brand="AI Builder" nav={adminNav('/admin')} schoolLabel="Program Nasional" avatarInitials="AD">
      <PageIntro role="RUANG ADMIN">
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Ringkasan program STEM Capacity Building 2026.
        </p>
      </PageIntro>

      <div className="app-stats grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <a key={s.href} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardBody>
                <p className="text-sm text-muted">{s.label}</p>
                <p className="mt-2 text-3xl font-semibold text-ink">
                  {s.value === null ? '—' : s.value}
                </p>
                {s.note ? (
                  <p className="mt-1 text-xs text-muted">{s.note}</p>
                ) : null}
              </CardBody>
            </Card>
          </a>
        ))}
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-ink">Aktivitas Guru</h2>
        <p className="mt-1 text-sm text-muted">
          Agregat lintas seluruh sekolah mitra.
        </p>
      </div>

      <div className="app-stats app-stats-secondary grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a href="/admin/teachers">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody>
              <p className="text-sm text-muted">Jumlah Guru</p>
              <p className="mt-2 text-3xl font-semibold text-ink">
                {summary === null ? '—' : summary.totalGuru}
              </p>
              <p className="mt-1 text-xs text-muted">
                {summary === null
                  ? '—'
                  : `${summary.guruAktif} aktif · ${summary.guruPending} pending`}
              </p>
            </CardBody>
          </Card>
        </a>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Jumlah Kelas</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {summary === null ? '—' : summary.totalKelas}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Jumlah Siswa</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {summary === null ? '—' : summary.totalSiswa}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Jumlah Sesi</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {summary === null ? '—' : summary.totalSesi}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHead
            title="Ringkasan per Sekolah"
            action={<ExportGlobalButton />}
          />
          <CardBody className="px-0 py-0">
            <Table>
              <THead>
                <TR>
                  <TH>Sekolah</TH>
                  <TH className="text-right">Jumlah Guru</TH>
                  <TH className="text-right">Jumlah Kelas</TH>
                  <TH className="text-right">Jumlah Siswa</TH>
                </TR>
              </THead>
              <TBody>
                {schoolActivity === null ? (
                  <TR>
                    <TD colSpan={4} className="text-muted">
                      Data tidak tersedia saat ini.
                    </TD>
                  </TR>
                ) : schoolActivity.length === 0 ? (
                  <TR>
                    <TD colSpan={4} className="text-muted">
                      Belum ada sekolah.
                    </TD>
                  </TR>
                ) : (
                  schoolActivity.map((row) => (
                    <TR key={row.schoolId}>
                      <TD>{row.schoolName}</TD>
                      <TD className="text-right">{row.jumlahGuru}</TD>
                      <TD className="text-right">{row.jumlahKelas}</TD>
                      <TD className="text-right">{row.jumlahSiswa}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
