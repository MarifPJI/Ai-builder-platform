-- Migration: 0003_app_runtime_role
-- Feature: identity-tenancy
-- Target: Amazon RDS for PostgreSQL (region ap-southeast-3)
--
-- Membuat role aplikasi runtime least-privilege `app_runtime` (R4.9, R6.1).
--
-- Prinsip:
--   * TIDAK super-user (NOSUPERUSER) dan TIDAK boleh BYPASSRLS (NOBYPASSRLS),
--     sehingga Row Level Security (migrasi 0002) tetap berlaku penuh atas role ini.
--   * NOCREATEROLE & NOCREATEDB — tidak ada privilege administratif di luar kebutuhan.
--   * Hanya diberi GRANT SELECT, INSERT, UPDATE pada `schools` & `profiles`.
--     TIDAK ada GRANT DELETE/TRUNCATE kecuali diperlukan; tidak ada GRANT pada
--     tabel/objek di luar kebutuhan tenancy ini.
--
-- Kata sandi:
--   * Kata sandi role di-set DI LUAR migrasi ini (via secret/parameter, mis.
--     AWS Secrets Manager atau `ALTER ROLE app_runtime WITH PASSWORD ...` yang
--     dijalankan terpisah). JANGAN mencantumkan kata sandi nyata di berkas ini.
--   * Koneksi runtime memakai `DATABASE_URL` berbasis `app_runtime` yang disimpan
--     hanya di sisi server (R6.1), tidak pernah dikirim ke klien browser.
--
-- Prasyarat: migrasi 0001 (tabel `schools`, `profiles`) sudah dijalankan.
-- Catatan: Ini PostgreSQL murni (Amazon RDS) — bukan sintaks khusus Supabase.
--
-- Sumber kebenaran: .kiro/specs/identity-tenancy/design.md (bagian "Least-privilege DB role").
--
-- ── Kompatibilitas Amazon RDS (PENTING) ─────────────────────────────────────
-- Pada RDS, master user (`postgres`) berperan `rds_superuser`, BUKAN superuser
-- penuh. RDS menolak upaya menyetel/mengubah atribut `SUPERUSER`/`NOSUPERUSER`
-- dan `BYPASSRLS`/`NOBYPASSRLS` oleh non-superuser:
--     ERROR: permission denied to alter role
-- Karena itu migrasi ini TIDAK menyebut `NOSUPERUSER`/`NOBYPASSRLS` secara
-- eksplisit. Ini AMAN: nilai DEFAULT PostgreSQL untuk `CREATE ROLE` sudah
-- `NOSUPERUSER` dan `NOBYPASSRLS` (keduanya harus diberikan eksplisit untuk
-- aktif, dan RDS tidak mengizinkannya). Jadi `app_runtime` tetap least-privilege:
-- bukan superuser dan tidak dapat mem-bypass RLS. `NOCREATEROLE`/`NOCREATEDB`
-- tetap kita sebut karena keduanya BUKAN atribut superuser-only dan diizinkan.

BEGIN;

-- =============================================================================
-- Role: app_runtime (R4.9, R6.1)
-- Idempoten: hanya CREATE bila belum ada, agar migrasi aman dijalankan ulang.
-- Tanpa menyebut NOSUPERUSER/NOBYPASSRLS (default sudah demikian; lihat catatan
-- kompatibilitas RDS di atas). Tanpa PASSWORD di sini; kata sandi di-set terpisah.
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
        CREATE ROLE app_runtime LOGIN NOCREATEROLE NOCREATEDB;
    END IF;
END
$$;

-- Tegaskan ulang atribut yang DIIZINKAN RDS (idempoten & defensif).
-- Sengaja TIDAK menyertakan NOSUPERUSER/NOBYPASSRLS (ditolak RDS; sudah default).
ALTER ROLE app_runtime WITH LOGIN NOCREATEROLE NOCREATEDB;

-- =============================================================================
-- GRANT least-privilege pada tabel tenancy.
-- Tanpa DELETE/TRUNCATE; tanpa grant di luar `schools` & `profiles`.
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON schools  TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON profiles TO app_runtime;

COMMIT;
