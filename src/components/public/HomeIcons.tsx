const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  external: 'M7 17 17 7M7 7h10v10',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  brain: 'M12 5a3 3 0 1 0-6 .125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 6 .125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4',
  code: 'm18 16 4-4-4-4M6 8l-4 4 4 4m11-16-5 16',
  close: 'm6 6 12 12M18 6 6 18',
  menu: 'M4 6h16M4 12h16M4 18h16',
  pause: 'M9 5v14m6-14v14',
  play: 'M9 5v14l10-7z',
  plus: 'M12 5v14M5 12h14',
};

export function HomeIcon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function HomeSpark({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="m12 0 1.72 7.84 6.77-4.33-4.33 6.77L24 12l-7.84 1.72 4.33 6.77-6.77-4.33L12 24l-1.72-7.84-6.77 4.33 4.33-6.77L0 12l7.84-1.72-4.33-6.77 6.77 4.33Z" />
    </svg>
  );
}
