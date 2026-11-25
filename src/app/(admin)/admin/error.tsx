'use client';

import { AccessDenied } from '@/components/shared/AccessDenied';

/**
 * Error boundary rute Admin — memetakan error otorisasi dari Session_Guard ke
 * layar `X04` (Akses Ditolak).
 *
 * Session_Guard (`requireSession`) melempar `AccessDeniedError` (peran tidak
 * berhak / akses lintas sekolah — R3.12/R4.6) atau `InactiveAccountError` (Guru
 * belum aktif — R2.2). Boundary ini menangkap error tersebut dan menampilkan
 * `AccessDenied` dengan pesan error (berbahasa Indonesia). Error tak dikenal
 * tetap ditampilkan sebagai akses ditolak generik demi deny-by-default pada UI.
 *
 * Catatan: redirect ke `U01` saat tidak terautentikasi (R1.10) ditangani oleh
 * `redirect()` di guard (bukan error boundary ini).
 */
export default function AdminError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AccessDenied message={error.message} />;
}
