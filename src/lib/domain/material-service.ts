/**
 * `materialService` — typed domain service untuk Materi (A07/T03) pada fitur
 * course-class-publishing.
 *
 * Materi bersifat GLOBAL (lintas sekolah): RLS mengizinkan SELECT oleh admin &
 * teacher, namun hanya admin yang menulis (lihat 0008_rls_policies.sql).
 *
 * KONTRAK SESI: service menerima `claims` yang SUDAH terverifikasi; pemanggil
 * (Server Action) menjalankan `requireSession` lebih dulu. Semua query lewat
 * `withTenantTransaction` (RLS aktif), parameterized.
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.5_
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import {
  presignGet,
  presignPut,
  type PresignPutResult,
  type UploadContentType,
} from '@/lib/s3/presign';
import {
  createMaterialSchema,
  materialResourceInputSchema,
  materialResourcesSchema,
  type CreateMaterialInput,
  type MaterialFileKind,
  type MaterialResourceInput,
  type ResourceType,
} from '@/lib/validation/material';

import { normalizeCanvaEmbedUrl, normalizeVideoEmbedUrl } from './resource-url';

export interface Material {
  id: string;
  title: string;
  timeAllocation: string | null;
  summary: string | null;
  keyPoints: string | null;
  publishStatus: 'draft' | 'published';
  createdAt: Date;
}

export interface MaterialFile {
  id: string;
  materialId: string;
  kind: MaterialFileKind;
  fileName: string;
  s3Bucket: string | null;
  s3Key: string | null;
  videoUrl: string | null;
}

export interface MaterialWithFiles extends Material {
  files: MaterialFile[];
}

/* ── Sumber Materi multi-sumber (material_resources) ───────────────────── */

/** Satu sumber belajar pada Materi (Canva/Video/PDF/PPTX). */
export interface MaterialResource {
  id: string;
  materialId: string;
  resourceType: ResourceType;
  title: string;
  externalUrl: string | null;
  s3Bucket: string | null;
  s3Key: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  sortOrder: number;
}

/** Materi beserta seluruh sumbernya (urut sortOrder). */
export interface MaterialWithResources extends Material {
  resources: MaterialResource[];
}

/** Ringkasan sumber per Materi untuk daftar (A07/T03): hitung per jenis. */
export interface MaterialResourceSummary {
  total: number;
  canva: number;
  video: number;
  pdf: number;
  pptx: number;
  web: number;
}

/** Materi + ringkasan jumlah sumber (untuk kartu daftar). */
export interface MaterialWithResourceSummary extends Material {
  resourceSummary: MaterialResourceSummary;
}

export class MaterialError extends Error {}

/* ── Mutasi Materi (admin) ─────────────────────────────────────────────── */

