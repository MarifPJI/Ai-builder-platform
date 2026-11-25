-- =============================================================================
-- AI Builder LMS — SETUP DATABASE SUPABASE (satu berkas, final state)
-- =============================================================================
-- Gabungan migrasi db/migrations/0001–0021 dalam bentuk akhir, siap dijalankan
-- di Supabase Dashboard > SQL Editor > New query > paste > Run.
--
-- SEBELUM RUN: ganti password app_runtime di LANGKAH 1 (cari GANTI_PASSWORD_INI).
--   Pakai password acak panjang (>= 16 karakter). Password ini dipakai di
--   DATABASE_URL Vercel:
--   postgresql://app_runtime.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres
--   Setelah sukses, hapus password dari query yang tersimpan di SQL Editor.
--
-- Sifat skrip:
--   * Satu transaksi: bila ada error, SEMUA dibatalkan (tidak setengah jadi).
--   * Idempoten: aman dijalankan ulang (IF NOT EXISTS, DROP POLICY IF EXISTS,
--     seed sekolah berdasarkan nama).
--   * Tenancy: RLS membaca app.current_user_role / app.current_school_id yang
--     disetel aplikasi per transaksi (withTenantTransaction / withPublicTransaction).
--
-- Perbedaan dari berkas migrasi lama (disengaja):
--   * Tambahan GRANT USAGE ON SCHEMA public TO app_runtime (perlu di Supabase).
--   * Tambahan DELETE untuk stem_gallery_items (grant + policy admin). Kode
--     deleteGalleryItem membutuhkannya; migrasi lama tidak memberikannya.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- LANGKAH 1 — Role aplikasi least-privilege `app_runtime` (0003)
-- Bukan superuser, tidak BYPASSRLS (default), tidak bisa membuat role/DB.
-- =============================================================================
DO $$
DECLARE
    pw text := 'GANTI_PASSWORD_INI';   -- <<< GANTI DENGAN PASSWORD KUAT
BEGIN
    IF pw = 'GANTI_PASSWORD_INI' OR length(pw) < 16 THEN
        RAISE EXCEPTION 'Ganti password app_runtime di LANGKAH 1 (minimal 16 karakter) sebelum menjalankan skrip.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
        EXECUTE format('CREATE ROLE app_runtime LOGIN NOCREATEROLE NOCREATEDB PASSWORD %L', pw);
    ELSE
        EXECUTE format('ALTER ROLE app_runtime WITH LOGIN NOCREATEROLE NOCREATEDB PASSWORD %L', pw);
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;

-- =============================================================================
-- LANGKAH 2 — Tabel
-- =============================================================================

