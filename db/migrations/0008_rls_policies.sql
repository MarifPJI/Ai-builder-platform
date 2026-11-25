-- Migration: 0008_rls_policies
-- Feature: course-class-publishing
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Row-Level Security untuk tabel baru 0006/0007, plus GRANT ke app_runtime.
--
-- Model tenancy (R1.6, R2.1, R4.7, R4.8, R8.3):
--   * MATERI GLOBAL (materials, material_files, material_reads):
--       - SELECT: admin & teacher (lintas sekolah).
--       - INSERT/UPDATE materials & material_files: HANYA admin.
--       - material_reads: teacher menandai Materi selesai dibaca untuk dirinya.
--   * KELAS/SISWA/SESI TENANT (classes, class_students, class_sessions):
--       - teacher: hanya baris pada school_id miliknya (baca & tulis).
--       - admin: boleh SELECT lintas sekolah (pemantauan A04).
--
-- Deny-by-default: current_setting(...,true) mengembalikan NULL saat variabel
-- sesi tak diset → kondisi policy gagal → tidak ada baris lolos.
-- Konteks diset withTenantTransaction (app.current_user_role / school_id).
-- Prasyarat: 0006 dan 0007 sudah dijalankan.

BEGIN;

-- =============================================================================
-- MATERI (GLOBAL)
-- =============================================================================
ALTER TABLE materials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials      FORCE  ROW LEVEL SECURITY;
ALTER TABLE material_files FORCE  ROW LEVEL SECURITY;
ALTER TABLE material_reads FORCE  ROW LEVEL SECURITY;

-- materials: baca admin+teacher; tulis admin-only.
CREATE POLICY materials_read ON materials
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IN ('admin', 'teacher'));
CREATE POLICY materials_admin_insert ON materials
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY materials_admin_update ON materials
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- material_files: baca admin+teacher; tulis admin-only.
CREATE POLICY material_files_read ON material_files
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IN ('admin', 'teacher'));
CREATE POLICY material_files_admin_insert ON material_files
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY material_files_admin_update ON material_files
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- material_reads: baca admin+teacher; teacher INSERT untuk profile_id miliknya.
-- (profile_id dicocokkan via profiles.cognito_sub = app.current_cognito_sub bila
-- diset; untuk kesederhanaan di sini teacher boleh insert baris read, dibatasi
-- role='teacher'. Pencocokan profil final ditegakkan di domain service.)
CREATE POLICY material_reads_read ON material_reads
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IN ('admin', 'teacher'));
CREATE POLICY material_reads_teacher_insert ON material_reads
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher');

-- =============================================================================
-- KELAS / SISWA / SESI (TENANT per school_id)
-- =============================================================================
ALTER TABLE classes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes        FORCE  ROW LEVEL SECURITY;
ALTER TABLE class_students FORCE  ROW LEVEL SECURITY;
ALTER TABLE class_sessions FORCE  ROW LEVEL SECURITY;

-- Teacher: hanya school_id miliknya (baca & tulis semua perintah).
CREATE POLICY classes_teacher_scope ON classes
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);
CREATE POLICY class_students_teacher_scope ON class_students
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);
CREATE POLICY class_sessions_teacher_scope ON class_sessions
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

-- Admin: baca lintas sekolah (pemantauan A04).
CREATE POLICY classes_admin_read ON classes
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY class_students_admin_read ON class_students
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY class_sessions_admin_read ON class_sessions
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

-- =============================================================================
-- GRANT least-privilege ke role aplikasi (app_runtime).
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON materials       TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON material_files   TO app_runtime;
GRANT SELECT, INSERT         ON material_reads   TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON classes        TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON class_students TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON class_sessions TO app_runtime;

COMMIT;
