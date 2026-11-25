-- Migration: 0006_materials
-- Feature: course-class-publishing
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Tabel MATERI (GLOBAL lintas sekolah) — R1.2, R1.7, R3.3, R8.6.
--   * materials      : Materi pegangan Guru yang diterbitkan Admin (A07).
--   * material_files : lampiran berkas (pptx/pdf di S3, atau video via URL).
--   * material_reads : penanda Guru telah menandai Materi selesai dibaca (T03).
--
-- Materi BUKAN tenant per school_id: diterbitkan Admin, dibaca semua Guru.
-- RLS untuk tabel-tabel ini didefinisikan di 0008_rls_policies.sql.
-- Prasyarat: 0001 (schools, profiles) sudah dijalankan.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS materials (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    time_allocation text,
    summary         text,
    key_points      text,
    publish_status  text NOT NULL DEFAULT 'draft'
                    CHECK (publish_status IN ('draft', 'published')),
    created_by      uuid REFERENCES profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_files (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('pptx', 'pdf', 'video')),
    file_name   text NOT NULL,
    s3_bucket   text,
    s3_key      text,
    video_url   text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    -- video memakai video_url; pptx/pdf memakai objek S3 (s3_key wajib).
    CONSTRAINT material_file_target_valid CHECK (
        (kind = 'video' AND video_url IS NOT NULL) OR
        (kind <> 'video' AND s3_key IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS material_reads (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    read_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_material_read UNIQUE (material_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_material_files_material ON material_files (material_id);
CREATE INDEX IF NOT EXISTS idx_material_reads_profile  ON material_reads (profile_id);
CREATE INDEX IF NOT EXISTS idx_materials_publish       ON materials (publish_status);

COMMIT;
