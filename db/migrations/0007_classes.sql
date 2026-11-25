-- Migration: 0007_classes
-- Feature: course-class-publishing
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Tabel KELAS / SISWA / SESI (TENANT per school_id) — R4.2, R4.6, R6.1, R8.6.
--   * classes        : kelas yang dibuat Guru pada sekolahnya (T02).
--   * class_students  : daftar siswa kelas (nis, full_name) — dasar daftar hadir.
--   * class_sessions  : jadwal sesi pertemuan kelas memakai Materi dari Admin.
--
-- Terikat school_id; isolasi tenant ditegakkan RLS di 0008_rls_policies.sql.
-- Prasyarat: 0001 (schools, profiles) dan 0006 (materials) sudah dijalankan.

BEGIN;

CREATE TABLE IF NOT EXISTS classes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(school_id),
    name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    grade_level text,
    material_id uuid REFERENCES materials(id),
    created_by  uuid REFERENCES profiles(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_students (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    school_id  uuid NOT NULL REFERENCES schools(school_id),
    nis        text NOT NULL,
    full_name  text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 150),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id     uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    school_id    uuid NOT NULL REFERENCES schools(school_id),
    material_id  uuid REFERENCES materials(id),
    name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
    scheduled_at timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_school        ON classes (school_id);
CREATE INDEX IF NOT EXISTS idx_class_students_class  ON class_students (class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_school ON class_students (school_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class  ON class_sessions (class_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_school ON class_sessions (school_id);

COMMIT;
