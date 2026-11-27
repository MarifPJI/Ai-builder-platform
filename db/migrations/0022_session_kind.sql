-- Migration: 0022_session_kind
-- Feature: tipe sesi terstruktur (Sesi Penuh / Sesi n / Sesi Terakhir / Sesi Tambahan)
-- Target: Supabase Postgres (jalankan di SQL Editor sebagai owner `postgres`)
--
-- Menambah dua kolom ke `class_sessions` agar aplikasi tahu kapan sebuah Kelas
-- SELESAI mengajarkan satu Materi (dasar pelacakan progres di Dashboard Admin):
--   * session_kind : 'full'  = satu sesi mencakup seluruh Materi (Sesi Penuh)
--                    'part'  = bagian dari Materi multi-sesi (Sesi 1, 2, ...)
--                    'final' = sesi terakhir Materi multi-sesi (Sesi n (Terakhir))
--                    'extra' = sesi tambahan setelah Materi selesai (tidak menambah progres)
--   * part_number  : nomor sesi untuk 'part'/'final' (1..50); NULL untuk 'full'/'extra'.
--
-- Sesi lama tetap NULL di kedua kolom (= "tanpa tipe") dan tidak dihitung
-- sebagai Materi selesai. Tidak ada data yang diubah.
--
-- RLS & GRANT: kebijakan dan grant `class_sessions` yang ada (0008, 0015)
-- berlaku per baris, jadi otomatis mencakup kolom baru. Tidak ada perubahan.
--
-- Idempoten: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS sebelum ADD,
-- CREATE INDEX IF NOT EXISTS. Aman dijalankan ulang.
--
-- URUTAN DEPLOY: jalankan migrasi ini SEBELUM kode yang memakai kolom ini
-- dideploy, agar halaman Sesi tidak error karena kolom belum ada.

BEGIN;

ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS session_kind text;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS part_number  smallint;

ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_session_kind_check;
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_session_kind_check
  CHECK (session_kind IS NULL OR session_kind IN ('full', 'part', 'final', 'extra'));

ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_part_number_range;
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_part_number_range
  CHECK (part_number IS NULL OR part_number BETWEEN 1 AND 50);

-- 'part'/'final' WAJIB bernomor; 'full'/'extra'/NULL TIDAK bernomor.
ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_kind_number_consistent;
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_kind_number_consistent
  CHECK (
    (session_kind IN ('part', 'final') AND part_number IS NOT NULL) OR
    ((session_kind IS NULL OR session_kind IN ('full', 'extra')) AND part_number IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_class_sessions_class_material
  ON class_sessions (class_id, material_id);

COMMIT;
