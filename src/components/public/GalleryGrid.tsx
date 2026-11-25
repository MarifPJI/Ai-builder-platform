'use client';

import { useEffect, useRef, useState } from 'react';

export interface GalleryPhoto {
  id: string;
  year: number;
  title: string;
  caption: string | null;
  imageUrl: string | null;
}

export function GalleryGrid({ items }: { items: GalleryPhoto[] }) {
  const [active, setActive] = useState<GalleryPhoto | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (active && !dialog.current?.open) dialog.current?.showModal();
    else if (!active) dialog.current?.close();
  }, [active]);
  return <>
    <div className="gallery-grid">
      {items.map((item) => (
        <button className="photo-card" type="button" key={item.id} onClick={() => setActive(item)} aria-label={`Perbesar foto: ${item.title}`}>
          <div className="photo-image">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.title} loading="lazy" width={900} height={600} />
            ) : <div className="gallery-placeholder">STEM · {item.year}</div>}
            <span aria-hidden="true">↗</span>
          </div>
          <div className="photo-caption"><span>KEGIATAN STEM · {item.year}</span><h3>{item.title}</h3>{item.caption && <p>{item.caption}</p>}</div>
        </button>
      ))}
    </div>
    <dialog className="gallery-dialog" ref={dialog} onClose={() => setActive(null)} onClick={(event) => { if (event.target === event.currentTarget) setActive(null); }} aria-label={active?.title ?? 'Galeri dokumentasi PJI'}>
      <button className="dialog-close" type="button" aria-label="Tutup foto" onClick={() => setActive(null)} autoFocus>✕</button>
      {active && <>
        {active.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.imageUrl} alt={active.title} />
        ) : <div className="gallery-placeholder">STEM · {active.year}</div>}
        <div><h3>{active.title}</h3>{active.caption && <p>{active.caption}</p>}<p>Tahun {active.year}</p></div>
      </>}
    </dialog>
  </>;
}
