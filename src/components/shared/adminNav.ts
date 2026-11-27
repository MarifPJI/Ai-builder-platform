import type { AppShellNavItem } from './AppShell';

/**
 * Navigasi sidebar Admin — SATU SUMBER KEBENARAN agar seluruh halaman admin
 * menampilkan menu yang konsisten (menghindari nav yang berbeda antar halaman).
 *
 * Pakai `adminNav(active)` di setiap halaman admin, dengan `active` = href
 * halaman tersebut agar item yang sesuai tersorot.
 */
const ITEMS: Omit<AppShellNavItem, 'active'>[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Sekolah', href: '/admin/schools' },
  { label: 'Akun Guru', href: '/admin/teachers' },
  { label: 'Materi', href: '/admin/materi' },
  { label: 'Showcase Karya', href: '/admin/karya' },
  { label: 'Kiriman', href: '/admin/submissions' },
];

/** Mengembalikan item nav admin dengan item `activeHref` ditandai aktif. */
export function adminNav(activeHref: string): AppShellNavItem[] {
  return ITEMS.map((it) => ({ ...it, active: it.href === activeHref }));
}
