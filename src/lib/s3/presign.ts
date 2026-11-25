/**
 * Helper Presigned URL untuk Supabase Storage via endpoint S3-compatible
 * (HANYA sisi server).
 *
 * Dipakai untuk berkas Materi (unggah Admin, unduh Guru), foto sesi, dan gambar
 * publik Galeri/Showcase: byte berkas mengalir LANGSUNG antara browser dan
 * Supabase Storage memakai URL berbatas waktu, tidak melewati fungsi Vercel
 * (yang punya batas ukuran body).
 *
 * Keamanan:
 * - `import 'server-only'` mencegah modul ini ter-bundle ke Client Component.
 * - Kunci S3 Supabase (Dashboard > Storage > S3 Connection) hanya dibaca dari
 *   env server. Nama env sengaja TIDAK berawalan `AWS_` karena Vercel
 *   mencadangkan prefiks itu.
 * - Bucket privat TIDAK public; akses hanya via presigned URL ≤ 300 detik.
 * - Bucket publik harus dibuat sebagai "Public bucket" di Supabase.
 *
 * Env:
 *   SUPABASE_URL                     https://<ref>.supabase.co
 *   SUPABASE_S3_ACCESS_KEY_ID        kunci akses S3 Supabase
 *   SUPABASE_S3_SECRET_ACCESS_KEY    rahasia kunci akses S3 Supabase
 *   SUPABASE_S3_REGION               region project (mis. ap-southeast-1)
 *   SUPABASE_S3_ENDPOINT             (opsional) default `${SUPABASE_URL}/storage/v1/s3`
 *   S3_PRIVATE_BUCKET / S3_PUBLIC_BUCKET   nama bucket
 *   S3_PUBLIC_BASE_URL               (opsional) basis URL publik
 *
 * _Requirements: 1.3, 3.2, 8.4_
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Region default bila `SUPABASE_S3_REGION` tidak disetel. */
const DEFAULT_REGION = 'ap-southeast-1' as const;

/** Masa berlaku presigned URL — maksimum 300 detik (R1.3, R3.2). */
export const PRESIGN_EXPIRES_SEC = 300 as const;

/** Bucket privat berkas Materi & foto sesi. */
export const PRIVATE_BUCKET =
  process.env.S3_PRIVATE_BUCKET?.trim() || 'private-assets';

/**
 * Bucket PUBLIK untuk aset halaman publik (Galeri & Showcase). Objek dapat
 * dibaca publik sehingga `image_url` yang disimpan bersifat permanen.
 */
export const PUBLIC_BUCKET =
  process.env.S3_PUBLIC_BUCKET?.trim() || 'public-showcase';
