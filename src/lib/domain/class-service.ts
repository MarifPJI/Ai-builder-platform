/**
 * `classService` — Kelas (T02) pada fitur course-class-publishing.
 *
 * TENANT per school_id: `school_id` SELALU diambil dari klaim Session_Guard,
 * tidak pernah dari input klien (R4.1). RLS menegakkan isolasi (0008).
 *
 * _Requirements: 4.1, 4.2, 5.3_
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import { createClassSchema, type CreateClassInput } from '@/lib/validation/class';

export interface ClassSummary {
  id: string;
  name: string;
  gradeLevel: string | null;
  materialId: string | null;
  studentCount: number;
  createdAt: Date;
}

export interface ClassStudent {
  id: string;
  nis: string;
  fullName: string;
}

export class ClassError extends Error {}

/** Membuat Kelas pada school_id Guru (R4.1, R4.2). */
export async function createClass(
  claims: SessionClaims,
  input: CreateClassInput,
): Promise<string> {
  const valid = createClassSchema.parse(input);
  if (!claims.schoolId) {
    throw new ClassError('Guru tidak terikat pada sekolah yang valid.');
  }
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO classes (school_id, name, grade_level, material_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [claims.schoolId, valid.name, valid.gradeLevel ?? null, valid.materialId ?? null],
    );
    const row = res.rows[0];
    if (!row) throw new ClassError('Gagal membuat kelas.');
    return row.id;
  });
}

/** Daftar Kelas milik Guru (tenant) beserta jumlah siswa (R5.3). */
export async function listClasses(claims: SessionClaims): Promise<ClassSummary[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT c.id, c.name, c.grade_level, c.material_id, c.created_at,
              COUNT(cs.id)::int AS student_count
         FROM classes c
         LEFT JOIN class_students cs ON cs.class_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC`,
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      gradeLevel: (r.grade_level as string | null) ?? null,
      materialId: (r.material_id as string | null) ?? null,
      studentCount: (r.student_count as number) ?? 0,
      createdAt: r.created_at as Date,
    }));
  });
}

/** Daftar nama siswa sebuah Kelas (R5.3) — dasar daftar hadir. */
export async function listStudents(
  claims: SessionClaims,
  classId: string,
): Promise<ClassStudent[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT id, nis, full_name FROM class_students
        WHERE class_id = $1 ORDER BY full_name ASC`,
      [classId],
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nis: r.nis as string,
      fullName: r.full_name as string,
    }));
  });
}
