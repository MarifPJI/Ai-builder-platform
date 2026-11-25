-- Migration: 0020_showcase_submitter_name
-- Feature: public-showcase (sinkronisasi karya landing ⇄ admin, Option A)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Menyimpan nama siswa/tim pengirim pada kiriman publik `showcase_projects`.
-- Sebelumnya `submitProject()` memvalidasi `name` lalu membuangnya; kolom baru
-- ini memungkinkan nama pengirim ditampilkan di antarmuka moderasi Admin.
--
-- Catatan RLS/GRANT: policy di 0010/0012 TIDAK menyebutkan daftar kolom
-- (USING/WITH CHECK hanya memeriksa `status`), dan GRANT bersifat level-tabel
-- (bukan per-kolom). Karena itu penambahan kolom ini TIDAK mengubah semantik
-- RLS: insert publik tetap dipaksa status='pending', dan kolom baru otomatis
-- tercakup oleh GRANT yang ada. Tidak ada perubahan policy yang diperlukan.
--
-- Aman dijalankan ulang: ADD COLUMN IF NOT EXISTS.
-- Prasyarat: 0009 (showcase_projects) sudah dijalankan.

BEGIN;

ALTER TABLE showcase_projects
  ADD COLUMN IF NOT EXISTS submitter_name text;

COMMENT ON COLUMN showcase_projects.submitter_name IS
  'Nama siswa/tim pengirim dari formulir publik Kirim Proyek (opsional pada baris lama).';

COMMIT;
