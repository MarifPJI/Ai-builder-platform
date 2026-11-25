/**
 * `admin-school-mutations-service` — domain service WRITE untuk Detail Sekolah
 * Admin (FASE 2, feat-002-admin-school-write).
 *
 * Melengkapi service READ Fase 1 (`admin-school-detail-service.ts`, TIDAK
 * diubah) dengan kemampuan admin: edit & hapus SESI, upsert & hapus PRESENSI
 * per siswa, upsert & hapus JURNAL, dan hapus FOTO dokumentasi (baris DB saja).
 *
 * KONTRAK SESI: setiap fungsi MENERIMA `claims` terverifikasi sebagai argumen
 * PERTAMA dan TIDAK memanggil `requireSession` sendiri (dilakukan di Server
 * Action pemanggil). Semua operasi berjalan di dalam
 * `withTenantTransaction(claims, ...)` di bawah RLS; untuk peran admin, policy
 * admin WRITE (migrasi 0015, `role='admin'`) mengizinkan mutasi lintas sekolah.
 * TANPA bypass RLS, TANPA superuser.
 *
 * Invarian: `school_id` SELALU diturunkan dari baris sesi (SQL `sess.school_id`),
 * tidak pernah dari input klien. Seluruh query terparameterisasi (`$1`) — tanpa
 * interpolasi string. `rowCount === 0 || null` pada operasi bertarget →
 * `AdminMutationError` dengan pesan berbahasa Indonesia.
 *
 * Admin override waktu: TIDAK ada pengecekan `scheduled_at <= now()` di mana pun
 * (admin boleh mengelola sesi/presensi/jurnal kapan saja — keputusan produk).
 */

import 'server-only';

import { z } from 'zod';
import type { PoolClient } from 'pg';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import {
  attendanceEntriesSchema,
  journalNotesSchema,
  type AttendanceStatus,
} from '@/lib/validation/attendance';
import { sessionNameSchema } from '@/lib/validation/admin-session';

/** Error domain mutasi admin; memisahkan kegagalan domain dari error DB biasa. */
export class AdminMutationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AdminMutationError';
  }
}

/** Satu entri presensi yang akan disimpan (siswa + status). */
export interface AdminAttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
}

/** Skema UUID generik untuk validasi id sebelum query. */
const uuidSchema = z.string().uuid({ message: 'Identitas tidak valid.' });

/** Skema ISO 8601 ber-offset (hasil konversi WIB di Server Action). */
const scheduledAtSchema = z
  .string({ required_error: 'Tanggal & jam sesi wajib diisi.' })
  .datetime({ offset: true, message: 'Tanggal & jam sesi tidak valid.' });

/**
 * Edit SESI (nama + jadwal). Menyimpan `scheduledAt` (ISO ber-offset) apa adanya
 * ke `timestamptz`. TIDAK mengubah `class_id`/`material_id`/`school_id` (menjaga
 * invarian kelas-milik-sekolah). Tanpa cek `scheduled_at > now()` (override admin).
 * `rowCount === 0` → sesi tidak ditemukan.
 */
export async function adminUpdateSession(
  claims: SessionClaims,
  sessionId: string,
  input: { name: string; scheduledAt: string },
): Promise<void> {
  const id = uuidSchema.parse(sessionId);
  const name = sessionNameSchema.parse(input.name);
  const scheduledAt = scheduledAtSchema.parse(input.scheduledAt);

  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `UPDATE class_sessions
          SET name = $2, scheduled_at = $3, updated_at = now()
        WHERE id = $1`,
      [id, name, scheduledAt],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AdminMutationError('Sesi tidak ditemukan.');
    }
  });
}

/**
 * Hapus SESI. Mengambil `school_id` lebih dulu untuk nilai redirect, lalu
 * `DELETE FROM class_sessions`; FK `ON DELETE CASCADE` menghapus baris presensi/
 * jurnal/foto sesi itu (objek S3 tidak dihapus). `rowCount === 0` → tidak ada.
 */
