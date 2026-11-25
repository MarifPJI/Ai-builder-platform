-- Migration: 0017_materials_admin_delete
-- Feature: redesign-materi-multi-sumber (A07 — hapus Materi)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Menambah policy admin DELETE pada tabel `materials`. Policy admin di 0008
-- hanya mencakup SELECT/INSERT/UPDATE; tanpa DELETE, Admin tidak dapat menghapus
-- Materi di bawah FORCE ROW LEVEL SECURITY.
--
-- Menghapus Materi akan CASCADE (via FK ON DELETE CASCADE) ke:
--   * material_resources (sumber Canva/Video/PDF/PPTX) — FK 0016
--   * material_files (lampiran lama) — FK 0006
--   * material_reads (penanda sudah dibaca Guru) — FK 0006
-- Objek S3 TIDAK ikut terhapus (hanya baris DB). Cascade FK adalah aksi sistem
-- yang TIDAK tunduk RLS; policy DELETE di sini dibutuhkan untuk DELETE langsung
-- pada `materials` oleh fungsi service admin (deleteMaterial).
--
-- GRANT: app_runtime sudah memiliki DELETE? 0008 hanya memberi
-- SELECT/INSERT/UPDATE pada materials (BUKAN DELETE). Karena itu migrasi ini
-- JUGA menambahkan GRANT DELETE ON materials ke app_runtime.
-- Prasyarat: 0006 dan 0008 sudah dijalankan.

BEGIN;

DROP POLICY IF EXISTS materials_admin_delete ON materials;
CREATE POLICY materials_admin_delete ON materials
  FOR DELETE
  USING (current_setting('app.current_user_role', true) = 'admin');

GRANT DELETE ON materials TO app_runtime;

COMMIT;

-- =============================================================================
-- INSTRUKSI APPLY (manual via CloudShell — RDS privat)
--   PGPASSWORD='<postgres>' psql "host=<rds-host> port=5432 dbname=lms \
--     user=postgres sslmode=require" -v ON_ERROR_STOP=1 \
--     -f ~/0017_materials_admin_delete.sql
-- Idempoten: DROP POLICY IF EXISTS sebelum CREATE; GRANT aman diulang.
-- =============================================================================
