-- Migration: 0012_showcase_public_repair
-- Feature: public-showcase
-- Target: Amazon RDS for PostgreSQL (ap-southeast-1)
--
-- Perbaikan idempoten jalur PUBLIK. Menjamin RLS + GRANT untuk akses publik
-- (role 'public') pada showcase_projects, stem_gallery_items, dan showcase_karya
-- benar-benar ada — terlepas dari apakah 0010/0011 commit sebagian.
--
-- Aman dijalankan ulang: DROP POLICY IF EXISTS sebelum CREATE, GRANT idempoten.

BEGIN;

-- Pastikan RLS enabled (idempoten; ENABLE berulang tidak error).
ALTER TABLE showcase_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stem_gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE showcase_karya      ENABLE ROW LEVEL SECURITY;

-- ── showcase_projects: publik baca approved; insert pending; admin update ──
DROP POLICY IF EXISTS showcase_read           ON showcase_projects;
DROP POLICY IF EXISTS showcase_public_insert  ON showcase_projects;
DROP POLICY IF EXISTS showcase_admin_update   ON showcase_projects;
CREATE POLICY showcase_read ON showcase_projects FOR SELECT
  USING (status = 'approved'
         OR current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY showcase_public_insert ON showcase_projects FOR INSERT
  WITH CHECK (status = 'pending');
CREATE POLICY showcase_admin_update ON showcase_projects FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ── stem_gallery_items: baca publik; tulis admin ──
DROP POLICY IF EXISTS gallery_public_read   ON stem_gallery_items;
DROP POLICY IF EXISTS gallery_admin_insert  ON stem_gallery_items;
DROP POLICY IF EXISTS gallery_admin_update  ON stem_gallery_items;
CREATE POLICY gallery_public_read ON stem_gallery_items FOR SELECT
  USING (true);
CREATE POLICY gallery_admin_insert ON stem_gallery_items FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY gallery_admin_update ON stem_gallery_items FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ── showcase_karya: publik baca published; admin tulis ──
DROP POLICY IF EXISTS karya_public_read   ON showcase_karya;
DROP POLICY IF EXISTS karya_admin_insert  ON showcase_karya;
DROP POLICY IF EXISTS karya_admin_update  ON showcase_karya;
CREATE POLICY karya_public_read ON showcase_karya FOR SELECT
  USING (published = true
         OR current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY karya_admin_insert ON showcase_karya FOR INSERT
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
CREATE POLICY karya_admin_update ON showcase_karya FOR UPDATE
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

-- ── GRANT (idempoten) ke app_runtime ──
GRANT SELECT, INSERT, UPDATE ON showcase_projects  TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON stem_gallery_items TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON showcase_karya      TO app_runtime;

COMMIT;
