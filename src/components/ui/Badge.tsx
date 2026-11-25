import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Badge — label status kecil dengan warna semantik (apple-ui.md §1).
 *
 * Tone:
 * - `hadir`  : Hadir/Aktif (hijau).
 * - `sakit`  : Sakit (Ocean Teal).
 * - `izin`   : Izin (kuning).
 * - `alfa`   : Alfa/Ditolak (merah).
 * - `neutral`: netral (abu-abu) untuk status umum seperti `pending`.
 */
export type BadgeTone = 'hadir' | 'sakit' | 'izin' | 'alfa' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  hadir: 'bg-hadir-soft text-hadir',
  sakit: 'bg-sakit-soft text-sakit',
  izin: 'bg-izin-soft text-izin',
  alfa: 'bg-alfa-soft text-alfa',
  neutral: 'bg-soft text-muted',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'ui-badge inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
