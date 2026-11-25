'use client';

import { useTransition } from 'react';

import { promoteSubmissionAction, setSubmissionStatusAction } from './actions';

/**
 * Baris kiriman dengan aksi ubah status (review/record). Tidak memublikasikan
 * ke halaman publik — hanya mencatat status tinjauan.
 */
export function SubmissionActions({
  id,
  status,
}: {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <span
        className={
          status === 'approved'
            ? 'rounded-full bg-hadir-soft px-2 py-0.5 text-xs text-hadir'
            : status === 'rejected'
              ? 'rounded-full bg-alfa-soft px-2 py-0.5 text-xs text-alfa'
              : 'rounded-full bg-soft px-2 py-0.5 text-xs text-muted'
        }
      >
        {status === 'approved' ? 'Disetujui' : status === 'rejected' ? 'Ditolak' : 'Menunggu'}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setSubmissionStatusAction(id, 'approved'))}
        className="rounded-full bg-hadir-soft px-2.5 py-1 text-xs font-medium text-hadir hover:opacity-80 disabled:opacity-50"
      >
        Setujui
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setSubmissionStatusAction(id, 'rejected'))}
        className="rounded-full bg-alfa-soft px-2.5 py-1 text-xs font-medium text-alfa hover:opacity-80 disabled:opacity-50"
      >
        Tolak
      </button>
      <button
        type="button"
        disabled={pending || status !== 'approved'}
        title={
          status === 'approved'
            ? 'Terbitkan kiriman ini ke Showcase publik'
            : 'Hanya kiriman yang telah disetujui yang dapat diterbitkan'
        }
        onClick={() => start(() => promoteSubmissionAction(id))}
        className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        Terbitkan ke Showcase
      </button>
    </div>
  );
}
