'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SESSION_COOKIE_NAME } from '@/lib/auth/guard';

/**
 * Aksi keluar (logout): menghapus cookie sesi httpOnly lalu mengarahkan ke
 * halaman login. Sesi berbasis cookie id_token, jadi menghapusnya mengakhiri
 * sesi pada sisi aplikasi.
 */
export async function logoutAction(): Promise<void> {
  cookies().delete(SESSION_COOKIE_NAME);
  redirect('/login');
}
