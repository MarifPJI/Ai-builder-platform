'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import type { TeacherListItem } from '@/lib/domain/teacher-account-service';

import {
  activateTeacherRowAction,
  activateTeachersAction,
  adoptTeacherAction,
  createTeacherAction,
  importTeachersAction,
  type ActivateFormState,
  type AdoptFormState,
  type CreateTeacherFormState,
  type ImportFormState,
} from './actions';

/**
 * TeacherAdminPanels — UI Client Component layar `A03` (identity-tenancy).
 *
 * Panel sesuai alur pembuatan + aktivasi + adopsi (R2/R3):
 *  0. Daftar Akun Guru (status + tombol Aktifkan per-baris) — jalur aktivasi utama.
 *  1. Buat akun Guru (sandi sementara; wajib ganti saat login pertama).
 *  2. Adopsi/perbaiki Guru dari Supabase Auth (R2).
 *  3. Impor CSV massal → menampilkan `ImportSummary` + sandi sementara.
 *  4. Aktivasi batch (textarea) → jalur sekunder/bulk.
 *
 * Otorisasi admin ditegakkan di Server Action (requireSession requireRole admin);
 * komponen ini hanya menyajikan form & hasil. Sekolah dipilih via dropdown
 * (picker) dengan value = UUID sekolah, label = nama sekolah (R3).
 */

export interface SchoolOption {
  schoolId: string;
  name: string;
}

export interface TeacherAdminPanelsProps {
  teachers: TeacherListItem[];
  schools: SchoolOption[];
}

const CREATE_INIT: CreateTeacherFormState = { status: 'idle' };
const IMPORT_INIT: ImportFormState = { status: 'idle' };
const ACTIVATE_INIT: ActivateFormState = { status: 'idle' };
const ADOPT_INIT: AdoptFormState = { status: 'idle' };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Memproses…' : label}
    </Button>
  );
}

/** Tombol Aktifkan per-baris (jalur aktivasi utama yang discoverable — R3). */
function ActivateRowButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-60"
    >
      {pending ? 'Memproses…' : 'Aktifkan'}
    </button>
  );
}

const INPUT_CLASS =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal';

