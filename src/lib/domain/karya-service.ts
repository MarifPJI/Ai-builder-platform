/**
 * `karyaService` — Showcase Karya yang DITERBITKAN Admin (public-showcase revisi).
 *
 * Berbeda dari `showcase_projects` (kotak masuk kiriman siswa): `showcase_karya`
 * adalah konten yang diterbitkan Admin dan TAMPIL PUBLIK di Bagian "Showcase
 * Karya", dengan halaman detail `/showcase/[id]`.
 *
 * Jalur PUBLIK (baca) via `withPublicTransaction`; jalur ADMIN (tulis) via
 * `withTenantTransaction` dengan klaim admin. Gambar (Phase 2) via S3 publik;
 * untuk Phase 1 field gambar opsional/null.
 *
 * _Requirements: public-showcase R2 (revisi), R5_
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';
import { withPublicTransaction } from '@/lib/db/public-transaction';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';

export interface Karya {
  id: string;
  type: 'student' | 'teacher';
  title: string;
  category: string;
  schoolName: string;
  mentor: string | null;
  demoUrl: string | null;
  summary: string;
  detail: string | null;
  imageUrl: string | null;
  published: boolean;
  createdAt: Date;
}

export interface CreateKaryaInput {
  type: 'student' | 'teacher';
  title: string;
  category: string;
  schoolName: string;
  mentor?: string;
  demoUrl?: string;
  summary: string;
  detail?: string;
  imageBucket?: string;
  imageKey?: string;
  imageUrl?: string;
}

export class KaryaError extends Error {}

function mapRow(r: Record<string, unknown>): Karya {
  return {
    id: r.id as string,
    type: r.type as 'student' | 'teacher',
    title: r.title as string,
    category: r.category as string,
    schoolName: r.school_name as string,
    mentor: (r.mentor as string | null) ?? null,
    demoUrl: (r.demo_url as string | null) ?? null,
    summary: r.summary as string,
    detail: (r.detail as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    published: r.published as boolean,
    createdAt: r.created_at as Date,
  };
}

const COLS = `id, type, title, category, school_name, mentor, demo_url, summary,
              detail, image_url, published, created_at`;

/** PUBLIK: daftar Karya terbit dengan filter tipe (Bagian Showcase publik). */
export async function listPublishedKarya(
  filter: 'all' | 'student' | 'teacher' = 'all',
): Promise<Karya[]> {
  return withPublicTransaction(async (tx) => {
    const params: string[] = [];
    let where = `published = true`;
    if (filter === 'student' || filter === 'teacher') {
      params.push(filter);
      where += ` AND type = $1`;
    }
    const res = await tx.query(
      `SELECT ${COLS} FROM showcase_karya WHERE ${where} ORDER BY created_at DESC`,
      params,
    );
    return res.rows.map(mapRow);
  });
}

/** PUBLIK: detail satu Karya terbit (halaman `/showcase/[id]`). */
export async function getPublishedKarya(id: string): Promise<Karya | null> {
  return withPublicTransaction(async (tx) => {
    const res = await tx.query(
      `SELECT ${COLS} FROM showcase_karya WHERE id = $1 AND published = true`,
      [id],
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  });
}

/** ADMIN: daftar semua Karya (termasuk belum terbit) untuk kelola. */
export async function listKaryaForAdmin(claims: SessionClaims): Promise<Karya[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT ${COLS} FROM showcase_karya ORDER BY created_at DESC`,
    );
    return res.rows.map(mapRow);
  });
}

/** ADMIN: terbitkan Karya baru. */
export async function createKarya(
  claims: SessionClaims,
  input: CreateKaryaInput,
): Promise<string> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO showcase_karya
         (type, title, category, school_name, mentor, demo_url, summary, detail,
          image_bucket, image_key, image_url, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, true)
       RETURNING id`,
      [
        input.type,
        input.title,
        input.category,
        input.schoolName,
        input.mentor ?? null,
        input.demoUrl ?? null,
        input.summary,
        input.detail ?? null,
        input.imageBucket ?? null,
        input.imageKey ?? null,
        input.imageUrl ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new KaryaError('Gagal menerbitkan karya.');
    return row.id;
  });
}

/**
 * ADMIN (Option A): promosikan satu kiriman publik (`showcase_projects`) yang
 * sudah berstatus 'approved' menjadi Karya terbit (`showcase_karya`,
 * published=true) tanpa mengetik ulang. Menyalin type/title/category/school/
 * mentor/demo_url/summary; detail dan gambar dikosongkan (bisa dilengkapi Admin
 * kemudian). Satu transaksi admin: baca kiriman + insert karya.
 *
 * Guard: hanya kiriman 'approved' yang boleh dipromosikan. Mencegah promosi
 * ganda sederhana: jika sudah ada karya dengan judul + sekolah identik, tolak.
 */
export async function promoteSubmissionToKarya(
  claims: SessionClaims,
  submissionId: string,
): Promise<string> {
  return withTenantTransaction(claims, async (tx) => {
    const sub = await tx.query<{
      type: 'student' | 'teacher';
      title: string;
      category: string;
      school_name: string;
      mentor: string | null;
      demo_url: string | null;
      summary: string;
      status: string;
    }>(
      `SELECT type, title, category, school_name, mentor, demo_url, summary, status
         FROM showcase_projects WHERE id = $1`,
      [submissionId],
    );
    const row = sub.rows[0];
    if (!row) {
      throw new KaryaError('Kiriman tidak ditemukan.');
    }
    if (row.status !== 'approved') {
      throw new KaryaError(
        'Hanya kiriman berstatus Disetujui yang dapat diterbitkan ke Showcase.',
      );
    }

    // Cegah promosi ganda yang mudah terdeteksi (judul + sekolah identik).
    const dup = await tx.query<{ id: string }>(
      `SELECT id FROM showcase_karya
        WHERE title = $1 AND school_name = $2 LIMIT 1`,
      [row.title, row.school_name],
    );
    if (dup.rows[0]) {
      throw new KaryaError('Karya ini sudah pernah diterbitkan ke Showcase.');
    }

    const res = await tx.query<{ id: string }>(
      `INSERT INTO showcase_karya
         (type, title, category, school_name, mentor, demo_url, summary, detail,
          image_bucket, image_key, image_url, published)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NULL, NULL, NULL, NULL, true)
       RETURNING id`,
      [
        row.type,
        row.title,
        row.category,
        row.school_name,
        row.mentor,
        row.demo_url,
        row.summary,
      ],
    );
    const created = res.rows[0];
    if (!created) throw new KaryaError('Gagal menerbitkan karya.');
    return created.id;
  });
}

/** ADMIN: ubah status terbit (sembunyikan/tampilkan). */
export async function setKaryaPublished(
  claims: SessionClaims,
  id: string,
  published: boolean,
): Promise<void> {
  await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `UPDATE showcase_karya SET published = $2, updated_at = now() WHERE id = $1`,
      [id, published],
    );
    if (res.rowCount === 0) throw new KaryaError('Karya tidak ditemukan.');
  });
}
