import type { ReactNode } from 'react';

export type AppIconName = 'dashboard' | 'school' | 'users' | 'book' | 'spark' | 'image' | 'inbox' | 'calendar' | 'check' | 'menu' | 'close' | 'search' | 'bell' | 'lock' | 'logout';

const paths: Record<AppIconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  school: <><path d="m3 10 9-6 9 6v11H3Z M9 21v-7h6v7 M12 4V2l5 1-5 2" /><path d="M6 12h.01M18 12h.01" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v3" /></>,
  book: <path d="M12 5v16M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z" />,
  spark: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  inbox: <path d="m5 3-3 11v7h20v-7L19 3ZM2 14h6l2 3h4l2-3h6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-14 5h3m4 0h3" /></>,
  check: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  bell: <path d="M5 17h14l-2-3V8a5 5 0 0 0-10 0v6Zm5 3h4" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  logout: <path d="M9 3H4v18h5m5-14 5 5-5 5m-5-5h11" />,
};

export function AppIcon({ name, className = '' }: { name: AppIconName; className?: string }) {
  return <svg className={`app-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
