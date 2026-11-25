/**
 * `admin-school-detail-service` — domain service READ-ONLY untuk drill-down
 * "Detail Sekolah" Admin (A02 → [schoolId], Fase 1).
 *
 * Menyediakan kontrak + tipe yang dikonsumsi halaman detail (FEAT-002):
 *   getSchoolDetail(claims, schoolId)              -> SchoolDetail | null
 *   listClassesWithStudents(claims, schoolId)      -> ClassWithStudents[]
 *   listSchoolSessions(claims, schoolId)           -> AdminSessionRow[]
 *   getSessionAttendanceDetail(claims, sessionId)  -> SessionAttendanceDetail | null
 *   presignSchoolSessionPhotos(photos)             -> PresignedPhoto[]
 *
 * KONTRAK SESI: setiap fungsi yang menyentuh DB MENERIMA `claims` terverifikasi
 * sebagai argumen PERTAMA dan menjalankan query di dalam
 * `withTenantTransaction(claims, ...)`. Untuk peran `admin`, kebijakan RLS admin
 * SELECT (sudah ada di migrasi 0002/0008/0014 — TANPA migrasi baru) mengizinkan
 * baca lintas sekolah. Service ini TIDAK memanggil `requireSession` sendiri;
 * otorisasi ditegakkan di lapisan UI + RLS.
 *
 * READ-ONLY (Fase 1): hanya `SELECT`. Tidak ada INSERT/UPDATE/DELETE di mana pun.
 * Seluruh query terparameterisasi (`$1`) — tanpa interpolasi string.
 *
 * Mengikuti gaya persis school-service.ts / admin-metrics-service.ts /
 * attendance-service.ts / session-service.ts.
 */

import 'server-only';

import type { PoolClient } from 'pg';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import { presignGet } from '@/lib/s3/presign';
import type { AttendanceStatus } from '@/lib/validation/attendance';

/** Ringkasan satu sekolah + hitungan agregat untuk header Detail Sekolah. */
export interface SchoolDetail {
  schoolId: string;
  name: string;
  ianaTimezone: string;
  jumlahGuru: number;
  jumlahKelas: number;
  jumlahSiswa: number;
  jumlahSesi: number;
}

/** Siswa ringkas (untuk daftar siswa per kelas). */
export interface StudentLite {
  id: string;
  nis: string;
  fullName: string;
}

/** Kelas beserta daftar siswanya. */
export interface ClassWithStudents {
  id: string;
  name: string;
  gradeLevel: string | null;
  students: StudentLite[];
}

/** Satu baris sesi sekolah (status presensi/jurnal dihitung di SQL via EXISTS). */
export interface AdminSessionRow {
  id: string;
  name: string;
  className: string;
  scheduledAt: Date;
  hasAttendance: boolean;
  hasJournal: boolean;
}

/** Baris presensi per siswa pada satu sesi (`status === null` = belum ditandai). */
export interface AttendanceStudentRow {
  studentId: string;
  nis: string;
  fullName: string;
  status: AttendanceStatus | null;
}

/** Foto dokumentasi sesi (s3Key mentah, belum dipresign). */
export interface SessionPhoto {
  id: string;
  s3Key: string;
}

/** Detail presensi + jurnal + foto satu sesi (read-only). */
export interface SessionAttendanceDetail {
  sessionId: string;
  sessionName: string;
  className: string;
  scheduledAt: Date;
  students: AttendanceStudentRow[];
  journalNotes: string | null;
  photos: SessionPhoto[];
}

/** Foto yang sudah dipresign (siap ditampilkan di UI). */
export interface PresignedPhoto {
  id: string;
  url: string;
}

/** Bentuk baris mentah hasil `getSchoolDetail` (snake_case dari SQL). */
interface SchoolDetailRow {
  name: string;
  iana_timezone: string;
  jumlah_guru: number;
  jumlah_kelas: number;
  jumlah_siswa: number;
  jumlah_sesi: number;
}

/** Bentuk baris mentah kelas (snake_case dari `pg`). */
interface ClassRow {
  id: string;
  name: string;
  grade_level: string | null;
}

/** Bentuk baris mentah siswa (snake_case dari `pg`). */
interface StudentRow {
  id: string;
  class_id: string;
  nis: string;
  full_name: string;
}

