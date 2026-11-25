import { listPublishedKarya } from '@/lib/domain/karya-service';

/** Only admin-published karya belong here; pending submissions stay private. */
export async function ShowcaseSection({ filter = 'student', year }: {
  filter?: 'student' | 'teacher';
  year?: number;
}) {
  let projects: Awaited<ReturnType<typeof listPublishedKarya>> = [];
  let unavailable = false;
  try {
    projects = await listPublishedKarya(filter);
  } catch (error) {
    console.error('[public] ShowcaseSection listPublishedKarya gagal:', error);
    unavailable = true;
  }
  const tabs = [
    { key: 'student', label: 'Proyek Siswa' },
    { key: 'teacher', label: 'Inovasi Guru' },
  ] as const;
  return <>
    <nav className="filters" aria-label="Filter karya">
      {tabs.map((item) => {
        const query = new URLSearchParams({ showcase: item.key });
        if (year !== undefined) query.set('year', String(year));
        return <a key={item.key} href={`/?${query.toString()}#karya-terbit`} aria-current={filter === item.key ? 'page' : undefined}>{item.label}</a>;
      })}
    </nav>
    {unavailable || projects.length === 0 ? (
      <div className="empty" role="status">
        <span className="empty-spark" aria-hidden="true">✧</span>
        <h3>{unavailable ? 'Karya belum dapat dimuat.' : 'Panggungnya siap. Karyamu berikutnya?'}</h3>
        <p>{unavailable ? 'Silakan muat ulang halaman beberapa saat lagi.' : `Belum ada ${filter === 'student' ? 'proyek siswa' : 'inovasi guru'} yang dipublikasikan. Karya akan tampil setelah diterbitkan tim program.`}</p>
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
            <div className="project-meta"><span>{project.type === 'student' ? 'Proyek Siswa' : 'Inovasi Guru'}</span><span>{project.category}</span></div>
            <h3>{project.title}</h3><span className="project-school">{project.schoolName}</span><p>{project.summary}</p>
            <a href={`/showcase/${encodeURIComponent(project.id)}`}>Lihat detail karya <span aria-hidden="true">↗</span></a>
          </div>
        </article>)}
      </div>
    )}
  </>;
}
