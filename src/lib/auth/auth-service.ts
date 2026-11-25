/**
 * Auth_Service — pembungkus Supabase Auth untuk autentikasi dua peran.
 *
 * Operasi inti:
 * - `signIn(email, password)`   — verifikasi kredensial via
 *   `signInWithPassword` dari SERVER (kata sandi tidak pernah ditangani
 *   browser selain lewat Server Action). Pesan kegagalan GENERIK (R1.4) dan
 *   lockout 5x gagal berturut per email selama 15 menit (R1.5).
 * - `completeNewPassword(session, newPassword)` — menyelesaikan ganti sandi
 *   wajib pada login pertama (R1.8), panjang 8–128 (R1.9).
 * - `verifyToken(jwt)` — verifikasi tanda tangan & klaim access token Supabase
 *   (JWKS untuk kunci asimetris; fallback ke Auth server untuk kunci HS256)
 *   lalu ekstrak `role` dan `schoolId` dari `app_metadata`. Peran & `schoolId`
 *   SELALU berasal dari token; input klien DIABAIKAN (R1.2/R1.3, Property 3).
 *
 * ── Ganti sandi wajib (pengganti FORCE_CHANGE_PASSWORD Cognito) ──────────────
 * Supabase tidak punya challenge NEW_PASSWORD_REQUIRED. Akun yang dibuat Admin
 * diberi sandi sementara + `app_metadata.must_change_password = true`.
 * - `signIn` yang kredensialnya benar tetapi flag itu aktif TIDAK mengembalikan
 *   `ok`; ia mengembalikan `force_change_password` dengan `session` = access
 *   token milik pengguna itu sendiri.
 * - `verifyToken` MENOLAK token yang flag-nya masih aktif, sehingga token itu
 *   tidak dapat dipakai sebagai cookie sesi untuk melewati ganti sandi.
 * - `completeNewPassword` memverifikasi token tersebut, mengganti sandi lewat
 *   Admin API, mematikan flag, lalu login ulang untuk mendapat token baru.
 *
 * ── Lockout store ────────────────────────────────────────────────────────────
 * Hitungan kegagalan disimpan di Postgres (`auth_login_failures`, migrasi
 * 0021) sehingga berlaku lintas instance serverless Vercel dan tahan restart.
 * Store & clock tetap injectable untuk pengujian.
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 1.9_
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getPool } from '@/lib/db/pool';

import { newPasswordSchema } from '../validation/auth';

import {
  APP_METADATA_MUST_CHANGE_PASSWORD_KEY,
  APP_METADATA_ROLE_KEY,
  APP_METADATA_SCHOOL_ID_KEY,
  getSupabaseAdminClient,
  getSupabaseAuthClient,
} from './supabase';
import type { Role, SessionClaims } from './types';

/* ──────────────────────────────────────────────────────────────────────────
 * Konstanta kebijakan lockout (R1.5)
 * ────────────────────────────────────────────────────────────────────────── */

/** Jumlah kegagalan login berturut yang memicu penguncian. */
export const MAX_FAILED_ATTEMPTS = 5;

/** Durasi penguncian minimum setelah ambang kegagalan tercapai (menit). */
export const LOCKOUT_DURATION_MINUTES = 15;

const LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MINUTES * 60 * 1000;

/* ──────────────────────────────────────────────────────────────────────────
 * Kontrak hasil
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Hasil upaya masuk / penggantian kata sandi.
 *
 * - `ok` — autentikasi berhasil; `jwt` adalah access token; `expiresIn` (detik)
 *   dipakai untuk masa berlaku cookie.
 * - `force_change_password` — kredensial benar tetapi sandi wajib diganti;
 *   `session` dipakai untuk `completeNewPassword`.
 * - `invalid_credentials` — pesan WAJIB generik (R1.4).
 * - `account_locked` — email terkunci sementara (R1.5).
 * - `password_policy_unmet` — sandi baru ditolak kebijakan sandi project.
 */
export type SignInResult =
  | { status: 'ok'; jwt: string; expiresIn?: number }
  | { status: 'force_change_password'; session: string }
  | { status: 'invalid_credentials' }
  | { status: 'account_locked'; retryAfterMinutes: number }
  | { status: 'password_policy_unmet' };

/* ──────────────────────────────────────────────────────────────────────────
 * Clock & Lockout store yang dapat di-inject
 * ────────────────────────────────────────────────────────────────────────── */

/** Abstraksi waktu agar lockout dapat diuji deterministik. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Catatan kegagalan login untuk satu email. */
export interface LockoutRecord {
  failures: number;
  /** Epoch ms kapan penguncian berakhir; `null` bila tidak terkunci. */
  lockedUntil: number | null;
}

