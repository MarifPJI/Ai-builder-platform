/**
 * `attendance-service` — domain service presensi, jurnal, dan foto dokumentasi
 * sesi (T06B, fitur teacher-ui).
 *
 * Kontrak (design.md §2.7):
 *   listAttendance(claims, sessionId)                         -> AttendanceRow[]
 *   saveAttendance(claims, sessionId, entries)                -> void
 *   saveJournal(claims, sessionId, notes)                     -> void
 *   requestSessionPhotoUpload(claims, sessionId, contentType) -> PresignPutResult
 *   confirmSessionPhoto(claims, sessionId, s3Bucket, s3Key)   -> void
 *
 * KONTRAK SESI: service MENERIMA `claims` yang SUDAH terverifikasi dan TIDAK
 * memanggil `requireSession` sendiri (dilakukan di Server Action pemanggil).
 *
 * Semua operasi DB berjalan melalui `withTenantTransaction(claims, ...)` di
 * bawah RLS (0014). `school_id` SELALU diturunkan dari baris sesi yang dimiliki,
 * tidak pernah dari input klien. Query memakai parameterisasi (`$1`) — tanpa
 * interpolasi string.
 *
 * "Belum ditandai" = ketiadaan baris `session_attendance` (Decision 2), bukan
 * nilai sentinel; `status` di DB hanya menyimpan empat nilai nyata.
 */

import 'server-only';

import type { PoolClient } from 'pg';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import {
  presignPutImage,
  type ImageContentType,
  type PresignPutResult,
} from '@/lib/s3/presign';
import {
  attendanceEntriesSchema,
  type AttendanceStatus,
} from '@/lib/validation/attendance';

import { teacherSchoolId } from './tenant-scope';

/** Error domain presensi; memisahkan kegagalan domain dari error DB biasa. */
export class AttendanceError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AttendanceError';
  }
}

/** Baris presensi per siswa pada satu sesi (`status === null` = belum ditandai). */
export interface AttendanceRow {
  studentId: string;
  nis: string;
  fullName: string;
  status: AttendanceStatus | null;
}

/** Satu entri presensi yang akan disimpan (siswa + status). */
export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
}

/** Bentuk baris mentah hasil `listAttendance` (snake_case dari `pg`). */
interface AttendanceQueryRow {
  student_id: string;
  nis: string;
  full_name: string;
  status: AttendanceStatus | null;
}

/**
 * Mengembalikan daftar seluruh siswa pada kelas sesi beserta status presensinya
 * (LEFT JOIN; siswa belum ditandai ber-`status === null`).
 *
 * Kepemilikan sesi dipaksakan RLS; untuk pesan error yang presisi, service lebih
 * dulu memeriksa `SELECT 1 FROM class_sessions WHERE id = $1` — sesi hilang/bukan
 * milik sekolah → `AttendanceError`.
 */
export async function listAttendance(
  claims: SessionClaims,
  sessionId: string,
): Promise<AttendanceRow[]> {
  const schoolId = teacherSchoolId(claims);
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const owned = await tx.query(
      `SELECT 1 FROM class_sessions WHERE id = $1 AND school_id = $2 LIMIT 1`,
      [sessionId, schoolId],
    );
    if (owned.rowCount === null || owned.rowCount === 0) {
      throw new AttendanceError('Sesi tidak ditemukan atau bukan milik sekolah Anda.');
    }

    const result = await tx.query<AttendanceQueryRow>(
      `SELECT cs.id AS student_id, cs.nis, cs.full_name, sa.status
         FROM class_sessions sess
         JOIN class_students cs ON cs.class_id = sess.class_id AND cs.school_id = sess.school_id
         LEFT JOIN session_attendance sa
                ON sa.session_id = sess.id AND sa.student_id = cs.id
        WHERE sess.id = $1 AND sess.school_id = $2
        ORDER BY cs.full_name ASC`,
      [sessionId, schoolId],
    );

    return result.rows.map((row) => ({
      studentId: row.student_id,
      nis: row.nis,
      fullName: row.full_name,
      status: row.status,
    }));
  });
}

/**
 * Menyimpan presensi secara idempoten (upsert set-based satu statement).
 *
 * Validasi bentuk via `attendanceEntriesSchema.parse`, verifikasi kepemilikan
 * sesi, lalu upsert semua entri dalam satu `INSERT ... SELECT ... unnest(...)`
 * dengan `ON CONFLICT (session_id, student_id) DO UPDATE`. `school_id` diambil
 * dari baris sesi (bukan input). Jika `rowCount < entries.length`, ada entri
 * yang merujuk siswa di luar kelas sesi (atau sesi tak dimiliki) → lempar
 * `AttendanceError` dan transaksi di-rollback (tanpa tulis parsial/asing).
 */
