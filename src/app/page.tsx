import type { Metadata } from 'next';

import AIBuilderHome from '@/components/public/AIBuilderHome';
import { ShowcaseSection } from '@/components/public/ShowcaseSection';
import { GallerySection } from '@/components/public/GallerySection';
import { SubmitProjectForm } from '@/components/public/SubmitProjectForm';

export const dynamic = 'force-dynamic';

// Homepage metadata is local to this route; LMS metadata stays unchanged.
export const metadata: Metadata = {
  title: 'AI Builder — Dari Ide Jadi Karya | PJI × AWS',
  description: 'STEM Capacity Building 2026–2027. Kenali AI, bangun aplikasi, dan ciptakan solusi nyata bersama PJI dan AWS Indonesia.',
};

type SearchParams = { year?: string | string[] };

function parseYear(value?: string | string[]): number | undefined {
  const year = typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(year) && year >= 2024 && year <= 2100 ? year : undefined;
}

/** Keep database reads in Server Components; the client shell owns animation. */
export default async function PublicLandingPage({ searchParams }: {
  searchParams?: Promise<SearchParams>;
}) {
  // Await also accepts the plain-object searchParams supplied by older Next.js releases.
  const params = await searchParams;
  const year = parseYear(params?.year);
  return (
    <AIBuilderHome
      showcase={<ShowcaseSection />}
      gallery={<GallerySection year={year} />}
      submission={<SubmitProjectForm />}
    />
  );
}
