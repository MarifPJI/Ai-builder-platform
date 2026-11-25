import type { ReactNode } from 'react';
import { BrandMark } from './BrandMark';

export function PageIntro({ role, children }: { role: string; children: ReactNode }) {
  return (
    <div className="app-intro">
      <div className="app-intro-copy">
        <span className="app-eyebrow">{role} <span aria-hidden="true">/</span> AI BUILDER 2026</span>
        {children}
      </div>
      <div className="app-intro-art" aria-hidden="true"><BrandMark /><span>LET’S BUILD<br />WHAT’S NEXT.</span></div>
    </div>
  );
}
