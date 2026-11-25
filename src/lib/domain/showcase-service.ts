/**
 * `showcaseService` — Showcase Proyek publik + moderasi admin (public-showcase).
 *
 * Jalur PUBLIK (tanpa login) memakai `withPublicTransaction` (role 'public'):
 *  - `listApproved` membaca hanya baris approved (RLS).
 *  - `submitProject` menyisipkan baris 'pending' (RLS WITH CHECK).
 * Jalur ADMIN memakai `withTenantTransaction` dengan klaim admin:
 *  - `listPendingForAdmin` membaca semua status; `moderate` meng-UPDATE status.
 *
 * _Requirements: 2.1, 2.2, 2.4, 4.2, 4.4, 5.1, 5.2, 5.3_
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';
import { withPublicTransaction } from '@/lib/db/public-transaction';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import {
  submitProjectSchema,
  type ShowcaseType,
  type SubmitProjectInput,
} from '@/lib/validation/showcase';

export interface ShowcaseProject {
  id: string;
  type: ShowcaseType;
  title: string;
  category: string;
  schoolName: string;
  mentor: string | null;
  demoUrl: string | null;
  summary: string;
  submitterName: string | null;
  imageUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export type ShowcaseFilter = 'all' | 'student' | 'teacher';

export class ShowcaseError extends Error {}

function mapRow(r: Record<string, unknown>): ShowcaseProject {
  return {
    id: r.id as string,
    type: r.type as ShowcaseType,
    title: r.title as string,
    category: r.category as string,
    schoolName: r.school_name as string,
    mentor: (r.mentor as string | null) ?? null,
    demoUrl: (r.demo_url as string | null) ?? null,
    summary: r.summary as string,
    submitterName: (r.submitter_name as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    status: r.status as ShowcaseProject['status'],
    createdAt: r.created_at as Date,
  };
}

/** PUBLIK: daftar karya approved dengan filter tipe (R2.1, R2.2, R2.4). */
export async function listApproved(
  filter: ShowcaseFilter = 'all',
): Promise<ShowcaseProject[]> {
  return withPublicTransaction(async (tx) => {
    // RLS sudah membatasi ke approved; filter tipe opsional.
    const params: string[] = [];
    let where = `status = 'approved'`;
    if (filter === 'student' || filter === 'teacher') {
      params.push(filter);
      where += ` AND type = $1`;
    }
    const res = await tx.query(
      `SELECT id, type, title, category, school_name, mentor, demo_url, summary,
              submitter_name, image_url, status, created_at
         FROM showcase_projects
        WHERE ${where}
        ORDER BY created_at DESC`,
      params,
    );
    return res.rows.map(mapRow);
  });
}

/** PUBLIK: kirim proyek (R4.2). Selalu tersimpan status 'pending'. */
export async function submitProject(input: SubmitProjectInput): Promise<void> {
  const valid = submitProjectSchema.parse(input);
  await withPublicTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO showcase_projects
         (type, title, category, school_name, mentor, demo_url, summary,
          submitter_name, status)
       VALUES ('student', $1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [
        valid.title,
        valid.category,
        valid.schoolName,
        valid.mentor ?? null,
        valid.demoUrl && valid.demoUrl.length > 0 ? valid.demoUrl : null,
        valid.summary,
        valid.name,
      ],
    );
  });
}

/** ADMIN: daftar kiriman untuk moderasi (R5.1). Semua status terlihat admin. */
export async function listForAdmin(
  claims: SessionClaims,
  status?: 'pending' | 'approved' | 'rejected',
): Promise<ShowcaseProject[]> {
  return withTenantTransaction(claims, async (tx) => {
    const params: string[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }
    const res = await tx.query(
      `SELECT id, type, title, category, school_name, mentor, demo_url, summary,
              submitter_name, image_url, status, created_at
         FROM showcase_projects ${where}
        ORDER BY created_at DESC`,
      params,
    );
    return res.rows.map(mapRow);
  });
}

/** ADMIN: setujui/tolak kiriman (R5.2, R5.3). Hanya admin (RLS update). */
export async function moderate(
  claims: SessionClaims,
  id: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `UPDATE showcase_projects SET status = $2 WHERE id = $1`,
      [id, decision],
    );
    if (res.rowCount === 0) {
      throw new ShowcaseError('Kiriman tidak ditemukan atau tidak berwenang.');
    }
  });
}
