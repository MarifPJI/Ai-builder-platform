'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';

import { confirmSessionPhotoAction, requestSessionPhotoUploadAction } from './actions';

type FacingMode = 'environment' | 'user';

const NO_CAMERA_MSG =
  'Kamera tidak tersedia atau izin ditolak. Periksa izin kamera browser lalu coba lagi.';

/* ── Seam fungsi kecil (dapat di-mock pada unit test) ───────────────────────── */

/** Minta stream kamera dengan facingMode tertentu. */
export async function startStream(facingMode: FacingMode): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia tidak tersedia');
  }
  return navigator.mediaDevices.getUserMedia({ video: { facingMode } });
}

/** Hentikan seluruh track pada stream (lepaskan kamera). */
export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/** Gambar frame video ke canvas lalu encode JPEG (Decision 6). */
export function captureJpeg(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<Blob | null> {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
}

/** Batas berkas asli dari galeri/dokumen sebelum dikonversi. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024; // 20 MB
/** Sisi terpanjang hasil konversi (piksel). */
export const MAX_DIMENSION = 1920;

/**
 * Ubah foto dari galeri/dokumen (JPEG/PNG/WebP/HEIC bila didukung browser)
 * menjadi JPEG berukuran wajar. Backend hanya menerima `image/jpeg`, dan
 * konversi lewat canvas juga membuang metadata EXIF (mis. lokasi GPS).
 */
export async function fileToJpeg(file: File, canvas: HTMLCanvasElement): Promise<Blob | null> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let release = () => {};

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    release = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode gagal'));
      img.src = url;
    });
    source = img;
    width = img.naturalWidth;
    height = img.naturalHeight;
    release = () => URL.revokeObjectURL(url);
  }

  try {
    if (!width || !height) return null;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Latar putih agar area transparan PNG tidak menjadi hitam di JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.88);
    });
  } finally {
    release();
  }
}

/**
 * Orkestrasi unggah: presign → PUT ke S3 → confirm. Dipisah agar mockable.
 * Header `Content-Type` WAJIB 'image/jpeg' agar cocok dengan presign (Decision 6).
 */
export async function uploadCapture(
  sessionId: string,
  blob: Blob,
): Promise<{ ok: boolean; message?: string }> {
  const put = await requestSessionPhotoUploadAction(sessionId, 'image/jpeg');
  const res = await fetch(put.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) {
    return { ok: false, message: 'Gagal mengunggah foto. Coba ambil ulang.' };
  }
  const confirmed = await confirmSessionPhotoAction(sessionId, put.bucket, put.s3Key);
  return { ok: confirmed.status === 'ok', message: confirmed.message };
}

/* ── Komponen ───────────────────────────────────────────────────────────────── */

/**
 * CameraCapture (T06B, 'use client') — dua cara menambah foto dokumentasi:
 *  1. LIVE CAMERA (getUserMedia): selektor "Kamera Belakang"/"Kamera Depan",
 *     "Ambil Foto" → canvas → JPEG → presign PUT → confirm.
 *  2. "Unggah dari Galeri/Dokumen": pilih berkas gambar → dikonversi ke JPEG
 *     di browser → pratinjau → "Unggah Foto Ini" (alur unggah yang sama).
 * Stream dihentikan saat unmount & saat ganti kamera. Bila kamera tidak
 * tersedia, unggah dari galeri tetap bisa dipakai.
 */
