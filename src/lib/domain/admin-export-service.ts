/**
 * `admin-export-service` — agregasi READ-ONLY khusus EKSPOR Excel untuk Admin.
 *
 * Dua fitur ekspor:
 *   1. GLOBAL (lintas seluruh sekolah): ringkasan per sekolah + rekap sesi &
 *      presensi nasional.
 *   2. SINGLE-SCHOOL (satu sekolah): header + daftar kelas + roster siswa +
 *      presensi per sesi.
 *
 * KONTRAK SESI: setiap fungsi MENERIMA `claims` terverifikasi dan menjalankan
 * query di dalam `withTenantTransaction(claims, ...)`. Untuk peran `admin`,
 * kebijakan RLS admin SELECT mengizinkan baca lintas sekolah — query global
 * TANPA filter sekolah; query single-school menambahkan `WHERE ... = $1`.
 *
 * Seluruh query terparameterisasi (`$1`) untuk query single-school. Semua COUNT
 * di-cast `::int` di SQL + `?? 0` di TypeScript. Menghindari N+1 — setiap fungsi
 * memakai SATU query dengan subquery/join.
 *
 * Mengikuti gaya persis admin-metrics-service.ts / admin-school-detail-service.ts.
 */

import 'server-only';

import type { PoolClient } from 'pg';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import type { AttendanceStatus } from '@/lib/validation/attendance';

/* ──────────────────────────────────────────────────────────────────────────
 * GLOBAL (Feature 1)
 * ────────────────────────────────────────────────────────────────────────── */

/** Satu baris ringkasan per sekolah untuk sheet "Ringkasan Sekolah". */
export interface GlobalSchoolSummaryRow {
  schoolId: string;
  name: string;
  jumlahGuru: number;
  jumlahKelas: number;
  jumlahSiswa: number;
  totalSesiPresensi: number;
}

/** Satu baris rekap sesi & presensi nasional (lintas sekolah). */
export interface NationalSessionRow {
  schoolName: string;
  /** Nama guru pengampu (`created_by`); `null` bila tidak ada. */
  teacherName: string | null;
  className: string;
  sessionName: string;
  scheduledAt: Date;
  totalHadir: number;
  totalSiswa: number;
}

/** Baris mentah ringkasan sekolah global (snake_case dari SQL). */
interface GlobalSchoolSummaryDbRow {
  school_id: string;
  name: string;
  jumlah_guru: number;
  jumlah_kelas: number;
  jumlah_siswa: number;
  total_sesi_presensi: number;
}

/** Baris mentah rekap sesi nasional (snake_case dari SQL). */
interface NationalSessionDbRow {
  school_name: string;
  teacher_name: string | null;
  class_name: string;
  session_name: string;
  scheduled_at: Date;
  total_hadir: number;
  total_siswa: number;
}

/**
 * Ringkasan GLOBAL per sekolah (SATU query, tanpa filter sekolah).
 * Memakai subquery skalar berkorelasi per metrik (anti-inflasi join).
 * Sekolah tanpa aktivitas tetap muncul dengan nilai `0`.
 *
 * `total_sesi_presensi` = jumlah class_sessions milik sekolah tsb yang MEMILIKI
 * setidaknya satu baris session_attendance (EXISTS).
 */
export async function getGlobalSchoolSummary(
  claims: SessionClaims,
): Promise<GlobalSchoolSummaryRow[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<GlobalSchoolSummaryDbRow>(
      `SELECT
         s.school_id AS school_id,
         s.name      AS name,
         (SELECT count(*) FROM profiles p
            WHERE p.school_id = s.school_id AND p.role = 'teacher')::int AS jumlah_guru,
         (SELECT count(*) FROM classes c
            WHERE c.school_id = s.school_id)::int AS jumlah_kelas,
         (SELECT count(*) FROM class_students cs
            WHERE cs.school_id = s.school_id)::int AS jumlah_siswa,
         (SELECT count(*) FROM class_sessions se
            WHERE se.school_id = s.school_id
              AND EXISTS(SELECT 1 FROM session_attendance a WHERE a.session_id = se.id))::int
            AS total_sesi_presensi
       FROM schools s
       ORDER BY s.name ASC`,
    );
    return result.rows.map((row) => ({
      schoolId: row.school_id,
      name: row.name,
      jumlahGuru: Number(row.jumlah_guru ?? 0),
      jumlahKelas: Number(row.jumlah_kelas ?? 0),
      jumlahSiswa: Number(row.jumlah_siswa ?? 0),
      totalSesiPresensi: Number(row.total_sesi_presensi ?? 0),
    }));
  });
}

