'use client';

import { useState, useTransition } from 'react';

import { Toast } from '@/components/ui/Toast';
import { JOURNAL_NOTES_MAX } from '@/lib/validation/attendance';

import { deleteJournalAction, saveJournalAction } from './actions';

/**
 * AdminJurnalEditor ('use client') — editor jurnal sesi milik ADMIN. Komponen
 * SENDIRI (tidak mengimpor komponen guru). Textarea (maks JOURNAL_NOTES_MAX,
 * prefill) + Simpan Jurnal (non-destruktif) + Hapus Jurnal (destruktif,
 * window.confirm). Admin override waktu: selalu aktif.
 */
export function AdminJurnalEditor({
  sessionId,
  schoolId,
  journalNotes,
}: {
  sessionId: string;
  schoolId: string;
  journalNotes: string | null;
}) {
  const [notes, setNotes] = useState(journalNotes ?? '');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function onSave() {
    const fd = new FormData();
    fd.set('sessionId', sessionId);
    fd.set('schoolId', schoolId);
    fd.set('notes', notes.trim());
    startSave(async () => {
      const res = await saveJournalAction({ status: 'idle' }, fd);
      setNotice(
        res.status === 'ok'
          ? { tone: 'success', message: res.message ?? 'Tersimpan.' }
          : { tone: 'error', message: res.message ?? 'Gagal menyimpan.' },
      );
    });
  }

  function onDelete() {
    const ok = window.confirm('Hapus catatan jurnal sesi ini? Tindakan ini tidak dapat dibatalkan.');
    if (!ok) return;
    const fd = new FormData();
    fd.set('sessionId', sessionId);
    fd.set('schoolId', schoolId);
    startDelete(async () => {
      const res = await deleteJournalAction({ status: 'idle' }, fd);
      if (res.status === 'ok') setNotes('');
      setNotice(
        res.status === 'ok'
          ? { tone: 'success', message: res.message ?? 'Terhapus.' }
          : { tone: 'error', message: res.message ?? 'Gagal menghapus.' },
      );
    });
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <Toast tone={notice.tone} message={notice.message} onDismiss={() => setNotice(null)} />
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="admin-journal-notes">
          Catatan Jurnal
        </label>
        <textarea
          id="admin-journal-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={JOURNAL_NOTES_MAX}
          rows={5}
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={savePending}
          onClick={onSave}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {savePending ? 'Menyimpan…' : 'Simpan Jurnal'}
        </button>
        <button
          type="button"
          disabled={deletePending}
          onClick={onDelete}
          className="rounded-full border border-line px-5 py-2 text-sm font-medium text-alfa hover:bg-alfa-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {deletePending ? 'Menghapus…' : 'Hapus Jurnal'}
        </button>
      </div>
    </div>
  );
}
