-- Migration: 0015_admin_write_policies
-- Feature: feat-002-admin-school-write (Detail Sekolah Admin — kemampuan WRITE)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Menambah policy admin WRITE untuk tabel sesi/presensi/jurnal/foto. Saat ini
-- (0008 + 0014) policy admin pada tabel ini HANYA FOR SELECT; migrasi ini
-- menambahkan UPDATE/DELETE/INSERT yang dibutuhkan admin untuk mengelola sesi,
-- presensi, jurnal, dan menghapus foto dokumentasi lintas sekolah.
--
-- Model tenancy (mirip 0008/0014):
--   * Admin WRITE lintas sekolah berbasis role (current_setting(...) = 'admin').
--   * Teacher scope (school_id = app.current_school_id) dari 0008/0014 TIDAK
--     disentuh — tidak di-DROP, tidak diubah.
--   * Policy admin SELECT dari 0008/0014 TIDAK disentuh.
--
-- Deny-by-default: current_setting('app.current_user_role', true) mengembalikan
-- NULL saat variabel sesi tak diset → predikat gagal → tidak ada baris lolos.
-- Konteks diset withTenantTransaction (app.current_user_role / school_id).
--
-- Policy DELETE pada tabel anak (session_attendance/journals/photos) ditambahkan
-- agar penghapusan eksplisit oleh fungsi service admin (adminDeleteAttendance /
-- adminDeleteJournal / adminDeletePhoto) tidak tertolak di bawah FORCE ROW LEVEL
-- SECURITY. Catatan: cascade FK saat DELETE class_sessions adalah aksi sistem
-- (integritas referensial) yang TIDAK tunduk pada RLS; policy anak di sini
-- dibutuhkan untuk DELETE langsung masing-masing fungsi, bukan untuk cascade.
--
-- GRANT: app_runtime SUDAH memiliki SELECT, INSERT, UPDATE, DELETE untuk
-- class_sessions (0008) dan session_attendance/session_journals/session_photos
-- (0014). Tidak ada GRANT baru yang diperlukan; migrasi ini TIDAK mencabut grant
-- apa pun.
--
-- Idempotensi: PostgreSQL tidak punya CREATE POLICY IF NOT EXISTS, sehingga
-- setiap CREATE POLICY didahului DROP POLICY IF EXISTS. ENABLE/FORCE RLS sudah
-- ditetapkan di 0008/0014 dan tidak diulang di sini.
-- Prasyarat: 0008 dan 0014 sudah dijalankan.

BEGIN;

-- =============================================================================
-- class_sessions — admin UPDATE + DELETE
-- =============================================================================
DROP POLICY IF EXISTS class_sessions_admin_update ON class_sessions;
CREATE POLICY class_sessions_admin_update ON class_sessions
  FOR UPDATE USING  (current_setting('app.current_user_role', true) = 'admin')
             WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS class_sessions_admin_delete ON class_sessions;
CREATE POLICY class_sessions_admin_delete ON class_sessions
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

-- =============================================================================
-- session_attendance — admin INSERT + UPDATE + DELETE (upsert presensi + hapus)
-- =============================================================================
DROP POLICY IF EXISTS session_attendance_admin_insert ON session_attendance;
CREATE POLICY session_attendance_admin_insert ON session_attendance
  FOR INSERT WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_attendance_admin_update ON session_attendance;
CREATE POLICY session_attendance_admin_update ON session_attendance
  FOR UPDATE USING  (current_setting('app.current_user_role', true) = 'admin')
             WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_attendance_admin_delete ON session_attendance;
CREATE POLICY session_attendance_admin_delete ON session_attendance
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

-- =============================================================================
-- session_journals — admin INSERT + UPDATE + DELETE (upsert jurnal + hapus)
-- =============================================================================
DROP POLICY IF EXISTS session_journals_admin_insert ON session_journals;
CREATE POLICY session_journals_admin_insert ON session_journals
  FOR INSERT WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_journals_admin_update ON session_journals;
CREATE POLICY session_journals_admin_update ON session_journals
  FOR UPDATE USING  (current_setting('app.current_user_role', true) = 'admin')
             WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_journals_admin_delete ON session_journals;
CREATE POLICY session_journals_admin_delete ON session_journals
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

-- =============================================================================
-- session_photos — admin DELETE (hanya hapus baris DB; objek S3 dibiarkan)
-- =============================================================================
DROP POLICY IF EXISTS session_photos_admin_delete ON session_photos;
CREATE POLICY session_photos_admin_delete ON session_photos
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

COMMIT;

-- =============================================================================
-- INSTRUKSI APPLY (manual via CloudShell — TIDAK di-apply oleh workflow)
-- -----------------------------------------------------------------------------
-- Jalankan 0015 SETELAH 0008 dan 0014 sudah ter-apply (keduanya prasyarat).
-- Migrasi ini idempoten: tiap CREATE POLICY didahului DROP POLICY IF EXISTS,
-- sehingga AMAN dijalankan ulang tanpa efek samping. Tidak ada koneksi RDS yang
-- dibuat oleh workflow; eksekusi dilakukan user secara manual.
--
-- Contoh (CloudShell, sesuaikan host/kredensial):
--   psql "$DATABASE_URL" -f db/migrations/0015_admin_write_policies.sql
-- =============================================================================
