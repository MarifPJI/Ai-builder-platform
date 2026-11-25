import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import type { ClassSummary } from '@/lib/domain/class-service';
import type { SessionRecap, SessionWithStatus } from '@/lib/domain/session-service';

// WIB (Asia/Jakarta) WAJIB di-set: server produksi berjalan di UTC, tanpa
// `timeZone` tanggal/jam akan tampil dalam UTC (bergeser -7 jam dari WIB).
const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

/**
 * PresensiOverview (T06B) — Server Component ringkasan 4 bagian layar Presensi:
 *  1. Daftar Kelas (tautan filter via `?classId=`).
 *  2. Sesi Aktif (isDue && !hasAttendance) dengan tombol buka UI pengisian.
 *  3. Sesi Terjadwal terkunci (!isDue) read-only dengan info kapan bisa diisi.
 *  4. Rekap Presensi per Sesi (listSessionRecap).
 *
 * Filter classId diterapkan di sini (default: semua kelas). Status waktu
 * (isDue) dihitung di SQL server, bukan di klien.
 */
export function PresensiOverview({
  classes,
  sessions,
  recaps,
  classId,
}: {
  classes: ClassSummary[];
  sessions: SessionWithStatus[];
  recaps: SessionRecap[];
  classId: string | null;
}) {
  const byClass = <T extends { classId: string }>(items: T[]) =>
    classId ? items.filter((i) => i.classId === classId) : items;

  const activeSessions = byClass(sessions.filter((s) => s.isDue && !s.hasAttendance));
  const lockedSessions = byClass(sessions.filter((s) => !s.isDue));

  // Rekap tidak memuat classId; peta sessionId -> classId dari sessions.
  const sessionClassId = new Map(sessions.map((s) => [s.id, s.classId]));
  const filteredRecaps = classId
    ? recaps.filter((r) => sessionClassId.get(r.id) === classId)
    : recaps;

  const sessionHref = (sessionId: string) => {
    const params = new URLSearchParams({ sessionId });
    if (classId) params.set('classId', classId);
    return `/teacher/presensi?${params.toString()}`;
  };

  return (
    <div className="grid gap-6">
      {/* 1. Daftar Kelas sebagai filter */}
      <Card>
        <CardHead title="Daftar Kelas" />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <a
              href="/teacher/presensi"
              className={filterPill(classId === null)}
              aria-current={classId === null ? 'true' : undefined}
            >
              Semua Kelas
            </a>
            {classes.map((c) => (
              <a
                key={c.id}
                href={`/teacher/presensi?classId=${c.id}`}
                className={filterPill(classId === c.id)}
                aria-current={classId === c.id ? 'true' : undefined}
              >
                {c.name}
                <span className="ml-1 text-xs opacity-70">· {c.studentCount} siswa</span>
              </a>
            ))}
            {classes.length === 0 ? (
              <p className="text-sm text-muted">
                Belum ada kelas. Buat kelas di menu Kelas.
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* 2. Sesi Aktif (fokus utama) */}
      <Card>
        <CardHead title="Sesi Aktif (perlu presensi)" />
        <CardBody className="p-0">
          {activeSessions.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              Tidak ada sesi aktif yang perlu diisi saat ini.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Sesi</TH>
                  <TH>Kelas</TH>
                  <TH>Jadwal</TH>
                  <TH className="text-right">Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {activeSessions.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD>{s.className}</TD>
                    <TD className="text-muted">{DATE_FMT.format(s.scheduledAt)}</TD>
                    <TD className="text-right">
                      <a
                        href={sessionHref(s.id)}
                        className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Isi Presensi &amp; Jurnal
                      </a>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* 3. Sesi Terjadwal (terkunci, read-only) */}
      <Card>
        <CardHead title="Sesi Terjadwal (terkunci)" />
        <CardBody className="p-0">
          {lockedSessions.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              Tidak ada sesi terjadwal yang belum tiba waktunya.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Sesi</TH>
                  <TH>Kelas</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {lockedSessions.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD>{s.className}</TD>
                    <TD className="text-muted">
                      Bisa diisi mulai {DATE_FMT.format(s.scheduledAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* 4. Rekap Presensi per Sesi */}
      <Card>
        <CardHead title="Rekap Presensi per Sesi" />
        <CardBody className="p-0">
          {filteredRecaps.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              Belum ada sesi yang terisi presensinya.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Sesi</TH>
                  <TH>Kelas</TH>
                  <TH>Jadwal</TH>
                  <TH>Hadir</TH>
                  <TH>Sakit</TH>
                  <TH>Izin</TH>
                  <TH>Alfa</TH>
                  <TH>Total Siswa</TH>
                  <TH>Jurnal</TH>
                </TR>
              </THead>
              <TBody>
                {filteredRecaps.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.name}</TD>
                    <TD>{r.className}</TD>
                    <TD className="text-muted">{DATE_FMT.format(r.scheduledAt)}</TD>
                    <TD>{r.hadir}</TD>
                    <TD>{r.sakit}</TD>
                    <TD>{r.izin}</TD>
                    <TD>{r.alfa}</TD>
                    <TD>{r.totalSiswa}</TD>
                    <TD className={r.hasJournal ? 'text-hadir' : 'text-muted'}>
                      {r.hasJournal ? 'Ada' : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function filterPill(active: boolean): string {
  const base =
    'inline-flex items-center rounded-full border px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal';
  return active
    ? `${base} border-primary bg-primary-soft font-medium text-primary`
    : `${base} border-line text-ink hover:bg-soft`;
}
