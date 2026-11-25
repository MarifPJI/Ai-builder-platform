'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Toast, type ToastTone } from '@/components/ui/Toast';

/**
 * ExportGlobalButton — client island untuk mengunduh rekap Excel lintas seluruh
 * sekolah (`/api/admin/export/global`). Menampilkan state loading + Toast.
 */

/** Ikon unduh (inline SVG) agar tanpa dependensi aset eksternal. */
function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Ekstrak filename dari header Content-Disposition, jika ada. */
function filenameFromDisposition(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) {
    return fallback;
  }
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return match?.[1] ?? fallback;
}

export function ExportGlobalButton() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tone: ToastTone; message: string } | null>(
    null,
  );

  async function handleClick() {
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch('/api/admin/export/global');
      if (!res.ok) {
        setToast({
          tone: 'error',
          message: 'Gagal menyiapkan berkas ekspor. Silakan coba lagi.',
        });
        return;
      }
      const blob = await res.blob();
      const filename = filenameFromDisposition(
        res.headers.get('Content-Disposition'),
        'Rekap_Nasional_AI_Builder.xlsx',
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setToast({ tone: 'success', message: 'Berkas ekspor berhasil diunduh.' });
    } catch {
      setToast({
        tone: 'error',
        message: 'Terjadi kesalahan saat mengunduh. Silakan coba lagi.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="primary"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <span>Menyiapkan…</span>
        ) : (
          <>
            <DownloadIcon />
            Export Rekap Semua Sekolah
          </>
        )}
      </Button>
      {toast ? (
        <Toast
          tone={toast.tone}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
