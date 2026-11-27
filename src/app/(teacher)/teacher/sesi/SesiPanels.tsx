'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import type { ClassSummary } from '@/lib/domain/class-service';
import {
  buildSessionName,
  planSessionOptions,
  type SessionKind,
} from '@/lib/domain/session-plan';

import { scheduleSessionAction, type SesiFormState } from './actions';

const INIT: SesiFormState = { status: 'idle' };

// WIB (Asia/Jakarta) WAJIB di-set: server produksi berjalan di UTC; tanpa ini
// jadwal sesi akan tampil dalam UTC (bergeser -7 jam dari WIB).
const dateFmt = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

const SELECT_CLASS =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal';

interface MaterialLite {
  id: string;
  title: string;
}
interface SessionLite {
  id: string;
  name: string;
  className: string;
  classId: string;
  materialId: string | null;
  sessionKind: SessionKind | null;
  partNumber: number | null;
  scheduledAt: string;
}

export function SesiPanels({
  classes,
  materials,
  sessions,
}: {
  classes: ClassSummary[];
  materials: MaterialLite[];
  sessions: SessionLite[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ScheduleSessionPanel classes={classes} materials={materials} sessions={sessions} />
      <SessionListPanel sessions={sessions} />
    </div>
  );
}

/* ── Jadwalkan sesi ─────────────────────────────────────────────────────────── */

function ScheduleSessionPanel({
  classes,
  materials,
  sessions,
}: {
  classes: ClassSummary[];
  materials: MaterialLite[];
  sessions: SessionLite[];
}) {
  const [state, action] = useFormState(scheduleSessionAction, INIT);
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '');
  /** Pilihan eksplisit guru; null = pakai pilihan default rencana. */
  const [kindChoice, setKindChoice] = useState<SessionKind | null>(null);

  const plan = useMemo(
    () =>
      planSessionOptions(
        sessions
          .filter((s) => s.classId === classId && s.materialId === materialId)
          .map((s) => ({ sessionKind: s.sessionKind, partNumber: s.partNumber })),
      ),
    [sessions, classId, materialId],
  );

  const selected =
    plan.options.find((o) => o.kind === kindChoice) ??
    plan.options.find((o) => o.kind === plan.defaultKind) ??
    plan.options[0];
  const materialTitle = materials.find((m) => m.id === materialId)?.title ?? '';

  // Setelah sesi tersimpan, daftar sesi dimuat ulang (revalidatePath) dan
  // pilihan kembali ke default rencana baru (mis. Sesi 1 → Sesi 2).
  useEffect(() => {
    if (state.status === 'ok') setKindChoice(null);
  }, [state]);

  return (
    <Card>
      <CardHead title="Jadwalkan Sesi" />
      <CardBody>
        {classes.length === 0 || materials.length === 0 ? (
          <p className="text-sm text-muted">
            Perlu minimal satu kelas dan satu materi terbit untuk menjadwalkan sesi.
          </p>
        ) : (
          <form action={action} className="space-y-3">
            <StateToast state={state} />
            <div>
              <label htmlFor="sesi-class" className="mb-1 block text-sm font-medium text-ink">
                Kelas
              </label>
              <select
                id="sesi-class"
                name="classId"
                required
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setKindChoice(null);
                }}
                className={SELECT_CLASS}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sesi-material" className="mb-1 block text-sm font-medium text-ink">
                Materi
              </label>
              <select
                id="sesi-material"
                name="materialId"
                required
                value={materialId}
                onChange={(e) => {
                  setMaterialId(e.target.value);
                  setKindChoice(null);
                }}
                className={SELECT_CLASS}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sesi-kind" className="mb-1 block text-sm font-medium text-ink">
                Sesi
              </label>
              <select
                id="sesi-kind"
                name="sessionKind"
                required
                value={selected?.kind ?? ''}
                onChange={(e) => setKindChoice(e.target.value as SessionKind)}
                aria-describedby="sesi-kind-help"
                className={SELECT_CLASS}
              >
                {plan.options.map((o) => (
                  <option key={o.kind} value={o.kind}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div id="sesi-kind-help" className="mt-1.5 space-y-1">
                {plan.finished ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Materi ini sudah selesai untuk kelas ini. Sesi tambahan tidak mengubah progres.
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Pilih <strong>Sesi Penuh</strong> bila satu pertemuan menuntaskan Materi, atau{' '}
                    <strong>Sesi Terakhir</strong> untuk pertemuan terakhir Materi ini.
                  </p>
                )}
                {selected ? (
                  <p className="text-xs text-muted">
                    Tersimpan sebagai:{' '}
                    <span className="font-medium text-ink">
                      {buildSessionName(selected.kind, selected.partNumber, materialTitle)}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
            <div>
              <label htmlFor="sesi-at" className="mb-1 block text-sm font-medium text-ink">
                Tanggal &amp; Jam
              </label>
              <input id="sesi-at" name="scheduledAt" type="datetime-local" required className={SELECT_CLASS} />
            </div>
            <SubmitBtn label="Jadwalkan Sesi" pendingLabel="Menjadwalkan…" />
          </form>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Daftar sesi terjadwal ──────────────────────────────────────────────────── */

function SessionListPanel({ sessions }: { sessions: SessionLite[] }) {
  return (
    <Card>
      <CardHead title="Sesi Terjadwal" />
      <CardBody className="p-0">
        {sessions.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">Belum ada sesi terjadwal.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Kelas</TH>
                <TH>Nama Sesi</TH>
                <TH>Jadwal</TH>
              </TR>
            </THead>
            <TBody>
              {sessions.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">{s.className}</TD>
                  <TD>
                    <span>{s.name}</span>
                    <KindBadge kind={s.sessionKind} />
                  </TD>
                  <TD>{dateFmt.format(new Date(s.scheduledAt))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

/** Penanda sesi yang menuntaskan Materi (Selesai) atau sesi tambahan. */
function KindBadge({ kind }: { kind: SessionKind | null }) {
  if (kind === 'full' || kind === 'final') {
    return (
      <span className="ml-2 inline-block rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
        Selesai
      </span>
    );
  }
  if (kind === 'extra') {
    return (
      <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        Tambahan
      </span>
    );
  }
  return null;
}

/* ── Primitif bersama ───────────────────────────────────────────────────────── */

function StateToast({ state }: { state: SesiFormState }) {
  if (state.status === 'idle' || !state.message) return null;
  return <Toast tone={state.status === 'ok' ? 'success' : 'error'} message={state.message} />;
}

function SubmitBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
