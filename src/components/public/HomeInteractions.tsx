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
import { Bi, T } from './Bi';
import { curriculum, heroPhotos, LMS_URL, programPhases } from './home-content';
import { HomeIcon, HomeSpark } from './HomeIcons';
import { LanguageToggle, useText } from './HomeLanguage';

const numberFormat = new Intl.NumberFormat('id-ID');
const twoDigits = (index: number) => String(index + 1).padStart(2, '0');

export function HomeNavigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const linksId = useId();
  const text = useText();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function dismissMenu(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && open) {
      setOpen(false);
      menuButton.current?.focus();
    }
  }

  return (
    <nav className="home-nav" data-scrolled={scrolled} aria-label={text({ id: 'Navigasi utama', en: 'Main navigation' })} onKeyDown={dismissMenu}>
      <div className="home-nav-inner">
        <a href="#top" className="home-brand" onClick={() => setOpen(false)}>
          <Image unoptimized src={brandImage} alt={text({ id: 'AI Builder by PJI × AWS · Beranda', en: 'AI Builder by PJI × AWS · Home' })} loading="eager" />
        </a>
        <div className="home-nav-actions">
          <div className="home-nav-lang-mobile"><LanguageToggle /></div>
          <button
            className="home-menu-toggle"
            type="button"
            ref={menuButton}
            aria-controls={linksId}
            aria-expanded={open}
            aria-label={open ? text({ id: 'Tutup menu', en: 'Close menu' }) : text({ id: 'Buka menu', en: 'Open menu' })}
            onClick={() => setOpen(!open)}
          >
            <HomeIcon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
        <div id={linksId} className="home-nav-links" data-open={open}>
          <a href="#program" onClick={() => setOpen(false)}>Program</a>
          <a href="#kurikulum" onClick={() => setOpen(false)}><Bi id="Kurikulum" en="Curriculum" /></a>
          <a href="#showcase" onClick={() => setOpen(false)}><Bi id="Karya Siswa" en="Student Projects" /></a>
          <a className="home-nav-lms" href={LMS_URL} onClick={() => setOpen(false)}>
            <Bi id="Masuk LMS" en="LMS Login" /> <HomeIcon name="external" size={14} />
          </a>
          <div className="home-nav-lang-desktop"><LanguageToggle /></div>
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
  const text = useText();

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
      aria-label={text({ id: 'Foto kegiatan STEM Capacity Building', en: 'Photos of STEM Capacity Building activities' })}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="home-hero-circle">
        {heroPhotos.map(({ image, alt, position }, index) => (
          <div
            key={alt.id}
            className="home-slide"
            data-active={active === index}
            aria-hidden={active !== index}
          >
            <Image
              unoptimized
              src={image}
              alt={text(alt)}
              style={{ objectPosition: position }}
              loading={index < 2 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
            />
          </div>
        ))}
        <div className="home-slide-controls" aria-label={text({ id: 'Pilih foto', en: 'Choose photo' })} role="group">
          {heroPhotos.map(({ alt }, index) => (
            <button
              type="button"
              key={alt.id}
              className="home-slide-dot"
              aria-label={text({ id: 'Foto ', en: 'Photo ' }) + (index + 1) + ': ' + text(alt)}
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
            aria-label={paused
              ? text({ id: 'Putar pergantian foto', en: 'Play photo slideshow' })
              : text({ id: 'Jeda pergantian foto', en: 'Pause photo slideshow' })}
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
        <span>{text({ id: '< ide_siswa /> → dampak_nyata', en: '< student_idea /> → real_impact' })}</span>
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
            {phase.current && <span><Bi id="SAAT INI" en="NOW" /></span>}
          </div>
          <div className="home-phase-label"><Bi id="TAHAP" en="PHASE" /> {twoDigits(index)} <HomeSpark size={14} /></div>
          <h3><T v={phase.title} /></h3>
          <p><T v={phase.description} /></p>
          <div className="home-phase-impact">
            <strong aria-hidden="true">{numberFormat.format(Math.round(phase.students * progress))}</strong>
            <strong className="home-visually-hidden">{numberFormat.format(phase.students)}</strong>
            <span><T v={phase.studentLabel} /></span>
            <div className="home-impact-bar" aria-hidden="true">
              <div style={{ width: (phase.students * progress / 6000 * 100) + '%' }} />
            </div>
            <dl>
              <div><dt><Bi id="sekolah terlibat" en="schools involved" /></dt><dd>{phase.schools}</dd></div>
              <div><dt><T v={phase.teacherLabel} /></dt><dd>{phase.teachers}</dd></div>
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
  const text = useText();

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
      <div className="home-tab-list" role="tablist" aria-label={text({ id: 'Topik kurikulum', en: 'Curriculum topics' })}>
        {curriculum.map((track, index) => (
          <button
            key={track.label.id}
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
            <span className="home-tab-label"><T v={track.label} /></span>
            <span className="home-tab-count"><T v={track.count} /></span>
            <HomeIcon name="arrow" size={15} />
          </button>
        ))}
      </div>
      {curriculum.map((track, index) => (
        <div
          key={track.label.id}
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
            <h3><T v={track.title} /></h3>
            <p><T v={track.description} /></p>
            <strong><T v={track.tools} /></strong>
          </div>
          <ol className="home-lesson-list">
            {track.lessons.map((lesson, lessonIndex) => (
              <li key={lesson.title.id}>
                <span className="home-lesson-number" aria-hidden="true">{twoDigits(lessonIndex)}</span>
                <div><strong><T v={lesson.title} /></strong>{lesson.detail && <small><T v={lesson.detail} /></small>}</div>
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
  const text = useText();

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
          <span><Bi id="Geser untuk melihat karya" en="Swipe to see projects" /></span>
          <button type="button" aria-label={text({ id: 'Karya sebelumnya', en: 'Previous project' })} aria-controls="karya-track" disabled={edges.start} onClick={() => move(-1)}>
            <HomeIcon name="back" size={17} />
          </button>
          <button type="button" aria-label={text({ id: 'Karya berikutnya', en: 'Next project' })} aria-controls="karya-track" disabled={edges.end} onClick={() => move(1)}>
            <HomeIcon name="arrow" size={17} />
          </button>
        </div>
      </div>
      <ul id="karya-track" className="home-featured-track" aria-label={text({ id: 'Sorotan karya siswa', en: 'Featured student projects' })} tabIndex={0} ref={track} onScroll={updateEdges}>
        {children}
      </ul>
    </>
  );
}

/**
 * Face overlay drawn on the robot image's own 360×360 grid.
 * - Always hides the "Zzz" baked into the image and draws animated ones (sleep only).
 * - When awake, covers the closed eyes and mouth with the visor colour and draws open eyes and a smile.
 * Coordinates were measured from footer-robot.webp; the visor is tilted about 9.5°.
 */
function RobotFace() {
  return (
    <svg className="home-robot-face" viewBox="0 0 360 360" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="robot-visor" gradientUnits="userSpaceOnUse" x1="140" y1="0" x2="232" y2="0">
          <stop offset="0" stopColor="#00052a" />
          <stop offset="1" stopColor="#031c62" />
        </linearGradient>
        <filter id="robot-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id="robot-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Hide the static Zzz printed in the artwork. */}
      <g fill="#17153a" filter="url(#robot-soft)">
        <rect x="316" y="16" width="27" height="30" rx="4" />
        <rect x="298" y="55" width="21" height="21" rx="4" />
        <rect x="279" y="83" width="15" height="15" rx="4" />
      </g>

      {/* Sleeping: floating Zzz. */}
      <g className="home-robot-zzz" fill="#cfc9f2" fontFamily="var(--home-display), Arial, sans-serif" fontWeight="800">
        <text x="284" y="96" fontSize="14">z</text>
        <text x="302" y="74" fontSize="19">z</text>
        <text x="320" y="44" fontSize="26">Z</text>
      </g>

      {/* Awake: open eyes and a smile. */}
      <g className="home-robot-awake">
        <g fill="url(#robot-visor)" filter="url(#robot-soft)">
          <ellipse cx="153" cy="109" rx="14" ry="8" transform="rotate(10 153 109)" />
          <ellipse cx="213" cy="119" rx="14" ry="8" transform="rotate(10 213 119)" />
          <ellipse cx="181" cy="128" rx="8" ry="6" />
        </g>
        <g filter="url(#robot-glow)">
          <g className="home-robot-eyes" fill="#6ff0ff">
            <rect x="148.5" y="101.5" width="9" height="15" rx="4.5" transform="rotate(9.5 153 109)" />
            <rect x="208.5" y="111.5" width="9" height="15" rx="4.5" transform="rotate(9.5 213 119)" />
          </g>
          <path d="M170 125 Q181 136 192 125" fill="none" stroke="#6ff0ff" strokeWidth="3.6" strokeLinecap="round" transform="rotate(9.5 181 128)" />
        </g>
      </g>
    </svg>
  );
}

export function FooterRobot() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [awake, setAwake] = useState(false);
  const text = useText();

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

  const greeting = text({ id: 'Lagi ngoding, kok!', en: 'Just coding, I promise!' });

  return (
    <div className="home-footer-mascot">
      <button
        type="button"
        className="home-footer-robot"
        onClick={wakeUp}
        data-awake={awake}
        aria-label={text({ id: 'Bangunkan robot AI Builder', en: 'Wake up the AI Builder robot' })}
      >
        <div className="home-robot-figure">
          <Image unoptimized src={footerRobot} alt="" />
          <RobotFace />
        </div>
        <span aria-hidden="true">{awake ? greeting : text({ id: 'Zzz… klik untuk bangunkan', en: 'Zzz… click to wake me up' })}</span>
      </button>
      <span role="status" className="home-visually-hidden">{awake ? greeting : ''}</span>
    </div>
  );
}
