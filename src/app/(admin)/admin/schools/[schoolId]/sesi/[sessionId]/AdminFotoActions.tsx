'use client';

import { useState, useTransition } from 'react';

import { deletePhotoAction } from './actions';

/**
 * AdminFotoActions ('use client') — membungkus satu foto dokumentasi dengan
 * tombol Hapus (destruktif, window.confirm) milik ADMIN. Hanya menghapus baris
 * DB (objek S3 dibiarkan). Komponen SENDIRI (tidak mengimpor komponen guru).
 */
export function AdminFotoActions({
  photoId,
  schoolId,
  sessionId,
  url,
}: {
  photoId: string;
  schoolId: string;
  sessionId: string;
  url: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    const ok = window.confirm(
      'Hapus foto dokumentasi ini? Baris foto akan dihapus dari data sesi. Tindakan ini tidak dapat dibatalkan.',
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set('photoId', photoId);
    fd.set('schoolId', schoolId);
    fd.set('sessionId', sessionId);
    startTransition(async () => {
      const res = await deletePhotoAction({ status: 'idle' }, fd);
      if (res.status === 'ok') {
        setHidden(true);
      } else {
        setError(res.message ?? 'Gagal menghapus foto.');
      }
    });
  }

  if (hidden) return null;

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Dokumentasi sesi"
        className="h-32 w-full rounded-card border border-line object-cover"
      />
      <button
        type="button"
        disabled={pending}
        onClick={onDelete}
        className="absolute right-2 top-2 rounded-full bg-alfa px-3 py-1 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {pending ? 'Menghapus…' : 'Hapus'}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-alfa" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
