# Deploy: Vercel + Supabase

Kode sudah dimigrasi dari AWS (RDS, Cognito, S3, ECS) ke Supabase (Postgres, Auth, Storage) dan Vercel.
Dokumen ini adalah urutan kerja untuk menyalakannya. Rencana awal ada di `SUPABASE_VERCEL_MIGRATION.md`.

## 1. Buat project Supabase

1. Buat project (region terdekat, mis. Singapore). Catat **Project Ref** dan password database.
2. Dashboard > Project Settings > API Keys: catat `SUPABASE_URL`, kunci publishable/anon (`SUPABASE_ANON_KEY`), dan kunci secret/service_role (`SUPABASE_SERVICE_ROLE_KEY`).
3. Dashboard > Integrations > Data API: **nonaktifkan Data API** bila tersedia. Aplikasi hanya memakai koneksi `pg`; migrasi 0021 juga mencabut grant `anon`/`authenticated` sebagai lapis kedua.

## 2. Siapkan database

**Cara termudah:** buka Dashboard > SQL Editor, paste seluruh isi `db/supabase_setup.sql`, ganti `GANTI_PASSWORD_INI` dengan password kuat untuk `app_runtime`, lalu Run. Skrip ini membuat semua tabel, RLS, role, grant, dan 51 sekolah dalam satu transaksi, dan aman dijalankan ulang. Lewati sisa langkah 2 bila memakai cara ini.

**Alternatif (psql, per migrasi):** gunakan string "Direct connection" (atau Session pooler bila jaringan Anda hanya IPv4) sebagai owner `postgres`.

```powershell
$env:DIRECT_URL = "postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"
Get-ChildItem db\migrations\0*.sql | Sort-Object Name | ForEach-Object {
  psql $env:DIRECT_URL -v ON_ERROR_STOP=1 -f $_.FullName
}
```

Lalu setel password role runtime:

```sql
ALTER ROLE app_runtime WITH PASSWORD '<PASSWORD_RUNTIME_KUAT>';
```

`DATABASE_URL` untuk aplikasi memakai pooler mode transaksi, username `app_runtime.<PROJECT_REF>`:

```
postgresql://app_runtime.<PROJECT_REF>:<PASSWORD_RUNTIME>@aws-0-<REGION>.pooler.supabase.com:6543/postgres
```

Catatan: migrasi `0004_seed_schools.sql` mengisi data sekolah. Periksa isinya sebelum dijalankan di produksi.

## 3. Storage

1. Dashboard > Storage: buat bucket `private-assets` (**Private**) dan `public-showcase` (**Public**). Nama dapat diubah lewat `S3_PRIVATE_BUCKET` / `S3_PUBLIC_BUCKET`.
2. Dashboard > Storage > S3 Configuration: buat **access key**, catat Access Key ID, Secret, dan Region.
3. Batasi ukuran file dan MIME type per bucket sesuai kebutuhan (PDF/PPTX di privat; JPEG/PNG/WebP di publik).

## 4. Auth

Dashboard > Authentication:

- Sign In / Providers > Email: aktif. Matikan **Allow new users to sign up** (hanya Admin yang membuat akun).
- Sessions: atur **JWT expiry**. Aplikasi menyimpan access token di cookie httpOnly dan tidak me-refresh, jadi sesi berakhir saat token kedaluwarsa. Default 3600 detik; naikkan (mis. 28800 = 8 jam) bila Guru mengeluh sering keluar.
- Password: setel panjang minimum dan syarat karakter. Aplikasi menolak sandi 8 sampai 128 karakter dan menampilkan pesan bila kebijakan project menolaknya.

### Membuat Admin pertama

Peran disimpan di `app_metadata` (hanya bisa diubah server/owner). Buat user lewat Dashboard > Authentication > Users > Add user (centang Auto Confirm), lalu jalankan di SQL Editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                        || '{"role":"admin"}'::jsonb
where email = 'admin@contoh.id';
```

Admin tidak memerlukan baris `profiles`. Guru dibuat dari layar admin **Kelola Guru**.

## 5. Vercel

1. Import repo ke Vercel. Framework: Next.js (otomatis). Region fungsi: pilih yang dekat Supabase (Singapore `sin1`) di Project Settings > Functions.
2. Isi Environment Variables (Production dan Preview) sesuai `.env.example`:

| Variabel | Isi |
|---|---|
| `DATABASE_URL` | Pooler 6543, user `app_runtime.<ref>` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | kunci publishable/anon |
| `SUPABASE_SERVICE_ROLE_KEY` | kunci secret/service_role |
| `SUPABASE_S3_ACCESS_KEY_ID` / `SUPABASE_S3_SECRET_ACCESS_KEY` | access key S3 |
| `SUPABASE_S3_REGION` | region project |
| `S3_PRIVATE_BUCKET` / `S3_PUBLIC_BUCKET` | nama bucket |
| `DATABASE_CA_CERT` | (opsional) PEM Supabase Root 2021 CA |

3. Domain: tambahkan `awsinstem.id` dan `lms.awsinstem.id`. `src/middleware.ts` tetap mengarahkan `lms.` ke `/login`.
4. File AWS lama (`Dockerfile`, `.dockerignore`, `buildspec.yml`, `amplify.yml`, folder `certs/`) tidak dipakai Vercel. Aman dihapus setelah cutover.

## 6. Perubahan perilaku dibanding AWS

- **Undangan email dihapus.** Supabase tidak mengirim sandi sementara lewat email. "Buat Akun Guru" membuat akun dengan sandi sementara acak yang ditampilkan sekali ke Admin. Impor CSV menampilkan daftar `email,sandi`. Guru wajib mengganti sandi saat login pertama. Bila ingin undangan email, perlu SMTP kustom dan halaman set-password (belum dibuat).
- **Ganti sandi wajib** memakai flag `app_metadata.must_change_password`. Token dengan flag aktif ditolak sebagai sesi.
- **Lockout login** (5 gagal = 15 menit) disimpan di tabel `auth_login_failures`, berlaku lintas instance.
- **`profiles.cognito_sub`** kini berisi UUID `auth.users.id`. Nama kolom dan field `SessionClaims.cognitoSub` sengaja tidak diganti.
- Akun yang dihapus atau diubah perannya tetap valid sampai access token-nya kedaluwarsa.

## 7. Uji setelah deploy (preview URL)

1. Landing publik dan galeri tampil, gambar publik termuat.
2. Login Admin, buka Kelola Guru, buat Guru, salin sandi sementara.
3. Login Guru dengan sandi sementara: diminta sandi baru, lalu masuk `/teacher` setelah Admin mengaktifkan akun.
4. Unggah materi (PDF/PPTX) dan foto presensi. **Uji unggah langsung dari browser ke endpoint S3 Supabase**; bila gagal karena CORS, itu hal pertama yang diperiksa.
5. Guru hanya melihat data sekolahnya. Ekspor Excel Admin berjalan.
6. Lima kali salah sandi menghasilkan pesan terkunci.
