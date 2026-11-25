/**
 * AccessDenied — layar `X04` (Akses Ditolak) berbahasa Indonesia.
 *
 * Ditampilkan ketika peran tidak berhak (R3.12) atau Guru mencoba mengakses
 * data di luar sekolahnya (R4.6). Session_Guard melempar `AccessDeniedError`;
 * layar yang memakai guard menangkap error tersebut dan merender komponen ini
 * (mis. lewat `error.tsx` boundary atau pengecekan di Route Handler/halaman).
 *
 * Komponen presentasional murni (Server Component) — tidak memuat logika
 * otorisasi; otorisasi ditegakkan di server + RLS (UI hiding bukan authorization).
 */
export interface AccessDeniedProps {
  /** Pesan opsional; default pesan generik berbahasa Indonesia. */
  message?: string;
}

export function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <main className="lms-status flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-card border border-line bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-alfa-soft text-alfa">
          🔒
        </div>
        <h1 className="text-lg font-semibold text-ink">Akses Ditolak</h1>
        <p className="mt-2 text-sm text-muted">
          {message ??
            'Anda tidak memiliki hak untuk mengakses halaman ini. Jika menurut ' +
              'Anda ini keliru, silakan hubungi Admin program.'}
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Kembali ke Beranda
        </a>
      </div>
    </main>
  );
}
