/**
 * Konfigurasi & klien Supabase Auth (HANYA sisi server).
 *
 * Pengganti `cognito.ts`. Supabase Auth dipakai sebagai penyedia identitas:
 * - Peran (`admin` | `teacher`) dan `school_id` disimpan di `app_metadata`
 *   pengguna. `app_metadata` HANYA dapat diubah oleh service-role (server);
 *   pengguna tidak dapat mengubahnya sendiri. JANGAN pernah memakai
 *   `user_metadata` untuk otorisasi: nilainya dapat diedit pengguna.
 * - Klaim `app_metadata` ikut tertanam di access token (JWT) Supabase sehingga
 *   Session_Guard dapat membaca peran & school_id dari token terverifikasi.
 *
 * Dua klien:
 * - `getSupabaseAuthClient()`  : kunci anon/publishable. Dipakai untuk
 *   `signInWithPassword` dan verifikasi token (`getClaims`).
 * - `getSupabaseAdminClient()` : kunci service-role/secret. Dipakai untuk Admin
 *   API (buat user, ubah `app_metadata`, ubah sandi). TIDAK PERNAH boleh sampai
 *   ke klien browser; jangan beri prefix `NEXT_PUBLIC_`.
 *
 * Kedua klien dibuat tanpa penyimpanan sesi (`persistSession: false`) karena
 * sesi dikelola aplikasi lewat cookie httpOnly.
 */

import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Role } from './types';

/** Nilai klaim `app_metadata.role` yang diizinkan (selaras dengan `Role`). */
export const APP_METADATA_ROLES: Readonly<Record<Role, Role>> = Object.freeze({
  admin: 'admin',
  teacher: 'teacher',
});

/** Kunci `app_metadata` yang dipakai aplikasi. */
export const APP_METADATA_ROLE_KEY = 'role' as const;
export const APP_METADATA_SCHOOL_ID_KEY = 'school_id' as const;
/** Penanda ganti sandi wajib pada login pertama (pengganti FORCE_CHANGE_PASSWORD). */
export const APP_METADATA_MUST_CHANGE_PASSWORD_KEY =
  'must_change_password' as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} belum tersetel. Variabel konfigurasi Supabase ini hanya dibaca ` +
        'di sisi server dan tidak boleh diberi prefix NEXT_PUBLIC_.',
    );
  }
  return value;
}

const globalForSupabase = globalThis as typeof globalThis & {
  __supabaseAuthClient__?: SupabaseClient;
  __supabaseAdminClient__?: SupabaseClient;
};

const CLIENT_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
} as const;

/** Klien kunci-anon (login & verifikasi token). Singleton lazy. */
export function getSupabaseAuthClient(): SupabaseClient {
  if (!globalForSupabase.__supabaseAuthClient__) {
    const url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    globalForSupabase.__supabaseAuthClient__ = createClient(
      url,
      requireEnv('SUPABASE_ANON_KEY'),
      CLIENT_OPTIONS,
    );
  }
  return globalForSupabase.__supabaseAuthClient__;
}

/** Klien service-role (Admin API). Singleton lazy. SERVER ONLY. */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!globalForSupabase.__supabaseAdminClient__) {
    const url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    globalForSupabase.__supabaseAdminClient__ = createClient(
      url,
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      CLIENT_OPTIONS,
    );
  }
  return globalForSupabase.__supabaseAdminClient__;
}
