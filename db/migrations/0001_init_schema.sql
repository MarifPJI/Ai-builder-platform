-- Migration: 0001_init_schema
-- Feature: identity-tenancy
-- Target: Amazon RDS for PostgreSQL (region ap-southeast-3)
--
-- Membuat skema inti identitas & tenancy:
--   - Tabel `schools`  (R5.1, R5.5, R6.3)
--   - Tabel `profiles` (R2.1, R2.3, R2.4, R3.11, R6.3)
--
-- Catatan:
--   * Seluruh waktu disimpan `timestamptz` default now() (UTC) lalu ditampilkan
--     sesuai `iana_timezone` sekolah terkait (R5.5).
--   * Primary key kedua tabel memakai UUID via gen_random_uuid() (R6.3).
--   * Ini adalah PostgreSQL murni (Amazon RDS) — bukan sintaks khusus Supabase.
--
-- Sumber kebenaran DDL ilustratif: .kiro/specs/identity-tenancy/design.md (bagian Data Models).

BEGIN;

-- gen_random_uuid() disediakan oleh extension pgcrypto.
-- Aktifkan bila belum tersedia (idempoten).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- Tabel: schools (R5.1, R5.5, R6.3)
-- Hingga 50 sekolah mitra; penegakan jumlah dilakukan di layer aplikasi/seed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS schools (
    school_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text NOT NULL,
    iana_timezone  text NOT NULL
                   CHECK (iana_timezone IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
    created_at     timestamptz NOT NULL DEFAULT now()  -- UTC (R5.5)
);

-- =============================================================================
-- Tabel: profiles (R2.1, R2.3, R2.4, R3.11, R6.3)
--   - cognito_sub & email UNIQUE
--   - full_name 1..150 karakter
--   - role IN ('admin','teacher')
--   - activation_status IN ('pending','active') DEFAULT 'pending'
--   - teacher wajib punya school_id (CONSTRAINT teacher_requires_school)
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub        text NOT NULL UNIQUE,
    email              text NOT NULL UNIQUE,                 -- format & panjang email divalidasi di layer aplikasi (maks 254)
    full_name          text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 150),
    role               text NOT NULL CHECK (role IN ('admin', 'teacher')),          -- R2.4
    school_id          uuid REFERENCES schools (school_id),  -- wajib untuk teacher (R2.3, R3.11)
    activation_status  text NOT NULL DEFAULT 'pending'
                       CHECK (activation_status IN ('pending', 'active')),           -- R2.1, R3.9
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    -- teacher wajib punya school_id; admin boleh lintas sekolah (school_id NULL)
    CONSTRAINT teacher_requires_school
        CHECK (role <> 'teacher' OR school_id IS NOT NULL)
);

-- =============================================================================
-- Index pendukung query tenancy & aktivasi
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_school_id       ON profiles (school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_activation ON profiles (role, activation_status);
-- cognito_sub sudah UNIQUE via definisi kolom; index unik eksplisit sesuai desain.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_cognito_sub ON profiles (cognito_sub);

COMMIT;
