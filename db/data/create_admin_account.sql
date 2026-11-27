-- =============================================================================
-- Buat 1 akun ADMIN baru + sandi sementara
-- =============================================================================
-- Cara pakai: Supabase Dashboard > SQL Editor > New query > paste semua >
--             ubah v_email & v_name di bagian PENGATURAN > Run.
-- Prasyarat : db/supabase_setup.sql sudah dijalankan (tabel profiles ada).
--
-- Hasil: satu baris berisi email, sandi sementara, dan status.
-- SALIN SANDINYA SEKARANG. Sandi hanya tampil sekali; yang tersimpan di
-- database hanya hash bcrypt.
--
-- Perilaku:
--   * Peran  : app_metadata.role = 'admin' (tanpa school_id, lintas sekolah).
--   * Sandi  : 12 karakter acak. Admin WAJIB mengganti sandi saat login pertama.
--   * Status : profiles.activation_status = 'active'.
--   * Aman dijalankan ulang: bila email sudah terdaftar, tidak ada yang diubah.
-- =============================================================================

CREATE TEMP TABLE IF NOT EXISTS admin_account_out (
    email              text,
    temporary_password text,
    note               text
);
TRUNCATE admin_account_out;

DO $$
DECLARE
    -- ===================== PENGATURAN =====================
    v_email text := lower(trim('admin.baru@prestasijunior.org'));  -- GANTI
    v_name  text := 'Admin Baru';                                   -- GANTI (1-150 karakter)
    -- ======================================================

    c_lower  constant text := 'abcdefghijkmnpqrstuvwxyz';
    c_upper  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    c_digit  constant text := '23456789';
    c_symbol constant text := '!@#$%*?';
    c_all    constant text := c_lower || c_upper || c_digit || c_symbol;

    v_pw  text := '';
    v_cs  text;
    v_uid uuid := gen_random_uuid();
    v_now timestamptz := now();
BEGIN
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN
        RAISE EXCEPTION 'Email tidak valid: %', v_email;
    END IF;
    IF char_length(v_name) NOT BETWEEN 1 AND 150 THEN
        RAISE EXCEPTION 'Nama harus 1-150 karakter.';
    END IF;

    -- Konteks admin agar RLS (FORCE) mengizinkan tulis profiles.
    PERFORM set_config('app.current_user_role', 'admin', true);
    PERFORM set_config('app.current_school_id', '00000000-0000-0000-0000-000000000000', true);

    IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email)
       OR EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email) = v_email) THEN
        INSERT INTO admin_account_out
        VALUES (v_email, NULL, 'dilewati: email sudah terdaftar (lihat bagian MENJADIKAN AKUN LAMA ADMIN di bawah)');
        RETURN;
    END IF;

    -- Sandi acak (CSPRNG): 1 huruf kecil, 1 besar, 1 angka, 1 simbol, 8 bebas, diacak.
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
            'role', 'admin',
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

    -- 3. Profil aplikasi (cognito_sub = id pengguna Supabase; admin tanpa sekolah).
    INSERT INTO public.profiles
        (cognito_sub, email, full_name, role, school_id, activation_status)
    VALUES
        (v_uid::text, v_email, v_name, 'admin', NULL, 'active');

    INSERT INTO admin_account_out VALUES (v_email, v_pw, 'dibuat (admin, aktif)');
END
$$;

SELECT email, temporary_password, note FROM admin_account_out;

-- =============================================================================
-- MENJADIKAN AKUN LAMA ADMIN (bila email sudah terdaftar, mis. akun guru):
--
--   BEGIN;
--   SELECT set_config('app.current_user_role', 'admin', true);
--   UPDATE auth.users
--      SET raw_app_meta_data = (raw_app_meta_data - 'school_id') || '{"role":"admin"}'::jsonb,
--          updated_at = now()
--    WHERE lower(email) = 'email.lama@contoh.org';
--   UPDATE public.profiles
--      SET role = 'admin', school_id = NULL, activation_status = 'active', updated_at = now()
--    WHERE lower(email) = 'email.lama@contoh.org';
--   COMMIT;
--   (Pengguna harus logout lalu login lagi agar perannya berubah.)
--
-- MEMBATALKAN (hapus akun admin yang dibuat script ini):
--
--   BEGIN;
--   SELECT set_config('app.current_user_role', 'admin', true);
--   ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;
--   DELETE FROM public.profiles WHERE lower(email) = 'admin.baru@prestasijunior.org';
--   ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
--   DELETE FROM auth.users      WHERE lower(email) = 'admin.baru@prestasijunior.org';
--   COMMIT;
-- =============================================================================
