import type { AppShellNavItem } from './AppShell';

/**
 * Navigasi sidebar Guru — SATU SUMBER KEBENARAN agar seluruh halaman Guru
 * menampilkan menu yang konsisten (AGENTS.md §3: TEPAT 5 menu inti Guru,
 * tidak lebih & tidak kurang).
 *
 * Pakai `teacherNav(active)` di setiap halaman Guru, dengan `active` = href
 * halaman tersebut agar item yang sesuai tersorot. Mirror `adminNav.ts`.
 */
const ITEMS: Omit<AppShellNavItem, 'active'>[] = [
  { label: 'Dashboard', href: '/teacher' },
  { label: 'Kelas', href: '/teacher/kelas' },
  { label: 'Sesi', href: '/teacher/sesi' },
  { label: 'Materi', href: '/teacher/materi' },
  { label: 'Presensi & Jurnal', href: '/teacher/presensi' },
];

/** Mengembalikan item nav Guru dengan item `activeHref` ditandai aktif. */
export function teacherNav(activeHref: string): AppShellNavItem[] {
  return ITEMS.map((it) => ({ ...it, active: it.href === activeHref }));
}
