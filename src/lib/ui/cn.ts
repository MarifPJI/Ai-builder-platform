/**
 * `cn` — penggabung className sederhana (tanpa dependency eksternal).
 *
 * Menerima daftar nilai className yang boleh berupa string, falsy
 * (`false`/`null`/`undefined`), sehingga pemakaian kondisional ringkas:
 *   cn('btn', isActive && 'btn-active')
 *
 * Dipakai komponen UI dasar Apple HIG (Button, Card, dll.) agar varian gaya
 * tetap deklaratif dan mudah dibaca.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