/** Tipe konten berkas Materi yang diizinkan diunggah (R1.4). */
export const ALLOWED_UPLOAD_CONTENT_TYPES = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export type UploadContentType =
  (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[keyof typeof ALLOWED_UPLOAD_CONTENT_TYPES];

/**
 * Tipe konten foto dokumentasi sesi (T06B). Satu nilai literal `image/jpeg`
 * (Decision 6): jalur tangkap kamera hanya meng-encode JPEG, sehingga format
 * lain (mis. PNG) tak terjangkau dan tidak dimodelkan sebagai union.
 */
export type ImageContentType = 'image/jpeg';

/**
 * Tipe konten gambar publik (Galeri/Showcase). Lebih luas dari `ImageContentType`
 * (yang khusus tangkap kamera JPEG): Admin mengunggah berkas foto dari perangkat,
 * jadi JPEG/PNG/WebP diizinkan.
 */
export const ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

export type PublicImageContentType =
  (typeof ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES)[keyof typeof ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES];

/**
 * Hasil presign PUT: URL unggah + `s3Key` yang HARUS dicatat ke basis data saat
 * unggah dikonfirmasi (confirmFileUpload).
 */
export interface PresignPutResult {
  url: string;
  bucket: string;
  s3Key: string;
  expiresInSec: number;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} belum tersetel (konfigurasi Supabase Storage).`);
  }
  return value;
}

function resolveRegion(): string {
  return process.env.SUPABASE_S3_REGION?.trim() || DEFAULT_REGION;
}

function resolveEndpoint(): string {
  const explicit = process.env.SUPABASE_S3_ENDPOINT?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }
  return `${requireEnv('SUPABASE_URL').replace(/\/+$/, '')}/storage/v1/s3`;
}

/**
 * Singleton klien S3 (lazy) pada globalThis untuk menghindari pembuatan berulang
 * akibat HMR. Mengarah ke endpoint S3-compatible Supabase dengan path-style.
 */
const globalForS3 = globalThis as typeof globalThis & {
  __identityS3Client__?: S3Client;
};

function getS3Client(): S3Client {
  if (!globalForS3.__identityS3Client__) {
    globalForS3.__identityS3Client__ = new S3Client({
      region: resolveRegion(),
      endpoint: resolveEndpoint(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: requireEnv('SUPABASE_S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('SUPABASE_S3_SECRET_ACCESS_KEY'),
      },
    });
  }
  return globalForS3.__identityS3Client__;
}
/**
 * Membuat `s3Key` unik & aman untuk objek Materi. `keyPrefix` mis. `materials/<id>`.
 * Nama berkas tidak dipakai langsung sebagai key (hindari path traversal / tabrakan);
 * disimpan terpisah sebagai metadata pada basis data.
 */
function buildKey(keyPrefix: string, ext: string): string {
  const safePrefix = keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');
  return `${safePrefix}/${randomUUID()}.${ext}`;
}

/**
 * Menerbitkan Presigned PUT URL untuk mengunggah berkas Materi ke bucket privat.
 * Hanya menerima tipe konten yang diizinkan (R1.4). Mengembalikan `s3Key` untuk
 * dicatat ke basis data setelah unggah dikonfirmasi (R1.3).
 */
export async function presignPut(
  contentType: UploadContentType,
  keyPrefix: string,
): Promise<PresignPutResult> {
  const ext = contentType === ALLOWED_UPLOAD_CONTENT_TYPES.pdf ? 'pdf' : 'pptx';
  const s3Key = buildKey(keyPrefix, ext);

  const command = new PutObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  });

  return {
    url,
    bucket: PRIVATE_BUCKET,
    s3Key,
    expiresInSec: PRESIGN_EXPIRES_SEC,
  };
}

/**
 * Menerbitkan Presigned PUT URL untuk mengunggah foto dokumentasi sesi (T06B)
 * ke bucket privat. Hanya menerima tipe konten gambar `image/jpeg`
 * (Decision 6) dan selalu memakai ekstensi `jpg`. Mengembalikan `s3Key` untuk
 * dicatat ke basis data setelah unggah dikonfirmasi (confirmSessionPhoto).
 *
 * Menggunakan kembali `buildKey`/`getS3Client`/`PRIVATE_BUCKET`/
 * `PRESIGN_EXPIRES_SEC` yang sama dengan unggah Materi; `ContentType` presign
 * disetel ke `contentType` sehingga header PUT klien WAJIB cocok persis.
 */
export async function presignPutImage(
  contentType: ImageContentType,
  keyPrefix: string,
): Promise<PresignPutResult> {
  const s3Key = buildKey(keyPrefix, 'jpg');

  const command = new PutObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  });

  return {
    url,
    bucket: PRIVATE_BUCKET,
    s3Key,
    expiresInSec: PRESIGN_EXPIRES_SEC,
  };
}

/**
 * Membangun URL publik permanen untuk objek di bucket publik. Bila
 * `S3_PUBLIC_BASE_URL` di-set (mis. CDN/domain kustom), URL dibangun dari
 * basis itu; jika tidak, memakai URL publik Supabase Storage:
 * `${SUPABASE_URL}/storage/v1/object/public/<bucket>/<key>`.
 */
export function publicObjectUrl(bucket: string, s3Key: string): string {
  const base = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (base) {
    return `${base.replace(/\/+$/, '')}/${s3Key}`;
  }
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${s3Key}`;
}
/**
 * Menerbitkan Presigned PUT URL untuk mengunggah gambar PUBLIK (Galeri/Showcase)
 * ke `PUBLIC_BUCKET`. Menerima JPEG/PNG/WebP. Mengembalikan `s3Key` + `bucket`
 * untuk dicatat ke basis data; gunakan `publicObjectUrl` untuk `image_url`.
 *
 * Catatan: bucket publik Supabase membuat objek dapat dibaca publik; header PUT
 * TIDAK menyetel ACL.
 */
export async function presignPutPublicImage(
  contentType: PublicImageContentType,
  keyPrefix: string,
): Promise<PresignPutResult> {
  const ext =
    contentType === ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES.png
      ? 'png'
      : contentType === ALLOWED_PUBLIC_IMAGE_CONTENT_TYPES.webp
        ? 'webp'
        : 'jpg';
  const s3Key = buildKey(keyPrefix, ext);

  const command = new PutObjectCommand({
    Bucket: PUBLIC_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  });

  return {
    url,
    bucket: PUBLIC_BUCKET,
    s3Key,
    expiresInSec: PRESIGN_EXPIRES_SEC,
  };
}

/**
 * Menghapus objek dari sebuah bucket (best-effort). Dipakai untuk membersihkan
 * foto Galeri/Showcase di `PUBLIC_BUCKET` saat item dihapus atau fotonya diganti,
 * agar tidak menumpuk objek yatim. Pemanggil sebaiknya menanganinya non-fatal:
 * kegagalan hapus S3 tidak boleh membatalkan operasi basis data.
 */
export async function deleteObject(bucket: string, s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: s3Key });
  await getS3Client().send(command);
}

/**
 * Menerbitkan Presigned GET URL untuk mengunduh berkas Materi (R3.2). Pemanggil
 * (materialService) WAJIB memastikan Material berstatus `published` sebelum
 * memanggil ini (R3.5).
 */
export async function presignGet(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: s3Key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_EXPIRES_SEC,
  });
}
