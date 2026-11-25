-- Migration: 0010_showcase_rls
-- Feature: public-showcase
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- RLS untuk tabel publik 0009 + GRANT ke app_runtime.
--
-- Model akses (public-showcase R2.4, R4.2, R5.2, R7.2, R7.3):
--   showcase_projects:
--     - SELECT publik: HANYA baris status='approved' (admin boleh lihat semua).
--     - INSERT publik: diizinkan TAPI WITH CHECK memaksa status='pending'
--       (kiriman publik tak bisa langsung 'approved').
--     - UPDATE (moderasi): HANYA admin.
--   stem_gallery_items:
--     - SELECT: publik (semua baris).
--     - INSERT/UPDATE: HANYA admin.
--
-- Konteks peran: operasi publik dijalankan dengan app.current_user_role TIDAK
-- diset ke 'admin' (mis. 'public' atau NULL). current_setting(...,true)=NULL
-- saat tak diset → kondisi admin gagal → hanya jalur publik yang berlaku.
-- Operasi admin dijalankan via withTenantTransaction dengan klaim admin
-- (role='admin').
--
-- Prasyarat: 0009 sudah dijalankan; role app_runtime ada (0003).

BEGIN;

-- =============================================================================
-- showcase_projects
-- =============================================================================
ALTER TABLE showcase_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_projects FORCE  ROW LEVEL SECURITY;

-- Baca: publik hanya 'approved'; admin melihat semua status (moderasi).
CREATE POLICY showcase_read ON showcase_projects
  FOR SELECT
  USING (
    status = 'approved'
    OR current_setting('app.current_user_role', true) = 'admin'
  );

-- Insert publik: selalu 'pending' (kiriman tak bisa langsung tayang).
CREATE POLICY showcase_public_insert ON showcase_projects
  FOR INSERT
  WITH CHECK (status = 'pending');

-- Update: hanya admin (menyetujui/menolak).
CREATE POLICY showcase_admin_update ON showcase_projects
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- =============================================================================
-- stem_gallery_items
-- =============================================================================
ALTER TABLE stem_gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stem_gallery_items FORCE  ROW LEVEL SECURITY;

-- Baca: publik (semua).
CREATE POLICY gallery_public_read ON stem_gallery_items
  FOR SELECT
  USING (true);

-- Insert/Update: hanya admin.
CREATE POLICY gallery_admin_insert ON stem_gallery_items
  FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY gallery_admin_update ON stem_gallery_items
  FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- =============================================================================
-- GRANT least-privilege ke app_runtime.
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON showcase_projects  TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON stem_gallery_items TO app_runtime;

COMMIT;
