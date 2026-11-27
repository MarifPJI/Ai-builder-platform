/**
 * Logika tipe sesi (Sesi Penuh / Sesi n / Sesi Terakhir / Sesi Tambahan).
 *
 * Modul MURNI (tanpa DB, tanpa `server-only`) sehingga dipakai bersama oleh
 * form Guru (menyusun pilihan dropdown) dan server (`scheduleSession`, yang
 * menghitung ulang nomor dan memvalidasi aturan — klien tidak dipercaya).
 *
 * Aturan per (Kelas, Materi):
 *   - Belum ada sesi bertipe     → pilihan: Sesi Penuh, Sesi 1.
 *   - Sudah ada Sesi 1..n        → pilihan: Sesi n+1, Sesi n+1 (Terakhir).
 *   - Sudah Penuh / Terakhir     → Materi SELESAI → hanya Sesi Tambahan
 *                                  (tidak mengubah progres).
 *   - Sesi lama tanpa tipe (NULL) diabaikan untuk penomoran.
 */

import { SESSION_NAME_MAX } from '@/lib/validation/class';

export const SESSION_KINDS = ['full', 'part', 'final', 'extra'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

/** Sesi yang sudah ada untuk satu Kelas + Materi (kind NULL = sesi lama). */
export interface ExistingSession {
  sessionKind: SessionKind | null;
  partNumber: number | null;
}

export interface SessionOption {
  kind: SessionKind;
  /** Nomor sesi untuk 'part'/'final'; null untuk 'full'/'extra'. */
  partNumber: number | null;
  label: string;
}

export interface SessionPlan {
  /** Materi sudah selesai untuk Kelas ini (ada Sesi Penuh atau Sesi Terakhir). */
  finished: boolean;
  /** Nomor sesi berikutnya untuk 'part'/'final'. */
  nextPart: number;
  options: SessionOption[];
  defaultKind: SessionKind;
}

/** Batas nomor sesi (selaras CHECK part_number BETWEEN 1 AND 50 di 0022). */
export const MAX_PART_NUMBER = 50;

export function isSessionKind(value: unknown): value is SessionKind {
  return typeof value === 'string' && (SESSION_KINDS as readonly string[]).includes(value);
}

/** Label pendek tanpa judul Materi (dipakai di dropdown & badge). */
export function sessionKindLabel(kind: SessionKind, partNumber: number | null): string {
  switch (kind) {
    case 'full':
      return 'Sesi Penuh';
    case 'part':
      return `Sesi ${partNumber ?? '?'}`;
    case 'final':
      return `Sesi ${partNumber ?? '?'} (Terakhir)`;
    case 'extra':
      return 'Sesi Tambahan';
  }
}

/** Menyusun pilihan dropdown dari sesi yang sudah ada untuk satu Kelas + Materi. */
export function planSessionOptions(existing: readonly ExistingSession[]): SessionPlan {
  const typed = existing.filter((s) => s.sessionKind !== null && s.sessionKind !== 'extra');
  const finished = typed.some((s) => s.sessionKind === 'full' || s.sessionKind === 'final');
  const maxPart = typed.reduce((max, s) => Math.max(max, s.partNumber ?? 0), 0);
  const nextPart = maxPart + 1;

  if (finished) {
    return {
      finished,
      nextPart,
      options: [{ kind: 'extra', partNumber: null, label: sessionKindLabel('extra', null) }],
      defaultKind: 'extra',
    };
  }

  if (typed.length === 0) {
    return {
      finished,
      nextPart: 1,
      options: [
        { kind: 'full', partNumber: null, label: sessionKindLabel('full', null) },
        { kind: 'part', partNumber: 1, label: sessionKindLabel('part', 1) },
      ],
      defaultKind: 'full',
    };
  }

  return {
    finished,
    nextPart,
    options: [
      { kind: 'part', partNumber: nextPart, label: sessionKindLabel('part', nextPart) },
      { kind: 'final', partNumber: nextPart, label: sessionKindLabel('final', nextPart) },
    ],
    defaultKind: 'part',
  };
}

export type ResolveResult =
  | { ok: true; kind: SessionKind; partNumber: number | null }
  | { ok: false; message: string };

/**
 * Validasi server: apakah `requested` boleh dibuat mengingat sesi yang ada,
 * dan nomor berapa yang dipakai. Nomor SELALU dihitung server (bukan klien).
 */
export function resolveSessionKind(
  requested: SessionKind,
  existing: readonly ExistingSession[],
): ResolveResult {
  const plan = planSessionOptions(existing);
  const option = plan.options.find((o) => o.kind === requested);
  if (option) {
    if (option.partNumber !== null && option.partNumber > MAX_PART_NUMBER) {
      return { ok: false, message: `Jumlah sesi untuk satu Materi maksimal ${MAX_PART_NUMBER}.` };
    }
    return { ok: true, kind: option.kind, partNumber: option.partNumber };
  }

  if (plan.finished) {
    return {
      ok: false,
      message: 'Materi ini sudah selesai untuk kelas ini. Pilih Sesi Tambahan.',
    };
  }
  if (requested === 'extra') {
    return {
      ok: false,
      message: 'Sesi Tambahan hanya tersedia setelah Materi selesai untuk kelas ini.',
    };
  }
  // requested === 'full' padahal sudah ada Sesi 1..n.
  return {
    ok: false,
    message: `Materi ini sudah dimulai bertahap. Pilih Sesi ${plan.nextPart} atau Sesi ${plan.nextPart} (Terakhir).`,
  };
}

/** Nama sesi tersimpan, mis. "Sesi 2 (Terakhir) · Pelajaran 7. Pengenalan Kiro". */
export function buildSessionName(
  kind: SessionKind,
  partNumber: number | null,
  materialTitle: string,
): string {
  const prefix = `${sessionKindLabel(kind, partNumber)} · `;
  const title = materialTitle.trim() || 'Materi';
  const full = prefix + title;
  if (full.length <= SESSION_NAME_MAX) return full;
  return prefix + title.slice(0, Math.max(0, SESSION_NAME_MAX - prefix.length - 1)).trimEnd() + '…';
}
