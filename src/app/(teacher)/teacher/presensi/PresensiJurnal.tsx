'use client';

import { useMemo, useState, useTransition } from 'react';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import type { AttendanceStatus } from '@/lib/validation/attendance';

import { saveAttendanceAndJournalAction } from './actions';
import {
  applyToChecked,
  markAllPresent,
  seedState,
  setRow,
  STATUS_VALUES,
  summarize,
  toSavePayload,
  type AttendanceStateMap,
} from './reducer';

interface RowLite {
  studentId: string;
  nis: string;
  fullName: string;
  status: AttendanceStatus | null;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alfa: 'Alfa',
};

/**
 * PresensiJurnal (T06B, 'use client') — tabel presensi LANGSUNG + jurnal + satu
 * tombol simpan. Mengikuti aturan ketat AGENTS.md §3:
 *  - "✓ Hadir Semua", multi-select + "Ubah ke:" + "Terapkan", tombol per-baris.
 *  - TANPA tab "Tempel Bulk".
 *  - Satu <textarea> "Catatan Sesi (Opsional)" TANPA chip pilihan cepat.
 *  - SATU tombol utama "✓ Simpan Presensi & Jurnal".
 * Logika state murni berada di `reducer.ts` (dapat diuji unit).
 */
export function PresensiJurnal({
  sessionId,
  rows,
}: {
  sessionId: string;
  rows: RowLite[];
}) {
  const [state, setState] = useState<AttendanceStateMap>(() =>
    seedState(rows.map((r) => ({ studentId: r.studentId, status: r.status }))),
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('hadir');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => summarize(state), [state]);

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSave() {
    const entries = toSavePayload(state);
    startTransition(async () => {
      const res = await saveAttendanceAndJournalAction(
        sessionId,
        entries,
        notes.trim() === '' ? null : notes,
      );
      setNotice(
        res.status === 'ok'
          ? { tone: 'success', message: res.message ?? 'Tersimpan.' }
          : { tone: 'error', message: res.message ?? 'Gagal menyimpan.' },
      );
    });
  }

  return (
    <Card>
      <CardHead title="Presensi Siswa" />
      <CardBody className="space-y-4">
        {notice ? <Toast tone={notice.tone} message={notice.message} /> : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted">Tidak ada siswa pada kelas sesi ini.</p>
        ) : (
          <>
            {/* Aksi massal */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setState((s) => markAllPresent(s))}
                className="rounded-full bg-hadir-soft px-4 py-1.5 text-sm font-medium text-hadir hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                ✓ Hadir Semua
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted" htmlFor="bulk-status">
                  Ubah ke:
                </label>
                <select
                  id="bulk-status"
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
                  className="rounded-xl border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={checked.size === 0}
                  onClick={() => setState((s) => applyToChecked(s, checked, bulkStatus))}
                  className="rounded-full border border-line px-4 py-1.5 text-sm text-ink hover:bg-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  Terapkan
                </button>
              </div>
            </div>

            {/* Ringkasan berjalan */}
            <p className="text-sm text-muted">
              {summary.hadir} Hadir · {summary.sakit} Sakit · {summary.izin} Izin ·{' '}
              {summary.alfa} Alfa
            </p>

            {/* Tabel presensi langsung */}
            <Table>
              <THead>
                <TR>
                  <TH className="w-10" aria-label="Pilih" />
                  <TH>Nama</TH>
                  <TH>NIS</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => {
                  const current = state.get(r.studentId) ?? null;
                  return (
                    <TR key={r.studentId}>
                      <TD>
                        <input
                          type="checkbox"
                          checked={checked.has(r.studentId)}
                          onChange={() => toggleChecked(r.studentId)}
                          aria-label={`Pilih ${r.fullName}`}
                          className="h-4 w-4 rounded border-line text-primary focus:ring-teal"
                        />
                      </TD>
                      <TD className="font-medium">{r.fullName}</TD>
                      <TD className="text-muted">{r.nis}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {STATUS_VALUES.map((s) => {
                            const active = current === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                aria-pressed={active}
                                onClick={() => setState((st) => setRow(st, r.studentId, s))}
                                className={
                                  active
                                    ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal'
                                    : 'rounded-full border border-line px-3 py-1 text-xs text-muted hover:bg-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal'
                                }
                              >
                                {STATUS_LABEL[s]}
                              </button>
                            );
                          })}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </>
        )}

        {/* Catatan sesi — satu textarea, TANPA chip pilihan cepat */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="session-notes">
            Catatan Sesi (Opsional)
          </label>
          <textarea
            id="session-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          />
        </div>

        {/* Satu tombol utama */}
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {pending ? 'Menyimpan…' : '✓ Simpan Presensi & Jurnal'}
        </button>
      </CardBody>
    </Card>
  );
}
