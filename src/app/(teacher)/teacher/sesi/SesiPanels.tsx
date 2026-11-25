'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import type { ClassSummary } from '@/lib/domain/class-service';

import { scheduleSessionAction, type SesiFormState } from './actions';

const INIT: SesiFormState = { status: 'idle' };

// WIB (Asia/Jakarta) WAJIB di-set: server produksi berjalan di UTC; tanpa ini
// jadwal sesi akan tampil dalam UTC (bergeser -7 jam dari WIB).
const dateFmt = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta',
});

interface MaterialLite {
  id: string;
  title: string;
}
interface SessionLite {
  id: string;
  name: string;
  className: string;
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
      <ScheduleSessionPanel classes={classes} materials={materials} />
      <SessionListPanel sessions={sessions} />
    </div>
  );
}

/* ── Jadwalkan sesi ─────────────────────────────────────────────────────────── */

function ScheduleSessionPanel({
  classes,
  materials,
}: {
  classes: ClassSummary[];
  materials: MaterialLite[];
}) {
  const [state, action] = useFormState(scheduleSessionAction, INIT);
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
              <label className="mb-1 block text-sm font-medium text-ink">Kelas</label>
              <select
                name="classId"
                required
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Materi</label>
              <select
                name="materialId"
                required
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <Field name="name" label="Nama Sesi" />
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Tanggal &amp; Jam</label>
              <input
                name="scheduledAt"
                type="datetime-local"
                required
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
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
                  <TD>{s.name}</TD>
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

/* ── Primitif bersama ───────────────────────────────────────────────────────── */

function Field({
  name,
  label,
  required = true,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <input
        name={name}
        type="text"
        required={required}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      />
    </div>
  );
}

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
