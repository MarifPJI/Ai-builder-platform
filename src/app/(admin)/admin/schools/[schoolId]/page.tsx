import { notFound } from 'next/navigation';

import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireSession } from '@/lib/auth/guard';
import {
  getSchoolDetail,
  listClassesWithStudents,
  listSchoolSessions,
} from '@/lib/domain/admin-school-detail-service';
import { toWibDatetimeLocal } from '@/lib/time/wib';

import { AdminSesiActions } from './AdminSesiActions';
import { ExportSchoolButton } from './ExportSchoolButton';

/**
 * Detail Sekolah Admin (A02 → [schoolId], Fase 1, READ-ONLY).
 *
 * Server Component di dalam grup rute (admin): mewarisi guard admin & error.tsx.
 * Mengonsumsi service FEAT-001 (getSchoolDetail/listClassesWithStudents/
 * listSchoolSessions) secara fail-soft via `safe()`. TANPA aksi mutasi apa pun
 * (edit/hapus/kelola = Fase 2). Format waktu WAJIB WIB (Asia/Jakarta).
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

/** Label zona waktu Indonesia dari IANA timezone (duplikat schools/page.tsx). */
function wibLabel(iana: string): string {
  switch (iana) {
    case 'Asia/Jakarta':
      return 'WIB';
    case 'Asia/Makassar':
      return 'WITA';
    case 'Asia/Jayapura':
      return 'WIT';
    default:
      return iana;
  }
}

/** Format jadwal sesi WAJIB WIB (Asia/Jakarta). */
const dateFmt = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

export default async function SchoolDetailPage({
  params,
}: {
  params: { schoolId: string };
}) {
  const claims = await requireSession({ requireRole: 'admin' });

  const [detail, classes, sessions] = await Promise.all([
    safe(() => getSchoolDetail(claims, params.schoolId)),
    safe(() => listClassesWithStudents(claims, params.schoolId)),
    safe(() => listSchoolSessions(claims, params.schoolId)),
  ]);

  // Sekolah tak ada / tak terlihat di bawah RLS → 404.
  if (detail === null || detail === undefined) {
    notFound();
  }

  const summaryCards = [
    { label: 'Jumlah Guru', value: detail.jumlahGuru },
    { label: 'Jumlah Kelas', value: detail.jumlahKelas },
    { label: 'Jumlah Siswa', value: detail.jumlahSiswa },
    { label: 'Jumlah Sesi', value: detail.jumlahSesi },
  ];

  return (
    <AppShell
      brand="AI Builder"
      nav={adminNav('/admin/schools')}
      schoolLabel="Program Nasional"
      avatarInitials="AD"
    >
      <div className="mb-4">
        <a
          href="/admin/schools"
          className="text-sm text-muted hover:text-ink"
        >
          ← Kembali ke Daftar Sekolah
        </a>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-ink">{detail.name}</h1>
          <Badge tone="sakit">{wibLabel(detail.ianaTimezone)}</Badge>
          <span className="text-xs text-muted">{detail.ianaTimezone}</span>
        </div>
        <ExportSchoolButton schoolId={params.schoolId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-sm text-muted">{s.label}</p>
              <p className="mt-2 text-3xl font-semibold text-ink">
                {s.value === null || s.value === undefined ? '—' : s.value}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-ink">Kelas</h2>
      </div>

      {classes === null ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">
              Data kelas tidak tersedia saat ini.
            </p>
          </CardBody>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Belum ada kelas.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {classes.map((kelas) => (
            <Card key={kelas.id}>
              <details>
                <summary className="cursor-pointer list-none">
                  <CardHead
                    title={
                      kelas.name +
                      (kelas.gradeLevel ? ' — ' + kelas.gradeLevel : '')
                    }
                  />
                </summary>
                <CardBody className="p-0">
                  {kelas.students.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-muted">
                      Belum ada siswa.
                    </p>
                  ) : (
                    <Table>
                      <THead>
                        <TR>
                          <TH>NIS</TH>
                          <TH>Nama</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {kelas.students.map((siswa) => (
                          <TR key={siswa.id}>
                            <TD>{siswa.nis}</TD>
                            <TD className="font-medium">{siswa.fullName}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  )}
                </CardBody>
              </details>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-ink">Sesi</h2>
      </div>

      {sessions === null ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">
              Data sesi tidak tersedia saat ini.
            </p>
          </CardBody>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">Belum ada sesi.</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHead title="Sesi" />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Nama Sesi</TH>
                  <TH>Kelas</TH>
                  <TH>Jadwal</TH>
                  <TH>Status</TH>
                  <TH>Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">
                      <a
                        href={`/admin/schools/${params.schoolId}/sesi/${s.id}`}
                        className="text-primary hover:underline"
                      >
                        {s.name}
                      </a>
                    </TD>
                    <TD>{s.className}</TD>
                    <TD>{dateFmt.format(s.scheduledAt)}</TD>
                    <TD>
                      {s.hasAttendance ? (
                        <Badge tone="hadir">Sudah Presensi</Badge>
                      ) : (
                        <Badge tone="neutral">Terjadwal</Badge>
                      )}
                    </TD>
                    <TD>
                      <AdminSesiActions
                        sessionId={s.id}
                        schoolId={params.schoolId}
                        sessionName={s.name}
                        scheduledAtLocal={toWibDatetimeLocal(s.scheduledAt)}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </AppShell>
  );
}
