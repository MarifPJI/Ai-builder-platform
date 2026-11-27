'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';

/** Baris tabel siap-serialisasi (tanggal sebagai ISO string). */
export interface ProgressTableRow {
  schoolId: string;
  schoolName: string;
  isTest: boolean;
  teacherNames: string | null;
  jumlahGuru: number;
  guruAktif: number;
  jumlahKelas: number;
  jumlahSiswa: number;
  sesiTerjadwal: number;
  sesiSelesai: number;
  sesiTerdokumentasi: number;
  kehadiranPersen: number | null;
  pelajaranPerKelas: { className: string; completed: number }[];
  covered: number;
  target: number;
  percent: number;
  classesAtTarget: number;
  achieved: boolean;
  lastActivity: string | null;
}

type SortKey = 'progress-asc' | 'progress-desc' | 'name' | 'activity-asc';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'progress-asc', label: 'Progres terendah' },
  { key: 'progress-desc', label: 'Progres tertinggi' },
  { key: 'activity-asc', label: 'Aktivitas paling lama' },
  { key: 'name', label: 'Nama sekolah (A–Z)' },
];

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' });

function daysAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

function compare(a: ProgressTableRow, b: ProgressTableRow, key: SortKey): number {
  switch (key) {
    case 'progress-asc':
      return a.percent - b.percent || a.schoolName.localeCompare(b.schoolName);
    case 'progress-desc':
      return b.percent - a.percent || a.schoolName.localeCompare(b.schoolName);
    case 'activity-asc': {
      const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return ta - tb || a.schoolName.localeCompare(b.schoolName);
    }
    case 'name':
      return a.schoolName.localeCompare(b.schoolName);
  }
}

export function ProgressTable({ rows, renderedAt }: { rows: ProgressTableRow[]; renderedAt: number }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('progress-asc');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          !q ||
          r.schoolName.toLowerCase().includes(q) ||
          (r.teacherNames ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => compare(a, b, sort));
  }, [rows, query, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="progress-search" className="mb-1 block text-xs font-medium text-muted">
            Cari sekolah atau guru
          </label>
          <input
            id="progress-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="mis. SMAN 4 Depok"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          />
        </div>
        <div>
          <label htmlFor="progress-sort" className="mb-1 block text-xs font-medium text-muted">
            Urutkan
          </label>
          <select
            id="progress-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {visible.length} dari {rows.length} sekolah
        </p>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Sekolah &amp; Guru</TH>
            <TH className="min-w-[190px]">Progres Pelajaran</TH>
            <TH className="text-right">Kelas</TH>
            <TH className="text-right">Siswa</TH>
            <TH className="text-right">Sesi Selesai</TH>
            <TH className="text-right">Kehadiran</TH>
            <TH className="text-right">Terdokumentasi</TH>
            <TH>Aktivitas Terakhir</TH>
          </TR>
        </THead>
        <TBody>
          {visible.length === 0 ? (
            <TR>
              <TD colSpan={8} className="text-muted">
                Tidak ada sekolah yang cocok.
              </TD>
            </TR>
          ) : (
            visible.map((r) => (
              <TR key={r.schoolId}>
                <TD className="min-w-[200px]">
                  <a
                    href={`/admin/schools/${encodeURIComponent(r.schoolId)}`}
                    className="font-medium text-ink hover:text-primary hover:underline"
                  >
                    {r.schoolName}
                  </a>
                  {r.isTest ? (
                    <span className="ml-2">
                      <Badge tone="neutral">Uji coba</Badge>
                    </span>
                  ) : null}
                  <p className="mt-0.5 text-xs text-muted">
                    {r.teacherNames ?? 'Belum ada akun guru'}
                    {r.jumlahGuru > r.guruAktif ? ' · belum aktif' : ''}
                  </p>
                </TD>
                <TD>
                  <ProgressCell row={r} />
                </TD>
                <TD className="text-right">{r.jumlahKelas}</TD>
                <TD className="text-right">{r.jumlahSiswa}</TD>
                <TD className="text-right">
                  {r.sesiSelesai}
                  <span className="text-muted"> / {r.sesiTerjadwal}</span>
                </TD>
                <TD className="text-right">{r.kehadiranPersen === null ? '—' : `${r.kehadiranPersen}%`}</TD>
                <TD className="text-right">
                  {r.sesiSelesai === 0 ? '—' : `${r.sesiTerdokumentasi} / ${r.sesiSelesai}`}
                </TD>
                <TD className="whitespace-nowrap">
                  {r.lastActivity ? (
                    <>
                      {dateFmt.format(new Date(r.lastActivity))}
                      <p className="text-xs text-muted">{daysAgo(r.lastActivity, renderedAt)} hari lalu</p>
                    </>
                  ) : (
                    <span className="text-muted">Belum ada</span>
                  )}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </div>
  );
}

function ProgressCell({ row }: { row: ProgressTableRow }) {
  const detail =
    row.pelajaranPerKelas.length === 0
      ? 'Belum ada kelas'
      : row.pelajaranPerKelas.map((c) => `${c.className}: ${c.completed}/10`).join(' · ');
  return (
    <div title={detail}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink">{row.percent}%</span>
        <span className="text-muted">
          {row.covered}/{row.target} pelajaran
        </span>
      </div>
      <div
        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={row.percent}
        aria-label={`Progres ${row.schoolName}`}
      >
        <div
          className={row.achieved ? 'h-full rounded-full bg-hadir' : 'h-full rounded-full bg-primary'}
          style={{ width: `${row.percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {row.achieved ? 'Target tercapai' : `${row.classesAtTarget}/3 kelas tuntas`}
      </p>
    </div>
  );
}
