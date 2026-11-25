'use client';

import { usePathname } from 'next/navigation';

import { adminNav } from './adminNav';
import { AppShell } from './AppShell';
import { teacherNav } from './teacherNav';

/**
 * Kerangka halaman (skeleton) yang tampil SEGERA saat halaman dashboard sedang
 * memuat data di server (dipakai oleh `loading.tsx`). Memakai AppShell yang
 * sama agar sidebar tidak "berkedip"; hanya isi konten yang berupa placeholder.
 */
export function PageSkeleton({ role }: { role: 'admin' | 'teacher' }) {
  const nav = role === 'admin' ? adminNav : teacherNav;
  const schoolLabel = role === 'admin' ? 'Program Nasional' : 'Memuat…';
  const avatarInitials = role === 'admin' ? 'AD' : 'GU';
  const pathname = usePathname() ?? '';
  const items = nav('');
  // Item aktif = href terpanjang yang menjadi awalan pathname.
  const active = items
    .map((it) => it.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0] ?? '';

  return (
    <AppShell
      brand="AI Builder"
      nav={nav(active)}
      schoolLabel={schoolLabel}
      avatarInitials={avatarInitials}
    >
      <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse">
        <span className="sr-only">Memuat…</span>
        <div className="mb-6 space-y-2">
          <div className="h-3 w-28 rounded bg-line" />
          <div className="h-6 w-48 rounded bg-line" />
          <div className="h-4 w-72 max-w-full rounded bg-line" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-card border border-line bg-white p-4">
              <div className="h-3 w-24 rounded bg-line" />
              <div className="mt-4 h-7 w-12 rounded bg-line" />
            </div>
          ))}
        </div>
        <div className="mt-8 h-64 rounded-card border border-line bg-white" />
      </div>
    </AppShell>
  );
}
