-- =============================================================================
-- Ganti email akun Guru menjadi pendek: <singkatan sekolah>@awsinstem.id
-- =============================================================================
-- Contoh: guru.sman4depok@guru.aibuilder.test  ->  sman4depok@awsinstem.id
--
-- Cara pakai (Supabase Dashboard > SQL Editor > New query > paste semua):
--   1. Jalankan apa adanya (v_apply := false) = PRATINJAU. Tidak ada yang diubah.
--      Periksa kolom new_email dan note di hasil. Ubah singkatan di daftar
--      PEMETAAN di bawah bila perlu, lalu jalankan pratinjau lagi.
--   2. Bila sudah benar, ubah v_apply := true lalu Run sekali lagi.
--      Hasilnya: daftar sekolah + email baru. SALIN/EXPORT untuk dibagikan ke guru.
--
-- Perilaku:
--   * Hanya akun Guru yang emailnya masih format lama
--     (guru.<nama sekolah>@guru.aibuilder.test, dari create_teacher_accounts.sql).
--     Akun guru lain (email asli, akun uji coba) tidak disentuh.
--   * Diubah di 3 tempat: auth.users (login), auth.identities (identitas email),
--     public.profiles (data aplikasi). Sandi, ID akun, kelas, presensi & jurnal
--     TIDAK berubah.
--   * Bila satu saja email baru sudah dipakai akun lain, TIDAK ADA yang diubah.
--   * Aman dijalankan ulang: akun yang sudah diganti tidak cocok format lama.
--   * Setelah diganti, email lama tidak bisa dipakai login. Guru yang sedang
--     login perlu Keluar lalu Masuk lagi dengan email baru.
-- =============================================================================

CREATE TEMP TABLE IF NOT EXISTS teacher_email_out (
    school_name  text,
    old_email    text,
    new_email    text,
    status       text,   -- ready | skip | conflict | done
    note         text,
    profile_id   uuid,
    auth_user_id text
);
TRUNCATE teacher_email_out;

DO $$
DECLARE
    -- ===================== PENGATURAN =====================
    v_apply      boolean := false;            -- false = pratinjau, true = terapkan
    v_domain     text    := 'awsinstem.id';   -- domain email baru
    v_old_domain text    := 'guru.aibuilder.test';
    -- ======================================================
    r          record;
    v_new      text;
    v_problems integer;
