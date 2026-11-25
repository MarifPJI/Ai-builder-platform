-- Migration: 0002_rls_policies
-- Feature: identity-tenancy
-- Target: Amazon RDS for PostgreSQL (region ap-southeast-3) — PostgreSQL murni.
--
-- Mengaktifkan Row-Level Security (RLS) dan membuat kebijakan tenancy per peran
-- pada tabel `schools` dan `profiles` (dibuat di 0001_init_schema.sql).
--
-- Lapis 2 dari model tenancy dua lapis (R4.3, R4.4, R4.5, R4.8):
--   * ENABLE + FORCE ROW LEVEL SECURITY agar RLS berlaku bahkan bagi pemilik tabel.
--   * Admin  : baca lintas semua sekolah (R4.4).
--   * Teacher: hanya baris pada `school_id` miliknya, untuk baca & ubah (R4.3, R4.5).
--   * Deny-by-default (R4.8): `current_setting(..., true)` mengembalikan NULL saat
--     variabel sesi tak diset, sehingga kondisi policy gagal dan tidak ada baris
--     yang lolos — tanpa penetapan nilai default.
--
-- Variabel sesi transaksi diset oleh Session_Guard via `withTenantTransaction`
-- (`SET LOCAL app.current_user_role`, `SET LOCAL app.current_school_id`) SEBELUM
-- statement data pertama (R4.1) — lihat 0003/lapisan DB.
--
-- Sumber kebenaran: .kiro/specs/identity-tenancy/design.md (bagian "Model Tenancy Dua Lapis").

BEGIN;

-- =============================================================================
-- Aktifkan RLS pada kedua tabel tenancy.
-- FORCE memastikan RLS tetap berlaku untuk pemilik tabel (owner), bukan hanya
-- peran biasa — penting agar `app_runtime` maupun owner tidak menembus isolasi.
-- =============================================================================
ALTER TABLE schools  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools  FORCE  ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE  ROW LEVEL SECURITY;

-- =============================================================================
-- Admin: baca lintas semua sekolah (hingga 50) — R4.4.
-- Hanya SELECT; perubahan data lintas sekolah dilakukan lewat alur domain Admin.
-- Deny-by-default (R4.8): bila `app.current_user_role` tak diset, current_setting
-- mengembalikan NULL -> kondisi `= 'admin'` bernilai NULL (bukan TRUE) -> ditolak.
-- =============================================================================
CREATE POLICY schools_admin_read ON schools
  FOR SELECT
  USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY profiles_admin_read ON profiles
  FOR SELECT
  USING (current_setting('app.current_user_role', true) = 'admin');

-- =============================================================================
-- Teacher: hanya baris pada `school_id` miliknya, untuk baca & ubah — R4.3, R4.5.
-- Tanpa klausa FOR -> policy berlaku untuk SEMUA perintah (SELECT/INSERT/UPDATE/
-- DELETE). USING menyaring baris yang dibaca/diubah; WITH CHECK memastikan baris
-- hasil INSERT/UPDATE tetap berada pada `school_id` konteks (tidak bisa memindah
-- data ke sekolah lain).
-- Deny-by-default (R4.8): bila `app.current_user_role` / `app.current_school_id`
-- tak diset, current_setting mengembalikan NULL -> kedua sisi AND gagal -> tidak
-- ada baris yang lolos, tanpa penetapan nilai default.
-- =============================================================================
CREATE POLICY schools_teacher_scope ON schools
  USING (
    current_setting('app.current_user_role', true) = 'teacher'
    AND school_id = current_setting('app.current_school_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'teacher'
    AND school_id = current_setting('app.current_school_id', true)::uuid
  );

CREATE POLICY profiles_teacher_scope ON profiles
  USING (
    current_setting('app.current_user_role', true) = 'teacher'
    AND school_id = current_setting('app.current_school_id', true)::uuid
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'teacher'
    AND school_id = current_setting('app.current_school_id', true)::uuid
  );

COMMIT;
