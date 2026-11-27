#!/usr/bin/env node
/**
 * Diagnostik koneksi DATABASE_URL (mis. role `app_runtime`) tanpa mengubah data.
 *
 * Pakai (PowerShell):
 *   $env:DATABASE_URL = "postgresql://app_runtime.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
 *   node scripts/check-db.mjs
 *
 * Langkah yang diperiksa:
 *   1. Koneksi + login (password / username pooler).
 *   2. Role yang dipakai dan apakah melewati RLS.
 *   3. Hak SELECT pada setiap tabel yang dipakai aplikasi.
 *   4. Tulis ke auth_login_failures (dipakai saat login) dalam transaksi yang
 *      selalu di-ROLLBACK, jadi tidak ada data yang tersimpan.
 * Password tidak pernah dicetak.
 */

import pg from 'pg';

const TABLES = [
  'schools', 'profiles', 'materials', 'material_files', 'material_reads',
  'material_resources', 'classes', 'class_students', 'class_sessions',
  'showcase_projects', 'stem_gallery_items', 'showcase_karya',
  'session_attendance', 'session_journals', 'session_photos', 'auth_login_failures',
];

const ok = (msg) => console.log(`  OK    ${msg}`);
const fail = (msg) => console.log(`  GAGAL ${msg}`);

function describeUrl(raw) {
  try {
    const u = new URL(raw);
    return `user=${decodeURIComponent(u.username)} host=${u.hostname} port=${u.port || '5432'} db=${u.pathname.slice(1)}`;
  } catch {
    return '(DATABASE_URL tidak berformat URL yang valid)';
  }
}

async function main() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    console.log('DATABASE_URL belum diset. Lihat komentar di bagian atas file ini.');
    process.exit(2);
  }
  console.log(`Target: ${describeUrl(raw)}\n`);

  const url = raw.replace(/([?&])sslmode=[^&]*(&|$)/i, (_m, pre, post) => (post === '&' ? pre : '')).replace(/[?&]$/, '');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });

  console.log('1. Koneksi');
  try {
    await client.connect();
    ok('terhubung');
  } catch (err) {
    fail(err.message);
    if (/password authentication failed/i.test(err.message)) {
      console.log('      -> Password salah. Jalankan ALTER ROLE app_runtime WITH PASSWORD ... lagi, atau URL-encode simbol di password.');
    } else if (/tenant or user not found/i.test(err.message)) {
      console.log('      -> Username harus app_runtime.<project-ref> dan host dari Connect > Transaction pooler.');
    }
    process.exit(1);
  }

  let problems = 0;
  try {
    console.log('\n2. Role');
    const { rows } = await client.query(
      `SELECT current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    const r = rows[0];
    ok(`current_user = ${r.role}`);
    if (r.rolsuper || r.rolbypassrls) {
      fail('role ini MELEWATI RLS (superuser/bypassrls). Gunakan app_runtime.');
      problems += 1;
    } else {
      ok('RLS berlaku untuk role ini');
    }

    console.log('\n3. Hak akses tabel');
    const usage = await client.query(`SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS u`);
    if (usage.rows[0].u) ok('USAGE pada schema public');
    else { fail('tidak punya USAGE pada schema public'); problems += 1; }

    for (const table of TABLES) {
      const exists = await client.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [`public.${table}`]);
      if (!exists.rows[0].e) { fail(`${table}: tabel tidak ada`); problems += 1; continue; }
      const priv = await client.query(`SELECT has_table_privilege(current_user, $1, 'SELECT') AS s`, [`public.${table}`]);
      if (priv.rows[0].s) ok(`${table}: SELECT`);
      else { fail(`${table}: tidak punya SELECT`); problems += 1; }
    }

    console.log('\n4. Tulis auth_login_failures (dibatalkan otomatis)');
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO auth_login_failures (email, failures, locked_until, updated_at)
         VALUES ('__check_db__@example.invalid', 1, NULL, now())
         ON CONFLICT (email) DO UPDATE SET failures = auth_login_failures.failures + 1`,
      );
      await client.query(`DELETE FROM auth_login_failures WHERE email = '__check_db__@example.invalid'`);
      ok('INSERT/DELETE diizinkan');
    } catch (err) {
      fail(err.message);
      problems += 1;
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
    }
  } finally {
    await client.end();
  }

  console.log(problems === 0 ? '\nSemua pemeriksaan lulus.' : `\n${problems} masalah ditemukan.`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Error tak terduga:', err.message);
  process.exit(1);
});