/** Store penghitung lockout (asinkron agar dapat berbasis database). */
export interface LockoutStore {
  get(email: string): Promise<LockoutRecord | undefined>;
  set(email: string, record: LockoutRecord): Promise<void>;
  delete(email: string): Promise<void>;
}

/** Store in-memory: hanya untuk pengujian/dev (tidak terbagi antar instance). */
export class InMemoryLockoutStore implements LockoutStore {
  private readonly records = new Map<string, LockoutRecord>();

  async get(email: string): Promise<LockoutRecord | undefined> {
    return this.records.get(email);
  }

  async set(email: string, record: LockoutRecord): Promise<void> {
    this.records.set(email, record);
  }

  async delete(email: string): Promise<void> {
    this.records.delete(email);
  }
}

/**
 * Store berbasis Postgres (tabel `auth_login_failures`, migrasi 0021). Query
 * berjalan lewat pool `app_runtime` TANPA konteks tenant karena terjadi sebelum
 * pengguna terautentikasi; tabel tidak berisi data tenant.
 */
export class PgLockoutStore implements LockoutStore {
  async get(email: string): Promise<LockoutRecord | undefined> {
    const result = await getPool().query<{
      failures: number;
      locked_until_ms: string | null;
    }>(
      `SELECT failures,
              (EXTRACT(EPOCH FROM locked_until) * 1000)::bigint AS locked_until_ms
         FROM auth_login_failures
        WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      failures: row.failures,
      lockedUntil:
        row.locked_until_ms === null ? null : Number(row.locked_until_ms),
    };
  }

  async set(email: string, record: LockoutRecord): Promise<void> {
    await getPool().query(
      `INSERT INTO auth_login_failures (email, failures, locked_until, updated_at)
       VALUES ($1, $2, CASE WHEN $3::bigint IS NULL THEN NULL
                            ELSE to_timestamp($3::bigint / 1000.0) END, now())
       ON CONFLICT (email) DO UPDATE
         SET failures = EXCLUDED.failures,
             locked_until = EXCLUDED.locked_until,
             updated_at = now()`,
      [email, record.failures, record.lockedUntil],
    );
  }

  async delete(email: string): Promise<void> {
    await getPool().query('DELETE FROM auth_login_failures WHERE email = $1', [
      email,
    ]);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Verifikasi token
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Pemverifikasi token: mengembalikan klaim JWT terverifikasi atau melempar.
 * Default memakai `supabase.auth.getClaims`.
 */
export interface TokenVerifier {
  verify(token: string): Promise<Record<string, unknown>>;
}

function createDefaultVerifier(client: SupabaseClient): TokenVerifier {
  return {
    async verify(token: string): Promise<Record<string, unknown>> {
      const { data, error } = await client.auth.getClaims(token);
      if (error || !data) {
        throw error ?? new Error('Token tidak valid.');
      }
      return data.claims as unknown as Record<string, unknown>;
    },
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Util internal
 * ────────────────────────────────────────────────────────────────────────── */

/** Normalisasi email untuk kunci lockout. */
function lockoutKey(email: string): string {
  return email.trim().toLowerCase();
}

interface SupabaseErrorLike {
  code?: string;
  status?: number;
  name?: string;
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as SupabaseErrorLike).code ?? '')
    : '';
}

function errorStatus(error: unknown): number {
  return error && typeof error === 'object' && 'status' in error
    ? Number((error as SupabaseErrorLike).status ?? 0)
    : 0;
}

/**
 * Kegagalan kredensial (dipetakan ke pesan generik R1.4). Email tidak ada dan
 * sandi salah sengaja diperlakukan sama agar tidak membocorkan keberadaan akun.
 */
function isInvalidCredentialsError(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === 'invalid_credentials' ||
    code === 'user_not_found' ||
    code === 'email_not_confirmed' ||
    code === 'user_banned'
  );
}

function isRateLimitError(error: unknown): boolean {
  return (
    errorStatus(error) === 429 ||
    errorCode(error) === 'over_request_rate_limit'
  );
}

function isPasswordPolicyError(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'weak_password' || code === 'same_password';
}

/* ──────────────────────────────────────────────────────────────────────────
 * Konstruksi Auth_Service
 * ────────────────────────────────────────────────────────────────────────── */

/** Dependensi Auth_Service; seluruhnya opsional dengan default produksi. */
export interface AuthServiceDeps {
  /** Klien kunci-anon (signIn). */
  readonly authClient?: SupabaseClient;
  /** Klien service-role (ganti sandi). */
  readonly adminClient?: SupabaseClient;
  readonly clock?: Clock;
  readonly lockoutStore?: LockoutStore;
  readonly verifier?: TokenVerifier;
}

export interface AuthService {
  signIn(email: string, password: string): Promise<SignInResult>;
  completeNewPassword(
    session: string,
    newPassword: string,
    email?: string,
  ): Promise<SignInResult>;
  verifyToken(jwt: string): Promise<SessionClaims>;
}

export function createAuthService(deps: AuthServiceDeps = {}): AuthService {
  const clock = deps.clock ?? systemClock;
  const lockoutStore = deps.lockoutStore ?? new PgLockoutStore();

  // Klien dibuat lazy agar import modul tidak membaca env (aman saat build).
  const authClient = (): SupabaseClient =>
    deps.authClient ?? getSupabaseAuthClient();
  const adminClient = (): SupabaseClient =>
    deps.adminClient ?? getSupabaseAdminClient();
  const verifier = (): TokenVerifier =>
    deps.verifier ?? createDefaultVerifier(authClient());

  /** Sisa menit penguncian (min 1) bila terkunci; `null` bila tidak. */
  async function getActiveLockMinutes(email: string): Promise<number | null> {
    const key = lockoutKey(email);
    const record = await lockoutStore.get(key);
    if (!record || record.lockedUntil === null) {
      return null;
    }
    const remainingMs = record.lockedUntil - clock.now();
    if (remainingMs <= 0) {
      await lockoutStore.delete(key);
      return null;
    }
    return Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  }

  /** Catat satu kegagalan; mencapai ambang → kunci selama 15 menit (R1.5). */
  async function recordFailure(email: string): Promise<void> {
    const key = lockoutKey(email);
    const existing = (await lockoutStore.get(key)) ?? {
      failures: 0,
      lockedUntil: null,
    };
    const failures = existing.failures + 1;
    const lockedUntil =
      failures >= MAX_FAILED_ATTEMPTS ? clock.now() + LOCKOUT_DURATION_MS : null;
    await lockoutStore.set(key, { failures, lockedUntil });
  }

  async function resetFailures(email: string): Promise<void> {
    await lockoutStore.delete(lockoutKey(email));
  }

  /**
   * Verifikasi token + ekstraksi klaim. `allowPasswordChange` hanya `true`
   * untuk `completeNewPassword`; selain itu token dengan flag ganti-sandi-wajib
   * ditolak.
   */
  async function readClaims(
    jwt: string,
    allowPasswordChange: boolean,
  ): Promise<SessionClaims & { appMetadata: Record<string, unknown> }> {
    const claims = await verifier().verify(jwt);

    // Token anon/service-role (role != authenticated) bukan sesi pengguna.
    if (claims['role'] !== 'authenticated') {
      throw new Error('Token bukan token pengguna terautentikasi.');
    }

    const authUserId = readStringClaim(claims, 'sub');
    const email = readStringClaim(claims, 'email');
    const appMetadata = readAppMetadata(claims);
    const role = readRoleClaim(appMetadata);
    const schoolId = readStringValue(appMetadata[APP_METADATA_SCHOOL_ID_KEY]);

    if (!authUserId || !email || role === null) {
      throw new Error('Klaim token tidak lengkap atau tidak valid.');
    }

    // Teacher WAJIB punya schoolId (R1.3); admin boleh null.
    if (role === 'teacher' && !schoolId) {
      throw new Error('Guru tanpa school_id pada token adalah klaim invalid.');
    }

    const mustChange =
      appMetadata[APP_METADATA_MUST_CHANGE_PASSWORD_KEY] === true;
    if (mustChange && !allowPasswordChange) {
      throw new Error('Sandi wajib diganti sebelum sesi dapat dipakai.');
    }

    return {
      cognitoSub: authUserId,
      email,
      role,
      schoolId,
      appMetadata,
    };
  }

  /** Login ke Supabase; mengembalikan hasil tanpa menyentuh lockout. */
  async function passwordSignIn(
    email: string,
    password: string,
  ): Promise<
    | { kind: 'ok'; jwt: string; expiresIn?: number; mustChange: boolean }
    | { kind: 'invalid' }
    | { kind: 'rate_limited' }
  > {
    const { data, error } = await authClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (isInvalidCredentialsError(error)) {
        return { kind: 'invalid' };
      }
      if (isRateLimitError(error)) {
        return { kind: 'rate_limited' };
      }
      // Konfigurasi/jaringan: bukan kredensial salah — lempar ulang.
      throw error;
    }

    const jwt = data.session?.access_token;
    if (!jwt || !data.user) {
      return { kind: 'invalid' };
    }
    const mustChange =
      (data.user.app_metadata ?? {})[APP_METADATA_MUST_CHANGE_PASSWORD_KEY] ===
      true;
    return {
      kind: 'ok',
      jwt,
      expiresIn: data.session?.expires_in,
      mustChange,
    };
  }

  async function signIn(
    email: string,
    password: string,
  ): Promise<SignInResult> {
    // Lockout diperiksa SEBELUM memanggil Supabase (R1.5).
    const lockedMinutes = await getActiveLockMinutes(email);
    if (lockedMinutes !== null) {
      return { status: 'account_locked', retryAfterMinutes: lockedMinutes };
    }

    const result = await passwordSignIn(email, password);

    if (result.kind === 'rate_limited') {
      // Pembatasan laju dari Supabase: perlakukan sebagai terkunci singkat.
      return { status: 'account_locked', retryAfterMinutes: 1 };
    }

    if (result.kind === 'invalid') {
      await recordFailure(email);
      const nowLocked = await getActiveLockMinutes(email);
      if (nowLocked !== null) {
        return { status: 'account_locked', retryAfterMinutes: nowLocked };
      }
      return { status: 'invalid_credentials' };
    }

    // Kredensial benar → reset penghitung lockout.
    await resetFailures(email);

    if (result.mustChange) {
      return { status: 'force_change_password', session: result.jwt };
    }
    return { status: 'ok', jwt: result.jwt, expiresIn: result.expiresIn };
  }

  async function completeNewPassword(
    session: string,
    newPassword: string,
    // Parameter `email` dipertahankan demi kompatibilitas pemanggil, tetapi
    // DIABAIKAN: identitas diambil dari token `session`, bukan dari input klien.
    _email?: string,
  ): Promise<SignInResult> {
    // Panjang 8–128 SEBELUM menyentuh Supabase (R1.9).
    const parsed = newPasswordSchema.safeParse({ password: newPassword });
    if (!parsed.success) {
      return { status: 'invalid_credentials' };
    }

    let claims: Awaited<ReturnType<typeof readClaims>>;
    try {
      claims = await readClaims(session, true);
    } catch {
      return { status: 'invalid_credentials' };
    }

    // Hanya akun yang memang wajib ganti sandi yang boleh memakai jalur ini.
    if (claims.appMetadata[APP_METADATA_MUST_CHANGE_PASSWORD_KEY] !== true) {
      return { status: 'invalid_credentials' };
    }

    const { error } = await adminClient().auth.admin.updateUserById(
      claims.cognitoSub,
      {
        password: newPassword,
        app_metadata: {
          ...claims.appMetadata,
          [APP_METADATA_MUST_CHANGE_PASSWORD_KEY]: false,
        },
      },
    );
    if (error) {
      if (isPasswordPolicyError(error)) {
        return { status: 'password_policy_unmet' };
      }
      throw error;
    }

    // Login ulang agar token baru memuat flag yang sudah dimatikan.
    const result = await passwordSignIn(claims.email, newPassword);
    if (result.kind !== 'ok' || result.mustChange) {
      return { status: 'invalid_credentials' };
    }
    return { status: 'ok', jwt: result.jwt, expiresIn: result.expiresIn };
  }

  async function verifyToken(jwt: string): Promise<SessionClaims> {
    // Tanda tangan/exp/iss invalid → `verify` melempar → deny-by-default.
    const { cognitoSub, email, role, schoolId } = await readClaims(jwt, false);
    return { cognitoSub, email, role, schoolId };
  }

  return { signIn, completeNewPassword, verifyToken };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Ekstraksi klaim (peran & school_id SELALU dari token — Property 3)
 * ────────────────────────────────────────────────────────────────────────── */

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringClaim(
  claims: Record<string, unknown>,
  name: string,
): string | null {
  return readStringValue(claims[name]);
}

/** `app_metadata` dari klaim JWT (bukan `user_metadata`, yang dapat diedit user). */
function readAppMetadata(
  claims: Record<string, unknown>,
): Record<string, unknown> {
  const meta = claims['app_metadata'];
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

/** Peran dari `app_metadata.role`; nilai tak dikenal → `null` (deny-by-default). */
function readRoleClaim(appMetadata: Record<string, unknown>): Role | null {
  const role = appMetadata[APP_METADATA_ROLE_KEY];
  return role === 'admin' || role === 'teacher' ? role : null;
}

let defaultAuthService: AuthService | undefined;

/** Auth_Service default (singleton, lazy). */
export function getAuthService(): AuthService {
  if (!defaultAuthService) {
    defaultAuthService = createAuthService();
  }
  return defaultAuthService;
}
