/**
 * pg Pool untuk Supabase Postgres (hanya sisi server).
 *
 * - Koneksi memakai `DATABASE_URL` berbasis role least-privilege `app_runtime`
 *   (NOSUPERUSER, NOBYPASSRLS) — lihat `db/migrations/0003_app_runtime_role.sql`.
 * - Di Vercel (serverless) `DATABASE_URL` WAJIB memakai Supavisor pooler mode
 *   TRANSACTION (port 6543), mis.
 *   `postgresql://app_runtime.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
 *   RLS aman di mode ini: konteks tenant disetel dengan
 *   `set_config(..., true)` di dalam `BEGIN ... COMMIT` (lokal-transaksi).
 *   Jangan memakai state level-sesi (SET tanpa LOCAL, prepared statement
 *   bernama) karena koneksi fisik berganti antar transaksi.
 * - Migrasi dijalankan terpisah lewat koneksi langsung (port 5432) sebagai
 *   owner, bukan lewat pool ini.
 * - Secret `DATABASE_URL` hanya dibaca di server (R6.1).
 *
 * `import 'server-only'` membuat build GAGAL bila modul ini terimpor ke bundel
 * Client Component.
 *
 * _Requirements: 4.1, 6.1_
 */

import 'server-only';

import { Pool } from 'pg';

/**
 * Membaca `DATABASE_URL` dari environment sisi server (fail-fast bila kosong).
 */
function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim().length === 0) {
    throw new Error(
      'DATABASE_URL belum tersetel. Variabel ini hanya dibaca di sisi server ' +
        'dan wajib memakai role least-privilege `app_runtime` lewat pooler ' +
        'Supabase (port 6543).',
    );
  }
  return url;
}

/**
 * CA opsional untuk verifikasi TLS penuh. Isi `DATABASE_CA_CERT` dengan PEM
 * "Supabase Root 2021 CA" (Dashboard > Database > Settings > SSL Configuration
 * > Download certificate). Tanpa ini koneksi tetap terenkripsi tetapi rantai
 * sertifikat tidak diverifikasi.
 */
function readCaCert(): string | undefined {
  const pem = process.env.DATABASE_CA_CERT?.trim();
  if (!pem) {
    return undefined;
  }
  // Env var satu-baris sering menyimpan newline sebagai "\n" literal.
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

/**
 * Jumlah koneksi maksimum per instance. Di serverless tiap instance hanya
 * memproses sedikit request sekaligus dan Supavisor yang melakukan pooling,
 * jadi default 1 di Vercel agar tidak menghabiskan batas koneksi Supabase.
 * Dapat dioverride dengan `DATABASE_POOL_MAX`.
 */
function readPoolMax(): number {
  const fromEnv = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '', 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return process.env.VERCEL ? 1 : 10;
}

/** Cache singleton pada globalThis (mencegah kebocoran koneksi saat HMR). */
const globalForPool = globalThis as typeof globalThis & {
  __identityTenancyPgPool__?: Pool;
};

/**
 * Membuat Pool dari `DATABASE_URL`.
 *
 * `pg` menyusun konfigurasi SSL sendiri dari `sslmode` pada URL dan dapat
 * mengabaikan objek `ssl` eksplisit. Karena itu `sslmode` dihapus dari URL dan
 * seluruh kendali TLS diserahkan ke objek `ssl` di bawah (selalu terenkripsi).
 */
function createPool(): Pool {
  const ca = readCaCert();
  const ssl = ca
    ? { ca, rejectUnauthorized: true as const }
    : { rejectUnauthorized: false as const };

  console.log(
    `[db] TLS mode: ${
      ca ? 'verified (DATABASE_CA_CERT)' : 'encrypted-only (no CA configured)'
    }`,
  );

  const rawUrl = readDatabaseUrl();
  const urlWithoutSslMode = rawUrl
    .replace(/([?&])sslmode=[^&]*(&|$)/i, (_m, pre: string, post: string) =>
      post === '&' ? pre : '',
    )
    .replace(/[?&]$/, '');

  return new Pool({
    connectionString: urlWithoutSslMode,
    ssl,
    max: readPoolMax(),
    // Lepas koneksi idle cepat agar instance serverless tidak menahannya.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

/** pg Pool singleton (lazy): koneksi fisik dibuka saat query pertama. */
export function getPool(): Pool {
  if (!globalForPool.__identityTenancyPgPool__) {
    globalForPool.__identityTenancyPgPool__ = createPool();
  }
  return globalForPool.__identityTenancyPgPool__;
}
