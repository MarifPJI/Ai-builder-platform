/**
 * `withPublicTransaction` — transaksi untuk akses PUBLIK tanpa autentikasi
 * (fitur public-showcase).
 *
 * Berbeda dari `withTenantTransaction` (yang menuntut klaim admin/teacher yang
 * valid dan deny-by-default), helper ini menetapkan konteks peran `public`
 * sehingga kebijakan RLS jalur publik berlaku:
 *   - showcase_projects: SELECT hanya baris `approved`; INSERT dipaksa `pending`.
 *   - stem_gallery_items: SELECT semua.
 * Kebijakan admin TIDAK terpenuhi (role='public' ≠ 'admin'), sehingga pengunjung
 * publik tidak pernah bisa memoderasi atau melihat baris non-approved.
 *
 * Nilai konteks disetel via `set_config($1,$2,true)` (SET LOCAL, parameterized)
 * sebelum statement data pertama — mencegah injeksi dan membatasi ke transaksi.
 *
 * _Requirements: public-showcase R2.4, R4.2, R7.2, R7.3_
 */

import 'server-only';

import type { PoolClient } from 'pg';

import { getPool } from './pool';

const SESSION_VAR_ROLE = 'app.current_user_role';
const SESSION_VAR_SCHOOL_ID = 'app.current_school_id';

/** Nilai peran untuk konteks publik (bukan admin/teacher). */
const PUBLIC_ROLE = 'public';
/** Sentinel non-tenant; publik tidak terikat sekolah mana pun. */
const NON_TENANT_SENTINEL = '00000000-0000-0000-0000-000000000000';

/**
 * Menjalankan `fn` dalam transaksi dengan konteks peran `public`.
 * Dipakai untuk membaca Showcase/Galeri publik dan menerima Submission publik.
 */
export async function withPublicTransaction<T>(
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', [
      SESSION_VAR_ROLE,
      PUBLIC_ROLE,
    ]);
    await client.query('SELECT set_config($1, $2, true)', [
      SESSION_VAR_SCHOOL_ID,
      NON_TENANT_SENTINEL,
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Abaikan error rollback agar error asli tidak tertutupi.
    }
    throw error;
  } finally {
    client.release();
  }
}
