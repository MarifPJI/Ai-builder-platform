-- Migration: 0005_admin_write_profiles
-- Feature: identity-tenancy
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Memperbaiki celah kebijakan RLS: Admin perlu MENULIS (INSERT/UPDATE) ke
-- `profiles` untuk membuat & mengaktifkan akun Guru lintas sekolah (A03;
-- R3.1, R3.9, R3.11), tetapi migrasi 0002 hanya memberi Admin kebijakan
-- `FOR SELECT` (baca). Akibatnya INSERT oleh Admin ditolak:
--     ERROR: new row violates row-level security policy for table "profiles"
--
-- 0002 (konteks):
--   * profiles_admin_read   : FOR SELECT, USING role='admin'        (baca saja)
--   * profiles_teacher_scope: semua perintah untuk teacher pada school-nya
--
-- Migrasi ini menambahkan kebijakan tulis khusus Admin pada `profiles`:
--   * profiles_admin_insert : FOR INSERT, WITH CHECK role='admin'
--   * profiles_admin_update : FOR UPDATE, USING+WITH CHECK role='admin'
--
-- Catatan desain: Admin memang berwenang lintas 50 sekolah (access-rules.md),
-- jadi kebijakan tulis Admin TIDAK dibatasi pada satu school_id — berbeda dari
-- Guru yang terikat school_id-nya. DELETE sengaja TIDAK diberikan (tidak ada
-- kebutuhan hapus akun pada alur saat ini; least-privilege).
--
-- Deny-by-default tetap terjaga: bila `app.current_user_role` tak diset,
-- current_setting(...) NULL -> '= admin' gagal -> tulis ditolak.

BEGIN;

-- Admin boleh membuat baris profiles apa pun (lintas sekolah) — R3.1/R3.11.
CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- Admin boleh memperbarui baris profiles apa pun (mis. aktivasi) — R3.9.
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

COMMIT;