/** Membuat Materi baru berstatus draft (R1.1, R1.2). */
export async function createMaterial(
  claims: SessionClaims,
  input: CreateMaterialInput,
): Promise<string> {
  const valid = createMaterialSchema.parse(input);
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO materials (title, time_allocation, summary, key_points, publish_status)
       VALUES ($1, $2, $3, $4, 'draft') RETURNING id`,
      [valid.title, valid.timeAllocation ?? null, valid.summary ?? null, valid.keyPoints ?? null],
    );
    const row = res.rows[0];
    if (!row) throw new MaterialError('Gagal membuat Materi.');
    return row.id;
  });
}

/** Mengubah status Materi menjadi published (R1.5). */
export async function publishMaterial(claims: SessionClaims, materialId: string): Promise<void> {
  await setPublishStatus(claims, materialId, 'published');
}

/**
 * Menghapus Materi beserta seluruh sumber/berkas/penanda-baca (cascade FK).
 * Objek S3 tidak ikut terhapus (hanya baris DB). Memerlukan policy admin DELETE
 * pada materials (migrasi 0017).
 */
export async function deleteMaterial(claims: SessionClaims, materialId: string): Promise<void> {
  await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(`DELETE FROM materials WHERE id = $1`, [materialId]);
    if (res.rowCount === 0) {
      throw new MaterialError('Materi tidak ditemukan atau tidak berwenang.');
    }
  });
}

/** Mengembalikan Materi ke draft (R2.3). */
export async function unpublishMaterial(claims: SessionClaims, materialId: string): Promise<void> {
  await setPublishStatus(claims, materialId, 'draft');
}

async function setPublishStatus(
  claims: SessionClaims,
  materialId: string,
  status: 'draft' | 'published',
): Promise<void> {
  await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `UPDATE materials SET publish_status = $2, updated_at = now() WHERE id = $1`,
      [materialId, status],
    );
    if (res.rowCount === 0) {
      throw new MaterialError('Materi tidak ditemukan atau tidak berwenang.');
    }
  });
}

/* ── Unggah berkas (admin) ─────────────────────────────────────────────── */

/**
 * Meminta Presigned PUT URL untuk unggah berkas Materi (R1.3, R1.4). Hanya
 * tipe konten pptx/pdf. `s3Key` yang dikembalikan dipakai di confirmFileUpload.
 */
export async function requestFileUpload(
  _claims: SessionClaims,
  materialId: string,
  contentType: UploadContentType,
): Promise<PresignPutResult> {
  return presignPut(contentType, `materials/${materialId}`);
}

/** Mencatat berkas terunggah ke material_files (R1.3). */
export async function confirmFileUpload(
  claims: SessionClaims,
  materialId: string,
  s3Bucket: string,
  s3Key: string,
  fileName: string,
  kind: 'pptx' | 'pdf',
): Promise<void> {
  await withTenantTransaction(claims, async (tx) => {
    await tx.query(
      `INSERT INTO material_files (material_id, kind, file_name, s3_bucket, s3_key)
       VALUES ($1, $2, $3, $4, $5)`,
      [materialId, kind, fileName, s3Bucket, s3Key],
    );
  });
}

/** Menambahkan lampiran video (URL) ke Materi (R1.4). */
export async function addVideoFile(
  claims: SessionClaims,
  materialId: string,
  videoUrl: string,
  fileName: string,
): Promise<void> {
  await withTenantTransaction(claims, async (tx) => {
    await tx.query(
      `INSERT INTO material_files (material_id, kind, file_name, video_url)
       VALUES ($1, 'video', $2, $3)`,
      [materialId, fileName, videoUrl],
    );
  });
}

/* ── Baca Materi (admin + teacher) ─────────────────────────────────────── */

/** Daftar Materi terbit (R2.1, R2.2). RLS membatasi; filter published eksplisit. */
export async function listPublished(claims: SessionClaims): Promise<Material[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT id, title, time_allocation, summary, key_points, publish_status, created_at
         FROM materials WHERE publish_status = 'published' ORDER BY created_at DESC`,
    );
    return res.rows.map(mapMaterial);
  });
}

/**
 * Daftar SELURUH Materi untuk Admin (A07) — draft + published, tanpa filter
 * publish_status. RLS `materials_read` sudah mengizinkan admin SELECT lintas
 * seluruh baris, sehingga tidak diperlukan kebijakan/grant baru. Mirror
 * `listPublished` tanpa `WHERE publish_status='published'`.
 */
