/**
 * `galleryService` — Galeri Kegiatan STEM 2024–2026 publik (public-showcase R3).
 * Baca publik via `withPublicTransaction` (RLS gallery_public_read = true).
 *
 * _Requirements: 3.1, 3.2_
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';
import { withPublicTransaction } from '@/lib/db/public-transaction';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import {
  deleteObject,
  presignPutPublicImage,
  type PresignPutResult,
  type PublicImageContentType,
} from '@/lib/s3/presign';

export interface GalleryItem {
  id: string;
  year: number;
  title: string;
  caption: string | null;
  imageUrl: string | null;
  createdAt: Date;
}

/** Daftar item galeri; filter tahun opsional (R3.1, R3.2). */
export async function listGallery(year?: number): Promise<GalleryItem[]> {
  return withPublicTransaction(async (tx) => {
    const params: number[] = [];
    let where = '';
    if (year && Number.isInteger(year)) {
      params.push(year);
      where = `WHERE year = $1`;
    }
    const res = await tx.query(
      `SELECT id, year, title, caption, image_url, created_at
         FROM stem_gallery_items ${where}
        ORDER BY year DESC, created_at DESC`,
      params,
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      year: r.year as number,
      title: r.title as string,
      caption: (r.caption as string | null) ?? null,
      imageUrl: (r.image_url as string | null) ?? null,
      createdAt: r.created_at as Date,
    }));
  });
}

/* ── Admin: kelola Galeri (public-showcase revisi) ─────────────────────────
 * Admin menerbitkan item galeri (tahun, judul, caption, gambar). Tulis admin
 * via withTenantTransaction (RLS gallery_admin_insert/update). Phase 1: gambar
 * opsional; Phase 2 menambahkan unggah foto ke S3 publik.
 */

export interface CreateGalleryInput {
  year: number;
  title: string;
  caption?: string;
  imageBucket?: string;
  imageKey?: string;
  imageUrl?: string;
}

export class GalleryError extends Error {}

