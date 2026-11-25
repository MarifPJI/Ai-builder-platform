import { listPublishedKarya } from '@/lib/domain/karya-service';

/**
 * Showcase publik — hanya menampilkan karya yang diterbitkan Admin. Kiriman
 * pending tetap privat. Satu jenis karya saja ("Inovasi Siswa"); tidak ada
 * filter jenis.
 */
export async function ShowcaseSection() {
  let projects: Awaited<ReturnType<typeof listPublishedKarya>> = [];
  let unavailable = false;
  try {
    projects = await listPublishedKarya('all');
  } catch (error) {
    console.error('[public] ShowcaseSection listPublishedKarya gagal:', error);
    unavailable = true;
  }
  return <>
    {unavailable || projects.length === 0 ? (
      <div className="empty" role="status">
        <span className="empty-spark" aria-hidden="true">✧</span>
        <h3>{unavailable ? 'Karya belum dapat dimuat.' : 'Panggungnya siap. Karyamu berikutnya?'}</h3>
        <p>{unavailable ? 'Silakan muat ulang halaman beberapa saat lagi.' : 'Belum ada inovasi siswa yang dipublikasikan. Karya akan tampil setelah diterbitkan tim program.'}</p>
        {!unavailable && <a className="text-link" href="#kirim">Siapkan proyekmu <span aria-hidden="true">→</span></a>}
      </div>
    ) : (
      <div className="project-grid">
        {projects.map((project) => <article className="project-card" key={project.id}>
          {project.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="published-image" src={project.imageUrl} alt={project.title} loading="lazy" />
          )}
          <div className="project-body">
            <div className="project-meta"><span>Inovasi Siswa</span><span>{project.category}</span></div>
            <h3>{project.title}</h3><span className="project-school">{project.schoolName}</span><p>{project.summary}</p>
            <a href={`/showcase/${encodeURIComponent(project.id)}`}>Lihat detail karya <span aria-hidden="true">↗</span></a>
          </div>
        </article>)}
      </div>
    )}
  </>;
}
