'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
 * CameraCapture (T06B, 'use client') — LIVE CAMERA (getUserMedia). Selektor
 * "Kamera Belakang" (environment) / "Kamera Depan" (user) me-restart stream.
 * "Ambil Foto" → canvas → blob JPEG → presign PUT → confirm. TANPA input file /
 * galeri. Stream dihentikan saat unmount & saat ganti kamera. Pesan Indonesia
 * saat kamera tidak tersedia / izin ditolak; panel presensi tetap dapat dipakai.
 */
export function CameraCapture({ sessionId }: { sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );

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

        <div className="overflow-hidden rounded-xl border border-line bg-black/5">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-video w-full bg-black object-cover"
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <button
          type="button"
          disabled={!cameraReady || busy}
          onClick={onCapture}
          className="w-full rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {busy ? 'Mengunggah…' : 'Ambil Foto'}
        </button>
      </CardBody>
    </Card>
  );
}
