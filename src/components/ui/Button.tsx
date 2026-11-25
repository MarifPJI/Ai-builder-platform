import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Button — tombol dasar Apple HIG × palet STEM (apple-ui.md §1).
 *
 * Varian:
 * - `primary`   : CTA utama pill, STEM Berry Magenta (#CB3480).
 * - `secondary` : tombol sekunder bergaya Ocean Teal (#0181B2).
 * - `ghost`     : tombol transparan untuk aksi minor.
 * - `danger`    : aksi destruktif (merah Alfa/Ditolak).
 *
 * Fokus memakai ring Ocean Teal demi aksesibilitas keyboard.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE =
  'ui-button inline-flex items-center justify-center rounded-full font-medium ' +
  'transition-colors focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-teal focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-teal-soft text-teal hover:bg-teal hover:text-white',
  ghost: 'bg-transparent text-ink hover:bg-soft',
  danger: 'bg-alfa text-white hover:opacity-90',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-5 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', className, type, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        data-variant={variant}
        data-size={size}
        // Default `type="button"` mencegah submit tak sengaja di dalam form.
        type={type ?? 'button'}
        className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
        {...rest}
      />
    );
  },
);