/** Bentuk baris mentah sesi sekolah (snake_case dari SQL). */
interface AdminSessionDbRow {
  id: string;
  name: string;
  class_name: string;
  scheduled_at: Date;
  has_attendance: boolean;
  has_journal: boolean;
}

/** Bentuk baris mentah meta sesi (snake_case dari SQL). */
interface SessionMetaRow {
  id: string;
  name: string;
  class_name: string;
  scheduled_at: Date;
}

/** Bentuk baris mentah presensi siswa (snake_case dari SQL). */
interface AttendanceStudentDbRow {
  student_id: string;
  nis: string;
  full_name: string;
  status: AttendanceStatus | null;
}

/** Bentuk baris mentah foto sesi (snake_case dari SQL). */
interface SessionPhotoRow {
  id: string;
  s3_key: string;
}

/**
 * Helper MURNI (tanpa DB): memetakan tiap kelas ke objek `ClassWithStudents`
 * dan mengisi `students` berdasar kecocokan `classId === class.id`. Urutan input
 * kelas maupun siswa dipertahankan; kelas tanpa siswa → `students: []`.
 */
export function groupStudentsByClass(
  classes: { id: string; name: string; gradeLevel: string | null }[],
  students: { id: string; classId: string; nis: string; fullName: string }[],
): ClassWithStudents[] {
  return classes.map((cls) => ({
    id: cls.id,
    name: cls.name,
    gradeLevel: cls.gradeLevel,
    students: students
      .filter((student) => student.classId === cls.id)
      .map((student) => ({
        id: student.id,
        nis: student.nis,
        fullName: student.fullName,
      })),
  }));
}

/**
 * Ringkasan satu sekolah + hitungan agregat (guru/kelas/siswa/sesi). Memakai
 * SATU query dengan subquery skalar per metrik (anti-inflasi join) — pola meniru
 * admin-metrics-service.ts. Bila sekolah tidak ditemukan (atau tak terlihat di
 * bawah RLS) → `null`.
 *
 * @param claims   Klaim sesi admin terverifikasi (dari `requireSession`).
 * @param schoolId UUID sekolah yang hendak diambil detailnya.
 */