export async function listAllForAdmin(claims: SessionClaims): Promise<Material[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT id, title, time_allocation, summary, key_points, publish_status, created_at
         FROM materials ORDER BY created_at DESC`,
    );
    return res.rows.map(mapMaterial);
  });
}

/**
 * Detail satu Materi + berkas untuk Admin (A07) — tanpa filter publish_status
 * sehingga Admin dapat melihat berkas yang terlampir pada draf. Mirror
 * `getPublished` tanpa filter `AND publish_status='published'`.
 */
export async function getForAdmin(
  claims: SessionClaims,
  materialId: string,
): Promise<MaterialWithFiles> {
  return withTenantTransaction(claims, async (tx) => {
    const m = await tx.query(
      `SELECT id, title, time_allocation, summary, key_points, publish_status, created_at
         FROM materials WHERE id = $1`,
      [materialId],
    );
    const row = m.rows[0];
    if (!row) throw new MaterialError('Materi tidak ditemukan.');
    const f = await tx.query(
      `SELECT id, material_id, kind, file_name, s3_bucket, s3_key, video_url
         FROM material_files WHERE material_id = $1 ORDER BY created_at ASC`,
      [materialId],
    );
    return { ...mapMaterial(row), files: f.rows.map(mapFile) };
  });
}

/** Detail Materi terbit + berkas (R3.1). Menolak jika tidak published (R3.5 dasar). */
export async function getPublished(
  claims: SessionClaims,
  materialId: string,
): Promise<MaterialWithFiles> {
  return withTenantTransaction(claims, async (tx) => {
    const m = await tx.query(
      `SELECT id, title, time_allocation, summary, key_points, publish_status, created_at
         FROM materials WHERE id = $1 AND publish_status = 'published'`,
      [materialId],
    );
    const row = m.rows[0];
    if (!row) throw new MaterialError('Materi tidak tersedia.');
    const f = await tx.query(
      `SELECT id, material_id, kind, file_name, s3_bucket, s3_key, video_url
         FROM material_files WHERE material_id = $1 ORDER BY created_at ASC`,
      [materialId],
    );
    return { ...mapMaterial(row), files: f.rows.map(mapFile) };
  });
}

/**
 * Presigned GET URL untuk unduh berkas (R3.2). Menolak jika Material tidak
 * published (R3.5) — diverifikasi via join ke materials dalam transaksi.
 */
export async function presignDownload(
  claims: SessionClaims,
  fileId: string,
): Promise<string> {
  const s3Key = await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ s3_key: string | null }>(
      `SELECT mf.s3_key
         FROM material_files mf
         JOIN materials m ON m.id = mf.material_id
        WHERE mf.id = $1 AND m.publish_status = 'published' AND mf.kind <> 'video'`,
      [fileId],
    );
    const row = res.rows[0];
    if (!row || !row.s3_key) {
      throw new MaterialError('Berkas tidak tersedia untuk diunduh.');
    }
    return row.s3_key;
  });
  return presignGet(s3Key);
}

/** Menandai Materi selesai dibaca oleh Guru (R3.3). Idempoten via UNIQUE. */
export async function markRead(claims: SessionClaims, materialId: string): Promise<void> {
  await withTenantTransaction(claims, async (tx) => {
    // profile_id diturunkan dari cognito_sub klaim (profil Guru aktif).
    await tx.query(
      `INSERT INTO material_reads (material_id, profile_id)
       SELECT $1, p.id FROM profiles p WHERE p.cognito_sub = $2
       ON CONFLICT (material_id, profile_id) DO NOTHING`,
      [materialId, claims.cognitoSub],
    );
  });
}

/* ── Sumber Materi multi-sumber (material_resources) ───────────────────── */

/**
 * Menormalkan satu input sumber: untuk canva_embed/video_link, `externalUrl`
 * di-normalisasi (Canva `?embed`, YouTube `/embed/`); untuk berkas, URL tak
 * dipakai. Mengembalikan baris siap-insert (nilai null yang sesuai).
 */
function prepareResource(input: MaterialResourceInput): {
  resourceType: ResourceType;
  title: string;
  externalUrl: string | null;
  s3Bucket: string | null;
  s3Key: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
} {
  const valid = materialResourceInputSchema.parse(input);
  let externalUrl: string | null = null;
  let s3Bucket: string | null = null;
  let s3Key: string | null = null;

  if (valid.resourceType === 'canva_embed') {
    externalUrl = normalizeCanvaEmbedUrl(valid.externalUrl ?? '');
  } else if (valid.resourceType === 'video_link') {
    externalUrl = normalizeVideoEmbedUrl(valid.externalUrl ?? '');
  } else if (valid.resourceType === 'web_link') {
    // Tautan web umum (Notion/Doc/website): dipakai apa adanya, tanpa normalisasi
    // embed. Ditampilkan sebagai kartu + buka tab baru (tanpa iframe).
    externalUrl = (valid.externalUrl ?? '').trim();
  } else {
    // pdf_file | pptx_file
    s3Bucket = valid.s3Bucket ?? null;
    s3Key = valid.s3Key ?? null;
  }

  return {
    resourceType: valid.resourceType,
    title: valid.title,
    externalUrl,
    s3Bucket,
    s3Key,
    mimeType: valid.mimeType ?? null,
    fileSizeBytes: valid.fileSizeBytes ?? null,
  };
}

/**
 * Membuat Materi baru (draft) BESERTA seluruh sumbernya dalam satu transaksi
 * (A07 "Buat & Terbitkan Materi"). `publish` menentukan status awal. Sumber
 * di-insert urut array (sort_order = indeks+1). Mengembalikan id Materi baru.
 */
export async function createMaterialWithResources(
  claims: SessionClaims,
  input: CreateMaterialInput,
  resources: MaterialResourceInput[],
  publish: boolean,
): Promise<string> {
  const validMaterial = createMaterialSchema.parse(input);
  const validResources = materialResourcesSchema.parse(resources);
  const prepared = validResources.map(prepareResource);

  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO materials (title, time_allocation, summary, key_points, publish_status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        validMaterial.title,
        validMaterial.timeAllocation ?? null,
        validMaterial.summary ?? null,
        validMaterial.keyPoints ?? null,
        publish ? 'published' : 'draft',
      ],
    );
    const row = res.rows[0];
    if (!row) throw new MaterialError('Gagal membuat Materi.');
    const materialId = row.id;

    for (let i = 0; i < prepared.length; i += 1) {
      const r = prepared[i]!;
      await tx.query(
        `INSERT INTO material_resources
           (material_id, resource_type, title, external_url, s3_bucket, s3_key, mime_type, file_size_bytes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [materialId, r.resourceType, r.title, r.externalUrl, r.s3Bucket, r.s3Key, r.mimeType, r.fileSizeBytes, i + 1],
      );
    }
    return materialId;
  });
}

