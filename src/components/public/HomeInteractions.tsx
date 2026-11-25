'use client';

import Image from 'next/image';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import brandImage from './home-assets/ai-builder.png';
import footerRobot from './home-assets/footer-robot.webp';
import { curriculum, heroPhotos, LMS_URL, programPhases } from './home-content';
import { HomeIcon, HomeSpark } from './HomeIcons';

const numberFormat = new Intl.NumberFormat('id-ID');
const twoDigits = (index: number) => String(index + 1).padStart(2, '0');

export function HomeNavigation() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const linksId = useId();

  function dismissMenu(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      setOpen(false);
      menuButton.current?.focus();
    }
  }

  return (
    <nav className="home-nav" aria-label="Navigasi utama" onKeyDown={dismissMenu}>
      <div className="home-nav-inner">
        <a href="#top" className="home-brand" onClick={() => setOpen(false)}>
          <Image unoptimized src={brandImage} alt="AI Builder by PJI Ã— AWS Â· Beranda" loading="eager" />
        </a>
        <button
          className="home-menu-toggle"
          type="button"
          ref={menuButton}
          aria-controls={linksId}
          aria-expanded={open}
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          onClick={() => setOpen(!open)}
        >
          <HomeIcon name={open ? 'close' : 'menu'} size={22} />
        </button>
        <div id={linksId} className="home-nav-links" data-open={open}>
          <a href="#program" onClick={() => setOpen(false)}>Program</a>
          <a href="#kurikulum" onClick={() => setOpen(false)}>Kurikulum</a>
          <a href="#showcase" onClick={() => setOpen(false)}>Karya Siswa</a>
          <a className="home-nav-lms" href={LMS_URL} onClick={() => setOpen(false)}>
            Masuk LMS <HomeIcon name="external" size={14} />
          </a>
        </div>
      </div>
    </nav>
  );
}

export function HeroSlideshow() {
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const element = stage.current;
    if (!element || paused || hovered) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = typeof IntersectionObserver === 'undefined';
    let rotation: number | undefined;

    function syncRotation() {
      window.clearInterval(rotation);
      if (inView && !document.hidden && !motion.matches) {
        rotation = window.setInterval(() => {
          setActive((current) => (current + 1) % heroPhotos.length);
        }, 4000);
      }
    }

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      syncRotation();
    }, { threshold: 0.25 });

    observer?.observe(element);
    motion.addEventListener('change', syncRotation);
    document.addEventListener('visibilitychange', syncRotation);
    syncRotation();
    return () => {
      observer?.disconnect();
      motion.removeEventListener('change', syncRotation);
      document.removeEventListener('visibilitychange', syncRotation);
      window.clearInterval(rotation);
    };
  }, [paused, hovered]);

  return (
    <div
      ref={stage}
      className="home-hero-stage"
      role="region"
      aria-label="Foto kegiatan STEM Capacity Building"
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="home-hero-circle">
        {heroPhotos.map(({ image, alt, position }, index) => (
          <div
            key={alt}
            className="home-slide"
            data-active={active === index}
            aria-hidden={active !== index}
          >
            <Image
              unoptimized
              src={image}
              alt={alt}
              style={{ objectPosition: position }}
              loading={index < 2 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
            />
          </div>
        ))}
        <div className="home-slide-controls" aria-label="Pilih foto" role="group">
          {heroPhotos.map(({ alt }, index) => (
            <button
              type="button"
              key={alt}
              className="home-slide-dot"
              aria-label={'Foto ' + (index + 1) + ': ' + alt}
              aria-pressed={index === active}
              onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setPaused(true); }}
              onClick={() => {
                setPaused(true);
                setActive(index);
              }}
            />
          ))}
          <button
            type="button"
            className="home-slide-toggle"
            aria-label={paused ? 'Putar pergantian foto' : 'Jeda pergantian foto'}
            onClick={() => setPaused((value) => !value)}
          >
            <HomeIcon name={paused ? 'play' : 'pause'} size={15} />
          </button>
        </div>
      </div>
      <div className="home-sticker home-sticker-hello" aria-hidden="true">
        <span>HELLO, FUTURE BUILDER!</span>
      </div>
      <div className="home-stamp" aria-hidden="true">
        <div><span>BUILT WITH</span><strong>CURIOSITY</strong><HomeSpark size={14} /></div>
      </div>
      <div className="home-sticker home-sticker-impact" aria-hidden="true">
        <span>THINK. BUILD. IMPACT.</span>
      </div>
      <div className="home-sticker home-sticker-idea" aria-hidden="true">
        <span>{'< ide_siswa /> â†’ dampak_nyata'}</span>
      </div>
    </div>
  );
}