/**
 * Rekap sesi & presensi NASIONAL (lintas sekolah, tanpa filter). Hanya sesi yang
 * `scheduled_at <= now()` (sesi aktif/selesai — "sesi presensi" yang relevan).
 * SATU query dengan join + subquery skalar (anti N+1).
 *
 * Kolom: nama sekolah, nama guru (null → biarkan null, UI → '-'), nama kelas,
 * nama sesi, scheduled_at, total_hadir, total_siswa.
 */
export async function listNationalSessions(
  claims: SessionClaims,
): Promise<NationalSessionRow[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<NationalSessionDbRow>(
      `SELECT
         sc.name AS school_name,
         p.full_name AS teacher_name,
         c.name  AS class_name,
         se.name AS session_name,
         se.scheduled_at AS scheduled_at,
         (SELECT count(*) FROM session_attendance a
            WHERE a.session_id = se.id AND a.status = 'hadir')::int AS total_hadir,
         (SELECT count(*) FROM class_students cs
            WHERE cs.class_id = se.class_id)::int AS total_siswa
       FROM class_sessions se
       JOIN classes c ON c.id = se.class_id
       JOIN schools sc ON sc.school_id = se.school_id
       LEFT JOIN profiles p ON p.id = c.created_by
      WHERE se.scheduled_at <= now()
      ORDER BY sc.name ASC, se.scheduled_at ASC`,
    );
    return result.rows.map((row) => ({
      schoolName: row.school_name,
      teacherName: row.teacher_name,
      className: row.class_name,
      sessionName: row.session_name,
      scheduledAt: row.scheduled_at,
      totalHadir: Number(row.total_hadir ?? 0),
      totalSiswa: Number(row.total_siswa ?? 0),
    }));
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * SINGLE-SCHOOL (Feature 2)
 * ────────────────────────────────────────────────────────────────────────── */

/** Header ekspor satu sekolah (metadata + total agregat). */
export interface SchoolExportHeader {
  schoolId: string;
  name: string;
  ianaTimezone: string;
  totalGuru: number;
  totalKelas: number;
  totalSiswa: number;
}

/** Satu baris kelas untuk ekspor sekolah. */
export interface SchoolClassExportRow {
  id: string;
  name: string;
  gradeLevel: string | null;
  /** Nama guru pengampu (`created_by`); `null` bila tidak ada. */
  teacherName: string | null;
  jumlahSiswa: number;
}

/** Satu baris roster siswa untuk ekspor sekolah. */
export interface SchoolRosterExportRow {
  className: string;
  nis: string;
  fullName: string;
}

/** Satu baris presensi (sesi × siswa) untuk ekspor sekolah. */
export interface SchoolAttendanceExportRow {
  sessionName: string;
  className: string;
  scheduledAt: Date;
  /** Status sesi terderivasi: 'Terjadwal' | 'Aktif' | 'Selesai'. */
  sessionState: 'Terjadwal' | 'Aktif' | 'Selesai';
  nis: string;
  fullName: string;
  /** Status kehadiran; `null` bila belum ditandai (tidak ada baris). */
  status: AttendanceStatus | null;
  /** Waktu presensi (session_attendance.created_at); `null` bila belum. */
  attendanceAt: Date | null;
}

/** Baris mentah header sekolah (snake_case dari SQL). */
interface SchoolExportHeaderDbRow {
  name: string;
  iana_timezone: string;
  total_guru: number;
  total_kelas: number;
  total_siswa: number;
}

/** Baris mentah kelas ekspor (snake_case dari SQL). */
interface SchoolClassExportDbRow {
  id: string;
  name: string;
  grade_level: string | null;
  teacher_name: string | null;
  jumlah_siswa: number;
}

/** Baris mentah roster ekspor (snake_case dari SQL). */
interface SchoolRosterExportDbRow {
  class_name: string;
  nis: string;
  full_name: string;
}

/** Baris mentah presensi ekspor (snake_case dari SQL). */
interface SchoolAttendanceExportDbRow {
  session_name: string;
  class_name: string;
  scheduled_at: Date;
  session_state: 'Terjadwal' | 'Aktif' | 'Selesai';
  nis: string;
  full_name: string;
  status: AttendanceStatus | null;
  attendance_at: Date | null;
}

/**
 * Header ekspor satu sekolah: nama, timezone, total guru/kelas/siswa.
 * SATU query dengan subquery skalar per metrik. `null` bila sekolah tak ada.
 */
export async function getSchoolExportHeader(
  claims: SessionClaims,
  schoolId: string,
): Promise<SchoolExportHeader | null> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SchoolExportHeaderDbRow>(
      `SELECT
         s.name,
         s.iana_timezone,
         (SELECT count(*) FROM profiles p
            WHERE p.school_id = s.school_id AND p.role = 'teacher')::int AS total_guru,
         (SELECT count(*) FROM classes c
            WHERE c.school_id = s.school_id)::int AS total_kelas,
         (SELECT count(*) FROM class_students cs
            WHERE cs.school_id = s.school_id)::int AS total_siswa
       FROM schools s
      WHERE s.school_id = $1`,
      [schoolId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      schoolId,
      name: row.name,
      ianaTimezone: row.iana_timezone,
      totalGuru: Number(row.total_guru ?? 0),
      totalKelas: Number(row.total_kelas ?? 0),
      totalSiswa: Number(row.total_siswa ?? 0),
    };
  });
}

