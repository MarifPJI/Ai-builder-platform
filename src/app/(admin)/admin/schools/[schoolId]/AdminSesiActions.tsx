'use client';

import { useState, useTransition } from 'react';

import { Toast } from '@/components/ui/Toast';

import { deleteSessionAction } from './actions';
import { updateSessionAction } from './sesi/[sessionId]/actions';

/**
 * AdminSesiActions ('use client') — aksi per baris sesi di Detail Sekolah:
 * Edit Sesi (form inline: nama + jadwal datetime-local WIB) dan Hapus Sesi
 * (destruktif, window.confirm). Komponen SENDIRI (tidak mengimpor komponen
 * guru). `updateSessionAction` diimpor dari actions level sesi (satu definisi),
 * `deleteSessionAction` dari actions level sekolah.
 *
 * `scheduledAtLocal` = prefill `datetime-local` WIB ("YYYY-MM-DDTHH:mm"),
 * dihitung di Server Component via `toWibDatetimeLocal`.
 */
export function AdminSesiActions({
  sessionId,
  schoolId,
  sessionName,
  scheduledAtLocal,
}: {
  sessionId: string;
  schoolId: string;
  sessionName: string;
  scheduledAtLocal: string;
}) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function onSubmitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    fd.set('sessionId', sessionId);
    fd.set('schoolId', schoolId);
    startSave(async () => {
      const res = await updateSessionAction({ status: 'idle' }, fd);
      setNotice(
        res.status === 'ok'
          ? { tone: 'success', message: res.message ?? 'Tersimpan.' }
          : { tone: 'error', message: res.message ?? 'Gagal menyimpan.' },
      );
      if (res.status === 'ok') setEditing(false);
    });
  }

  function onDelete() {
    const ok = window.confirm(
      `Hapus sesi "${sessionName}"? Presensi, jurnal, dan foto sesi akan ikut terhapus. Tindakan ini tidak dapat dibatalkan. (Berkas foto di penyimpanan tidak ikut terhapus.)`,
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set('sessionId', sessionId);
    fd.set('schoolId', schoolId);
    startDelete(async () => {
      const res = await deleteSessionAction({ status: 'idle' }, fd);
      if (res.status !== 'ok') {
        setNotice({ tone: 'error', message: res.message ?? 'Gagal menghapus sesi.' });
      }
      // Sukses → baris hilang setelah revalidate; tidak perlu set notice.
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-full border border-line px-3 py-1 text-xs text-ink hover:bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {editing ? 'Tutup' : 'Edit Sesi'}
        </button>
        <button
          type="button"
          disabled={deletePending}
          onClick={onDelete}
          className="rounded-full border border-line px-3 py-1 text-xs text-alfa hover:bg-alfa-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {deletePending ? 'Menghapus…' : 'Hapus Sesi'}
        </button>
      </div>

      {notice ? (
        <Toast tone={notice.tone} message={notice.message} onDismiss={() => setNotice(null)} />
      ) : null}

      {editing ? (
        <form onSubmit={onSubmitEdit} className="space-y-2 rounded-xl border border-line p-3">
          <div>
            <label
              className="mb-1 block text-xs font-medium text-ink"
              htmlFor={`sesi-name-${sessionId}`}
            >
              Nama Sesi
            </label>
            <input
              id={`sesi-name-${sessionId}`}
              name="name"
              type="text"
              defaultValue={sessionName}
              required
              className="w-full rounded-xl border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-ink"
              htmlFor={`sesi-jadwal-${sessionId}`}
            >
              Tanggal &amp; Jam (WIB)
            </label>
            <input
              id={`sesi-jadwal-${sessionId}`}
              name="scheduledAt"
              type="datetime-local"
              defaultValue={scheduledAtLocal}
              required
              className="w-full rounded-xl border border-line bg-white px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            />
          </div>
          <button
            type="submit"
            disabled={savePending}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {savePending ? 'Menyimpan…' : 'Simpan'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
