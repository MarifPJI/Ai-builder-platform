-- Migration: 0004_seed_schools
-- Feature: identity-tenancy
-- Target: Amazon RDS for PostgreSQL (region ap-southeast-1)
--
-- Skrip seed data sekolah mitra program STEM Capacity Building 2026
-- (Prestasi Junior Indonesia x AWS) untuk menopang tenancy (R5.1).
-- Berisi 50 sekolah mitra ASLI + 1 sekolah test (SMAN 10 Samarinda) = 51 baris.
--
-- Kolom tabel `schools` (lihat 0001_init_schema.sql — JANGAN diubah):
--   school_id     uuid PRIMARY KEY DEFAULT gen_random_uuid()
--   name          text NOT NULL
--   iana_timezone text NOT NULL CHECK IN ('Asia/Jakarta','Asia/Makassar','Asia/Jayapura')
--   created_at    timestamptz NOT NULL DEFAULT now()  -- UTC
--
-- Pemetaan zona waktu Indonesia -> IANA (R5.1):
--   WIB  (Waktu Indonesia Barat)  -> Asia/Jakarta
--        Sumatra, Jawa, Kalimantan Barat & Tengah
--   WITA (Waktu Indonesia Tengah) -> Asia/Makassar
--        Bali, NTB, NTT, Kalimantan Selatan/Timur/Utara, Sulawesi
--   WIT  (Waktu Indonesia Timur)  -> Asia/Jayapura
--        Maluku, Maluku Utara, Papua
--
-- Idempotensi:
--   * Tabel `schools` TIDAK memiliki UNIQUE constraint pada `name` (lihat 0001),
--     sehingga INSERT ... ON CONFLICT tidak dapat dipakai tanpa mengubah 0001.
--     Agar skrip ini aman dijalankan ulang (re-run), setiap baris diseed via
--     INSERT ... SELECT ... WHERE NOT EXISTS (pencocokan pada `name`).
--     Menjalankan ulang skrip tidak akan menghasilkan duplikat.
--   * `school_id` sengaja tidak ditetapkan eksplisit agar memakai
--     gen_random_uuid() dari skema (R6.3).
--
-- Penegakan jumlah maksimum sekolah dilakukan di layer aplikasi/seed (R5.1);
-- berkas ini menyediakan 50 sekolah mitra ASLI + 1 sekolah test.

BEGIN;

-- Seed sekolah mitra program STEM Capacity Building 2026 (data ASLI).
-- 50 sekolah mitra + 1 sekolah test (SMAN 10 Samarinda) = 51 baris.
-- Setiap baris hanya disisipkan bila `name` belum ada (idempoten / aman
-- dijalankan ulang). Seluruh sekolah berada di WIB -> Asia/Jakarta.
--
-- Catatan: SMAN 10 Samarinda dipertahankan sebagai SEKOLAH TEST (dipakai akun
-- guru uji coba `guru1`); boleh difilter/ditandai di lapisan aplikasi bila
-- tidak ingin tampil di daftar produksi.
INSERT INTO schools (name, iana_timezone)
SELECT seed.name, seed.iana_timezone
FROM (
    VALUES
        -- ---------------------------------------------------------------------
        -- 50 sekolah mitra ASLI (WIB -> Asia/Jakarta)
        -- ---------------------------------------------------------------------
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

        -- ---------------------------------------------------------------------
        -- Sekolah TEST (akun guru uji coba) — WIB -> Asia/Jakarta
        -- ---------------------------------------------------------------------
        ('SMAN 10 Samarinda',                   'Asia/Jakarta')
) AS seed (name, iana_timezone)
WHERE NOT EXISTS (
    SELECT 1 FROM schools s WHERE s.name = seed.name
);

COMMIT;