/**
 * Daftar kelas sekolah untuk ekspor: nama, grade_level, nama guru pengampu
 * (LEFT JOIN created_by → profiles), jumlah siswa. SATU query, ORDER BY name.
 */
export async function listSchoolClassesForExport(
  claims: SessionClaims,
  schoolId: string,
): Promise<SchoolClassExportRow[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SchoolClassExportDbRow>(
      `SELECT
         c.id,
         c.name,
         c.grade_level,
         p.full_name AS teacher_name,
         (SELECT count(*) FROM class_students cs
            WHERE cs.class_id = c.id)::int AS jumlah_siswa
       FROM classes c
       LEFT JOIN profiles p ON p.id = c.created_by
      WHERE c.school_id = $1
      ORDER BY c.name ASC`,
      [schoolId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      gradeLevel: row.grade_level,
      teacherName: row.teacher_name,
      jumlahSiswa: Number(row.jumlah_siswa ?? 0),
    }));
  });
}

/**
 * Roster seluruh siswa sekolah untuk ekspor: nama kelas, NIS, nama lengkap.
 * SATU query (JOIN class_students → classes), ORDER BY class_name, full_name.
 */
export async function listSchoolRosterForExport(
  claims: SessionClaims,
  schoolId: string,
): Promise<SchoolRosterExportRow[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SchoolRosterExportDbRow>(
      `SELECT
         c.name AS class_name,
         cs.nis AS nis,
         cs.full_name AS full_name
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
      WHERE cs.school_id = $1
      ORDER BY c.name ASC, cs.full_name ASC`,
      [schoolId],
    );
    return result.rows.map((row) => ({
      className: row.class_name,
      nis: row.nis,
      fullName: row.full_name,
    }));
  });
}

/**
 * Presensi per sesi × siswa untuk ekspor sekolah. SATU query (bukan N+1):
 * join class_sessions → classes, lalu tiap siswa kelas tsb via class_students
 * LEFT JOIN session_attendance (status null = belum ditandai).
 *
 * `session_state` diderivasi di SQL:
 *   - scheduled_at > now()                                   → 'Terjadwal'
 *   - scheduled_at <= now() DAN ada baris presensi di sesi   → 'Selesai'
 *   - scheduled_at <= now() DAN tidak ada baris presensi     → 'Aktif'
 *
 * ORDER BY scheduled_at, class_name, full_name.
 */
export async function listSchoolAttendanceForExport(
  claims: SessionClaims,
  schoolId: string,
): Promise<SchoolAttendanceExportRow[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SchoolAttendanceExportDbRow>(
      `SELECT
         se.name AS session_name,
         c.name  AS class_name,
         se.scheduled_at AS scheduled_at,
         CASE
           WHEN se.scheduled_at > now() THEN 'Terjadwal'
           WHEN EXISTS(SELECT 1 FROM session_attendance a WHERE a.session_id = se.id) THEN 'Selesai'
           ELSE 'Aktif'
         END AS session_state,
         cs.nis AS nis,
         cs.full_name AS full_name,
         sa.status AS status,
         sa.created_at AS attendance_at
       FROM class_sessions se
       JOIN classes c ON c.id = se.class_id
       JOIN class_students cs ON cs.class_id = se.class_id
       LEFT JOIN session_attendance sa
              ON sa.session_id = se.id AND sa.student_id = cs.id
      WHERE se.school_id = $1
      ORDER BY se.scheduled_at ASC, c.name ASC, cs.full_name ASC`,
      [schoolId],
    );
    return result.rows.map((row) => ({
      sessionName: row.session_name,
      className: row.class_name,
      scheduledAt: row.scheduled_at,
      sessionState: row.session_state,
      nis: row.nis,
      fullName: row.full_name,
      status: row.status,
      attendanceAt: row.attendance_at,
    }));
  });
}
