import { notFound } from 'next/navigation';

import { PublicNavbar } from '@/components/public/PublicNavbar';
import { getPublishedKarya } from '@/lib/domain/karya-service';

/**
 * Halaman detail Karya publik `/showcase/[id]` (public-showcase revisi).
 * Menampilkan karya yang diterbitkan Admin secara lengkap. Diakses dari kartu
 * Showcase di halaman publik. 404 bila tidak ada/belum terbit.
 */
export const dynamic = 'force-dynamic';

export default async function KaryaDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const karya = await getPublishedKarya(params.id);
  if (!karya) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <PublicNavbar />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <a href="/#showcase" className="text-sm text-teal hover:underline">
          ← Kembali ke Showcase
        </a>

        <article className="mt-4 rounded-card border border-line bg-white p-6 md:p-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              {karya.type === 'student' ? 'Proyek Siswa' : 'Inovasi Guru'}
            </span>
            <span className="text-xs text-muted">{karya.category}</span>
          </div>

          <h1 className="text-2xl font-semibold text-ink md:text-3xl">
            {karya.title}
          </h1>
          <p className="mt-1 text-sm text-muted">{karya.schoolName}</p>
          {karya.mentor ? (
            <p className="mt-1 text-sm text-muted">Pembimbing: {karya.mentor}</p>
          ) : null}

          {karya.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={karya.imageUrl}
              alt={karya.title}
              className="mt-5 w-full rounded-card object-cover"
            />
          ) : null}

          <section className="mt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Ringkasan Solusi AI
            </h2>
            <p className="mt-2 whitespace-pre-line text-ink/90">{karya.summary}</p>
          </section>

          {karya.detail ? (
            <section className="mt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Detail
              </h2>
              <p className="mt-2 whitespace-pre-line text-ink/90">{karya.detail}</p>
            </section>
          ) : null}

          {karya.demoUrl ? (
            <a
              href={karya.demoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Lihat Demo →
            </a>
          ) : null}
        </article>
      </main>
    </div>
  );
}
