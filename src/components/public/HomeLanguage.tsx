'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type Lang = 'id' | 'en';

const EVENT = 'home-lang-change';
const STORAGE_KEY = 'home-lang';

const homeRoot = () => document.querySelector<HTMLElement>('.stem-home');

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

const getSnapshot = (): Lang => (homeRoot()?.dataset.lang === 'en' ? 'en' : 'id');
const getServerSnapshot = (): Lang => 'id';

/** Active homepage language; use for attributes (placeholder, aria-label, alt) that CSS cannot switch. */
export function useHomeLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setHomeLang(lang: Lang) {
  homeRoot()?.setAttribute('data-lang', lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable: language still applies for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Picks the right string for attributes. */
export function useText() {
  const lang = useHomeLang();
  return (value: { id: string; en: string }) => value[lang];
}

export function LanguageToggle() {
  const lang = useHomeLang();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="home-lang" role="group" aria-label="Bahasa / Language">
      <button type="button" lang="id" aria-pressed={lang === 'id'} aria-label="Bahasa Indonesia" onClick={() => setHomeLang('id')}>ID</button>
      <button type="button" lang="en" aria-pressed={lang === 'en'} aria-label="English" onClick={() => setHomeLang('en')}>EN</button>
    </div>
  );
}

const REVEAL_TARGETS = [
  '.home-partners-row > *',
  '.home-section > .home-kicker',
  '.home-program-heading > *',
  '.home-phase-card',
  '.home-activities-heading > *',
  '.home-activity-grid > li',
  '.home-section-heading',
  '.home-curriculum-tabs',
  '.home-curriculum-bottom',
  '.home-hackathon-grid > div',
  '.home-competition-stages > li',
  '.home-awards > div',
  '.home-featured-card',
  '.home-featured-next',
  '.home-published',
  '.home-gallery .home-section > *:not(.home-kicker)',
  '.home-submission-copy > *',
  '.home-form-card',
  '.home-faq-grid > div:first-child',
  '.home-faq-list details',
  '.home-closing',
  '.home-footer-grid > *',
].join(',');

/** Scroll-reveal for sections. Content stays visible without JavaScript or with reduced motion. */
export function HomeMotion() {
  useEffect(() => {
    const root = homeRoot();
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timers: number[] = [];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        element.dataset.reveal = 'in';
        // Drop the helper attribute afterwards so hover transitions apply normally.
        timers.push(window.setTimeout(() => element.removeAttribute('data-reveal'), 1400));
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    const viewport = window.innerHeight;
    root.querySelectorAll<HTMLElement>(REVEAL_TARGETS).forEach((element) => {
      if (element.getBoundingClientRect().top < viewport * 0.9) return;
      const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
      element.style.setProperty('--reveal-delay', (Math.max(0, siblings.indexOf(element)) % 4) * 90 + 'ms');
      element.dataset.reveal = 'pending';
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
