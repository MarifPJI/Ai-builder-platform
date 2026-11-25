-- Migration: 0014_attendance_rls
-- Feature: teacher-ui (Presensi & Jurnal — T06B)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Row-Level Security untuk tabel baru 0013, plus GRANT ke app_runtime.
--
-- Model tenancy (FR-18, mirip 0008):
--   * PRESENSI/JURNAL/FOTO SESI (session_attendance, session_journals, session_photos):
--       - teacher: hanya baris pada school_id miliknya (baca & tulis).
--       - admin: boleh SELECT lintas sekolah (pemantauan).
--
-- Deny-by-default: current_setting(...,true) mengembalikan NULL saat variabel
-- sesi tak diset → kondisi policy gagal → tidak ada baris lolos.
-- Konteks diset withTenantTransaction (app.current_user_role / school_id).
--
-- Idempotensi: PostgreSQL tidak punya CREATE POLICY IF NOT EXISTS, sehingga
-- setiap CREATE POLICY didahului DROP POLICY IF EXISTS (satu-satunya deviasi
-- dari teks literal 0008). ENABLE/FORCE RLS sendiri sudah idempoten.
-- Prasyarat: 0013 sudah dijalankan.

BEGIN;

ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_journals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_attendance FORCE  ROW LEVEL SECURITY;
ALTER TABLE session_journals   FORCE  ROW LEVEL SECURITY;
ALTER TABLE session_photos     FORCE  ROW LEVEL SECURITY;

-- Teacher: hanya school_id miliknya (baca & tulis semua perintah).
DROP POLICY IF EXISTS session_attendance_teacher_scope ON session_attendance;
CREATE POLICY session_attendance_teacher_scope ON session_attendance
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);
DROP POLICY IF EXISTS session_journals_teacher_scope ON session_journals;
CREATE POLICY session_journals_teacher_scope ON session_journals
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);
DROP POLICY IF EXISTS session_photos_teacher_scope ON session_photos;
CREATE POLICY session_photos_teacher_scope ON session_photos
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

-- Admin: baca lintas sekolah (pemantauan).
DROP POLICY IF EXISTS session_attendance_admin_read ON session_attendance;
CREATE POLICY session_attendance_admin_read ON session_attendance
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');
DROP POLICY IF EXISTS session_journals_admin_read ON session_journals;
CREATE POLICY session_journals_admin_read ON session_journals
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');
DROP POLICY IF EXISTS session_photos_admin_read ON session_photos;
CREATE POLICY session_photos_admin_read ON session_photos
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

-- GRANT least-privilege ke role aplikasi (app_runtime) — paritas dengan 0008.
GRANT SELECT, INSERT, UPDATE, DELETE ON session_attendance TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_journals   TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_photos     TO app_runtime;

COMMIT;