export function CameraCapture({ sessionId }: { sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  /** Foto dari galeri yang sudah dikonversi dan menunggu konfirmasi unggah. */
  const [picked, setPicked] = useState<{ blob: Blob; previewUrl: string; name: string } | null>(
    null,
  );

  // Lepas object URL pratinjau saat diganti/unmount.
  useEffect(() => {
    if (!picked) return;
    return () => URL.revokeObjectURL(picked.previewUrl);
  }, [picked]);

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = ''; // izinkan memilih berkas yang sama lagi
    const canvas = canvasRef.current;
    if (!file || !canvas) return;

    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', message: 'Pilih berkas gambar (JPG, PNG, atau WebP).' });
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setNotice({ tone: 'error', message: 'Ukuran foto maksimal 20 MB.' });
      return;
    }

    setBusy(true);
    try {
      const blob = await fileToJpeg(file, canvas);
      if (!blob) {
        setNotice({ tone: 'error', message: 'Foto tidak dapat dibaca. Coba foto lain.' });
        return;
      }
      setPicked({ blob, previewUrl: URL.createObjectURL(blob), name: file.name });
      setNotice(null);
    } catch {
      setNotice({
        tone: 'error',
        message: 'Format foto tidak didukung browser ini. Gunakan JPG atau PNG.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onUploadPicked() {
    if (!picked) return;
    setBusy(true);
    try {
      const result = await uploadCapture(sessionId, picked.blob);
      if (result.ok) {
        setPicked(null);
        setNotice({ tone: 'success', message: result.message ?? 'Foto dokumentasi tersimpan.' });
      } else {
        setNotice({ tone: 'error', message: result.message ?? 'Gagal mengunggah foto. Coba lagi.' });
      }
    } catch {
      setNotice({ tone: 'error', message: 'Gagal mengunggah foto. Coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  const begin = useCallback(async (mode: FacingMode) => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setCameraReady(false);
    try {
      const stream = await startStream(mode);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
      setNotice(null);
    } catch {
      setCameraReady(false);
      setNotice({ tone: 'error', message: NO_CAMERA_MSG });
    }
  }, []);

  useEffect(() => {
    void begin(facingMode);
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [begin, facingMode]);

  async function onCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setBusy(true);
    try {
      const blob = await captureJpeg(video, canvas);
      if (!blob) {
        setNotice({ tone: 'error', message: 'Gagal mengambil foto. Coba lagi.' });
        return;
      }
      const result = await uploadCapture(sessionId, blob);
      setNotice(
        result.ok
          ? { tone: 'success', message: result.message ?? 'Foto dokumentasi tersimpan.' }
          : { tone: 'error', message: result.message ?? 'Gagal mengunggah foto. Coba ambil ulang.' },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHead title="Foto Dokumentasi" />
      <CardBody className="space-y-3">
        {notice ? <Toast tone={notice.tone} message={notice.message} /> : null}

        <div className="inline-flex rounded-full border border-line p-1 text-sm">
          <button
            type="button"
            aria-pressed={facingMode === 'environment'}
            onClick={() => setFacingMode('environment')}
            className={
              facingMode === 'environment'
                ? 'rounded-full bg-primary-soft px-3 py-1 font-medium text-primary'
                : 'rounded-full px-3 py-1 text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal'
            }
          >
            Kamera Belakang
          </button>
          <button
            type="button"
            aria-pressed={facingMode === 'user'}
            onClick={() => setFacingMode('user')}
            className={
              facingMode === 'user'
                ? 'rounded-full bg-primary-soft px-3 py-1 font-medium text-primary'
                : 'rounded-full px-3 py-1 text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal'
            }
          >
            Kamera Depan
          </button>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-line bg-black/5">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`aspect-video w-full bg-black object-cover ${picked ? 'invisible' : ''}`}
          />
          {picked ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picked.previewUrl}
              alt={`Pratinjau foto: ${picked.name}`}
              className="absolute inset-0 h-full w-full bg-black object-contain"
            />
          ) : null}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {picked ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={onUploadPicked}
              className="w-full rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {busy ? 'Mengunggah…' : 'Unggah Foto Ini'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPicked(null)}
              className="w-full rounded-full border border-line px-5 py-2 text-sm font-medium text-ink hover:bg-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Batal
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!cameraReady || busy}
              onClick={onCapture}
              className="w-full rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {busy ? 'Memproses…' : 'Ambil Foto'}
            </button>

            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              atau
              <span className="h-px flex-1 bg-line" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChosen}
              aria-label="Pilih foto dari galeri atau dokumen"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-full border border-primary px-5 py-2 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Unggah dari Galeri / Dokumen
            </button>
            <p className="text-center text-xs text-muted">
              JPG, PNG, atau WebP, maksimal 20 MB. Foto diperkecil otomatis sebelum diunggah.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
