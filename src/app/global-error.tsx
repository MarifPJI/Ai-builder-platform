'use client';

/**
 * global-error — boundary catch-all tingkat root aplikasi.
 *
 * Karena `global-error.tsx` MENGGANTIKAN root layout saat aktif, komponen ini
 * WAJIB merender `<html>` dan `<body>` miliknya sendiri (aturan Next.js App
 * Router). Menyajikan pesan generik berbahasa Indonesia + tombol coba lagi
 * (`reset`) sebagai jaring pengaman terakhir untuk error tak tertangani.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
          <div className="w-full max-w-md rounded-card border border-line bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-alfa-soft text-alfa">
              ⚠️
            </div>
            <h1 className="text-lg font-semibold text-ink">Terjadi Kesalahan</h1>
            <p className="mt-2 text-sm text-muted">
              Maaf, terjadi kesalahan tak terduga. Silakan muat ulang halaman.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Coba Lagi
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