export async function getSchoolDetail(
  claims: SessionClaims,
  schoolId: string,
): Promise<SchoolDetail | null> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<SchoolDetailRow>(
      `SELECT
         s.name,
         s.iana_timezone,
         (SELECT count(*) FROM profiles p
            WHERE p.school_id = s.school_id AND p.role = 'teacher')::int AS jumlah_guru,
         (SELECT count(*) FROM classes c
            WHERE c.school_id = s.school_id)::int AS jumlah_kelas,
         (SELECT count(*) FROM class_students cs
            WHERE cs.school_id = s.school_id)::int AS jumlah_siswa,
         (SELECT count(*) FROM class_sessions se
            WHERE se.school_id = s.school_id)::int AS jumlah_sesi
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
      jumlahGuru: Number(row.jumlah_guru ?? 0),
      jumlahKelas: Number(row.jumlah_kelas ?? 0),
      jumlahSiswa: Number(row.jumlah_siswa ?? 0),
      jumlahSesi: Number(row.jumlah_sesi ?? 0),
    };
  });
}

/**
 * Daftar kelas sekolah beserta siswa tiap kelas. Dua query parameterized (kelas
 * + siswa), lalu digabung di TypeScript via `groupStudentsByClass` (helper murni)
 * agar logika pengelompokan mudah diuji tanpa DB.
 *
 * @param claims   Klaim sesi admin terverifikasi (dari `requireSession`).
 * @param schoolId UUID sekolah.
 */
export async function listClassesWithStudents(
  claims: SessionClaims,
  schoolId: string,
): Promise<ClassWithStudents[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const classesResult = await tx.query<ClassRow>(
      `SELECT id, name, grade_level
         FROM classes
        WHERE school_id = $1
        ORDER BY name ASC`,
      [schoolId],
    );
    const studentsResult = await tx.query<StudentRow>(
      `SELECT id, class_id, nis, full_name
         FROM class_students
        WHERE school_id = $1
        ORDER BY full_name ASC`,
      [schoolId],
    );

    const classes = classesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      gradeLevel: row.grade_level,
    }));
    const students = studentsResult.rows.map((row) => ({
      id: row.id,
      classId: row.class_id,
      nis: row.nis,
      fullName: row.full_name,
    }));

    return groupStudentsByClass(classes, students);
  });
}

/**
 * Daftar sesi sekolah + status presensi/jurnal dihitung di SQL (EXISTS), diurut
 * `scheduled_at DESC`. Pola EXISTS meniru session-service.ts.
 *
 * @param claims   Klaim sesi admin terverifikasi (dari `requireSession`).
 * @param schoolId UUID sekolah.
 */
export async function listSchoolSessions(
  claims: SessionClaims,
  schoolId: string,
): Promise<AdminSessionRow[]> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query<AdminSessionDbRow>(
      `SELECT s.id, s.name, c.name AS class_name, s.scheduled_at,
              EXISTS(SELECT 1 FROM session_attendance a WHERE a.session_id = s.id) AS has_attendance,
              EXISTS(SELECT 1 FROM session_journals j WHERE j.session_id = s.id) AS has_journal
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
        WHERE s.school_id = $1
        ORDER BY s.scheduled_at DESC`,
      [schoolId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      className: row.class_name,
      scheduledAt: row.scheduled_at,
      hasAttendance: row.has_attendance,
      hasJournal: row.has_journal,
    }));
  });
}

/**
 * Detail presensi + jurnal + foto satu sesi (read-only). Bila sesi tidak
 * ditemukan (atau tak terlihat di bawah RLS) → `null`. Daftar siswa memakai
 * LEFT JOIN `class_students` → `session_attendance` (status `null` = belum
 * ditandai), meniru attendance-service.listAttendance.
 *
 * @param claims    Klaim sesi admin terverifikasi (dari `requireSession`).
 * @param sessionId UUID sesi.
 */
export async function getSessionAttendanceDetail(
  claims: SessionClaims,
  sessionId: string,
): Promise<SessionAttendanceDetail | null> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const metaResult = await tx.query<SessionMetaRow>(
      `SELECT s.id, s.name, c.name AS class_name, s.scheduled_at
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
        WHERE s.id = $1
        LIMIT 1`,
      [sessionId],
    );
    const meta = metaResult.rows[0];
    if (!meta) {
      return null;
    }

    const studentsResult = await tx.query<AttendanceStudentDbRow>(
      `SELECT cs.id AS student_id, cs.nis, cs.full_name, sa.status
         FROM class_sessions sess
         JOIN class_students cs ON cs.class_id = sess.class_id
         LEFT JOIN session_attendance sa
                ON sa.session_id = sess.id AND sa.student_id = cs.id
        WHERE sess.id = $1
        ORDER BY cs.full_name ASC`,
      [sessionId],
    );

    const journalResult = await tx.query<{ notes: string | null }>(
      `SELECT notes
         FROM session_journals
        WHERE session_id = $1
        LIMIT 1`,
      [sessionId],
    );

    const photosResult = await tx.query<SessionPhotoRow>(
      `SELECT id, s3_key
         FROM session_photos
        WHERE session_id = $1
        ORDER BY created_at ASC`,
      [sessionId],
    );

    return {
      sessionId: meta.id,
      sessionName: meta.name,
      className: meta.class_name,
      scheduledAt: meta.scheduled_at,
      students: studentsResult.rows.map((row) => ({
        studentId: row.student_id,
        nis: row.nis,
        fullName: row.full_name,
        status: row.status,
      })),
      journalNotes: journalResult.rows[0]?.notes ?? null,
      photos: photosResult.rows.map((row) => ({
        id: row.id,
        s3Key: row.s3_key,
      })),
    };
  });
}

/**
 * Helper server (TANPA claims dan TANPA DB): memetakan tiap `photo.s3Key` lewat
 * `presignGet` dengan `Promise.all`, mengembalikan `{ id, url }[]`. Memisahkan
 * I/O S3 dari query DB menjaga service tetap murni. Dipanggil halaman FEAT-002
 * di server setelah `getSessionAttendanceDetail`.
 */
export async function presignSchoolSessionPhotos(
  photos: SessionPhoto[],
): Promise<PresignedPhoto[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      id: photo.id,
      url: await presignGet(photo.s3Key),
    })),
  );
}
