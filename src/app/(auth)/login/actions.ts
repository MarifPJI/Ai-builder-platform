'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getAuthService } from '@/lib/auth/auth-service';
import { SESSION_COOKIE_NAME } from '@/lib/auth/guard';
import { loginSchema, newPasswordSchema } from '@/lib/validation/auth';

/**
 * Server Actions untuk layar login `U01` (identity-tenancy).
 *
 * Seluruh verifikasi terjadi di server (R6.1): kata sandi tidak pernah ditangani
 * di klien selain dikirim melalui Server Action ini. Peran dan `school_id`
 * ditentukan server dari token (R1.2/R1.3) — tidak ada pilihan peran di UI.
 *
 * ── State form (dikembalikan ke Client Component) ──────────────────────────
 *  - `idle`                   : belum ada aksi.
 *  - `invalid`                : input/kredensial tidak valid — pesan GENERIK
 *                               (R1.4) yang tidak membocorkan email vs sandi.
 *  - `locked`                 : akun terkunci sementara (R1.5).
 *  - `force_change_password`  : akun wajib mengganti kata sandi; `session`
 *                               diteruskan ke form ganti sandi (R1.8).
 * Pada keberhasilan, cookie sesi httpOnly diset lalu redirect ke beranda.
 */
export interface LoginState {
  status: 'idle' | 'invalid' | 'locked' | 'force_change_password';
  /** Pesan berbahasa Indonesia untuk ditampilkan (bila ada). */
  message?: string;
  /** Email dipertahankan agar tidak perlu diketik ulang (R1.4). */
  email?: string;
  /** Sisa menit penguncian (untuk status `locked`). */
  retryAfterMinutes?: number;
  /** Token sementara untuk menyelesaikan ganti sandi (untuk status `force_change_password`). */
  session?: string;
}

/**
 * Opsi cookie sesi: httpOnly, Secure di produksi (Vercel selalu HTTPS), SameSite
 * Lax. `maxAge` mengikuti masa berlaku access token Supabase (default 1 jam,
 * dapat diatur di Dashboard > Auth > Sessions/JWT expiry) agar cookie tidak
 * hidup lebih lama dari token di dalamnya.
 */
function sessionCookieOptions(expiresInSeconds?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(expiresInSeconds && expiresInSeconds > 0
      ? { maxAge: expiresInSeconds }
      : {}),
  };
}

/**
 * Menyetel cookie sesi httpOnly dari JWT. Token TIDAK pernah diekspos ke
 * JavaScript klien (httpOnly) sesuai aturan kerahasiaan (R6.1).
 */
function setSessionCookie(jwt: string, expiresInSeconds?: number): void {
  cookies().set(SESSION_COOKIE_NAME, jwt, sessionCookieOptions(expiresInSeconds));
}
/**
 * Aksi login (R1.1–R1.5, R1.8). Dipakai sebagai `useFormState` action.
 *
 * Alur:
 * 1. Validasi bentuk input (email ≤254, sandi 8–128). Gagal → pesan generik.
 * 2. `Auth_Service.signIn`. Petakan hasil:
 *    - `ok`                    → set cookie sesi → redirect beranda.
 *    - `force_change_password` → kembalikan status + session untuk form ganti.
 *    - `account_locked`        → status `locked` + sisa menit.
 *    - `invalid_credentials`   → status `invalid`, pesan generik, email disimpan.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    // Pesan generik (R1.4): jangan bedakan field; email dipertahankan.
    return {
      status: 'invalid',
      message: 'Email atau kata sandi tidak valid.',
      email,
    };
  }

  const result = await getAuthService().signIn(parsed.data.email, parsed.data.password);

  let destination = '/';

  switch (result.status) {
    case 'ok':
      setSessionCookie(result.jwt, result.expiresIn);
      destination = await destinationForJwt(result.jwt);
      break; // redirect di luar switch (redirect melempar).
    case 'force_change_password':
      return {
        status: 'force_change_password',
        session: result.session,
        email: parsed.data.email,
        message: 'Silakan tetapkan kata sandi baru untuk melanjutkan.',
      };
    case 'account_locked':
      return {
        status: 'locked',
        retryAfterMinutes: result.retryAfterMinutes,
        email: parsed.data.email,
        message:
          `Akun terkunci sementara. Coba lagi dalam ${result.retryAfterMinutes} menit ` +
          'atau hubungi Admin.',
      };
    case 'invalid_credentials':
    case 'password_policy_unmet':
    default:
      // `password_policy_unmet` tak muncul dari signIn (hanya dari penggantian
      // sandi), tetapi ditangani di sini agar switch lengkap & aman.
      return {
        status: 'invalid',
        message: 'Email atau kata sandi tidak valid.',
        email: parsed.data.email,
      };
  }

  // Keberhasilan: redirect sesuai peran (redirect() melempar NEXT_REDIRECT).
  // admin → area admin; teacher → area guru. Ini memperbaiki kasus login dari
  // domain apex (awsinstem.id) yang sebelumnya mendarat di halaman publik `/`.
  redirect(destination);
}

/**
 * Menentukan tujuan redirect pasca-login berdasarkan peran pada token.
 * admin → `/admin/schools`; teacher → `/teacher`; selain itu (atau bila gagal
 * membaca peran) → `/login` sebagai fallback aman.
 */
async function destinationForJwt(jwt: string): Promise<string> {
  try {
    const claims = await getAuthService().verifyToken(jwt);
    if (claims.role === 'admin') {
      return '/admin/schools';
    }
    if (claims.role === 'teacher') {
      return '/teacher';
    }
    return '/login';
  } catch {
    return '/login';
  }
}

/**
 * Aksi penyelesaian penggantian kata sandi wajib (FORCE_CHANGE_PASSWORD, R1.8/R1.9).
 *
 * - Validasi kata sandi baru 8–128 (R1.9). Tidak valid → pesan Bahasa Indonesia.
 * - `Auth_Service.completeNewPassword`. Sukses → set cookie → redirect beranda.
 *   Gagal → kembalikan ke state force_change_password dengan pesan.
 */
export async function completeNewPasswordAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const session = String(formData.get('session') ?? '');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const parsed = newPasswordSchema.safeParse({ password });
  if (!parsed.success) {
    return {
      status: 'force_change_password',
      session,
      email,
      message: 'Kata sandi baru harus terdiri dari 8 sampai 128 karakter.',
    };
  }

  const result = await getAuthService().completeNewPassword(
    session,
    parsed.data.password,
    email || undefined,
  );

  if (result.status === 'ok') {
    setSessionCookie(result.jwt, result.expiresIn);
    redirect(await destinationForJwt(result.jwt));
  }

  // Sandi baru tidak memenuhi kebijakan kata sandi (huruf besar/kecil, angka,
  // simbol) → tetap di form ganti sandi dengan pesan aturan yang jelas.
  if (result.status === 'password_policy_unmet') {
    return {
      status: 'force_change_password',
      session,
      email,
      message:
        'Kata sandi baru harus minimal 8 karakter dan memuat huruf besar, ' +
        'huruf kecil, angka, dan simbol.',
    };
  }

  // Gagal menyelesaikan challenge → tetap di form ganti sandi.
  return {
    status: 'force_change_password',
    session,
    email,
    message: 'Gagal menetapkan kata sandi baru. Silakan coba lagi.',
  };
}
