import { listPublishedKarya } from '@/lib/domain/karya-service';
import { Bi } from './Bi';

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
    { key: 'student', label: <Bi id="Proyek Siswa" en="Student Projects" /> },
    { key: 'teacher', label: <Bi id="Inovasi Guru" en="Teacher Innovations" /> },
  ] as const;
  const kind = filter === 'student'
    ? { id: 'proyek siswa', en: 'student projects' }
    : { id: 'inovasi guru', en: 'teacher innovations' };
  return <>
    <nav className="filters" aria-label="Filter">
      {tabs.map((item) => {
        const query = new URLSearchParams({ showcase: item.key });
        if (year !== undefined) query.set('year', String(year));
        return <a key={item.key} href={`/?${query.toString()}#karya-terbit`} aria-current={filter === item.key ? 'page' : undefined}>{item.label}</a>;
      })}
    </nav>
    {unavailable || projects.length === 0 ? (
      <div className="empty" role="status">
        <span className="empty-spark" aria-hidden="true">✧</span>
        <h3>{unavailable
          ? <Bi id="Karya belum dapat dimuat." en="Projects could not be loaded." />
          : <Bi id="Panggungnya siap. Karyamu berikutnya?" en="The stage is set. Is your project next?" />}</h3>
        <p>{unavailable
          ? <Bi id="Silakan muat ulang halaman beberapa saat lagi." en="Please reload the page in a moment." />
          : <Bi
              id={`Belum ada ${kind.id} yang dipublikasikan. Karya akan tampil setelah diterbitkan tim program.`}
              en={`No ${kind.en} have been published yet. Projects appear once the program team publishes them.`}
            />}</p>
        {!unavailable && <a className="text-link" href="#kirim"><Bi id="Siapkan proyekmu" en="Prepare your project" /> <span aria-hidden="true">→</span></a>}
      </div>
    ) : (
      <div className="project-grid">
        {projects.map((project) => <article className="project-card" key={project.id}>
          {project.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="published-image" src={project.imageUrl} alt={project.title} loading="lazy" />
          )}
          <div className="project-body">
            <div className="project-meta">
              <span>{project.type === 'student' ? <Bi id="Proyek Siswa" en="Student Project" /> : <Bi id="Inovasi Guru" en="Teacher Innovation" />}</span>
              <span>{project.category}</span>
            </div>
            <h3>{project.title}</h3><span className="project-school">{project.schoolName}</span><p>{project.summary}</p>
            <a href={`/showcase/${encodeURIComponent(project.id)}`}><Bi id="Lihat detail karya" en="View project details" /> <span aria-hidden="true">↗</span></a>
          </div>
        </article>)}
      </div>
    )}
  </>;
}
