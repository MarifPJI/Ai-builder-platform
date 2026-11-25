import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Table — tabel data dasar Apple HIG. Dipakai mis. daftar sekolah (A02) dan
 * daftar akun Guru (A03). Header memakai permukaan `soft`, baris dipisah border
 * halus. Dibungkus kontainer dengan overflow-x agar responsif pada viewport
 * sempit (360/390) tanpa merusak tata letak.
 */
export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="ui-table-scroll w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel data, geser untuk melihat semua kolom">
      <table
        className={cn('ui-table w-full border-collapse text-left text-sm', className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-soft">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('border-b border-line last:border-0', className)} {...rest}>
      {children}
    </tr>
  );
}

export function TH({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted', className)}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 text-ink', className)} {...rest}>
      {children}
    </td>
  );
}
