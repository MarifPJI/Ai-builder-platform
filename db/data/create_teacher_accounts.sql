-- =============================================================================
-- Buat 1 akun Guru untuk SETIAP sekolah (51 akun) + sandi sementara
-- =============================================================================
-- Cara pakai: Supabase Dashboard > SQL Editor > New query > paste semua > Run.
-- Prasyarat: db/supabase_setup.sql sudah dijalankan (tabel schools & profiles).
--
-- Hasil: tabel di bawah editor berisi sekolah, email, sandi sementara, status.
-- SALIN/DOWNLOAD HASILNYA SEKARANG (tombol Export/CSV di panel hasil).
-- Sandi hanya tampil sekali; yang tersimpan di database hanya hash bcrypt.
--
-- Perilaku:
--   * Email  : guru.<nama sekolah tanpa spasi/simbol>@<v_domain>
--   * Nama   : "Guru <nama sekolah>" (bisa diubah nanti)
--   * Sandi  : 12 karakter acak (huruf besar, kecil, angka, simbol).
--              Guru WAJIB mengganti sandi saat login pertama.
--   * Peran  : app_metadata.role = 'teacher', app_metadata.school_id = sekolahnya
--   * Status : 'pending' (default) atau 'active' bila v_activate := true.
--              Akun pending baru bisa dipakai setelah Admin mengaktifkannya di
--              aplikasi (Kelola Guru > Aktifkan).
--   * Aman dijalankan ulang: email yang sudah ada dilewati (tidak diubah).
-- =============================================================================

CREATE TEMP TABLE IF NOT EXISTS teacher_accounts_out (
    school_name        text,
    email              text,
    temporary_password text,
    note               text
);
TRUNCATE teacher_accounts_out;

DO $$
DECLARE
    -- ===================== PENGATURAN =====================
    v_domain   text    := 'guru.aibuilder.test';  -- ganti bila ingin domain lain
    v_activate boolean := false;                  -- true = langsung aktif
    -- ======================================================

    c_lower  constant text := 'abcdefghijkmnpqrstuvwxyz';
    c_upper  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    c_digit  constant text := '23456789';
    c_symbol constant text := '!@#$%*?';
    c_all    constant text := c_lower || c_upper || c_digit || c_symbol;

    s       record;
    v_email text;
    v_name  text;
    v_pw    text;
    v_cs    text;
    v_uid   uuid;
    v_now   timestamptz := now();
BEGIN
    -- Konteks admin agar RLS (FORCE) mengizinkan baca schools & tulis profiles.
    PERFORM set_config('app.current_user_role', 'admin', true);
    PERFORM set_config('app.current_school_id', '00000000-0000-0000-0000-000000000000', true);

    FOR s IN SELECT school_id, name FROM public.schools ORDER BY name LOOP
        v_email := 'guru.' || lower(regexp_replace(s.name, '[^A-Za-z0-9]+', '', 'g'))
                   || '@' || v_domain;
        v_name  := left('Guru ' || s.name, 150);

        IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email)
           OR EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email) = v_email) THEN
            INSERT INTO teacher_accounts_out
            VALUES (s.name, v_email, NULL, 'dilewati: email sudah terdaftar');
            CONTINUE;
        END IF;

        -- Sandi acak (CSPRNG): 1 huruf kecil, 1 besar, 1 angka, 1 simbol, 8 bebas,
        -- lalu diacak urutannya.
        v_pw := '';
        FOR i IN 1..12 LOOP
            v_cs := CASE i WHEN 1 THEN c_lower WHEN 2 THEN c_upper
                           WHEN 3 THEN c_digit WHEN 4 THEN c_symbol
                           ELSE c_all END;
            v_pw := v_pw || substr(
                v_cs,
                1 + get_byte(extensions.gen_random_bytes(1), 0) % length(v_cs),
                1);
        END LOOP;
        SELECT string_agg(ch, '' ORDER BY random()) INTO v_pw
          FROM regexp_split_to_table(v_pw, '') AS ch;

        v_uid := gen_random_uuid();

        -- 1. Pengguna Supabase Auth (email sudah terkonfirmasi).
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at,
            confirmation_token, recovery_token, email_change_token_new, email_change
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_uid,
            'authenticated', 'authenticated', v_email,
            extensions.crypt(v_pw, extensions.gen_salt('bf')),
            v_now,
            jsonb_build_object(
                'provider', 'email',
                'providers', jsonb_build_array('email'),
                'role', 'teacher',
                'school_id', s.school_id::text,
                'must_change_password', true),
            jsonb_build_object('full_name', v_name),
            v_now, v_now,
            '', '', '', ''
        );

        -- 2. Identitas provider email (wajib agar login email/sandi berfungsi).
        INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object(
                'sub', v_uid::text,
                'email', v_email,
                'email_verified', true,
                'phone_verified', false),
            'email', v_now, v_now, v_now
        );

        -- 3. Profil aplikasi (cognito_sub = id pengguna Supabase).
        INSERT INTO public.profiles
            (cognito_sub, email, full_name, role, school_id, activation_status)
        VALUES
            (v_uid::text, v_email, v_name, 'teacher', s.school_id,
             CASE WHEN v_activate THEN 'active' ELSE 'pending' END);

        INSERT INTO teacher_accounts_out
        VALUES (s.name, v_email, v_pw,
                CASE WHEN v_activate THEN 'dibuat (aktif)'
                     ELSE 'dibuat (pending, aktifkan di Kelola Guru)' END);
    END LOOP;
END
$$;

SELECT school_name, email, temporary_password, note
  FROM teacher_accounts_out
 ORDER BY school_name;

-- =============================================================================
-- MENGAKTIFKAN SEMUA SEKALIGUS (opsional, setelah script di atas):
--
--   BEGIN;
--   SELECT set_config('app.current_user_role', 'admin', true);
--   UPDATE public.profiles SET activation_status = 'active', updated_at = now()
--    WHERE role = 'teacher' AND email LIKE '%@guru.aibuilder.test';
--   COMMIT;
--
-- MEMBATALKAN (hapus semua akun hasil script ini):
--
--   BEGIN;
--   SELECT set_config('app.current_user_role', 'admin', true);
--   DELETE FROM public.profiles WHERE email LIKE '%@guru.aibuilder.test';
--   DELETE FROM auth.users      WHERE email LIKE '%@guru.aibuilder.test';
--   COMMIT;
--   (profiles tidak punya policy DELETE; bila ditolak RLS, jalankan baris
--    "ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;" sebelum DELETE dan
--    "ALTER TABLE profiles FORCE ROW LEVEL SECURITY;" sesudahnya.)
-- =============================================================================