/**
 * Menyinkronkan metadata Materi + MENGGANTI seluruh sumber dengan `resources`
 * yang diberikan (kelola sumber, A07 "Simpan Perubahan"). Dilakukan dalam satu
 * transaksi: update materials, hapus semua material_resources lama, insert baru
 * urut array. `publish` menyetel status.
 */
export async function updateMaterialWithResources(
  claims: SessionClaims,
  materialId: string,
  input: CreateMaterialInput,
  resources: MaterialResourceInput[],
  publish: boolean,
): Promise<void> {
  const validMaterial = createMaterialSchema.parse(input);
  const validResources = materialResourcesSchema.parse(resources);
  const prepared = validResources.map(prepareResource);

  await withTenantTransaction(claims, async (tx) => {
    const upd = await tx.query(
      `UPDATE materials
          SET title = $2, time_allocation = $3, summary = $4, key_points = $5,
              publish_status = $6, updated_at = now()
        WHERE id = $1`,
      [
        materialId,
        validMaterial.title,
        validMaterial.timeAllocation ?? null,
        validMaterial.summary ?? null,
        validMaterial.keyPoints ?? null,
        publish ? 'published' : 'draft',
      ],
    );
    if (upd.rowCount === 0) {
      throw new MaterialError('Materi tidak ditemukan atau tidak berwenang.');
    }

    await tx.query(`DELETE FROM material_resources WHERE material_id = $1`, [materialId]);

    for (let i = 0; i < prepared.length; i += 1) {
      const r = prepared[i]!;
      await tx.query(
        `INSERT INTO material_resources
           (material_id, resource_type, title, external_url, s3_bucket, s3_key, mime_type, file_size_bytes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [materialId, r.resourceType, r.title, r.externalUrl, r.s3Bucket, r.s3Key, r.mimeType, r.fileSizeBytes, i + 1],
      );
    }
  });
}

/**
 * Meminta Presigned PUT untuk unggah berkas sumber (pdf/pptx) SEBELUM Materi
 * tersimpan. Memakai prefix sementara `material-resources/staging` karena
 * material_id belum tentu ada saat Admin menyusun sumber di form.
 */
export async function requestResourceUpload(
  _claims: SessionClaims,
  contentType: UploadContentType,
): Promise<PresignPutResult> {
  return presignPut(contentType, `material-resources/staging`);
}

/** Daftar SELURUH Materi (admin) + ringkasan jumlah sumber per jenis (A07). */
export async function listAllForAdminWithSummary(
  claims: SessionClaims,
): Promise<MaterialWithResourceSummary[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT m.id, m.title, m.time_allocation, m.summary, m.key_points, m.publish_status, m.created_at,
              count(r.*) FILTER (WHERE r.resource_type = 'canva_embed') AS canva,
              count(r.*) FILTER (WHERE r.resource_type = 'video_link')  AS video,
              count(r.*) FILTER (WHERE r.resource_type = 'pdf_file')    AS pdf,
              count(r.*) FILTER (WHERE r.resource_type = 'pptx_file')   AS pptx,
              count(r.*) FILTER (WHERE r.resource_type = 'web_link')    AS web,
              count(r.*) AS total
         FROM materials m
         LEFT JOIN material_resources r ON r.material_id = m.id
        GROUP BY m.id
        ORDER BY m.created_at DESC`,
    );
    return res.rows.map(mapMaterialWithSummary);
  });
}

/** Daftar Materi TERBIT (teacher) + ringkasan jumlah sumber per jenis (T03). */
export async function listPublishedWithSummary(
  claims: SessionClaims,
): Promise<MaterialWithResourceSummary[]> {
  return withTenantTransaction(claims, async (tx) => {
    const res = await tx.query(
      `SELECT m.id, m.title, m.time_allocation, m.summary, m.key_points, m.publish_status, m.created_at,
              count(r.*) FILTER (WHERE r.resource_type = 'canva_embed') AS canva,
              count(r.*) FILTER (WHERE r.resource_type = 'video_link')  AS video,
              count(r.*) FILTER (WHERE r.resource_type = 'pdf_file')    AS pdf,
              count(r.*) FILTER (WHERE r.resource_type = 'pptx_file')   AS pptx,
              count(r.*) FILTER (WHERE r.resource_type = 'web_link')    AS web,
              count(r.*) AS total
         FROM materials m
         LEFT JOIN material_resources r ON r.material_id = m.id
        WHERE m.publish_status = 'published'
        GROUP BY m.id
        ORDER BY m.created_at DESC`,
    );
    return res.rows.map(mapMaterialWithSummary);
  });
}

/** Detail Materi + sumber untuk Admin (apa pun status) — kelola sumber. */
export async function getWithResourcesForAdmin(
  claims: SessionClaims,
  materialId: string,
): Promise<MaterialWithResources> {
  return withTenantTransaction(claims, async (tx) => {
    const m = await tx.query(
      `SELECT id, title, time_allocation, summary, key_points, publish_status, created_at
         FROM materials WHERE id = $1`,
      [materialId],
    );
    const row = m.rows[0];
    if (!row) throw new MaterialError('Materi tidak ditemukan.');
    const r = await tx.query(
      `SELECT id, material_id, resource_type, title, external_url, s3_bucket, s3_key, mime_type, file_size_bytes, sort_order
         FROM material_resources WHERE material_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [materialId],
    );
    return { ...mapMaterial(row), resources: r.rows.map(mapResource) };
  });
}

/** Detail Materi TERBIT + sumber untuk Guru (T03). Menolak bila belum terbit. */
export async function getWithResourcesPublished(
  claims: SessionClaims,
  materialId: string,
): Promise<MaterialWithResources> {
  return withTenantTransaction(claims, async (tx) => {
    const m = await tx.query(
      `SELECT id, title, time_allocation, summary, key_points, publish_status, created_at
         FROM materials WHERE id = $1 AND publish_status = 'published'`,
      [materialId],
    );
    const row = m.rows[0];
    if (!row) throw new MaterialError('Materi tidak tersedia.');
    const r = await tx.query(
      `SELECT id, material_id, resource_type, title, external_url, s3_bucket, s3_key, mime_type, file_size_bytes, sort_order
         FROM material_resources WHERE material_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [materialId],
    );
    return { ...mapMaterial(row), resources: r.rows.map(mapResource) };
  });
}

/**
 * Presigned GET untuk sebuah sumber berkas (pdf/pptx) Materi TERBIT (T03).
 * Menolak bila sumber bukan berkas, Materi belum terbit, atau s3_key kosong.
 */
export async function presignResourceDownload(
  claims: SessionClaims,
  resourceId: string,
): Promise<string> {
  const s3Key = await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ s3_key: string | null }>(
      `SELECT r.s3_key
         FROM material_resources r
         JOIN materials m ON m.id = r.material_id
        WHERE r.id = $1
          AND m.publish_status = 'published'
          AND r.resource_type IN ('pdf_file', 'pptx_file')`,
      [resourceId],
    );
    const row = res.rows[0];
    if (!row || !row.s3_key) {
      throw new MaterialError('Berkas tidak tersedia untuk diunduh.');
    }
    return row.s3_key;
  });
  return presignGet(s3Key);
}

