'use client';

import { AccessDenied } from '@/components/shared/AccessDenied';

/**
 * Error boundary rute Guru — memetakan error dari Session_Guard ke layar ramah
 * berbahasa Indonesia alih-alih 500 mentah (gejala produksi: Guru belum aktif
 * di `/teacher` → `InactiveAccountError` tanpa boundary → 500).
 *
 * Session_Guard (`requireSession`) melempar:
 *   - `InactiveAccountError` → Guru belum aktif (R2.1/R2.2) → layar "hubungi Admin".
 *   - `AccessDeniedError`    → peran/isolasi tenancy (R3.12/R4.6) → `X04` (AccessDenied).
 *
 * PENTING: pencocokan dilakukan atas `error.name` (string), BUKAN `instanceof` —
 * identitas kelas hilang melintasi batas server/klien dan melalui digest Next.js.
 * Error lain → fallback generik dengan tombol coba lagi (`reset`).
 */
export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (error.name === 'InactiveAccountError') {
    return (
      <main className="lms-status flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md rounded-card border border-line bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-izin-soft text-izin">
            ⏳
          </div>
          <h1 className="text-lg font-semibold text-ink">Akun Belum Aktif</h1>
          <p className="mt-2 text-sm text-muted">
            Akun Anda belum aktif. Silakan hubungi Admin sekolah Anda.
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Kembali ke Login
          </a>
        </div>
      </main>
    );
  }

  if (error.name === 'AccessDeniedError') {
    return <AccessDenied message={error.message} />;
  }

  return (
    <main className="lms-status flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-card border border-line bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-alfa-soft text-alfa">
          ⚠️
        </div>
        <h1 className="text-lg font-semibold text-ink">Terjadi Kesalahan</h1>
        <p className="mt-2 text-sm text-muted">
          Maaf, terjadi kesalahan saat memuat halaman. Silakan coba lagi.
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
  );
}