export function ProgramImpact() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const element = gridRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      if (motion.matches) return;

      const started = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min(1, (now - started) / 1800);
        setProgress(1 - (1 - elapsed) ** 3);
        if (elapsed < 1) frame = window.requestAnimationFrame(tick);
      };
      setProgress(0);
      frame = window.requestAnimationFrame(tick);
    }, { threshold: 0.2 });

    observer.observe(element);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="home-phase-grid" ref={gridRef}>
      {programPhases.map((phase, index) => (
        <article className="home-phase-card" key={phase.period}>
          <div className="home-phase-badges">
            <span>{phase.period}</span>
            {phase.current && <span>SAAT INI</span>}
          </div>
          <div className="home-phase-label">TAHAP {twoDigits(index)} <HomeSpark size={14} /></div>
          <h3>{phase.title}</h3>
          <p>{phase.description}</p>
          <div className="home-phase-impact">
            <strong aria-hidden="true">{numberFormat.format(Math.round(phase.students * progress))}</strong>
            <strong className="home-visually-hidden">{numberFormat.format(phase.students)}</strong>
            <span>{phase.studentLabel}</span>
            <div className="home-impact-bar" aria-hidden="true">
              <div style={{ width: (phase.students * progress / 6000 * 100) + '%' }} />
            </div>
            <dl>
              <div><dt>sekolah terlibat</dt><dd>{phase.schools}</dd></div>
              <div><dt>{phase.teacherLabel}</dt><dd>{phase.teachers}</dd></div>
            </dl>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CurriculumTabs() {
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const tabsId = useId();

  function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = curriculum.length - 1;
    let next: number;

    switch (event.key) {
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1;
        break;
      case 'ArrowRight':
        next = index === last ? 0 : index + 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }

  return (
    <div className="home-curriculum-tabs">
      <div className="home-tab-list" role="tablist" aria-label="Topik kurikulum">
        {curriculum.map((track, index) => (
          <button
            key={track.label}
            type="button"
            role="tab"
            id={tabsId + '-tab-' + index}
            ref={(element) => { buttons.current[index] = element; }}
            aria-controls={tabsId + '-panel-' + index}
            aria-selected={index === active}
            tabIndex={index === active ? 0 : -1}
            onKeyDown={(event) => handleTabKeys(event, index)}
            onClick={() => setActive(index)}
          >
            <span className="home-tab-number" aria-hidden="true">{twoDigits(index)}</span>
            <span className="home-tab-label">{track.label}</span>
            <span className="home-tab-count">{track.count}</span>
            <HomeIcon name="arrow" size={15} />
          </button>
        ))}
      </div>
      {curriculum.map((track, index) => (
        <div
          key={track.label}
          className="home-lesson-panel"
          role="tabpanel"
          id={tabsId + '-panel-' + index}
          aria-labelledby={tabsId + '-tab-' + index}
          hidden={index !== active}
          tabIndex={0}
          data-track={index}
        >
          <div className="home-lesson-intro">
            <HomeIcon name={track.icon} size={46} />
            <h3>{track.title}</h3>
            <p>{track.description}</p>
            <strong>{track.tools}</strong>
          </div>
          <ol className="home-lesson-list">
            {track.lessons.map((lesson, lessonIndex) => (
              <li key={lesson.title}>
                <span className="home-lesson-number" aria-hidden="true">{twoDigits(lessonIndex)}</span>
                <div><strong>{lesson.title}</strong>{lesson.detail && <small>{lesson.detail}</small>}</div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function FeaturedProjectCarousel({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  function updateEdges() {
    const element = track.current;
    if (!element) return;
    setEdges({
      start: element.scrollLeft <= 1,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
    });
  }

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
    observer?.observe(element);
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateEdges);
    };
  }, []);

  function move(direction: number) {
    const element = track.current;
    const first = element?.children[0];
    const second = element?.children[1];
    if (!element || !first || !second) return;
    const step = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
    element.scrollBy({ left: direction * step });
  }

  return (
    <>
      <div className="home-section-heading home-showcase-heading">
        {heading}
        <div className="home-project-controls">
          <span>Geser untuk melihat karya</span>
          <button type="button" aria-label="Karya sebelumnya" aria-controls="karya-track" disabled={edges.start} onClick={() => move(-1)}>
            <HomeIcon name="back" size={17} />
          </button>
          <button type="button" aria-label="Karya berikutnya" aria-controls="karya-track" disabled={edges.end} onClick={() => move(1)}>
            <HomeIcon name="arrow" size={17} />
          </button>
        </div>
      </div>
      <ul id="karya-track" className="home-featured-track" aria-label="Sorotan karya siswa" tabIndex={0} ref={track} onScroll={updateEdges}>
        {children}
      </ul>
    </>
  );
}

export function FooterRobot() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [awake, setAwake] = useState(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function wakeUp() {
    if (timer.current) clearTimeout(timer.current);
    setAwake(true);
    timer.current = setTimeout(() => {
      setAwake(false);
      timer.current = null;
    }, 3000);
  }

  return (
    <div className="home-footer-mascot">
      <button
        type="button"
        className="home-footer-robot"
        onClick={wakeUp}
        data-awake={awake}
        aria-label="Bangunkan robot AI Builder"
      >
        <Image unoptimized src={footerRobot} alt="" />
        <span aria-hidden="true">{awake ? 'Halo! Ayo jelajahi programnya.' : 'Zzzâ€¦ klik untuk bangunkan'}</span>
      </button>
      <span role="status" className="home-visually-hidden">{awake ? 'Halo! Ayo jelajahi programnya.' : ''}</span>
    </div>
  );
}
