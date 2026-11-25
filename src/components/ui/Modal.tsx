'use client';

import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

import { Button } from './Button';

/**
 * Modal — dialog overlay Apple HIG (Client Component).
 *
 * Aksesibilitas:
 * - `role="dialog"` + `aria-modal` + `aria-labelledby` menuju judul.
 * - Menutup saat tombol Escape ditekan atau backdrop diklik.
 * - Fokus ring Ocean Teal pada kontrol di dalamnya (via Button).
 *
 * Komponen ini sengaja minimal (tanpa trap fokus penuh) sebagai dasar; layar
 * yang memakainya dapat memperkaya sesuai kebutuhan.
 */
export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-hidden={false}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Tutup dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'ui-modal relative z-10 w-full max-w-lg rounded-card border border-line bg-white shadow-xl',
        )}
      >
        <div className="ui-modal-head flex items-center justify-between border-b border-line px-6 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-ink">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup">
            ✕
          </Button>
        </div>
        <div className="ui-modal-body px-6 py-5">{children}</div>
        {footer ? (
          <div className="ui-modal-footer flex justify-end gap-2 border-t border-line px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