BEGIN
    -- Konteks admin agar RLS (FORCE) mengizinkan baca schools & ubah profiles.
    PERFORM set_config('app.current_user_role', 'admin', true);
    PERFORM set_config('app.current_school_id', '00000000-0000-0000-0000-000000000000', true);

    FOR r IN
        WITH map (school_name, local_part) AS (
            VALUES
            -- ======================= PEMETAAN =======================
            -- (nama sekolah persis seperti di tabel schools, singkatan email)
            ('SMA DARUL FALAH CIHAMPELAS',         'smadarulfalah'),
            ('SMKN 2 PEKALONGAN',                  'smkn2pekalongan'),
            ('SMK NEGERI 1 KARAWANG',              'smkn1karawang'),
            ('SMAN 1 TASIKMALAYA',                 'sman1tasikmalaya'),
            ('SMAN 4 DEPOK',                       'sman4depok'),
            ('SMK PERGURUAN CIKINI KIIC KARAWANG', 'smkcikini'),
            ('SMAN 29 BANDUNG',                    'sman29bandung'),
            ('SMAN 17 GARUT',                      'sman17garut'),
            ('SMAN 2 CIBARUSAH',                   'sman2cibarusah'),
            ('SMKN 17 JAKARTA',                    'smkn17jakarta'),
            ('SMAN 1 KANDANGHAUR INDRAMAYU',       'sman1kandanghaur'),
            ('SMKN 1 KAWALI',                      'smkn1kawali'),
            ('SMAN 2 KLARI',                       'sman2klari'),
            ('SMAN 1 NAGREG',                      'sman1nagreg'),
            ('SMAN 2 KARAWANG',                    'sman2karawang'),
            ('SMAN 1 BATUJAJAR',                   'sman1batujajar'),
            ('SMKN 1 NARINGGUL',                   'smkn1naringgul'),
            ('SMAN 1 KARAWANG',                    'sman1karawang'),
            ('SMAN 1 SLEMAN',                      'sman1sleman'),
            ('SMKN 4 BANDUNG',                     'smkn4bandung'),
            ('SMAN 1 BOJONGMANGU',                 'sman1bojongmangu'),
            ('SMAN 2 CIBINONG',                    'sman2cibinong'),
            ('SMAN 1 TELUKJAMBE',                  'sman1telukjambe'),
            ('SMAN 1 SEWON',                       'sman1sewon'),
            ('SMKN 10 SURABAYA',                   'smkn10surabaya'),
            ('SMAN 1 KADIPATEN',                   'sman1kadipaten'),
            ('SMKN 1 CIREBON',                     'smkn1cirebon'),
            ('SMAN 2 CIANJUR',                     'sman2cianjur'),
            ('SMKN 15 JAKARTA',                    'smkn15jakarta'),
            ('SMAN 1 CILILIN',                     'sman1cililin'),
            ('SMAN 21 GARUT',                      'sman21garut'),
            ('SMKN 2 KOTA BEKASI',                 'smkn2bekasi'),
            ('SMAN 1 TANGERANG',                   'sman1tangerang'),
            ('SMKN 1 KOTA SERANG',                 'smkn1serang'),
            ('SMAN 1 SUMBER',                      'sman1sumber'),
            ('SMAN 1 CIKIDANG',                    'sman1cikidang'),
            ('SMAN 1 WANAYASA',                    'sman1wanayasa'),
            ('SMAN 1 SEMARANG',                    'sman1semarang'),
            ('SMAN 1 CIPEUNDEUY KBB',              'sman1cipeundeuy'),
            ('SMKN 1 KOTA SUKABUMI',               'smkn1sukabumi'),
            ('SMAN 2 BEKASI',                      'sman2bekasi'),
            ('SMAN 1 CIKARANG',                    'sman1cikarang'),
            ('SMAN 4 KARAWANG',                    'sman4karawang'),
            ('SMKN 1 CIMAHI',                      'smkn1cimahi'),
            ('SMKN 4 GARUT',                       'smkn4garut'),
            ('SMKN 3 BUDURAN',                     'smkn3buduran'),
            ('SMKN 11 BANDUNG',                    'smkn11bandung'),
            ('SMAN 2 CIKARANG SELATAN',            'sman2cikarangsel'),
            ('SMKN 1 GEBANG',                      'smkn1gebang'),
            ('SMKN 3 BOGOR',                       'smkn3bogor')
            -- Sekolah uji coba "SMAN 10 Samarinda" sengaja tidak dipetakan.
            -- ========================================================
        )
        SELECT p.id          AS profile_id,
               p.cognito_sub AS auth_user_id,
               p.email       AS old_email,
               s.name        AS school_name,
               m.local_part
          FROM public.profiles p
          JOIN public.schools  s ON s.school_id = p.school_id
          LEFT JOIN map m ON upper(trim(m.school_name)) = upper(trim(s.name))
         WHERE p.role = 'teacher'
           AND lower(p.email) = 'guru.'
               || lower(regexp_replace(s.name, '[^A-Za-z0-9]+', '', 'g'))
               || '@' || v_old_domain
         ORDER BY s.name
    LOOP
        IF r.local_part IS NULL THEN
            INSERT INTO teacher_email_out
            VALUES (r.school_name, r.old_email, NULL, 'skip',
                    'dilewati: belum ada singkatan di PEMETAAN', r.profile_id, r.auth_user_id);
            CONTINUE;
        END IF;

        v_new := lower(r.local_part) || '@' || v_domain;

        IF v_new !~ '^[a-z0-9][a-z0-9._-]*@[a-z0-9.-]+\.[a-z]{2,}$' THEN
            INSERT INTO teacher_email_out
            VALUES (r.school_name, r.old_email, v_new, 'conflict',
                    'MASALAH: format email tidak valid', r.profile_id, r.auth_user_id);
        ELSIF EXISTS (SELECT 1 FROM auth.users u
                       WHERE lower(u.email) = v_new AND u.id::text <> r.auth_user_id)
           OR EXISTS (SELECT 1 FROM public.profiles p
                       WHERE lower(p.email) = v_new AND p.id <> r.profile_id) THEN
            INSERT INTO teacher_email_out
            VALUES (r.school_name, r.old_email, v_new, 'conflict',
                    'MASALAH: email baru sudah dipakai akun lain', r.profile_id, r.auth_user_id);
        ELSE
            INSERT INTO teacher_email_out
            VALUES (r.school_name, r.old_email, v_new, 'ready',
                    'siap diubah (pratinjau, belum diubah)', r.profile_id, r.auth_user_id);
        END IF;
    END LOOP;

    -- Dua sekolah tidak boleh mendapat email baru yang sama.
    UPDATE teacher_email_out o
       SET status = 'conflict', note = 'MASALAH: singkatan dipakai lebih dari satu sekolah'
     WHERE o.new_email IN (
           SELECT new_email FROM teacher_email_out
            WHERE new_email IS NOT NULL
            GROUP BY new_email HAVING count(*) > 1);

    IF NOT v_apply THEN
        RETURN;
    END IF;

    SELECT count(*) INTO v_problems FROM teacher_email_out WHERE status = 'conflict';
    IF v_problems > 0 THEN
        RAISE EXCEPTION 'Dibatalkan: % email bermasalah. Jalankan pratinjau (v_apply := false) untuk melihat detailnya.', v_problems;
    END IF;

    -- 1. Email login Supabase Auth.
    UPDATE auth.users u
       SET email = o.new_email, updated_at = now()
      FROM teacher_email_out o
     WHERE o.status = 'ready' AND u.id::text = o.auth_user_id;

    -- 2. Identitas provider email (dipakai login email/sandi).
    UPDATE auth.identities i
       SET identity_data = i.identity_data || jsonb_build_object('email', o.new_email),
           updated_at = now()
      FROM teacher_email_out o
     WHERE o.status = 'ready' AND i.user_id::text = o.auth_user_id AND i.provider = 'email';

    -- 3. Profil aplikasi.
    UPDATE public.profiles p
       SET email = o.new_email, updated_at = now()
      FROM teacher_email_out o
     WHERE o.status = 'ready' AND p.id = o.profile_id;

    -- 4. Bersihkan penghitung gagal-login milik email lama.
    DELETE FROM public.auth_login_failures f
     USING teacher_email_out o
     WHERE o.status = 'ready' AND f.email = lower(o.old_email);

    UPDATE teacher_email_out SET status = 'done', note = 'diubah' WHERE status = 'ready';
END
$$;

SELECT school_name, old_email, new_email, note
  FROM teacher_email_out
 ORDER BY (status = 'conflict') DESC, school_name;
