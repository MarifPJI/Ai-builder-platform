import type { Metadata } from 'next';

import AIBuilderHome from '@/components/public/AIBuilderHome';
import { ShowcaseSection } from '@/components/public/ShowcaseSection';
import { SubmitProjectForm } from '@/components/public/SubmitProjectForm';
import './homepage.css';
import './homepage-motion.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'STEM Capacity Building | AI Builder by PJI × AWS',
  description: 'Program literasi AI dan keterampilan digital untuk guru dan siswa SMA/SMK. Pelajari kurikulum, AI Hackathon, dan karya siswa bersama PJI dan AWS Indonesia.',
};

export default function PublicLandingPage() {
  return (
    <AIBuilderHome
      showcase={<ShowcaseSection />}
      submission={<SubmitProjectForm />}
    />
  );
}
