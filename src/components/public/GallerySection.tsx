import { listGallery } from '@/lib/domain/gallery-service';
import { Bi } from './Bi';
import { GalleryGrid } from './GalleryGrid';

/** Keep the existing public gallery and year/query-link workflow. */
export async function GallerySection({ year }: { year?: number }) {
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
  const tabs = [
    { year: undefined, key: 'all', label: <Bi id="Semua Tahun" en="All Years" /> },
    ...years.map((value) => ({ year: value, key: String(value), label: <>{value}</> })),
  ];
  return <>
    <nav className="filters gallery-filters" aria-label="Filter">
      {tabs.map((item) => {
        const href = item.year === undefined ? '/#galeri' : `/?year=${item.year}#galeri`;
        return <a key={item.key} href={href} aria-current={year === item.year ? 'page' : undefined}>{item.label}</a>;
      })}
    </nav>
    {unavailable || visible.length === 0 ? (
      <div className="empty" role="status">
        <span className="empty-spark" aria-hidden="true">✧</span>
        <h3>{unavailable
          ? <Bi id="Galeri belum dapat dimuat." en="The gallery could not be loaded." />
          : <Bi id="Cerita berikutnya segera hadir." en="The next story is coming soon." />}</h3>
        <p>{unavailable
          ? <Bi id="Silakan muat ulang halaman beberapa saat lagi." en="Please reload the page in a moment." />
          : <Bi
              id={`Dokumentasi kegiatan${year ? ` tahun ${year}` : ''} akan tampil setelah diterbitkan tim program.`}
              en={`Activity photos${year ? ` from ${year}` : ''} appear once the program team publishes them.`}
            />}</p>
      </div>
    ) : <GalleryGrid items={visible.map(({ id, year: itemYear, title, caption, imageUrl }) => ({ id, year: itemYear, title, caption, imageUrl }))} />}
  </>;
}
