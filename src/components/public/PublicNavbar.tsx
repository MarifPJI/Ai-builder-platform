/**
 * Navbar publik U01 — segmented pill TANPA angka/badge (public-showcase R1.4).
 * Item: Showcase Karya, Galeri Kegiatan, Kirim Proyek, Masuk Akun.
 * "Masuk Akun" menuju /login pada domain yang sama.
 */
export function PublicNavbar() {
  const items = [
    { label: 'Showcase Karya', href: '#showcase' },
    { label: 'Galeri Kegiatan', href: '#galeri' },
    { label: 'Kirim Proyek', href: '#kirim' },
    // Path relatif: login di domain yang sama (URL Vercel atau domain kustom).
    { label: 'Masuk Akun', href: '/login' },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <span className="rounded-card bg-hero-grad px-3 py-1 text-sm font-semibold text-white">
          AI Builder
        </span>
        <nav className="flex items-center gap-1 rounded-full bg-soft p-1">
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className={
                it.label === 'Masuk Akun'
                  ? 'rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover'
                  : 'rounded-full px-4 py-1.5 text-sm text-muted hover:bg-white hover:text-ink'
              }
            >
              {it.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
