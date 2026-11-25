'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/guard';
import {
  getTeacherAccountService,
  type ActivationResult,
  type ImportSummary,
} from '@/lib/domain/teacher-account-service';

/** Path layar `A03` yang di-revalidate agar daftar Guru selalu mutakhir. */
const TEACHERS_PATH = '/admin/teachers' as const;

/**
 * Server Actions layar `A03` — Kelola & Aktivasi Akun Guru (identity-tenancy).
 *
 * OTORISASI (R3.1, R3.12, R3.13): SETIAP aksi diawali
 * `requireSession({ requireRole: 'admin' })`. Non-admin → `AccessDeniedError`
 * → `X04` (via error boundary rute admin). Karena aktivasi/pembuatan hanya ada
 * di sini (bukan di `U01`), aturan "tolak dari U01" (R3.13) terpenuhi secara
 * struktural: `U01` tidak pernah memanggil aksi ini.
 *
 * Verifikasi identitas/peran dilakukan di server pada setiap entry point
 * (UI hiding bukan authorization). Pesan hasil berbahasa Indonesia.
 */

export interface CreateTeacherFormState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
  /** Sandi sementara (tampil sekali ke Admin; tidak disimpan). */
  temporaryPassword?: string;
  /** Email akun yang baru dibuat (untuk ditampilkan bersama sandi). */
  email?: string;
}

/** Aksi: buat akun Guru dengan sandi sementara (R3.1, R3.2, R3.11). */
export async function createTeacherAction(
  _prev: CreateTeacherFormState,
  formData: FormData,
): Promise<CreateTeacherFormState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const input = {
    email: String(formData.get('email') ?? ''),
    fullName: String(formData.get('fullName') ?? ''),
    schoolId: String(formData.get('schoolId') ?? ''),
  };

  try {
    const res = await getTeacherAccountService().createTeacher(claims, input);
    revalidatePath(TEACHERS_PATH);
    return {
      status: 'ok',
      message: `Akun Guru berhasil dibuat (status: belum aktif). ID profil: ${res.profileId}. Sampaikan sandi sementara di bawah ke Guru; ia wajib menggantinya saat login pertama.`,
      temporaryPassword: res.temporaryPassword,
      email: input.email.trim(),
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Gagal membuat akun Guru. Silakan coba lagi.',
    };
  }
}

export interface ImportFormState {
  status: 'idle' | 'done' | 'error';
  summary?: ImportSummary;
  message?: string;
}

/** Aksi: impor CSV massal + ringkasan hasil (R3.5–R3.8). */
export async function importTeachersAction(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const text = String(formData.get('csv') ?? '');

  try {
    const summary = await getTeacherAccountService().importTeachersCsv(claims, {
      text,
    });
    revalidatePath(TEACHERS_PATH);
    return { status: 'done', summary };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Gagal mengimpor CSV. Silakan periksa berkas dan coba lagi.',
    };
  }
}

export interface ActivateFormState {
  status: 'idle' | 'done' | 'error';
  result?: ActivationResult;
  message?: string;
}

/** Aksi: aktivasi batch + hasil aktivasi (R3.9, R3.10). */
export async function activateTeachersAction(
  _prev: ActivateFormState,
  formData: FormData,
): Promise<ActivateFormState> {
  const claims = await requireSession({ requireRole: 'admin' });
  // `profileIds` dikirim sebagai daftar dipisah newline/koma dari textarea.
  const raw = String(formData.get('profileIds') ?? '');
  const profileIds = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    const result = await getTeacherAccountService().activateTeachers(
      claims,
      profileIds,
    );
    revalidatePath(TEACHERS_PATH);
    return { status: 'done', result };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Gagal mengaktifkan akun Guru. Silakan coba lagi.',
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * R2 — Adopsi/perbaikan Guru dari Supabase Auth
 * ────────────────────────────────────────────────────────────────────────── */

export interface AdoptFormState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/**
 * Aksi: adopsi/perbaikan akun Guru yang sudah ada di Supabase Auth namun belum punya
 * profil aplikasi (R2). Admin-gated. Status hasil tetap `pending` (belum aktif)
 * — aktivasi tetap langkah terpisah oleh Admin (AGENTS.md §1).
 */
export async function adoptTeacherAction(
  _prev: AdoptFormState,
  formData: FormData,
): Promise<AdoptFormState> {
  const claims = await requireSession({ requireRole: 'admin' });
  const input = {
    email: String(formData.get('email') ?? ''),
    fullName: String(formData.get('fullName') ?? ''),
    schoolId: String(formData.get('schoolId') ?? ''),
  };

  try {
    await getTeacherAccountService().adoptAuthTeacher(claims, input);
    revalidatePath(TEACHERS_PATH);
    return {
      status: 'ok',
      message: 'Akun Guru berhasil diadopsi/diperbaiki (status: belum aktif).',
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Gagal mengadopsi akun Guru. Silakan coba lagi.',
    };
  }
}

/**
 * Aksi tipis: aktivasi SATU akun Guru dari tombol per-baris di daftar (R3 —
 * jalur aktivasi utama yang discoverable). Membaca `profileIds` tunggal dari
 * form, memanggil `activateTeachers`, lalu `revalidatePath` agar badge status
 * ter-refresh. Service `activateTeachers` TIDAK diubah.
 */
export async function activateTeacherRowAction(
  formData: FormData,
): Promise<void> {
  const claims = await requireSession({ requireRole: 'admin' });
  const raw = String(formData.get('profileIds') ?? '');
  const profileIds = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (profileIds.length === 0) {
    return;
  }

  await getTeacherAccountService().activateTeachers(claims, profileIds);
  revalidatePath(TEACHERS_PATH);
}
