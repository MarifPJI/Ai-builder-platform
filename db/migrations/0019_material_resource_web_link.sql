-- Migration: 0019_material_resource_web_link
-- Feature: redesign-materi-multi-sumber (A07/T03 — jenis sumber "Tautan Web")
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Menambah jenis sumber ke-5: `web_link` (tautan web umum — mis. halaman Notion,
-- Google Doc, website). Ditampilkan sebagai kartu + tombol "Buka Tautan" (buka
-- tab baru), TANPA iframe (banyak situs memblokir embed via X-Frame-Options/CSP).
--
-- Mengubah CHECK constraint `resource_type` pada material_resources (0016) agar
-- menerima nilai baru. web_link memakai `external_url` (sama seperti canva/video),
-- sehingga CHECK target-valid (external_url wajib untuk sumber tautan) diperluas.
-- Prasyarat: 0016 sudah dijalankan.

BEGIN;

-- 1) Perluas CHECK resource_type: tambah 'web_link'.
ALTER TABLE material_resources
  DROP CONSTRAINT IF EXISTS material_resources_resource_type_check;
ALTER TABLE material_resources
  ADD CONSTRAINT material_resources_resource_type_check
  CHECK (resource_type IN ('canva_embed', 'video_link', 'pdf_file', 'pptx_file', 'web_link'));

-- 2) Perluas CHECK target-valid: web_link termasuk sumber "tautan" (butuh external_url).
ALTER TABLE material_resources
  DROP CONSTRAINT IF EXISTS material_resource_target_valid;
ALTER TABLE material_resources
  ADD CONSTRAINT material_resource_target_valid CHECK (
    (resource_type IN ('canva_embed', 'video_link', 'web_link') AND external_url IS NOT NULL) OR
    (resource_type IN ('pdf_file', 'pptx_file') AND s3_key IS NOT NULL)
  );

COMMIT;

-- =============================================================================
-- INSTRUKSI APPLY (manual via CloudShell — RDS privat)
--   PGPASSWORD='<postgres>' psql "host=<rds-host> port=5432 dbname=lms \
--     user=postgres sslmode=require" -v ON_ERROR_STOP=1 \
--     -f ~/0019_material_resource_web_link.sql
-- Idempoten: DROP CONSTRAINT IF EXISTS sebelum ADD. Aman dijalankan ulang.
-- Jalankan sebagai pemilik tabel (postgres); ALTER TABLE perlu hak owner.
-- =============================================================================
