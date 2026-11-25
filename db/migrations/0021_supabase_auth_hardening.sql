-- Migration: 0021_supabase_auth_hardening
-- Target: Supabase Postgres
--
-- Dijalankan sebagai owner (role `postgres`) lewat koneksi LANGSUNG (port 5432).
--
-- 1. Tabel `auth_login_failures`: penghitung lockout login (5x gagal -> 15 menit)
--    yang terbagi lintas instance serverless Vercel. Sebelumnya disimpan
--    in-memory (tidak efektif di serverless).
-- 2. Hardening Supabase Data API (PostgREST): Supabase memberi grant default ke
--    role `anon` dan `authenticated` pada tabel baru di schema `public`. Aplikasi
--    ini TIDAK memakai Data API (hanya koneksi `pg` sebagai `app_runtime`), jadi
--    semua akses itu dicabut agar kunci anon tidak dapat membaca/menulis tabel.
-- 3. `profiles.cognito_sub` kini menyimpan UUID `auth.users.id` Supabase. Nama
--    kolom dipertahankan agar kebijakan RLS & kode tidak berubah.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Lockout login
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_login_failures (
    email         text PRIMARY KEY,                -- huruf kecil, ter-trim
    failures      integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
    locked_until  timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS aktif tanpa policy untuk anon/authenticated => tertutup bagi Data API.
-- `app_runtime` diberi policy eksplisit (tabel ini tidak berisi data tenant;
-- diakses sebelum pengguna terautentikasi).
ALTER TABLE auth_login_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_login_failures_app_runtime ON auth_login_failures;
CREATE POLICY auth_login_failures_app_runtime ON auth_login_failures
    FOR ALL TO app_runtime
    USING (true)
    WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_login_failures TO app_runtime;

-- ---------------------------------------------------------------------------
-- 2. Cabut akses Data API (anon / authenticated) pada schema public
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Tabel/fungsi yang dibuat owner di masa depan juga tidak otomatis terbuka.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dokumentasi kolom
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN profiles.cognito_sub IS
    'UUID pengguna Supabase Auth (auth.users.id) sebagai teks. Nama kolom warisan era Cognito.';

COMMIT;
