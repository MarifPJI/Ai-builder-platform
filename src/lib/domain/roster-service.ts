/**
 * `rosterService` — daftar siswa Kelas (T02) pada course-class-publishing.
 *
 * Dua mode input (R4.3, R4.4). Impor massal menjaga invarian:
 * `saved + rejected.length === total` (R4.5, Property 4). TENANT per school_id;
 * school_id diambil dari klaim (bukan input), RLS menegakkan isolasi.
 *
 * _Requirements: 4.3, 4.4, 4.5, 5.1, 5.2_
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import {
  MAX_ROSTER_ROWS,
  parseRosterText,
  parseStudentRow,
  studentSchema,
  type RawStudentRow,
} from '@/lib/validation/roster';

import { teacherSchoolId } from './tenant-scope';

export class RosterError extends Error {}

export interface RosterSummary {
  total: number;
  saved: number;
  rejected: { line: number; reason: string }[];
}

/** Masukan impor: teks mentah `Input Sekaligus` atau baris yang sudah terpisah. */
export type RosterInput = { text: string } | { rows: RawStudentRow[] };

/** Menambah satu siswa secara manual (R4.4). */
export async function addStudentManual(
  claims: SessionClaims,
  classId: string,
  nis: string,
  fullName: string,
): Promise<void> {
  const valid = studentSchema.parse({ nis, fullName });
  const schoolId = teacherSchoolId(claims);
  await withTenantTransaction(claims, async (tx) => {
    // Pastikan kelas milik tenant (RLS + filter school_id eksplisit); insert siswa.
    const ins = await tx.query(
      `INSERT INTO class_students (class_id, school_id, nis, full_name)
       SELECT c.id, c.school_id, $2, $3 FROM classes c WHERE c.id = $1 AND c.school_id = $4`,
      [classId, valid.nis, valid.fullName, schoolId],
    );
    if (ins.rowCount === 0) {
      throw new RosterError('Kelas tidak ditemukan atau tidak berwenang.');
    }
  });
}

/**
 * Impor daftar siswa massal (R4.3, R4.5). Menolak bila baris > MAX_ROSTER_ROWS.
 * Baris invalid dilewati + dicatat; invarian saved + rejected = total.
 */
export async function importRoster(
  claims: SessionClaims,
  classId: string,
  input: RosterInput,
): Promise<RosterSummary> {
  const schoolId = teacherSchoolId(claims);

  const rows: RawStudentRow[] = 'text' in input ? parseRosterText(input.text) : input.rows;

  if (rows.length > MAX_ROSTER_ROWS) {
    throw new RosterError(
      `Jumlah baris (${rows.length}) melebihi batas ${MAX_ROSTER_ROWS}. Impor dibatalkan.`,
    );
  }

  const total = rows.length;
  const rejected: { line: number; reason: string }[] = [];
  let saved = 0;

  await withTenantTransaction(claims, async (tx) => {
    // Verifikasi kelas milik tenant sekali di awal (RLS + cek eksplisit).
    const own = await tx.query(`SELECT 1 FROM classes WHERE id = $1 AND school_id = $2`, [
      classId,
      schoolId,
    ]);
    if (own.rowCount === 0) {
      throw new RosterError('Kelas tidak ditemukan atau tidak berwenang.');
    }

    for (let i = 0; i < rows.length; i += 1) {
      const line = i + 1;
      const parsed = parseStudentRow(rows[i]!);
      if (!parsed.valid) {
        rejected.push({ line, reason: parsed.reason });
        continue;
      }
      try {
        await tx.query(
          `INSERT INTO class_students (class_id, school_id, nis, full_name)
           SELECT c.id, c.school_id, $2, $3 FROM classes c WHERE c.id = $1 AND c.school_id = $4`,
          [classId, parsed.value.nis, parsed.value.fullName, schoolId],
        );
        saved += 1;
      } catch {
        rejected.push({ line, reason: 'Gagal menyimpan baris ini.' });
      }
    }
  });

  return { total, saved, rejected };
}

/**
 * Menghapus satu siswa dari sebuah Kelas. Ber-scope eksplisit ke `class_id`
 * (RLS teacher-scope membatasi `school_id`; `class_id` mencegah hapus lintas
 * kelas). Query parameterized. Bila tidak ada baris terhapus, lempar RosterError.
 */
export async function removeStudent(
  claims: SessionClaims,
  classId: string,
  studentId: string,
): Promise<void> {
  const schoolId = teacherSchoolId(claims);
  await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `DELETE FROM class_students WHERE id = $1 AND class_id = $2 AND school_id = $3`,
      [studentId, classId, schoolId],
    );
    if (res.rowCount === 0) {
      throw new RosterError('Siswa tidak ditemukan atau tidak berwenang.');
    }
  });
}
