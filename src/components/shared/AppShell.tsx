'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { logoutAction } from '@/app/actions/logout';
import { AppIcon, type AppIconName } from './AppIcon';
import { BrandMark } from './BrandMark';

export interface AppShellNavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface AppShellProps {
  brand: string;
  nav: AppShellNavItem[];
  schoolLabel: string;
  avatarInitials: string;
  children: ReactNode;
}

const NAV_ICONS: Record<string, AppIconName> = {
  admin: 'dashboard', teacher: 'dashboard', schools: 'school', teachers: 'users',
  materi: 'book', karya: 'spark', galeri: 'image', submissions: 'inbox',
  kelas: 'users', sesi: 'calendar', presensi: 'check',
};

/** Responsive presentation; role, school scope and logout stay server-owned. */
export function AppShell({ brand, nav, schoolLabel, avatarInitials, children }: AppShellProps) {
  // CSS supplies the initial desktop/mobile layout before hydration.
  const [sidebarOpen, setSidebarOpen] = useState<boolean | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const expanded = sidebarOpen ?? isDesktop;

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => { setIsDesktop(media.matches); setSidebarOpen(null); };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!expanded || isDesktop) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    controls()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false);
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKey);
      toggleRef.current?.focus();
    };
  }, [expanded, isDesktop]);

  return (
    <div className="lms-app" data-sidebar={sidebarOpen === null ? 'auto' : sidebarOpen ? 'open' : 'closed'}>
      <a href="#app-content" className="app-skip-link">Langsung ke konten</a>
      {expanded && !isDesktop ? <button type="button" tabIndex={-1} aria-label="Tutup menu" onClick={() => setSidebarOpen(false)} className="app-backdrop" /> : null}
      <aside id="app-navigation" ref={sidebarRef} className="app-sidebar" aria-label="Menu utama">
        <div className="app-brand-row">
          <span className="app-brand"><BrandMark />{brand}<span className="app-brand-dot">®</span></span>
          <button type="button" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)} className="app-icon-button app-close-menu"><AppIcon name="close" /></button>
        </div>
        <p className="app-nav-label">RUANG BELAJAR &amp; BERKARYA</p>
        <nav aria-label="Navigasi aplikasi">
          <ul className="app-nav-list">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} aria-current={item.active ? 'page' : undefined} className="app-nav-link" onClick={() => { if (!isDesktop) setSidebarOpen(false); }}>
                  <AppIcon name={NAV_ICONS[item.href.split('/').filter(Boolean).pop() ?? ''] ?? 'book'} />
                  <span>{item.label}</span>
                  {item.active ? <span className="app-nav-dot" aria-hidden="true" /> : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="app-sidebar-note">
          <BrandMark />
          <p>Ide kecil.<br /><strong>Dampak besar.</strong></p>
          <span>STEM CAPACITY BUILDING 2026</span>
        </div>
        <p className="app-sidebar-partners">Prestasi Junior Indonesia <span>×</span> AWS</p>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="app-topbar-start">
            <button ref={toggleRef} type="button" onClick={() => setSidebarOpen(!expanded)} aria-label={expanded ? 'Sembunyikan menu' : 'Tampilkan menu'} aria-expanded={expanded} aria-controls="app-navigation" className="app-icon-button app-menu-toggle"><AppIcon name="menu" /></button>
          </div>
          <div className="app-topbar-actions">
            <button type="button" aria-label="Notifikasi" className="app-icon-button app-notifications"><AppIcon name="bell" /></button>
            <span className="app-school" title={`Sekolah terkunci: ${schoolLabel}`}><AppIcon name="lock" /><span>{schoolLabel}</span></span>
            <span className="app-avatar" aria-label="Profil pengguna">{avatarInitials}</span>
            <form action={logoutAction}><button type="submit" className="app-logout"><AppIcon name="logout" /><span>Keluar</span></button></form>
          </div>
        </header>
        <main id="app-content" tabIndex={-1} className="app-content">{children}</main>
        <footer className="app-footer"><span>AI Builder <span aria-hidden="true">✳</span> Belajar. Bereksperimen. Berkarya.</span><span>STEM Capacity Building 2026</span></footer>
      </div>
    </div>
  );
}
