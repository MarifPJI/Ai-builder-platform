'use client';

import { useMemo, useState, useTransition } from 'react';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/validation/attendance';

import { deleteAttendanceAction, saveAttendanceAction } from './actions';

/**
 * AdminPresensiEditor ('use client') — tabel presensi editable milik ADMIN.
 * Komponen SENDIRI; TIDAK mengimpor komponen/reducer/SubmitBtn/StateToast guru.
 * Admin override waktu: editor selalu aktif (tanpa cek jadwal).
 *
 * Per baris siswa: empat tombol Hadir/Sakit/Izin/Alfa + Badge status terpilih,
 * plus tombol Hapus (konfirmasi) yang mengembalikan siswa ke "belum ditandai".
 * Tombol Simpan Presensi mengirim seluruh entri yang bertanda (status != null).
 */
interface SiswaRow {
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

const STATUS_TONE: Record<AttendanceStatus, BadgeTone> = {
  hadir: 'hadir',
  sakit: 'sakit',
  izin: 'izin',
  alfa: 'alfa',
};

export function AdminPresensiEditor({
  sessionId,
  schoolId,
  students,
}: {
  sessionId: string;
  schoolId: string;
  students: SiswaRow[];
}) {
  const [state, setState] = useState<Map<string, AttendanceStatus | null>>(
    () => new Map(students.map((s) => [s.studentId, s.status])),
  );
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const entriesPayload = useMemo(() => {
    const out: { studentId: string; status: AttendanceStatus }[] = [];
    for (const [studentId, status] of state.entries()) {
      if (status !== null) out.push({ studentId, status });
    }
    return out;
  }, [state]);

  function setRow(studentId: string, status: AttendanceStatus) {
    setState((prev) => {
      const next = new Map(prev);
      next.set(studentId, status);
      return next;
    });
  }

  function onSave() {
    const fd = new FormData();
    fd.set('sessionId', sessionId);
    fd.set('schoolId', schoolId);
    fd.set('entries', JSON.stringify(entriesPayload));
    startSave(async () => {
      const res = await saveAttendanceAction({ status: 'idle' }, fd);
      setNotice(
        res.status === 'ok'
          ? { tone: 'success', message: res.message ?? 'Tersimpan.' }
          : { tone: 'error', message: res.message ?? 'Gagal menyimpan.' },
      );
    });
  }

  function onDelete(studentId: string, fullName: string) {
    const ok = window.confirm(
      `Hapus presensi untuk ${fullName}? Status siswa ini akan kembali menjadi "Belum ditandai".`,
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set('sessionId', sessionId);
    fd.set('schoolId', schoolId);
    fd.set('studentId', studentId);
    startDelete(async () => {
      const res = await deleteAttendanceAction({ status: 'idle' }, fd);
      if (res.status === 'ok') {
        setState((prev) => {
          const next = new Map(prev);
          next.set(studentId, null);
          return next;
        });
      }
      setNotice(
        res.status === 'ok'
          ? { tone: 'success', message: res.message ?? 'Terhapus.' }
          : { tone: 'error', message: res.message ?? 'Gagal menghapus.' },
      );
    });
  }

  if (students.length === 0) {
    return <p className="px-6 py-4 text-sm text-muted">Belum ada siswa di kelas ini.</p>;
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="px-6 pt-4">
          <Toast tone={notice.tone} message={notice.message} onDismiss={() => setNotice(null)} />
        </div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>NIS</TH>
            <TH>Nama</TH>
            <TH>Status</TH>
            <TH>Tandai</TH>
            <TH>Aksi</TH>
          </TR>
        </THead>
        <TBody>
          {students.map((siswa) => {
            const current = state.get(siswa.studentId) ?? null;
            return (
              <TR key={siswa.studentId}>
                <TD>{siswa.nis}</TD>
                <TD className="font-medium">{siswa.fullName}</TD>
                <TD>
                  {current ? (
                    <Badge tone={STATUS_TONE[current]}>{STATUS_LABEL[current]}</Badge>
                  ) : (
                    <span className="text-muted">Belum ditandai</span>
                  )}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {ATTENDANCE_STATUSES.map((s) => {
                      const active = current === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setRow(siswa.studentId, s)}
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
                <TD>
                  <button
                    type="button"
                    disabled={deletePending || current === null}
                    onClick={() => onDelete(siswa.studentId, siswa.fullName)}
                    className="rounded-full border border-line px-3 py-1 text-xs text-alfa hover:bg-alfa-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    Hapus
                  </button>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <div className="px-6 pb-5">
        <button
          type="button"
          disabled={savePending}
          onClick={onSave}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {savePending ? 'Menyimpan…' : 'Simpan Presensi'}
        </button>
      </div>
    </div>
  );
}
