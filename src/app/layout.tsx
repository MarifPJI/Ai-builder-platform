import type { Metadata } from 'next';
import './globals.css';
import './app-theme.css';

export const metadata: Metadata = {
  title: 'AI Builder LMS & Presensi',
  description:
    'Platform LMS & Presensi program STEM Capacity Building 2026 — Prestasi Junior Indonesia × AWS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