-- ---- schools (0001) --------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
    school_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text NOT NULL,
    iana_timezone  text NOT NULL
                   CHECK (iana_timezone IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---- profiles (0001) -------------------------------------------------------
-- cognito_sub = UUID pengguna Supabase Auth (auth.users.id) sebagai teks.
CREATE TABLE IF NOT EXISTS profiles (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub        text NOT NULL UNIQUE,
    email              text NOT NULL UNIQUE,
    full_name          text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 150),
    role               text NOT NULL CHECK (role IN ('admin', 'teacher')),
    school_id          uuid REFERENCES schools (school_id),
    activation_status  text NOT NULL DEFAULT 'pending'
                       CHECK (activation_status IN ('pending', 'active')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT teacher_requires_school
        CHECK (role <> 'teacher' OR school_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_profiles_school_id       ON profiles (school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_activation ON profiles (role, activation_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_cognito_sub ON profiles (cognito_sub);

COMMENT ON COLUMN profiles.cognito_sub IS
    'UUID pengguna Supabase Auth (auth.users.id) sebagai teks. Nama kolom warisan era Cognito.';

-- ---- materials, material_files, material_reads (0006) ----------------------
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

-- ---- material_resources (0016 + 0019) --------------------------------------
CREATE TABLE IF NOT EXISTS material_resources (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id     uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    resource_type   varchar(24) NOT NULL,
    title           varchar(255) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
    external_url    text,
    s3_bucket       varchar(255),
    s3_key          varchar(1024),
    mime_type       varchar(120),
    file_size_bytes bigint,
    sort_order      int NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Constraint dalam bentuk akhir (0019: tambah 'web_link').
ALTER TABLE material_resources DROP CONSTRAINT IF EXISTS material_resources_resource_type_check;
ALTER TABLE material_resources
  ADD CONSTRAINT material_resources_resource_type_check
  CHECK (resource_type IN ('canva_embed', 'video_link', 'pdf_file', 'pptx_file', 'web_link'));

ALTER TABLE material_resources DROP CONSTRAINT IF EXISTS material_resource_target_valid;
ALTER TABLE material_resources
  ADD CONSTRAINT material_resource_target_valid CHECK (
    (resource_type IN ('canva_embed', 'video_link', 'web_link') AND external_url IS NOT NULL) OR
    (resource_type IN ('pdf_file', 'pptx_file') AND s3_key IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_material_resources_material      ON material_resources (material_id);
CREATE INDEX IF NOT EXISTS idx_material_resources_material_sort ON material_resources (material_id, sort_order);

-- ---- classes, class_students, class_sessions (0007 + 0018) -----------------
CREATE TABLE IF NOT EXISTS classes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES schools(school_id),
    name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    grade_level text,
    material_id uuid,
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
    material_id  uuid,
    name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
    scheduled_at timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- FK material_id -> ON DELETE SET NULL (0018): hapus Materi melepas tautan saja.
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_material_id_fkey;
ALTER TABLE classes
  ADD CONSTRAINT classes_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;

ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_material_id_fkey;
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_school        ON classes (school_id);
CREATE INDEX IF NOT EXISTS idx_class_students_class  ON class_students (class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_school ON class_students (school_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class  ON class_sessions (class_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_school ON class_sessions (school_id);

-- ---- showcase_projects, stem_gallery_items (0009 + 0020) -------------------
CREATE TABLE IF NOT EXISTS showcase_projects (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type           text NOT NULL CHECK (type IN ('student', 'teacher')),
    title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
    category       text NOT NULL,
    school_name    text NOT NULL CHECK (char_length(school_name) BETWEEN 1 AND 120),
    mentor         text,
    demo_url       text,
    summary        text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 4000),
    image_bucket   text,
    image_key      text,
    image_url      text,
    status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE showcase_projects ADD COLUMN IF NOT EXISTS submitter_name text;
COMMENT ON COLUMN showcase_projects.submitter_name IS
  'Nama siswa/tim pengirim dari formulir publik Kirim Proyek (opsional pada baris lama).';

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

-- ---- showcase_karya (0011) -------------------------------------------------
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
    detail       text,
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

-- ---- session_attendance, session_journals, session_photos (0013) -----------
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

-- ---- auth_login_failures (0021) --------------------------------------------
CREATE TABLE IF NOT EXISTS auth_login_failures (
    email         text PRIMARY KEY,
    failures      integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
    locked_until  timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- LANGKAH 3 — Seed 51 sekolah (0004)
-- RLS `schools` belum/tidak di-FORCE pada saat ini sehingga owner (postgres)
-- dapat menulis. FORCE diaktifkan di LANGKAH 4.
-- =============================================================================
ALTER TABLE schools NO FORCE ROW LEVEL SECURITY;

INSERT INTO schools (name, iana_timezone)
SELECT seed.name, seed.iana_timezone
FROM (
    VALUES
        ('SMA DARUL FALAH CIHAMPELAS',          'Asia/Jakarta'),
        ('SMKN 2 PEKALONGAN',                   'Asia/Jakarta'),
        ('SMK NEGERI 1 KARAWANG',               'Asia/Jakarta'),
        ('SMAN 1 TASIKMALAYA',                  'Asia/Jakarta'),
        ('SMAN 4 DEPOK',                        'Asia/Jakarta'),
        ('SMK PERGURUAN CIKINI KIIC KARAWANG',  'Asia/Jakarta'),
        ('SMAN 29 BANDUNG',                     'Asia/Jakarta'),
        ('SMAN 17 GARUT',                       'Asia/Jakarta'),
        ('SMAN 2 CIBARUSAH',                    'Asia/Jakarta'),
        ('SMKN 17 JAKARTA',                     'Asia/Jakarta'),
        ('SMAN 1 KANDANGHAUR INDRAMAYU',        'Asia/Jakarta'),
        ('SMKN 1 KAWALI',                       'Asia/Jakarta'),
        ('SMAN 2 KLARI',                        'Asia/Jakarta'),
        ('SMAN 1 NAGREG',                       'Asia/Jakarta'),
        ('SMAN 2 KARAWANG',                     'Asia/Jakarta'),
        ('SMAN 1 BATUJAJAR',                    'Asia/Jakarta'),
        ('SMKN 1 NARINGGUL',                    'Asia/Jakarta'),
        ('SMAN 1 KARAWANG',                     'Asia/Jakarta'),
        ('SMAN 1 SLEMAN',                       'Asia/Jakarta'),
        ('SMKN 4 BANDUNG',                      'Asia/Jakarta'),
        ('SMAN 1 BOJONGMANGU',                  'Asia/Jakarta'),
        ('SMAN 2 CIBINONG',                     'Asia/Jakarta'),
        ('SMAN 1 TELUKJAMBE',                   'Asia/Jakarta'),
        ('SMAN 1 SEWON',                        'Asia/Jakarta'),
        ('SMKN 10 SURABAYA',                    'Asia/Jakarta'),
        ('SMAN 1 KADIPATEN',                    'Asia/Jakarta'),
        ('SMKN 1 CIREBON',                      'Asia/Jakarta'),
        ('SMAN 2 CIANJUR',                      'Asia/Jakarta'),
        ('SMKN 15 JAKARTA',                     'Asia/Jakarta'),
        ('SMAN 1 CILILIN',                      'Asia/Jakarta'),
        ('SMAN 21 GARUT',                       'Asia/Jakarta'),
        ('SMKN 2 KOTA BEKASI',                  'Asia/Jakarta'),
        ('SMAN 1 TANGERANG',                    'Asia/Jakarta'),
        ('SMKN 1 KOTA SERANG',                  'Asia/Jakarta'),
        ('SMAN 1 SUMBER',                       'Asia/Jakarta'),
        ('SMAN 1 CIKIDANG',                     'Asia/Jakarta'),
        ('SMAN 1 WANAYASA',                     'Asia/Jakarta'),
        ('SMAN 1 SEMARANG',                     'Asia/Jakarta'),
        ('SMAN 1 CIPEUNDEUY KBB',               'Asia/Jakarta'),
        ('SMKN 1 KOTA SUKABUMI',                'Asia/Jakarta'),
        ('SMAN 2 BEKASI',                       'Asia/Jakarta'),
        ('SMAN 1 CIKARANG',                     'Asia/Jakarta'),
        ('SMAN 4 KARAWANG',                     'Asia/Jakarta'),
        ('SMKN 1 CIMAHI',                       'Asia/Jakarta'),
        ('SMKN 4 GARUT',                        'Asia/Jakarta'),
        ('SMKN 3 BUDURAN',                      'Asia/Jakarta'),
        ('SMKN 11 BANDUNG',                     'Asia/Jakarta'),
        ('SMAN 2 CIKARANG SELATAN',             'Asia/Jakarta'),
        ('SMKN 1 GEBANG',                       'Asia/Jakarta'),
        ('SMKN 3 BOGOR',                        'Asia/Jakarta'),
        -- Sekolah TEST (akun guru uji coba)
        ('SMAN 10 Samarinda',                   'Asia/Jakarta')
) AS seed (name, iana_timezone)
WHERE NOT EXISTS (
    SELECT 1 FROM schools s WHERE s.name = seed.name
);

-- =============================================================================
-- LANGKAH 4 — Row Level Security
-- ENABLE + FORCE: RLS berlaku juga untuk pemilik tabel. Deny-by-default:
-- current_setting(..., true) bernilai NULL bila tidak disetel -> policy gagal.
-- =============================================================================
ALTER TABLE schools            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_files     ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_reads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stem_gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_karya     ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_journals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_login_failures ENABLE ROW LEVEL SECURITY;

ALTER TABLE schools            FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles           FORCE ROW LEVEL SECURITY;
ALTER TABLE materials          FORCE ROW LEVEL SECURITY;
ALTER TABLE material_files     FORCE ROW LEVEL SECURITY;
ALTER TABLE material_reads     FORCE ROW LEVEL SECURITY;
ALTER TABLE material_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE classes            FORCE ROW LEVEL SECURITY;
ALTER TABLE class_students     FORCE ROW LEVEL SECURITY;
ALTER TABLE class_sessions     FORCE ROW LEVEL SECURITY;
ALTER TABLE showcase_projects  FORCE ROW LEVEL SECURITY;
ALTER TABLE stem_gallery_items FORCE ROW LEVEL SECURITY;
ALTER TABLE showcase_karya     FORCE ROW LEVEL SECURITY;
ALTER TABLE session_attendance FORCE ROW LEVEL SECURITY;
ALTER TABLE session_journals   FORCE ROW LEVEL SECURITY;
ALTER TABLE session_photos     FORCE ROW LEVEL SECURITY;
-- auth_login_failures tidak di-FORCE (sama seperti 0021); app_runtime bukan owner.

-- ---- schools (0002) --------------------------------------------------------
DROP POLICY IF EXISTS schools_admin_read ON schools;
CREATE POLICY schools_admin_read ON schools
  FOR SELECT
  USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS schools_teacher_scope ON schools;
CREATE POLICY schools_teacher_scope ON schools
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

-- ---- profiles (0002 + 0005) ------------------------------------------------
DROP POLICY IF EXISTS profiles_admin_read ON profiles;
CREATE POLICY profiles_admin_read ON profiles
  FOR SELECT
  USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS profiles_teacher_scope ON profiles;
CREATE POLICY profiles_teacher_scope ON profiles
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS profiles_admin_insert ON profiles;
CREATE POLICY profiles_admin_insert ON profiles
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ---- materials (0008 + 0017) -----------------------------------------------
DROP POLICY IF EXISTS materials_read ON materials;
CREATE POLICY materials_read ON materials
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IN ('admin', 'teacher'));

DROP POLICY IF EXISTS materials_admin_insert ON materials;
CREATE POLICY materials_admin_insert ON materials
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS materials_admin_update ON materials;
CREATE POLICY materials_admin_update ON materials
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS materials_admin_delete ON materials;
CREATE POLICY materials_admin_delete ON materials
  FOR DELETE
  USING (current_setting('app.current_user_role', true) = 'admin');

-- ---- material_files (0008) -------------------------------------------------
DROP POLICY IF EXISTS material_files_read ON material_files;
CREATE POLICY material_files_read ON material_files
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IN ('admin', 'teacher'));

DROP POLICY IF EXISTS material_files_admin_insert ON material_files;
CREATE POLICY material_files_admin_insert ON material_files
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS material_files_admin_update ON material_files;
CREATE POLICY material_files_admin_update ON material_files
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ---- material_reads (0008) -------------------------------------------------
DROP POLICY IF EXISTS material_reads_read ON material_reads;
CREATE POLICY material_reads_read ON material_reads
  FOR SELECT
  USING (current_setting('app.current_user_role', true) IN ('admin', 'teacher'));

DROP POLICY IF EXISTS material_reads_teacher_insert ON material_reads;
CREATE POLICY material_reads_teacher_insert ON material_reads
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher');

-- ---- material_resources (0016) ---------------------------------------------
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

-- ---- classes / class_students / class_sessions (0008 + 0015) ---------------
DROP POLICY IF EXISTS classes_teacher_scope ON classes;
CREATE POLICY classes_teacher_scope ON classes
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS class_students_teacher_scope ON class_students;
CREATE POLICY class_students_teacher_scope ON class_students
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS class_sessions_teacher_scope ON class_sessions;
CREATE POLICY class_sessions_teacher_scope ON class_sessions
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS classes_admin_read ON classes;
CREATE POLICY classes_admin_read ON classes
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS class_students_admin_read ON class_students;
CREATE POLICY class_students_admin_read ON class_students
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS class_sessions_admin_read ON class_sessions;
CREATE POLICY class_sessions_admin_read ON class_sessions
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS class_sessions_admin_update ON class_sessions;
CREATE POLICY class_sessions_admin_update ON class_sessions
  FOR UPDATE USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS class_sessions_admin_delete ON class_sessions;
CREATE POLICY class_sessions_admin_delete ON class_sessions
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

-- ---- showcase_projects (0010/0012) -----------------------------------------
DROP POLICY IF EXISTS showcase_read ON showcase_projects;
CREATE POLICY showcase_read ON showcase_projects
  FOR SELECT
  USING (status = 'approved'
         OR current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS showcase_public_insert ON showcase_projects;
CREATE POLICY showcase_public_insert ON showcase_projects
  FOR INSERT
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS showcase_admin_update ON showcase_projects;
CREATE POLICY showcase_admin_update ON showcase_projects
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ---- stem_gallery_items (0010/0012 + DELETE baru) --------------------------
DROP POLICY IF EXISTS gallery_public_read ON stem_gallery_items;
CREATE POLICY gallery_public_read ON stem_gallery_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS gallery_admin_insert ON stem_gallery_items;
CREATE POLICY gallery_admin_insert ON stem_gallery_items
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS gallery_admin_update ON stem_gallery_items;
CREATE POLICY gallery_admin_update ON stem_gallery_items
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS gallery_admin_delete ON stem_gallery_items;
CREATE POLICY gallery_admin_delete ON stem_gallery_items
  FOR DELETE
  USING (current_setting('app.current_user_role', true) = 'admin');

-- ---- showcase_karya (0011/0012) --------------------------------------------
DROP POLICY IF EXISTS karya_public_read ON showcase_karya;
CREATE POLICY karya_public_read ON showcase_karya
  FOR SELECT
  USING (published = true
         OR current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS karya_admin_insert ON showcase_karya;
CREATE POLICY karya_admin_insert ON showcase_karya
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS karya_admin_update ON showcase_karya;
CREATE POLICY karya_admin_update ON showcase_karya
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ---- session_attendance / journals / photos (0014 + 0015) ------------------
DROP POLICY IF EXISTS session_attendance_teacher_scope ON session_attendance;
CREATE POLICY session_attendance_teacher_scope ON session_attendance
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS session_journals_teacher_scope ON session_journals;
CREATE POLICY session_journals_teacher_scope ON session_journals
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS session_photos_teacher_scope ON session_photos;
CREATE POLICY session_photos_teacher_scope ON session_photos
  USING (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (current_setting('app.current_user_role', true) = 'teacher'
         AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS session_attendance_admin_read ON session_attendance;
CREATE POLICY session_attendance_admin_read ON session_attendance
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_journals_admin_read ON session_journals;
CREATE POLICY session_journals_admin_read ON session_journals
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_photos_admin_read ON session_photos;
CREATE POLICY session_photos_admin_read ON session_photos
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_attendance_admin_insert ON session_attendance;
CREATE POLICY session_attendance_admin_insert ON session_attendance
  FOR INSERT WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_attendance_admin_update ON session_attendance;
CREATE POLICY session_attendance_admin_update ON session_attendance
  FOR UPDATE USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_attendance_admin_delete ON session_attendance;
CREATE POLICY session_attendance_admin_delete ON session_attendance
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_journals_admin_insert ON session_journals;
CREATE POLICY session_journals_admin_insert ON session_journals
  FOR INSERT WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_journals_admin_update ON session_journals;
CREATE POLICY session_journals_admin_update ON session_journals
  FOR UPDATE USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_journals_admin_delete ON session_journals;
CREATE POLICY session_journals_admin_delete ON session_journals
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS session_photos_admin_delete ON session_photos;
CREATE POLICY session_photos_admin_delete ON session_photos
  FOR DELETE USING (current_setting('app.current_user_role', true) = 'admin');

-- ---- auth_login_failures (0021) --------------------------------------------
-- Dipakai sebelum login (tanpa konteks tenant); tidak berisi data tenant.
DROP POLICY IF EXISTS auth_login_failures_app_runtime ON auth_login_failures;
CREATE POLICY auth_login_failures_app_runtime ON auth_login_failures
  FOR ALL TO app_runtime
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- LANGKAH 5 — GRANT least-privilege ke app_runtime
-- =============================================================================
GRANT SELECT, INSERT, UPDATE         ON schools            TO app_runtime;
GRANT SELECT, INSERT, UPDATE         ON profiles           TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON materials          TO app_runtime;
GRANT SELECT, INSERT, UPDATE         ON material_files     TO app_runtime;
GRANT SELECT, INSERT                 ON material_reads     TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON material_resources TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON classes            TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON class_students     TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON class_sessions     TO app_runtime;
GRANT SELECT, INSERT, UPDATE         ON showcase_projects  TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON stem_gallery_items TO app_runtime;
GRANT SELECT, INSERT, UPDATE         ON showcase_karya     TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_attendance TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_journals   TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_photos     TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_login_failures TO app_runtime;

-- =============================================================================
-- LANGKAH 6 — Tutup Supabase Data API (anon / authenticated) (0021)
-- Aplikasi hanya memakai koneksi pg sebagai app_runtime. Grant default Supabase
-- ke anon/authenticated dicabut agar kunci anon tidak bisa membaca/menulis tabel.
-- =============================================================================
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- VERIFIKASI (hasil tampil di bawah editor)
-- Konteks admin disetel untuk sesi editor ini agar count sekolah tetap terbaca
-- di bawah FORCE RLS (policy schools_admin_read).
-- =============================================================================
SELECT set_config('app.current_user_role', 'admin', false);

SELECT c.relname                    AS table_name,
       c.relrowsecurity             AS rls_enabled,
       c.relforcerowsecurity        AS rls_forced,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies,
       has_table_privilege('app_runtime', c.oid, 'SELECT') AS app_runtime_select,
       has_table_privilege('anon', c.oid, 'SELECT')        AS anon_select,
       (SELECT count(*) FROM schools)                      AS total_schools
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
 ORDER BY c.relname;
-- Harapan: 16 tabel, rls_enabled = true semua, anon_select = false semua,
-- app_runtime_select = true semua, total_schools = 51.

-- =============================================================================
-- SETELAH SKRIP INI: buat Admin pertama
-- 1. Dashboard > Authentication > Users > Add user > Create new user
--    (isi email + password, centang "Auto Confirm User").
-- 2. Jalankan (ganti email):
--
--   UPDATE auth.users
--      SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                              || '{"role":"admin"}'::jsonb
--    WHERE email = 'admin@contoh.id';
--
-- Admin tidak perlu baris profiles. Guru dibuat dari aplikasi (Kelola Guru).
-- =============================================================================
