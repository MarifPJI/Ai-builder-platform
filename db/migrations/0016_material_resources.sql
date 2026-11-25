-- Migration: 0016_material_resources
-- Feature: redesign-materi-multi-sumber (A07/T03)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Tabel SUMBER MATERI (1 Materi -> N Sumber, GLOBAL lintas sekolah).
--   * material_resources : sumber belajar pegangan Guru per Materi. Satu Materi
--     dapat memiliki banyak sumber tanpa batas: Canva Smart Embed, tautan Video
--     (YouTube/Vimeo/MP4), berkas PDF, dan slide PPTX.
--
-- Menggantikan peran `material_files` (0006) sebagai sumber kebenaran lampiran
-- Materi. `material_files` SENGAJA DIBIARKAN ADA (tidak di-drop) demi keamanan;
-- tidak lagi dipakai aplikasi setelah refactor.
--
-- Materi BUKAN tenant per school_id (sama seperti materials/0006): diterbitkan
-- Admin, dibaca semua Guru. RLS: SELECT admin+teacher; tulis HANYA admin.
-- Prasyarat: 0006 (materials) sudah dijalankan.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS material_resources (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id     uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    resource_type   varchar(24) NOT NULL
                    CHECK (resource_type IN ('canva_embed', 'video_link', 'pdf_file', 'pptx_file')),
    title           varchar(255) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
    external_url    text,
    s3_bucket       varchar(255),
    s3_key          varchar(1024),
    mime_type       varchar(120),
    file_size_bytes bigint,
    sort_order      int NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    -- Sumber tautan (canva/video) WAJIB punya external_url; sumber berkas
    -- (pdf/pptx) WAJIB punya s3_key.
    CONSTRAINT material_resource_target_valid CHECK (
        (resource_type IN ('canva_embed', 'video_link') AND external_url IS NOT NULL) OR
        (resource_type IN ('pdf_file', 'pptx_file') AND s3_key IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_material_resources_material
    ON material_resources (material_id);
CREATE INDEX IF NOT EXISTS idx_material_resources_material_sort
    ON material_resources (material_id, sort_order);

-- =============================================================================
-- RLS: Materi GLOBAL — SELECT admin+teacher; INSERT/UPDATE/DELETE admin-only.
-- Meniru pola material_files di 0008_rls_policies.sql.
-- =============================================================================
ALTER TABLE material_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_resources FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_resources_read ON material_resources;
CREATE POLICY material_resources_read ON material_resources
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IN ('admin', 'teacher'));

DROP POLICY IF EXISTS material_resources_admin_insert ON material_resources;
CREATE POLICY material_resources_admin_insert ON material_resources
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS material_resources_admin_update ON material_resources;
CREATE POLICY material_resources_admin_update ON material_resources
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS material_resources_admin_delete ON material_resources;
CREATE POLICY material_resources_admin_delete ON material_resources
  FOR DELETE
  USING (current_setting('app.current_user_role', true) = 'admin');

-- GRANT least-privilege ke role aplikasi (app_runtime) — paritas dengan 0008.
GRANT SELECT, INSERT, UPDATE, DELETE ON material_resources TO app_runtime;

COMMIT;

-- =============================================================================
-- INSTRUKSI APPLY (manual via CloudShell — RDS privat)
-- -----------------------------------------------------------------------------
-- Jalankan SETELAH 0006 ada. Idempoten: CREATE TABLE IF NOT EXISTS + DROP POLICY
-- IF EXISTS sebelum tiap CREATE POLICY. Aman dijalankan ulang.
--   PGPASSWORD='<postgres>' psql "host=<rds-host> port=5432 dbname=lms \
--     user=postgres sslmode=require" -v ON_ERROR_STOP=1 \
--     -f ~/0016_material_resources.sql
-- =============================================================================