/** Field input bersama (email + nama lengkap + picker sekolah) untuk form. */
function TeacherFields({ schools }: { schools: SchoolOption[] }) {
  return (
    <>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Email Resmi</label>
        <input name="email" type="email" required maxLength={254} className={INPUT_CLASS} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Nama Lengkap</label>
        <input name="fullName" type="text" required maxLength={150} className={INPUT_CLASS} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Sekolah</label>
        <select name="schoolId" required defaultValue="" className={INPUT_CLASS}>
          <option value="" disabled>
            Pilih sekolah…
          </option>
          {schools.map((s) => (
            <option key={s.schoolId} value={s.schoolId}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export function TeacherAdminPanels({ teachers, schools }: TeacherAdminPanelsProps) {
  const [createState, createAction] = useFormState(createTeacherAction, CREATE_INIT);
  const [importState, importAction] = useFormState(importTeachersAction, IMPORT_INIT);
  const [adoptState, adoptAction] = useFormState(adoptTeacherAction, ADOPT_INIT);
  const [activateState, activateAction] = useFormState(
    activateTeachersAction,
    ACTIVATE_INIT,
  );

  const schoolNameById = new Map(schools.map((s) => [s.schoolId, s.name]));

  return (
    <div className="space-y-6">
      {/* 0. Daftar akun Guru + status + aktivasi per-baris (jalur utama) */}
      <Card>
        <CardHead title="Daftar Akun Guru" />
        <CardBody>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Nama Lengkap</TH>
                <TH>Sekolah</TH>
                <TH>Status</TH>
                <TH>Aksi</TH>
              </TR>
            </THead>
            <TBody>
              {teachers.length === 0 ? (
                <TR>
                  <TD className="text-muted" colSpan={5}>
                    Belum ada akun Guru.
                  </TD>
                </TR>
              ) : (
                teachers.map((t) => {
                  const isActive = t.activationStatus === 'active';
                  return (
                    <TR key={t.id}>
                      <TD>{t.email}</TD>
                      <TD>{t.fullName}</TD>
                      <TD>{schoolNameById.get(t.schoolId) ?? t.schoolId}</TD>
                      <TD>
                        <Badge tone={isActive ? 'hadir' : 'neutral'}>
                          {isActive ? 'Aktif' : 'Pending'}
                        </Badge>
                      </TD>
                      <TD>
                        {isActive ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <form action={activateTeacherRowAction}>
                            <input type="hidden" name="profileIds" value={t.id} />
                            <ActivateRowButton />
                          </form>
                        )}
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Buat akun (sandi sementara + ganti sandi wajib) */}
        <Card>
          <CardHead title="Buat Akun Guru" />
          <CardBody>
            <form action={createAction} className="space-y-4">
              {createState.status !== 'idle' && createState.message ? (
                <Toast
                  tone={createState.status === 'ok' ? 'success' : 'error'}
                  message={createState.message}
                />
              ) : null}
              {createState.status === 'ok' && createState.temporaryPassword ? (
                <div className="rounded-xl border border-line bg-soft p-3 text-sm">
                  <p className="text-muted">
                    Sandi sementara untuk {createState.email} (hanya tampil sekali):
                  </p>
                  <p className="mt-1 select-all font-mono text-base font-semibold text-ink">
                    {createState.temporaryPassword}
                  </p>
                </div>
              ) : null}
              <TeacherFields schools={schools} />
              <SubmitButton label="Buat Akun" />
            </form>
          </CardBody>
        </Card>

        {/* 2. Adopsi/perbaiki Guru dari Supabase Auth */}
        <Card>
          <CardHead title="Adopsi / Perbaiki Guru dari Supabase Auth" />
          <CardBody>
            <form action={adoptAction} className="space-y-4">
              {adoptState.status !== 'idle' && adoptState.message ? (
                <Toast
                  tone={adoptState.status === 'ok' ? 'success' : 'error'}
                  message={adoptState.message}
                />
              ) : null}
              <p className="text-sm text-muted">
                Gunakan untuk Guru yang sudah ada di Supabase Auth (mis. dibuat lewat
                Dashboard) tetapi belum punya profil di aplikasi.
              </p>
              <TeacherFields schools={schools} />
              <SubmitButton label="Adopsi / Perbaiki" />
            </form>
          </CardBody>
        </Card>

        {/* 3. Impor CSV massal */}
        <Card>
          <CardHead title="Impor Daftar Guru (CSV)" />
          <CardBody>
            <form action={importAction} className="space-y-4">
              <p className="text-sm text-muted">
                Format kolom: email, nama lengkap, ID sekolah. Maksimum 1.000 baris.
              </p>
              <textarea
                name="csv"
                rows={6}
                required
                placeholder={'email,nama lengkap,id sekolah'}
                className="w-full rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
              <SubmitButton label="Impor" />

              {importState.status === 'error' && importState.message ? (
                <Toast tone="error" message={importState.message} />
              ) : null}

              {importState.status === 'done' && importState.summary ? (
                <div className="rounded-xl border border-line bg-soft p-3 text-sm">
                  <p className="font-medium text-ink">
                    Ringkasan: {importState.summary.created} berhasil,{' '}
                    {importState.summary.rejected.length} ditolak dari{' '}
                    {importState.summary.total} baris.
                  </p>
                  {importState.summary.credentials.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-muted">
                        Sandi sementara (hanya tampil sekali). Format: email,sandi.
                      </p>
                      <textarea
                        readOnly
                        rows={Math.min(importState.summary.credentials.length, 8)}
                        value={importState.summary.credentials
                          .map((c) => `${c.email},${c.temporaryPassword}`)
                          .join('\n')}
                        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs"
                      />
                    </div>
                  ) : null}
                  {importState.summary.rejected.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-alfa">
                      {importState.summary.rejected.map((row) => (
                        <li key={row.line}>
                          Baris {row.line}: {row.reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </form>
          </CardBody>
        </Card>

        {/* 4. Aktivasi batch (jalur sekunder/bulk) */}
        <Card>
          <CardHead title="Aktivasi Akun Guru (Massal)" />
          <CardBody>
            <form action={activateAction} className="space-y-4">
              <p className="text-sm text-muted">
                Jalur sekunder: tempel daftar ID profil (satu per baris) untuk
                diaktifkan sekaligus. Jalur utama ada pada tombol Aktifkan di
                daftar di atas.
              </p>
              <textarea
                name="profileIds"
                rows={5}
                required
                placeholder="ID profil Guru…"
                className="w-full rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
              <SubmitButton label="Aktifkan" />

              {activateState.status === 'error' && activateState.message ? (
                <Toast tone="error" message={activateState.message} />
              ) : null}

              {activateState.status === 'done' && activateState.result ? (
                <div className="rounded-xl border border-line bg-soft p-3 text-sm">
                  <p className="font-medium text-hadir">
                    {activateState.result.activated.length} akun diaktifkan.
                  </p>
                  {activateState.result.failed.length > 0 ? (
                    <p className="mt-1 text-alfa">
                      {activateState.result.failed.length} gagal (tetap belum aktif):{' '}
                      {activateState.result.failed.join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
