import Link from 'next/link';

import { listGallery } from '@/lib/domain/gallery-service';
import { GalleryGrid } from './GalleryGrid';

/** Keep the existing public gallery and year/query-link workflow. */
export async function GallerySection({ year }: {
  year?: number;
}) {
  let items: Awaited<ReturnType<typeof listGallery>> = [];
  let unavailable = false;
  try {
    items = await listGallery();
  } catch (error) {
    console.error('[public] GallerySection listGallery gagal:', error);
    unavailable = true;
  }
  const years = Array.from(new Set([2024, 2025, 2026, ...(year ? [year] : []), ...items.map((item) => item.year)])).sort((a, b) => a - b);
  const visible = year === undefined ? items : items.filter((item) => item.year === year);
  const tabs = [{ year: undefined, label: 'Semua Tahun' }, ...years.map((value) => ({ year: value, label: String(value) }))];
  return <>
    <nav className="filters gallery-filters" aria-label="Filter tahun galeri">
      {tabs.map((item) => {
        const query = new URLSearchParams();
        if (item.year !== undefined) query.set('year', String(item.year));
        const href = query.toString() ? `/?${query.toString()}#galeri` : '/#galeri';
        return <Link key={item.label} href={href} scroll={false} aria-current={year === item.year ? 'page' : undefined}>{item.label}</Link>;
      })}
    </nav>
    {unavailable || visible.length === 0 ? (
      <div className="empty" role="status">
        <span className="empty-spark" aria-hidden="true">✧</span>
        <h3>{unavailable ? 'Galeri belum dapat dimuat.' : 'Cerita berikutnya segera hadir.'}</h3>
        <p>{unavailable ? 'Silakan muat ulang halaman beberapa saat lagi.' : `Dokumentasi kegiatan${year ? ` tahun ${year}` : ''} akan tampil setelah diterbitkan tim program.`}</p>
      </div>
    ) : <GalleryGrid items={visible.map(({ id, year: itemYear, title, caption, imageUrl }) => ({ id, year: itemYear, title, caption, imageUrl }))} />}
  </>;
}
