import { createElement, type ReactNode } from 'react';

/** Bilingual text: Indonesian (id) and English (en). */
export type Txt = { id: string; en: string };

export const t = (id: string, en: string): Txt => ({ id, en });

/**
 * Renders both languages and lets CSS show the active one (`data-lang` on `.stem-home`).
 * Server-safe, so server components can stay server components and there is no flash on load.
 */
export function Bi({ id, en }: { id: ReactNode; en: ReactNode }) {
  // A custom element (not <span>) so existing `span` styling rules never match the wrapper.
  return (
    <>
      {createElement('i18n-text', { 'data-l': 'id' }, id)}
      {createElement('i18n-text', { 'data-l': 'en' }, en)}
    </>
  );
}

export function T({ v }: { v: Txt }) {
  return <Bi id={v.id} en={v.en} />;
}

/**
 * Applies the saved language to the parent `.stem-home` element before first paint.
 * Must be the first child of `.stem-home`.
 */
export function LangInit() {
  const code = "try{if(localStorage.getItem('home-lang')==='en'){document.currentScript.parentElement.setAttribute('data-lang','en')}}catch(e){}";
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
