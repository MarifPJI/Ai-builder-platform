-- Migration: 0013_attendance_journal
-- Feature: teacher-ui (Presensi & Jurnal — T06B)
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Tabel PRESENSI / JURNAL / FOTO SESI (TENANT per school_id) — FR-17.
--   * session_attendance : status kehadiran siswa per sesi (hadir/sakit/izin/alfa).
--                          "Belum ditandai" = baris tidak ada (Decision 2).
--   * session_journals   : satu catatan jurnal per sesi (notes opsional).
--   * session_photos      : metadata foto dokumentasi sesi (bucket + key S3 privat).
--
-- Terikat school_id; isolasi tenant ditegakkan RLS di 0014_attendance_rls.sql.
-- Prasyarat: 0007 (classes, class_students, class_sessions) sudah dijalankan.

BEGIN;

CREATE TABLE IF NOT EXISTS session_attendance (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES class_students(id) ON DELETE CASCADE,
    school_id  uuid NOT NULL REFERENCES schools(school_id),
    status     text NOT NULL CHECK (status IN ('hadir','sakit','izin','alfa')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS session_journals (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    school_id  uuid NOT NULL REFERENCES schools(school_id),
    notes      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS session_photos (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    school_id  uuid NOT NULL REFERENCES schools(school_id),
    s3_bucket  text NOT NULL,
    s3_key     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_attendance_school  ON session_attendance (school_id);
CREATE INDEX IF NOT EXISTS idx_session_attendance_session ON session_attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_session_journals_school    ON session_journals (school_id);
CREATE INDEX IF NOT EXISTS idx_session_journals_session   ON session_journals (session_id);
CREATE INDEX IF NOT EXISTS idx_session_photos_school      ON session_photos (school_id);
CREATE INDEX IF NOT EXISTS idx_session_photos_session     ON session_photos (session_id);

COMMIT;
