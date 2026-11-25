-- Migration: 0018_material_fk_set_null
-- Feature: redesign-materi-multi-sumber (A07 — hapus Materi yang masih dipakai)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Mengubah FK `material_id` pada `classes` dan `class_sessions` menjadi
-- ON DELETE SET NULL. Sebelumnya (0007) FK ini tanpa klausa aksi (default
-- NO ACTION/RESTRICT), sehingga menghapus Materi yang masih dirujuk kelas/sesi
-- ditolak:
--   ERROR: update or delete on table "materials" violates foreign key
--          constraint "classes_material_id_fkey" on table "classes".
--
-- Dengan SET NULL: menghapus Materi akan MELEPAS tautan (material_id -> NULL)
-- pada kelas/sesi terkait TANPA menghapus kelas, siswa, sesi, atau presensi.
-- Kolom material_id pada kedua tabel memang nullable (lihat 0007).
--
-- Idempoten: pakai DROP CONSTRAINT IF EXISTS sebelum ADD. Nama constraint
-- mengikuti konvensi default PostgreSQL (<tabel>_<kolom>_fkey) yang dikonfirmasi
-- dari pesan error produksi (classes_material_id_fkey).
-- Prasyarat: 0006 (materials) dan 0007 (classes, class_sessions) sudah dijalankan.

BEGIN;

-- classes.material_id -> ON DELETE SET NULL
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_material_id_fkey;
ALTER TABLE classes
  ADD CONSTRAINT classes_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;

-- class_sessions.material_id -> ON DELETE SET NULL
ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_material_id_fkey;
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;

COMMIT;

-- =============================================================================
-- INSTRUKSI APPLY (manual via CloudShell — RDS privat)
--   PGPASSWORD='<postgres>' psql "host=<rds-host> port=5432 dbname=lms \
--     user=postgres sslmode=require" -v ON_ERROR_STOP=1 \
--     -f ~/0018_material_fk_set_null.sql
-- Idempoten: DROP CONSTRAINT IF EXISTS sebelum ADD. Aman dijalankan ulang.
-- Jalankan sebagai pemilik tabel (postgres); ALTER TABLE perlu hak owner.
-- =============================================================================
