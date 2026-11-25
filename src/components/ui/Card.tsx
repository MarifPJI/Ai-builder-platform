import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Card — permukaan putih bersih Apple HIG (radius 18px, border halus).
 * Dipakai sebagai kontainer utama konten pada seluruh layar.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('ui-card rounded-card border border-line bg-white', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * CardHead — kepala kartu. Sesuai apple-ui.md §2.3, HINDARI paragraf instruksi
 * panjang di bawah judul; cukup judul ringkas + aksi opsional di kanan.
 */
export interface CardHeadProps {
  title: string;
  action?: ReactNode;
}

export function CardHead({ title, action }: CardHeadProps) {
  return (
    <div className="ui-card-head flex items-center justify-between border-b border-line px-6 py-4">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

/** CardBody — isi kartu dengan padding standar. */
export function CardBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('ui-card-body px-6 py-5', className)} {...rest}>
      {children}
    </div>
  );
}
