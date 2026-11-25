'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';

import {
  completeNewPasswordAction,
  loginAction,
  type LoginState,
} from './actions';

/**
 * LoginForm — Client Component minimal untuk layar `U01` (R1.7).
 *
 * KEBERSIHAN UI (apple-ui.md, R1.7):
 * - HANYA form Masuk (`Email Resmi` + `Kata Sandi`) + tautan bantuan reset ke
 *   Admin. TANPA pilihan peran, TANPA pendaftaran/aktivasi mandiri (self sign-up
 *   dimatikan — R1.6).
 * - Peran & `school_id` ditentukan server dari token (R1.2/R1.3); tidak ada
 *   masukan peran di sini.
 *
 * Menangani state: kredensial salah/invalid (pesan generik, R1.4), akun terkunci
 * (R1.5), dan transisi ke form ganti kata sandi wajib (FORCE_CHANGE_PASSWORD,
 * R1.8). Email dipertahankan antar percobaan.
 */

const INITIAL_STATE: LoginState = { status: 'idle' };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Memproses…' : label}
    </Button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState(loginAction, INITIAL_STATE);
  const [changeState, changeAction] = useFormState(
    completeNewPasswordAction,
    INITIAL_STATE,
  );

  // Setelah login mengindikasikan FORCE_CHANGE_PASSWORD, tampilkan form ganti
  // kata sandi. Gunakan state terbaru di antara kedua aksi.
  const forceChange =
    state.status === 'force_change_password' ||
    changeState.status === 'force_change_password';
  const activeMessage = changeState.message ?? state.message;
  const session = changeState.session ?? state.session ?? '';
  const email = changeState.email ?? state.email ?? '';

  if (forceChange) {
    return (
      <form action={changeAction} className="auth-form space-y-4">
        <input type="hidden" name="session" value={session} />
        <input type="hidden" name="email" value={email} />
        <div>
          <h1 className="text-lg font-semibold text-ink">Tetapkan Kata Sandi Baru</h1>
          <p className="mt-1 text-sm text-muted">
            Masukkan kata sandi baru (8–128 karakter) untuk mengaktifkan akun Anda.
          </p>
        </div>
        {activeMessage ? <Toast tone="info" message={activeMessage} /> : null}
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-ink">
            Kata Sandi Baru
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          />
        </div>
        <SubmitButton label="Simpan Kata Sandi" />
      </form>
    );
  }

  const tone = state.status === 'locked' ? 'error' : 'error';

  return (
    <form action={action} className="auth-form space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Masuk Akun</h1>
        <p className="mt-1 text-sm text-muted">
          Khusus Guru &amp; Admin program STEM Capacity Building 2026.
        </p>
      </div>

      {state.status === 'invalid' || state.status === 'locked' ? (
        <Toast tone={tone} message={state.message ?? 'Terjadi kesalahan.'} />
      ) : null}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
          Email Resmi
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          defaultValue={state.email ?? ''}
          autoComplete="email"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
          Kata Sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        />
      </div>

      <SubmitButton label="Masuk" />

      {/* Tautan bantuan reset ke Admin — TANPA pendaftaran mandiri (R1.6/R1.7). */}
      <p className="text-center text-sm text-muted">
        Lupa kata sandi?{' '}
        <a href="mailto:admin@aibuilder.id" className="text-teal hover:underline">
          Minta bantuan reset ke Admin
        </a>
      </p>
    </form>
  );
}
