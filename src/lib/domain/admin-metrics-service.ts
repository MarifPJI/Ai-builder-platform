/**
 * `adminMetricsService` — agregasi read-only lintas-sekolah untuk Dashboard
 * Admin (`A01`). Menyajikan data NYATA aktivitas Guru tanpa menyentuh service
 * domain lain (setiap fungsi di sini berdiri sendiri).
 *
 * Model tenancy:
 *   Seluruh fungsi MENERIMA `claims` terverifikasi dan dijalankan melalui
 *   `withTenantTransaction(claims, ...)`. Untuk peran `admin`, kebijakan RLS
 *   admin SELECT (`schools_admin_read`, `profiles_admin_read`,
 *   `classes_admin_read`, `class_students_admin_read`, `class_sessions_admin_read`)
 *   mengizinkan baca lintas semua sekolah — SELURUH sekolah ikut terhitung,
 *   termasuk sekolah test (tidak ada filter sekolah). Tidak diperlukan
 *   migrasi/policy/grant baru (admin RLS SELECT sudah lengkap — diverifikasi di
 *   0002 & 0008).
 *
 * Keamanan:
 *   Query hanya memakai literal konstan (tanpa input pengguna), sehingga tidak
 *   ada interpolasi string maupun parameter dinamis. Semua COUNT dikembalikan
 *   sebagai `number` (cast `::int` di SQL + `?? 0` di TypeScript).
 */

import 'server-only';

import type { PoolClient } from 'pg';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';

/**
 * Agregat GLOBAL lintas semua sekolah untuk kartu ringkasan aktivitas Guru.
 * Seluruh nilai berupa `number`.
 */
export interface AdminActivitySummary {
  /** COUNT profiles WHERE role='teacher'. */
  totalGuru: number;
  /** COUNT profiles WHERE role='teacher' AND activation_status='active'. */
  guruAktif: number;
  /** COUNT profiles WHERE role='teacher' AND activation_status='pending'. */
  guruPending: number;
  /** COUNT(*) FROM classes. */
  totalKelas: number;
  /** COUNT(*) FROM class_students. */
  totalSiswa: number;
  /** COUNT(*) FROM class_sessions. */
  totalSesi: number;
}

/**
 * Satu baris ringkasan aktivitas per SEKOLAH (tabel "Ringkasan per Sekolah").
 * Sekolah tanpa aktivitas tetap muncul dengan nilai `0`.
 */
export interface SchoolActivityRow {
  schoolId: string;
  schoolName: string;
  jumlahGuru: number;
  jumlahKelas: number;
  jumlahSiswa: number;
}

/** Bentuk baris mentah hasil agregat global (snake_case dari SQL). */
interface SummaryRow {
  total_guru: number;
  guru_aktif: number;
  guru_pending: number;
  total_kelas: number;
  total_siswa: number;
  total_sesi: number;
}

/** Bentuk baris mentah ringkasan per sekolah (snake_case dari SQL). */
interface SchoolActivityDbRow {
  school_id: string;
  school_name: string;
  jumlah_guru: number;
  jumlah_kelas: number;
  jumlah_siswa: number;
}

/**
 * Agregat GLOBAL lintas semua sekolah (termasuk sekolah test — tanpa filter).
 *
 * Memakai SATU query dengan subquery skalar per metrik agar tidak ada join yang
 * menginflasi hitungan. Semua COUNT di-cast `::int` di SQL dan di-fallback `?? 0`
 * di TypeScript sehingga selalu berupa `number`.
 *
 * @param claims Klaim sesi admin terverifikasi (dari `requireSession`).
 */
