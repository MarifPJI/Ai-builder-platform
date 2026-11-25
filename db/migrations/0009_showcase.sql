-- Migration: 0009_showcase
-- Feature: public-showcase
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Tabel halaman publik U01 (awsinstem.id):
--   * showcase_projects : entri karya (proyek siswa / inovasi guru). Kiriman
--     publik masuk status 'pending' → 'approved' oleh Admin sebelum tayang.
--   * stem_gallery_items: dokumentasi kegiatan STEM per tahun (2024–2026).
--
-- Gambar disimpan di S3 publik (via CloudFront): image_bucket/image_key +
-- image_url (URL CloudFront). RLS didefinisikan di 0010_showcase_rls.sql.
-- Prasyarat: 0001 (schools, profiles) sudah dijalankan.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS showcase_projects (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type         text NOT NULL CHECK (type IN ('student', 'teacher')),
    title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
    category     text NOT NULL,
    school_name  text NOT NULL CHECK (char_length(school_name) BETWEEN 1 AND 120),
    mentor       text,                 -- Kelas & Guru Pembimbing (opsional)
    demo_url     text,
    summary      text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 4000),
    image_bucket text,
    image_key    text,
    image_url    text,
    status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stem_gallery_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    year         int  NOT NULL CHECK (year BETWEEN 2024 AND 2100),
    title        text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    caption      text,
    image_bucket text,
    image_key    text,
    image_url    text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showcase_status ON showcase_projects (status);
CREATE INDEX IF NOT EXISTS idx_showcase_type   ON showcase_projects (type);
CREATE INDEX IF NOT EXISTS idx_gallery_year    ON stem_gallery_items (year);

COMMIT;
