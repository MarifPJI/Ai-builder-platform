import { describe, expect, it } from 'vitest';

import { SESSION_NAME_MAX } from '@/lib/validation/class';

import {
  buildSessionName,
  planSessionOptions,
  resolveSessionKind,
  type ExistingSession,
} from './session-plan';

const part = (n: number): ExistingSession => ({ sessionKind: 'part', partNumber: n });
const final = (n: number): ExistingSession => ({ sessionKind: 'final', partNumber: n });
const full: ExistingSession = { sessionKind: 'full', partNumber: null };
const extra: ExistingSession = { sessionKind: 'extra', partNumber: null };
const legacy: ExistingSession = { sessionKind: null, partNumber: null };

describe('planSessionOptions', () => {
  it('offers Sesi Penuh and Sesi 1 when the Materi has no sessions yet', () => {
    const plan = planSessionOptions([]);
    expect(plan.finished).toBe(false);
    expect(plan.defaultKind).toBe('full');
    expect(plan.options.map((o) => o.label)).toEqual(['Sesi Penuh', 'Sesi 1']);
  });

  it('suggests the next number after Sesi 1 and Sesi 2', () => {
    const plan = planSessionOptions([part(1), part(2)]);
    expect(plan.finished).toBe(false);
    expect(plan.nextPart).toBe(3);
    expect(plan.defaultKind).toBe('part');
    expect(plan.options.map((o) => o.label)).toEqual(['Sesi 3', 'Sesi 3 (Terakhir)']);
  });

  it('uses the highest number, even if a middle session was deleted', () => {
    expect(planSessionOptions([part(1), part(3)]).nextPart).toBe(4);
  });

  it('only offers Sesi Tambahan after Sesi Penuh', () => {
    const plan = planSessionOptions([full]);
    expect(plan.finished).toBe(true);
    expect(plan.options.map((o) => o.kind)).toEqual(['extra']);
  });

  it('only offers Sesi Tambahan after Sesi Terakhir', () => {
    const plan = planSessionOptions([part(1), final(2), extra]);
    expect(plan.finished).toBe(true);
    expect(plan.options.map((o) => o.kind)).toEqual(['extra']);
  });

  it('ignores legacy sessions without a type', () => {
    const plan = planSessionOptions([legacy, legacy]);
    expect(plan.finished).toBe(false);
    expect(plan.options.map((o) => o.label)).toEqual(['Sesi Penuh', 'Sesi 1']);
  });
});

describe('resolveSessionKind', () => {
  it('assigns the server-computed number to part and final', () => {
    expect(resolveSessionKind('part', [part(1)])).toEqual({ ok: true, kind: 'part', partNumber: 2 });
    expect(resolveSessionKind('final', [part(1)])).toEqual({ ok: true, kind: 'final', partNumber: 2 });
  });

  it('rejects Sesi Penuh once the Materi was started in parts', () => {
    const result = resolveSessionKind('full', [part(1)]);
    expect(result.ok).toBe(false);
  });

  it('rejects part/final after the Materi is finished', () => {
    expect(resolveSessionKind('part', [full]).ok).toBe(false);
    expect(resolveSessionKind('final', [part(1), final(2)]).ok).toBe(false);
  });

  it('rejects Sesi Tambahan before the Materi is finished', () => {
    expect(resolveSessionKind('extra', []).ok).toBe(false);
    expect(resolveSessionKind('extra', [part(1)]).ok).toBe(false);
  });

  it('allows Sesi Tambahan after the Materi is finished', () => {
    expect(resolveSessionKind('extra', [full])).toEqual({ ok: true, kind: 'extra', partNumber: null });
  });

  it('rejects numbers above the database limit', () => {
    const existing = Array.from({ length: 50 }, (_, i) => part(i + 1));
    expect(resolveSessionKind('part', existing).ok).toBe(false);
  });
});

describe('buildSessionName', () => {
  const title = 'Pelajaran 7. Pengenalan Kiro';

  it('builds names for each kind', () => {
    expect(buildSessionName('full', null, title)).toBe('Sesi Penuh · Pelajaran 7. Pengenalan Kiro');
    expect(buildSessionName('part', 2, title)).toBe('Sesi 2 · Pelajaran 7. Pengenalan Kiro');
    expect(buildSessionName('final', 3, title)).toBe('Sesi 3 (Terakhir) · Pelajaran 7. Pengenalan Kiro');
    expect(buildSessionName('extra', null, title)).toBe('Sesi Tambahan · Pelajaran 7. Pengenalan Kiro');
  });

  it('truncates long titles to the database limit', () => {
    const name = buildSessionName('final', 12, 'x'.repeat(400));
    expect(name.length).toBeLessThanOrEqual(SESSION_NAME_MAX);
    expect(name.startsWith('Sesi 12 (Terakhir) · ')).toBe(true);
    expect(name.endsWith('…')).toBe(true);
  });
});

describe('scheduleSessionSchema', () => {
  const base = {
    classId: '11111111-1111-4111-8111-111111111111',
    materialId: '22222222-2222-4222-8222-222222222222',
    scheduledAt: '2026-11-27T02:00:00.000Z',
  };

  it('accepts a session type without a name', async () => {
    const { scheduleSessionSchema } = await import('@/lib/validation/class');
    expect(scheduleSessionSchema.safeParse({ ...base, sessionKind: 'part' }).success).toBe(true);
  });

  it('still accepts the legacy free-text name', async () => {
    const { scheduleSessionSchema } = await import('@/lib/validation/class');
    expect(scheduleSessionSchema.safeParse({ ...base, name: 'Sesi 1' }).success).toBe(true);
  });

  it('rejects input with neither a type nor a name', async () => {
    const { scheduleSessionSchema } = await import('@/lib/validation/class');
    const result = scheduleSessionSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Nama sesi wajib diisi.');
  });

  it('rejects an unknown session type with an Indonesian message', async () => {
    const { scheduleSessionSchema } = await import('@/lib/validation/class');
    const result = scheduleSessionSchema.safeParse({ ...base, sessionKind: 'bogus' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Jenis sesi tidak valid.');
  });
});