export async function getTeacherActivitySummary(
  claims: SessionClaims,
): Promise<AdminActivitySummary> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SummaryRow>(
      `SELECT
         (SELECT count(*) FROM profiles WHERE role = 'teacher')::int AS total_guru,
         (SELECT count(*) FROM profiles WHERE role = 'teacher' AND activation_status = 'active')::int  AS guru_aktif,
         (SELECT count(*) FROM profiles WHERE role = 'teacher' AND activation_status = 'pending')::int AS guru_pending,
         (SELECT count(*) FROM classes)::int        AS total_kelas,
         (SELECT count(*) FROM class_students)::int AS total_siswa,
         (SELECT count(*) FROM class_sessions)::int AS total_sesi`,
    );
    const row = result.rows[0];
    return {
      totalGuru: Number(row?.total_guru ?? 0),
      guruAktif: Number(row?.guru_aktif ?? 0),
      guruPending: Number(row?.guru_pending ?? 0),
      totalKelas: Number(row?.total_kelas ?? 0),
      totalSiswa: Number(row?.total_siswa ?? 0),
      totalSesi: Number(row?.total_sesi ?? 0),
    };
  });
}

/** Jumlah konten untuk kartu statistik atas Dashboard Admin. */
export interface AdminContentCounts {
  schools: number;
  karya: number;
  galeri: number;
  submissions: number;
  pendingSubmissions: number;
}

/**
 * Semua hitungan kartu atas Dashboard Admin dalam SATU query/transaksi.
 * Sebelumnya dashboard memanggil 5 fungsi list (5 transaksi) hanya untuk
 * menghitung panjang array. Hasilnya identik di bawah RLS admin.
 */
export async function getContentCounts(
  claims: SessionClaims,
): Promise<AdminContentCounts> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<{
      schools: number;
      karya: number;
      galeri: number;
      submissions: number;
      pending_submissions: number;
    }>(
      `SELECT
         (SELECT count(*) FROM schools)::int            AS schools,
         (SELECT count(*) FROM showcase_karya)::int     AS karya,
         (SELECT count(*) FROM stem_gallery_items)::int AS galeri,
         (SELECT count(*) FROM showcase_projects)::int  AS submissions,
         (SELECT count(*) FROM showcase_projects WHERE status = 'pending')::int AS pending_submissions`,
    );
    const row = result.rows[0];
    return {
      schools: Number(row?.schools ?? 0),
      karya: Number(row?.karya ?? 0),
      galeri: Number(row?.galeri ?? 0),
      submissions: Number(row?.submissions ?? 0),
      pendingSubmissions: Number(row?.pending_submissions ?? 0),
    };
  });
}

/**
 * Satu baris per SEKOLAH, diurutkan berdasarkan nama. Memakai subquery skalar
 * berkorelasi per metrik (anti-inflasi join ganda) sehingga setiap hitungan
 * independen dan akurat. Baris `schools` selalu muncul meski semua subquery
 * bernilai `0` → sekolah tanpa aktivitas tetap tampil dengan 0.
 *
 * SELURUH sekolah ikut (termasuk sekolah test — tidak difilter).
 *
 * @param claims Klaim sesi admin terverifikasi (dari `requireSession`).
 */
export async function listSchoolActivity(
  claims: SessionClaims,
): Promise<SchoolActivityRow[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SchoolActivityDbRow>(
      `SELECT
         s.school_id AS school_id,
         s.name      AS school_name,
         (SELECT count(*) FROM profiles p
            WHERE p.school_id = s.school_id AND p.role = 'teacher')::int AS jumlah_guru,
         (SELECT count(*) FROM classes c
            WHERE c.school_id = s.school_id)::int AS jumlah_kelas,
         (SELECT count(*) FROM class_students cs
            WHERE cs.school_id = s.school_id)::int AS jumlah_siswa
       FROM schools s
       ORDER BY s.name ASC`,
    );
    return result.rows.map((row) => ({
      schoolId: row.school_id,
      schoolName: row.school_name,
      jumlahGuru: Number(row.jumlah_guru ?? 0),
      jumlahKelas: Number(row.jumlah_kelas ?? 0),
      jumlahSiswa: Number(row.jumlah_siswa ?? 0),
    }));
  });
}
