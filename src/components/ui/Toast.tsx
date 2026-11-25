'use client';

import { cn } from '@/lib/ui/cn';

/**
 * Toast — notifikasi ringan non-blok (Client Component).
 *
 * Tone:
 * - `success` : hijau (operasi berhasil).
 * - `error`   : merah (operasi gagal).
 * - `info`    : Ocean Teal (informasi netral).
 *
 * Memakai `role="status"
      data-tone={tone}` + `aria-live="polite"` agar pembaca layar
 * mengumumkan pesan tanpa mengganggu fokus (aksesibilitas).
 */
export type ToastTone = 'success' | 'error' | 'info';

const TONES: Record<ToastTone, string> = {
  success: 'bg-hadir-soft text-hadir border-hadir/20',
  error: 'bg-alfa-soft text-alfa border-alfa/20',
  info: 'bg-teal-soft text-teal border-teal/20',
};

export interface ToastProps {
  tone?: ToastTone;
  message: string;
  onDismiss?: () => void;
}

export function Toast({ tone = 'info', message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      data-tone={tone}
      aria-live="polite"
      className={cn(
        'ui-toast flex items-center justify-between gap-4 rounded-card border px-4 py-3 text-sm',
        TONES[tone],
      )}
    >
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="text-current opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
