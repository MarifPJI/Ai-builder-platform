import { PageIntro } from '@/components/shared/PageIntro';
import { AppShell } from '@/components/shared/AppShell';
import { ExportGlobalButton } from './ExportGlobalButton';
import { ProgressTable } from './ProgressTable';
import { adminNav } from '@/components/shared/adminNav';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { requireSession } from '@/lib/auth/guard';
import {
  getContentCounts,
  getTeacherActivitySummary,
} from '@/lib/domain/admin-metrics-service';
import {
  getTeachingProgress,
  type WeeklySessions,
} from '@/lib/domain/admin-progress-service';
import { CLASS_TARGET, LESSONS_PER_CLASS } from '@/lib/domain/progress-calc';

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

  // 3 transaksi paralel: hitungan konten, ringkasan guru, progres mengajar.
  const [counts, summary, progress] = await Promise.all([
    safe(() => getContentCounts(claims)),
    safe(() => getTeacherActivitySummary(claims)),
    safe(() => getTeachingProgress(claims)),
  ]);
  // Dipakai tabel untuk "x hari lalu" agar server & klien menghitung dari waktu yang sama.
  const renderedAt = Date.now();

  const schools = counts?.schools ?? null;
  const karya = counts?.karya ?? null;
  const submissions = counts?.submissions ?? null;
  const pendingSubmissions = counts?.pendingSubmissions ?? null;

  const stats = [
    { label: 'Sekolah Mitra', value: schools, href: '/admin/schools', note: null },
    { label: 'Showcase Karya', value: karya, href: '/admin/karya', note: null },
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

      <div className="app-stats app-stats-3 grid gap-4 sm:grid-cols-3">
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

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-ink">Progres Mengajar</h2>
        <p className="mt-1 text-sm text-muted">
          Target per sekolah: {CLASS_TARGET} kelas × {LESSONS_PER_CLASS} pelajaran. Pelajaran
          tuntas bila Sesi Penuh atau Sesi Terakhirnya sudah berisi presensi.
          {progress && progress.materiTerbit < LESSONS_PER_CLASS
            ? ` Saat ini baru ${progress.materiTerbit} Materi terbit, jadi target 100% belum bisa dicapai.`
            : ''}
        </p>
      </div>

      {progress === null ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Data progres tidak tersedia saat ini.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="app-stats app-stats-secondary grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ProgressStat
              label="Rata-rata Progres"
              value={`${progress.national.rataRataPersen}%`}
              note={`dari ${progress.national.totalSekolah} sekolah mitra`}
            />
            <ProgressStat
              label="Sekolah Capai Target"
              value={`${progress.national.sekolahTercapai}`}
              note={`${progress.national.sekolahMulai} sekolah sudah mulai`}
            />
            <ProgressStat
              label="Kelas Tuntas 10 Pelajaran"
              value={`${progress.national.kelasTercapai}`}
              note={`target ${progress.national.targetKelas} kelas`}
            />
            <ProgressStat
              label="Sesi Selesai"
              value={`${progress.national.sesiSelesai}`}
              note="sesi berisi presensi"
            />
          </div>

          <div className="mt-6">
            <Card>
              <CardHead title={`Sesi Selesai per Minggu (${progress.weekly.length} minggu terakhir)`} />
              <CardBody>
                <WeeklyBars weekly={progress.weekly} />
              </CardBody>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <CardHead title="Progres per Sekolah" action={<ExportGlobalButton />} />
              <CardBody className="px-0 py-0">
                <ProgressTable
                  renderedAt={renderedAt}
                  rows={progress.schools.map((s) => ({
                    schoolId: s.schoolId,
                    schoolName: s.schoolName,
                    isTest: s.isTest,
                    teacherNames: s.teacherNames,
                    jumlahGuru: s.jumlahGuru,
                    guruAktif: s.guruAktif,
                    jumlahKelas: s.jumlahKelas,
                    jumlahSiswa: s.jumlahSiswa,
                    sesiTerjadwal: s.sesiTerjadwal,
                    sesiSelesai: s.sesiSelesai,
                    sesiTerdokumentasi: s.sesiTerdokumentasi,
                    kehadiranPersen: s.kehadiranPersen,
                    pelajaranPerKelas: s.pelajaranPerKelas,
                    covered: s.progress.covered,
                    target: s.progress.target,
                    percent: s.progress.percent,
                    classesAtTarget: s.progress.classesAtTarget,
                    achieved: s.progress.achieved,
                    lastActivity: s.lastActivity ? new Date(s.lastActivity).toISOString() : null,
                  }))}
                />
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}

function ProgressStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
        <p className="mt-1 text-xs text-muted">{note}</p>
      </CardBody>
    </Card>
  );
}

const weekFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Batang mingguan sederhana (CSS) — tanpa pustaka grafik. */
function WeeklyBars({ weekly }: { weekly: WeeklySessions[] }) {
  const max = Math.max(1, ...weekly.map((w) => w.sessions));
  const total = weekly.reduce((sum, w) => sum + w.sessions, 0);
  if (total === 0) {
    return <p className="text-sm text-muted">Belum ada sesi berisi presensi dalam periode ini.</p>;
  }
  return (
    <div>
      <ol className="flex h-40 items-end gap-2" aria-label="Jumlah sesi selesai per minggu">
        {weekly.map((w) => {
          const label = weekFmt.format(new Date(`${w.weekStart}T00:00:00Z`));
          return (
            <li key={w.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] font-semibold text-ink">{w.sessions || ''}</span>
              <div
                className="w-full max-w-[36px] rounded-t-md bg-primary/80"
                style={{ height: `${Math.max(w.sessions ? 6 : 2, (w.sessions / max) * 100)}%` }}
                title={`Minggu ${label}: ${w.sessions} sesi`}
                aria-label={`Minggu ${label}: ${w.sessions} sesi`}
              />
              <span className="text-[10px] text-muted">{label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted">
        Total {total} sesi selesai · minggu dimulai Senin (WIB) · tanpa sekolah uji coba.
      </p>
    </div>
  );
}