/** ADMIN: daftar seluruh item galeri untuk kelola. */
export async function listGalleryForAdmin(
  claims: SessionClaims,
): Promise<GalleryItem[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT id, year, title, caption, image_url, created_at
         FROM stem_gallery_items ORDER BY year DESC, created_at DESC`,
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      year: r.year as number,
      title: r.title as string,
      caption: (r.caption as string | null) ?? null,
      imageUrl: (r.image_url as string | null) ?? null,
      createdAt: r.created_at as Date,
    }));
  });
}

/**
 * ADMIN: minta Presigned PUT URL untuk unggah foto Galeri ke bucket PUBLIK.
 * Dipanggil dari Server Action setelah requireSession admin. Klien lalu PUT byte
 * langsung ke S3, dan URL publik (`publicObjectUrl(bucket, s3Key)`) + bucket/key
 * dikirim bersama form createGaleriAction.
 */
export async function requestGalleryImageUpload(
  claims: SessionClaims,
  contentType: PublicImageContentType,
): Promise<PresignPutResult> {
  void claims; // divalidasi di Server Action (requireSession admin) sebelum dipanggil.
  return presignPutPublicImage(contentType, 'gallery');
}

/** ADMIN: terbitkan item galeri baru. */
export async function createGalleryItem(
  claims: SessionClaims,
  input: CreateGalleryInput,
): Promise<string> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO stem_gallery_items
         (year, title, caption, image_bucket, image_key, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        input.year,
        input.title,
        input.caption ?? null,
        input.imageBucket ?? null,
        input.imageKey ?? null,
        input.imageUrl ?? null,
      ],
    );
    const row = res.rows[0];
    if (!row) throw new GalleryError('Gagal menerbitkan item galeri.');
    return row.id;
  });
}

/**
 * Aksi foto saat mengubah item:
 * - 'keep'    : pertahankan foto lama (abaikan field image*).
 * - 'replace' : pakai foto baru (image* wajib) & hapus objek lama di S3.
 * - 'remove'  : kosongkan foto & hapus objek lama di S3.
 */
export type GalleryImageAction = 'keep' | 'replace' | 'remove';

/** Referensi objek S3 yatim untuk dibersihkan best-effort setelah commit. */
type Orphan = { bucket: string; key: string };

export interface UpdateGalleryInput {
  year: number;
  title: string;
  caption?: string;
  imageAction: GalleryImageAction;
  // Diisi hanya bila imageAction === 'replace'.
  imageBucket?: string;
  imageKey?: string;
  imageUrl?: string;
}

/**
 * ADMIN: ubah item galeri. Mengubah year/title/caption, dan opsional foto sesuai
 * `imageAction`. Objek S3 lama dibersihkan best-effort SETELAH commit DB berhasil
 * (kegagalan hapus S3 tidak membatalkan perubahan). RLS membatasi ke admin.
 */
export async function updateGalleryItem(
  claims: SessionClaims,
  id: string,
  input: UpdateGalleryInput,
): Promise<void> {
  // Objek S3 lama yang perlu dibersihkan setelah commit (replace/remove).
  // Dikembalikan dari transaksi agar TS mempertahankan tipenya dengan benar.
  const orphan = await withTenantTransaction<Orphan | null>(claims, async (tx) => {
    const current = await tx.query<{ image_bucket: string | null; image_key: string | null }>(
      `SELECT image_bucket, image_key FROM stem_gallery_items WHERE id = $1`,
      [id],
    );
    const existing = current.rows[0];
    if (!existing) throw new GalleryError('Item galeri tidak ditemukan.');

    if (input.imageAction === 'keep') {
      await tx.query(
        `UPDATE stem_gallery_items SET year = $2, title = $3, caption = $4 WHERE id = $1`,
        [id, input.year, input.title, input.caption ?? null],
      );
      return null;
    }

    if (input.imageAction === 'remove') {
      await tx.query(
        `UPDATE stem_gallery_items
            SET year = $2, title = $3, caption = $4,
                image_bucket = NULL, image_key = NULL, image_url = NULL
          WHERE id = $1`,
        [id, input.year, input.title, input.caption ?? null],
      );
      return existing.image_bucket && existing.image_key
        ? { bucket: existing.image_bucket, key: existing.image_key }
        : null;
    }

    // replace
    if (!input.imageUrl) {
      throw new GalleryError('Foto baru belum lengkap.');
    }
    await tx.query(
      `UPDATE stem_gallery_items
          SET year = $2, title = $3, caption = $4,
              image_bucket = $5, image_key = $6, image_url = $7
        WHERE id = $1`,
      [
        id,
        input.year,
        input.title,
        input.caption ?? null,
        input.imageBucket ?? null,
        input.imageKey ?? null,
        input.imageUrl,
      ],
    );
    // Hanya bersihkan objek lama bila key-nya berbeda dari yang baru.
    return existing.image_bucket &&
      existing.image_key &&
      existing.image_key !== input.imageKey
      ? { bucket: existing.image_bucket, key: existing.image_key }
      : null;
  });

  // Best-effort: hapus objek S3 lama di luar transaksi DB.
  if (orphan) {
    try {
      await deleteObject(orphan.bucket, orphan.key);
    } catch {
      // Diabaikan: objek yatim tidak fatal; perubahan DB tetap berhasil.
    }
  }
}

/**
 * ADMIN: hapus item galeri. Menghapus baris DB lalu (best-effort) objek foto di
 * S3. RLS membatasi ke admin. Kegagalan hapus S3 tidak membatalkan hapus DB.
 */
export async function deleteGalleryItem(
  claims: SessionClaims,
  id: string,
): Promise<void> {
  const orphan = await withTenantTransaction<Orphan | null>(claims, async (tx) => {
    const res = await tx.query<{ image_bucket: string | null; image_key: string | null }>(
      `DELETE FROM stem_gallery_items WHERE id = $1
         RETURNING image_bucket, image_key`,
      [id],
    );
    const row = res.rows[0];
    if (!row) throw new GalleryError('Item galeri tidak ditemukan.');
    return row.image_bucket && row.image_key
      ? { bucket: row.image_bucket, key: row.image_key }
      : null;
  });

  if (orphan) {
    try {
      await deleteObject(orphan.bucket, orphan.key);
    } catch {
      // Diabaikan: objek yatim tidak fatal.
    }
  }
}
