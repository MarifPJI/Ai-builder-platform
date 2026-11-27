/**
 * `sessionService` — jadwal Sesi pertemuan (T02) pada course-class-publishing.
 *
 * Memeriksa dua invarian (Property 5): `class_id` milik school_id Guru dan
 * `material_id` merujuk Materi `published` (R6.1–R6.3). TENANT; RLS menegakkan
 * isolasi kelas/sesi; Materi global.
 *
 * _Requirements: 6.1, 6.2, 6.3, 6.5_
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import { scheduleSessionSchema, type ScheduleSessionInput } from '@/lib/validation/class';

import {
  buildSessionName,
  isSessionKind,
  resolveSessionKind,
  type SessionKind,
} from './session-plan';
import { teacherSchoolId } from './tenant-scope';

export class SessionError extends Error {}

export interface SessionRow {
  id: string;
  classId: string;
  className: string;
  materialId: string | null;
  name: string;
  scheduledAt: Date;
  /** Tipe sesi (0022); null untuk sesi lama tanpa tipe. */
  sessionKind: SessionKind | null;
  partNumber: number | null;
}

function readKind(value: unknown): SessionKind | null {
  return isSessionKind(value) ? value : null;
}

function readPart(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Sesi dengan status waktu dihitung di SQL server (bukan klien):
 * `isDue` = scheduled_at sudah lewat/sekarang, `hasAttendance` = sudah ada
 * baris presensi. Dipakai halaman Sesi (FEAT-002) & Dashboard (FEAT-003).
 */
export interface SessionWithStatus extends SessionRow {
  isDue: boolean;
  hasAttendance: boolean;
}

/** Rekap presensi per Sesi (read-only) untuk layar Presensi & Jurnal. */
export interface SessionRecap {
  id: string;
  name: string;
  className: string;
  scheduledAt: Date;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  totalSiswa: number;
  hasJournal: boolean;
}

/** Menjadwalkan Sesi (R6.1). Validasi kepemilikan kelas + Materi published. */
export async function scheduleSession(
  claims: SessionClaims,
  input: ScheduleSessionInput,
): Promise<string> {
  const valid = scheduleSessionSchema.parse(input);
  const schoolId = teacherSchoolId(claims);
  return withTenantTransaction(claims, async (tx) => {
    // R6.2: class_id harus milik tenant (RLS + filter school_id eksplisit).
    // FOR UPDATE mengunci baris kelas agar dua permintaan bersamaan untuk kelas
    // yang sama tidak mendapat nomor sesi yang sama.
    const cls = await tx.query(
      `SELECT 1 FROM classes WHERE id = $1 AND school_id = $2 FOR UPDATE`,
      [valid.classId, schoolId],
    );
    if (cls.rowCount === 0) {
      throw new SessionError('Kelas tidak ditemukan atau bukan milik sekolah Anda.');
    }
    // R6.3: material_id harus merujuk Materi published (Materi global).
    const mat = await tx.query<{ title: string }>(
      `SELECT title FROM materials WHERE id = $1 AND publish_status = 'published'`,
      [valid.materialId],
    );
    const material = mat.rows[0];
    if (!material) {
      throw new SessionError('Materi belum diterbitkan. Sesi tidak dapat dijadwalkan.');
    }

    let name = valid.name ?? '';
    let sessionKind: SessionKind | null = null;
    let partNumber: number | null = null;

    if (valid.sessionKind) {
      // Nomor & aturan SELALU dihitung server dari sesi yang ada (klien tidak dipercaya).
      const existing = await tx.query(
        `SELECT session_kind, part_number FROM class_sessions
          WHERE class_id = $1 AND material_id = $2 AND school_id = $3`,
        [valid.classId, valid.materialId, schoolId],
      );
      const resolved = resolveSessionKind(
        valid.sessionKind,
        existing.rows.map((r: Record<string, unknown>) => ({
          sessionKind: readKind(r.session_kind),
          partNumber: readPart(r.part_number),
        })),
      );
      if (!resolved.ok) throw new SessionError(resolved.message);
      sessionKind = resolved.kind;
      partNumber = resolved.partNumber;
      name = buildSessionName(sessionKind, partNumber, material.title);
    }

    if (!name) throw new SessionError('Nama sesi wajib diisi.');

    const res = await tx.query<{ id: string }>(
      `INSERT INTO class_sessions
              (class_id, school_id, material_id, name, scheduled_at, session_kind, part_number)
       SELECT c.id, c.school_id, $2, $3, $4, $6, $7
         FROM classes c WHERE c.id = $1 AND c.school_id = $5
       RETURNING id`,
      [valid.classId, valid.materialId, name, valid.scheduledAt, schoolId, sessionKind, partNumber],
    );
    const row = res.rows[0];
    if (!row) throw new SessionError('Gagal menjadwalkan sesi.');
    return row.id;
  });
}

/** Daftar Sesi mengajar Guru (R6.5). */
export async function listSessions(claims: SessionClaims): Promise<SessionRow[]> {
  const schoolId = teacherSchoolId(claims);
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT s.id, s.class_id, c.name AS class_name, s.material_id, s.name, s.scheduled_at,
              s.session_kind, s.part_number
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
        WHERE s.school_id = $1 AND c.school_id = $1
        ORDER BY s.scheduled_at DESC`,
      [schoolId],
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      classId: r.class_id as string,
      className: r.class_name as string,
      materialId: (r.material_id as string | null) ?? null,
      name: r.name as string,
      scheduledAt: r.scheduled_at as Date,
      sessionKind: readKind(r.session_kind),
      partNumber: readPart(r.part_number),
    }));
  });
}

/**
 * Daftar Sesi mengajar Guru beserta status waktu (read-only). Status dihitung
 * di SQL server: `is_due` via `now()` dan `has_attendance` via EXISTS.
 */
export async function listSessionsWithStatus(
  claims: SessionClaims,
): Promise<SessionWithStatus[]> {
  const schoolId = teacherSchoolId(claims);
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT s.id, s.class_id, c.name AS class_name, s.material_id, s.name, s.scheduled_at,
              s.session_kind, s.part_number,
              (s.scheduled_at <= now()) AS is_due,
              EXISTS(SELECT 1 FROM session_attendance a
                      WHERE a.session_id = s.id AND a.school_id = s.school_id) AS has_attendance
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
        WHERE s.school_id = $1 AND c.school_id = $1
        ORDER BY s.scheduled_at DESC`,
      [schoolId],
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      classId: r.class_id as string,
      className: r.class_name as string,
      materialId: (r.material_id as string | null) ?? null,
      name: r.name as string,
      scheduledAt: r.scheduled_at as Date,
      sessionKind: readKind(r.session_kind),
      partNumber: readPart(r.part_number),
      isDue: r.is_due as boolean,
      hasAttendance: r.has_attendance as boolean,
    }));
  });
}

