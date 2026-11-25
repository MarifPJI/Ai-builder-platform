-- Migration: 0011_showcase_karya
-- Feature: public-showcase (revisi model)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Model DIPERJELAS:
--   * showcase_projects (0009) = KOTAK MASUK KIRIMAN siswa dari form publik.
--     Hanya untuk ditinjau/dicatat Admin; TIDAK tampil publik.
--   * showcase_karya (BARU)    = KARYA yang DITERBITKAN Admin; INI yang tampil
--     di Bagian "Showcase Karya" publik, punya halaman detail `/showcase/[id]`.
--
-- Karya punya gambar (S3 publik via CloudFront): image_bucket/image_key/image_url.
-- RLS: baca publik, tulis admin. Grant ke app_runtime.
-- Prasyarat: 0001 (profiles), 0009 (showcase_projects) sudah dijalankan.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS showcase_karya (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type         text NOT NULL DEFAULT 'student'
                 CHECK (type IN ('student', 'teacher')),
    title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
    category     text NOT NULL,
    school_name  text NOT NULL CHECK (char_length(school_name) BETWEEN 1 AND 120),
    mentor       text,
    demo_url     text,
    summary      text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 4000),
    detail       text,                 -- isi lengkap untuk halaman detail
    image_bucket text,
    image_key    text,
    image_url    text,
    published    boolean NOT NULL DEFAULT true,
    created_by   uuid REFERENCES profiles(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_karya_published ON showcase_karya (published);
CREATE INDEX IF NOT EXISTS idx_karya_type      ON showcase_karya (type);

-- RLS: publik baca karya published; admin tulis.
ALTER TABLE showcase_karya ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_karya FORCE  ROW LEVEL SECURITY;

CREATE POLICY karya_public_read ON showcase_karya
  FOR SELECT
  USING (published = true
         OR current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY karya_admin_insert ON showcase_karya
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY karya_admin_update ON showcase_karya
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

GRANT SELECT, INSERT, UPDATE ON showcase_karya TO app_runtime;

COMMIT;