export async function adminDeleteSession(
  claims: SessionClaims,
  sessionId: string,
): Promise<{ schoolId: string }> {
  const id = uuidSchema.parse(sessionId);

  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const owned = await tx.query<{ school_id: string }>(
      `SELECT school_id FROM class_sessions WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = owned.rows[0];
    if (!row) {
      throw new AdminMutationError('Sesi tidak ditemukan.');
    }

    const result = await tx.query(
      `DELETE FROM class_sessions WHERE id = $1`,
      [id],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AdminMutationError('Sesi tidak ditemukan.');
    }

    return { schoolId: row.school_id };
  });
}

/**
 * Upsert PRESENSI (set-based satu statement, pola dua langkah). `school_id`
 * dari baris sesi. Validasi bentuk via `attendanceEntriesSchema`; cek
 * kepemilikan sesi DULU untuk pesan presisi; `rowCount < entries.length` →
 * ada siswa di luar kelas sesi. Tanpa cek waktu (override admin).
 */
export async function adminSaveAttendance(
  claims: SessionClaims,
  sessionId: string,
  entries: AdminAttendanceEntry[],
): Promise<void> {
  const id = uuidSchema.parse(sessionId);
  const parsed = attendanceEntriesSchema.parse(entries);

  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const owned = await tx.query(
      `SELECT 1 FROM class_sessions WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (owned.rowCount === null || owned.rowCount === 0) {
      throw new AdminMutationError('Sesi tidak ditemukan.');
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
        WHERE sess.id = $1
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
      [id, studentIds, statuses],
    );

    if (result.rowCount === null || result.rowCount < parsed.length) {
      throw new AdminMutationError('Sebagian siswa tidak terdaftar di kelas sesi ini.');
    }
  });
}

/**
 * Hapus satu baris PRESENSI siswa (mengembalikan ke "belum ditandai" =
 * ketiadaan baris). `rowCount === 0` → presensi siswa tidak ditemukan.
 */
export async function adminDeleteAttendance(
  claims: SessionClaims,
  sessionId: string,
  studentId: string,
): Promise<void> {
  const sid = uuidSchema.parse(sessionId);
  const stId = uuidSchema.parse(studentId);

  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `DELETE FROM session_attendance WHERE session_id = $1 AND student_id = $2`,
      [sid, stId],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AdminMutationError('Presensi siswa tidak ditemukan.');
    }
  });
}

/**
 * Upsert JURNAL sesi (pada `UNIQUE (session_id)`). `notes` boleh `null`
 * (mengosongkan isi, baris tetap). `school_id` dari baris sesi. `rowCount === 0`
 * → sesi tidak ditemukan.
 */
export async function adminSaveJournal(
  claims: SessionClaims,
  sessionId: string,
  notes: string | null,
): Promise<void> {
  const id = uuidSchema.parse(sessionId);
  const parsedNotes = journalNotesSchema.parse(notes);

  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `INSERT INTO session_journals (session_id, school_id, notes)
       SELECT sess.id, sess.school_id, $2 FROM class_sessions sess WHERE sess.id = $1
       ON CONFLICT (session_id) DO UPDATE SET notes = EXCLUDED.notes, updated_at = now()`,
      [id, parsedNotes],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AdminMutationError('Sesi tidak ditemukan.');
    }
  });
}

/**
 * Hapus baris JURNAL sepenuhnya (bukan sekadar `notes = null`), menyamakan
 * kemampuan "hapus jurnal" dengan "hapus presensi". `rowCount === 0` → jurnal
 * tidak ditemukan.
 */
export async function adminDeleteJournal(
  claims: SessionClaims,
  sessionId: string,
): Promise<void> {
  const id = uuidSchema.parse(sessionId);

  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `DELETE FROM session_journals WHERE session_id = $1`,
      [id],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AdminMutationError('Jurnal tidak ditemukan.');
    }
  });
}

/**
 * Hapus satu FOTO dokumentasi (baris DB saja; objek S3 `s3_bucket`/`s3_key`
 * TIDAK dihapus — keputusan produk Fase 2). `rowCount === 0` → foto tidak
 * ditemukan.
 */
export async function adminDeletePhoto(
  claims: SessionClaims,
  photoId: string,
): Promise<void> {
  const id = uuidSchema.parse(photoId);

  await withTenantTransaction(claims, async (tx: PoolClient) => {
    const result = await tx.query(
      `DELETE FROM session_photos WHERE id = $1`,
      [id],
    );
    if (result.rowCount === null || result.rowCount === 0) {
      throw new AdminMutationError('Foto tidak ditemukan.');
    }
  });
}