export async function saveAttendance(
  claims: SessionClaims,
  sessionId: string,
  entries: AttendanceEntry[],
): Promise<void> {
  const parsed = attendanceEntriesSchema.parse(entries);
  const schoolId = teacherSchoolId(claims);

  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const owned = await tx.query(
      `SELECT 1 FROM class_sessions WHERE id = $1 AND school_id = $2 LIMIT 1`,
      [sessionId, schoolId],
    );
    if (owned.rowCount === null || owned.rowCount === 0) {
      throw new AttendanceError('Sesi tidak ditemukan atau bukan milik sekolah Anda.');
    }

    if (parsed.length === 0) {
      return;
    }

    const studentIds = parsed.map((e) => e.studentId);
    const statuses = parsed.map((e) => e.status);

    const result = await tx.query(
      `INSERT INTO session_attendance (session_id, student_id, school_id, status)
       SELECT sess.id, cs.id, sess.school_id, e.status
         FROM class_sessions sess
         JOIN unnest($2::uuid[], $3::text[]) AS e(student_id, status) ON TRUE
         JOIN class_students cs ON cs.class_id = sess.class_id AND cs.id = e.student_id
                                AND cs.school_id = sess.school_id
        WHERE sess.id = $1 AND sess.school_id = $4
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
      [sessionId, studentIds, statuses, schoolId],
    );

    if (result.rowCount === null || result.rowCount < parsed.length) {
      throw new AttendanceError('Sebagian siswa tidak terdaftar di kelas sesi ini.');
    }
  });
}

/**
 * Menyimpan satu catatan jurnal per sesi (upsert pada `UNIQUE (session_id)`).
 * `notes` boleh `null` (textarea opsional). `school_id` diambil dari baris sesi.
 * Zero rowCount → sesi hilang/bukan milik sekolah → `AttendanceError`.
 */
export async function saveJournal(
  claims: SessionClaims,
  sessionId: string,
  notes: string | null,
): Promise<void> {
  const schoolId = teacherSchoolId(claims);
  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `INSERT INTO session_journals (session_id, school_id, notes)
       SELECT sess.id, sess.school_id, $2 FROM class_sessions sess
        WHERE sess.id = $1 AND sess.school_id = $3
       ON CONFLICT (session_id) DO UPDATE SET notes = EXCLUDED.notes, updated_at = now()
        WHERE session_journals.school_id = $3`,
      [sessionId, notes, schoolId],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AttendanceError('Sesi tidak ditemukan atau bukan milik sekolah Anda.');
    }
  });
}

/**
 * Menerbitkan Presigned PUT URL untuk unggah foto dokumentasi sesi ke bucket
 * privat dengan prefix `sessions/<sessionId>`. Memvalidasi `contentType` adalah
 * tipe gambar yang diizinkan (`image/jpeg`, Decision 6) di runtime. Tidak perlu
 * round-trip DB; kepemilikan diperiksa ulang saat `confirmSessionPhoto`.
 */
export async function requestSessionPhotoUpload(
  claims: SessionClaims,
  sessionId: string,
  contentType: ImageContentType,
): Promise<PresignPutResult> {
  void claims; // `claims` divalidasi di Server Action (requireSession) sebelum dipanggil.
  if (contentType !== 'image/jpeg') {
    throw new AttendanceError('Tipe berkas foto tidak didukung. Gunakan format JPEG.');
  }
  return presignPutImage(contentType, `sessions/${sessionId}`);
}

/**
 * Mencatat baris `session_photos` setelah unggah S3 sukses, menurunkan
 * `school_id` dari baris sesi yang dimiliki (mencegah lampir foto ke sesi
 * sekolah lain). Zero rowCount → sesi hilang/bukan milik sekolah →
 * `AttendanceError`.
 */
export async function confirmSessionPhoto(
  claims: SessionClaims,
  sessionId: string,
  s3Bucket: string,
  s3Key: string,
): Promise<void> {
  const schoolId = teacherSchoolId(claims);
  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `INSERT INTO session_photos (session_id, school_id, s3_bucket, s3_key)
       SELECT sess.id, sess.school_id, $2, $3 FROM class_sessions sess
        WHERE sess.id = $1 AND sess.school_id = $4`,
      [sessionId, s3Bucket, s3Key, schoolId],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AttendanceError('Sesi tidak ditemukan atau bukan milik sekolah Anda.');
    }
  });
}
