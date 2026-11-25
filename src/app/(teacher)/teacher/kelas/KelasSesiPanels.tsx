'use client';

import { useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import type { ClassStudent, ClassSummary } from '@/lib/domain/class-service';

import {
  addStudentManualAction,
  createClassAction,
  getStudentsAction,
  importRosterAction,
  removeStudentAction,
  type RosterFormState,
  type TeacherFormState,
} from './actions';

const INIT: TeacherFormState = { status: 'idle' };
const ROSTER_INIT: RosterFormState = { status: 'idle' };

interface MaterialLite {
  id: string;
  title: string;
}

export function KelasSesiPanels({
  classes,
  materials,
  selectedClassId,
  students,
}: {
  classes: ClassSummary[];
  materials: MaterialLite[];
  selectedClassId: string | null;
  students: ClassStudent[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CreateClassPanel materials={materials} />
      <ClassRosterPanel
        classes={classes}
        initialSelectedClassId={selectedClassId}
        initialStudents={students}
      />
    </div>
  );
}

/* ── KIRI: Buat kelas (form kelas saja) ─────────────────────────────────────── */

function CreateClassPanel({ materials }: { materials: MaterialLite[] }) {
  const [state, action] = useFormState(createClassAction, INIT);
  return (
    <Card>
      <CardHead title="Buat Kelas" />
      <CardBody>
        <form action={action} className="space-y-3">
          <StateToast state={state} />
          <Field name="name" label="Nama Kelas" />
          <Field name="gradeLevel" label="Jenjang/Tingkat (opsional)" required={false} />
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Materi Pegangan (opsional)
            </label>
            <select
              name="materialId"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <option value="">— Tidak dipilih —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          <SubmitBtn label="Buat Kelas" pendingLabel="Menyimpan…" />
        </form>
      </CardBody>
    </Card>
  );
}

/* ── KANAN: Daftar kelas + panel siswa berbasis seleksi ─────────────────────── */

function ClassRosterPanel({
  classes,
  initialSelectedClassId,
  initialStudents,
}: {
  classes: ClassSummary[];
  initialSelectedClassId: string | null;
  initialStudents: ClassStudent[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedClassId);
  const [students, setStudents] = useState<ClassStudent[]>(initialStudents);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isLoading, startLoad] = useTransition();

  function loadStudents(id: string) {
    startLoad(async () => {
      const next = await getStudentsAction(id);
      setStudents(next);
    });
  }

  function selectClass(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setMode('view');
    loadStudents(id);
  }

  function refreshStudents() {
    if (selectedId) loadStudents(selectedId);
  }

  const selectedClass = classes.find((c) => c.id === selectedId) ?? null;

  return (
    <Card>
      <CardHead title="Daftar Kelas" />
      <CardBody className="space-y-4">
        {classes.length === 0 ? (
          <p className="text-sm text-muted">
            Belum ada kelas. Buat kelas terlebih dahulu di panel kiri.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {classes.map((c) => {
              const active = c.id === selectedId;
              const count = active ? students.length : c.studentCount;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectClass(c.id)}
                    className={
                      'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ' +
                      (active
                        ? 'bg-primary-soft font-medium text-primary'
                        : 'text-ink hover:bg-soft')
                    }
                  >
                    <span className="truncate">{c.name}</span>
                    <span
                      className={
                        'ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs ' +
                        (active ? 'bg-primary text-white' : 'bg-soft text-muted')
                      }
                    >
                      {count} siswa
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selectedClass ? (
          <div className="rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{selectedClass.name}</p>
                <p className="text-xs text-muted">
                  {isLoading ? 'Memuat…' : `${students.length} siswa`}
                </p>
              </div>
              {mode === 'view' ? (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="rounded-full border border-teal px-3 py-1.5 text-sm font-medium text-teal hover:bg-teal-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  Edit Daftar Siswa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  Selesai
                </button>
              )}
            </div>

            <div className="space-y-4 px-4 py-4">
              {mode === 'edit' ? (
                <EditRosterForms classId={selectedClass.id} onMutated={refreshStudents} />
              ) : null}

              <StudentList
                classId={selectedClass.id}
                students={students}
                editable={mode === 'edit'}
                onRemoved={refreshStudents}
              />
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ── Daftar siswa (read-only atau dengan tombol Hapus) ──────────────────────── */

function StudentList({
  classId,
  students,
  editable,
  onRemoved,
}: {
  classId: string;
  students: ClassStudent[];
  editable: boolean;
  onRemoved: () => void;
}) {
  const [isPending, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove(student: ClassStudent) {
    if (!window.confirm(`Hapus siswa "${student.fullName}" dari kelas ini?`)) return;
    setError(null);
    startRemove(async () => {
      const res = await removeStudentAction(classId, student.id);
      if (res.status === 'error') {
        setError(res.message ?? 'Gagal menghapus siswa.');
        return;
      }
      onRemoved();
    });
  }

  if (students.length === 0) {
    return <p className="text-sm text-muted">Belum ada siswa.</p>;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Daftar Siswa ({students.length})
      </p>
      {error ? <Toast tone="error" message={error} /> : null}
      <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
        {students.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink">{s.fullName}</span>
            <span className="shrink-0 text-muted">{s.nis}</span>
            {editable ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemove(s)}
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-alfa hover:bg-alfa-soft disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                Hapus
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Mode edit: Input Sekaligus + Satu per Satu ─────────────────────────────── */

function EditRosterForms({
  classId,
  onMutated,
}: {
  classId: string;
  onMutated: () => void;
}) {
  const [tab, setTab] = useState<'bulk' | 'manual'>('bulk');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-line p-1 text-sm">
        <button
          type="button"
          aria-pressed={tab === 'bulk'}
          onClick={() => setTab('bulk')}
          className={
            tab === 'bulk'
              ? 'rounded-full bg-primary-soft px-3 py-1 font-medium text-primary'
              : 'rounded-full px-3 py-1 text-muted hover:text-ink'
          }
        >
          Input Sekaligus
        </button>
        <button
          type="button"
          aria-pressed={tab === 'manual'}
          onClick={() => setTab('manual')}
          className={
            tab === 'manual'
              ? 'rounded-full bg-primary-soft px-3 py-1 font-medium text-primary'
              : 'rounded-full px-3 py-1 text-muted hover:text-ink'
          }
        >
          Satu per Satu
        </button>
      </div>

      {tab === 'bulk' ? (
        <BulkRosterForm classId={classId} onMutated={onMutated} />
      ) : (
        <ManualRosterForm classId={classId} onMutated={onMutated} />
      )}
    </div>
  );
}

function BulkRosterForm({ classId, onMutated }: { classId: string; onMutated: () => void }) {
  const [state, action] = useFormState(importRosterAction, ROSTER_INIT);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const lastHandled = useRef<RosterFormState | null>(null);

  // Setelah impor sukses, segarkan daftar siswa induk (sekali per state baru).
  if (state.status === 'ok' && state !== lastHandled.current) {
    lastHandled.current = state;
    onMutated();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (textRef.current) textRef.current.value = String(reader.result ?? '');
    };
    reader.readAsText(file);
  }

  return (
    <form action={action} className="space-y-3">
      <StateToast state={state} />
      <input type="hidden" name="classId" value={classId} />
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Daftar Siswa (NIS, Nama)</label>
        <textarea
          ref={textRef}
          name="text"
          rows={6}
          placeholder={'12345, Budi Santoso\n12346, Siti Aminah'}
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        />
        <p className="mt-1 text-xs text-muted">
          Tempel daftar <code>NIS, Nama</code> atau impor file CSV (simpan dari Excel/Sheets sebagai
          CSV).
        </p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Impor CSV</label>
        <input
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={onFile}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-soft file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:bg-line"
        />
      </div>
      <SubmitBtn label="Impor Daftar Siswa" pendingLabel="Mengimpor…" />

      {state.summary && state.summary.rejected.length > 0 ? (
        <div className="rounded-xl border border-line bg-soft p-3">
          <p className="mb-1 text-xs font-semibold text-ink">Baris ditolak:</p>
          <ul className="space-y-0.5 text-xs text-muted">
            {state.summary.rejected.map((r) => (
              <li key={r.line}>
                Baris {r.line}: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

function ManualRosterForm({ classId, onMutated }: { classId: string; onMutated: () => void }) {
  const [state, action] = useFormState(addStudentManualAction, INIT);
  const lastHandled = useRef<TeacherFormState | null>(null);

  if (state.status === 'ok' && state !== lastHandled.current) {
    lastHandled.current = state;
    onMutated();
  }

  return (
    <form action={action} className="space-y-3">
      <StateToast state={state} />
      <input type="hidden" name="classId" value={classId} />
      <Field name="nis" label="NIS" />
      <Field name="fullName" label="Nama Lengkap" />
      <SubmitBtn label="Tambah Siswa" pendingLabel="Menyimpan…" />
    </form>
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

function StateToast({ state }: { state: TeacherFormState }) {
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