/**
 * Rekap presensi per Sesi (read-only): hitung jumlah per status + total siswa
 * kelas + ada tidaknya jurnal. Hanya Sesi yang sudah punya presensi.
 */
export async function listSessionRecap(claims: SessionClaims): Promise<SessionRecap[]> {
  const schoolId = teacherSchoolId(claims);
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT s.id AS session_id, s.name, c.name AS class_name, s.scheduled_at,
              count(a.*) FILTER (WHERE a.status = 'hadir') AS hadir,
              count(a.*) FILTER (WHERE a.status = 'sakit') AS sakit,
              count(a.*) FILTER (WHERE a.status = 'izin') AS izin,
              count(a.*) FILTER (WHERE a.status = 'alfa') AS alfa,
              (SELECT count(*) FROM class_students cs
                WHERE cs.class_id = s.class_id AND cs.school_id = s.school_id) AS total_siswa,
              EXISTS(SELECT 1 FROM session_journals j
                      WHERE j.session_id = s.id AND j.school_id = s.school_id) AS has_journal
         FROM class_sessions s
         JOIN classes c ON c.id = s.class_id
         JOIN session_attendance a ON a.session_id = s.id AND a.school_id = s.school_id
        WHERE s.school_id = $1 AND c.school_id = $1
        GROUP BY s.id, s.name, c.name, s.scheduled_at
        ORDER BY s.scheduled_at DESC`,
      [schoolId],
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.session_id as string,
      name: r.name as string,
      className: r.class_name as string,
      scheduledAt: r.scheduled_at as Date,
      hadir: Number(r.hadir),
      sakit: Number(r.sakit),
      izin: Number(r.izin),
      alfa: Number(r.alfa),
      totalSiswa: Number(r.total_siswa),
      hasJournal: r.has_journal as boolean,
    }));
  });
}