/** Presigned GET untuk sumber berkas milik Admin (apa pun status) — pratinjau. */
export async function presignResourceForAdmin(
  claims: SessionClaims,
  resourceId: string,
): Promise<string> {
  const s3Key = await withTenantTransaction(claims, async (tx) => {
    const res = await tx.query<{ s3_key: string | null }>(
      `SELECT s3_key FROM material_resources
        WHERE id = $1 AND resource_type IN ('pdf_file', 'pptx_file')`,
      [resourceId],
    );
    const row = res.rows[0];
    if (!row || !row.s3_key) {
      throw new MaterialError('Berkas tidak tersedia.');
    }
    return row.s3_key;
  });
  return presignGet(s3Key);
}

/* ── Mapper ────────────────────────────────────────────────────────────── */

function mapMaterial(r: Record<string, unknown>): Material {
  return {
    id: r.id as string,
    title: r.title as string,
    timeAllocation: (r.time_allocation as string | null) ?? null,
    summary: (r.summary as string | null) ?? null,
    keyPoints: (r.key_points as string | null) ?? null,
    publishStatus: r.publish_status as 'draft' | 'published',
    createdAt: r.created_at as Date,
  };
}

function mapFile(r: Record<string, unknown>): MaterialFile {
  return {
    id: r.id as string,
    materialId: r.material_id as string,
    kind: r.kind as MaterialFileKind,
    fileName: r.file_name as string,
    s3Bucket: (r.s3_bucket as string | null) ?? null,
    s3Key: (r.s3_key as string | null) ?? null,
    videoUrl: (r.video_url as string | null) ?? null,
  };
}

function mapResource(r: Record<string, unknown>): MaterialResource {
  return {
    id: r.id as string,
    materialId: r.material_id as string,
    resourceType: r.resource_type as ResourceType,
    title: r.title as string,
    externalUrl: (r.external_url as string | null) ?? null,
    s3Bucket: (r.s3_bucket as string | null) ?? null,
    s3Key: (r.s3_key as string | null) ?? null,
    mimeType: (r.mime_type as string | null) ?? null,
    fileSizeBytes: r.file_size_bytes == null ? null : Number(r.file_size_bytes),
    sortOrder: Number(r.sort_order ?? 1),
  };
}

function mapMaterialWithSummary(r: Record<string, unknown>): MaterialWithResourceSummary {
  return {
    ...mapMaterial(r),
    resourceSummary: {
      total: Number(r.total ?? 0),
      canva: Number(r.canva ?? 0),
      video: Number(r.video ?? 0),
      pdf: Number(r.pdf ?? 0),
      pptx: Number(r.pptx ?? 0),
      web: Number(r.web ?? 0),
    },
  };
}
