import { SubmitProjectForm } from './SubmitProjectForm';

/**
 * Bagian 3 — terbagi dua (public-showcase R4, R6):
 *  - KIRI: formulir publik Kirim Proyek (SubmitProjectForm, Server Action).
 *  - KANAN: kartu "Masuk ke Akun LMS" → /login (tanpa pendaftaran mandiri).
 */
export function SubmitAndLoginSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* KIRI — Formulir Kirim Proyek AI Siswa */}
      <div className="rounded-card border border-line bg-white p-6">
        <h2 className="text-xl font-semibold text-ink">Kirim Proyek AI Siswa</h2>
        <p className="mt-1 text-sm text-muted">
          Kirim karya proyek AI tim Anda. Tanpa perlu akun; proyek tampil setelah
          ditinjau Admin.
        </p>
        <div className="mt-4">
          <SubmitProjectForm />
        </div>
      </div>

      {/* KANAN — Kartu Masuk ke Akun LMS */}
      <div className="flex flex-col justify-center rounded-card bg-hero-grad p-8 text-white">
        <h2 className="text-xl font-semibold">Masuk ke Akun LMS</h2>
        <p className="mt-2 text-white/85">
          Khusus Guru Pengampu &amp; Admin Program yang telah diaktifkan Admin.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex w-fit items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-indigo hover:bg-white/90"
        >
          Masuk Akun
        </a>
        <p className="mt-4 text-sm text-white/70">
          Lupa kata sandi? Minta bantuan reset ke Admin.
        </p>
      </div>
    </div>
  );
}
