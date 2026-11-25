import type { Metadata } from 'next';

import AIBuilderHome from '@/components/public/AIBuilderHome';
import { ShowcaseSection } from '@/components/public/ShowcaseSection';
import { GallerySection } from '@/components/public/GallerySection';
import { SubmitProjectForm } from '@/components/public/SubmitProjectForm';
import './homepage.css';
import './homepage-motion.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'STEM Capacity Building | AI Builder by PJI × AWS',
  description: 'Program literasi AI dan keterampilan digital untuk guru dan siswa SMA/SMK. Pelajari kurikulum, AI Hackathon, dan karya siswa bersama PJI dan AWS Indonesia.',
};

type SearchParams = { year?: string | string[] };

function parseYear(value?: string | string[]): number | undefined {
  const year = typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(year) && year >= 2024 && year <= 2100 ? year : undefined;
}

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
