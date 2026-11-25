'use client';

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import type { GalleryItem } from '@/lib/domain/gallery-service';
import type { PublicImageContentType } from '@/lib/s3/presign';

import {
  createGaleriAction,
  deleteGaleriAction,
  requestGaleriImageUploadAction,
  updateGaleriAction,
  type GaleriFormState,
} from './actions';

const INIT: GaleriFormState = { status: 'idle' };
const YEARS = [2024, 2025, 2026] as const;

const ACCEPTED_IMAGE_TYPES: Record<string, PublicImageContentType> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
    >
      {pending ? 'Menerbitkan…' : 'Terbitkan'}
    </button>
  );
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'done'; publicUrl: string; bucket: string; s3Key: string }
  | { phase: 'error'; message: string };

/**
 * Field unggah foto yang dipakai ulang di form Terbitkan & Edit. `label` dan
 * `onUploaded` opsional; saat sukses, memancarkan hidden field imageUrl/bucket/key
 * dan memanggil `onUploaded` (dipakai form edit untuk menyetel imageAction=replace).
 */
function ImageUploadField({
  label = 'Foto (opsional)',
  onUploaded,
}: {
  label?: string;
  onUploaded?: (done: boolean) => void;
}) {
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const contentType = ACCEPTED_IMAGE_TYPES[file.type];
    if (!contentType) {
      setUpload({ phase: 'error', message: 'Format tidak didukung. Gunakan JPEG, PNG, atau WebP.' });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUpload({ phase: 'error', message: 'Ukuran gambar maksimum 5 MB.' });
      return;
    }
    setUpload({ phase: 'uploading' });
    try {
      const presign = await requestGaleriImageUploadAction(contentType);
      const put = await fetch(presign.url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!put.ok) throw new Error(`PUT gagal (${put.status})`);
      setUpload({
        phase: 'done',
        publicUrl: presign.publicUrl,
        bucket: presign.bucket,
        s3Key: presign.s3Key,
      });
      onUploaded?.(true);
    } catch {
      setUpload({ phase: 'error', message: 'Gagal mengunggah gambar. Coba lagi.' });
      onUploaded?.(false);
    }
  }

  function reset() {
    setUpload({ phase: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
    onUploaded?.(false);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>

      {/* Field tersembunyi yang dikirim bersama form bila unggah berhasil. */}
      {upload.phase === 'done' ? (
        <>
          <input type="hidden" name="imageUrl" value={upload.publicUrl} />
          <input type="hidden" name="imageBucket" value={upload.bucket} />
          <input type="hidden" name="imageKey" value={upload.s3Key} />
        </>
      ) : null}

      {upload.phase === 'done' ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={upload.publicUrl}
            alt="Pratinjau foto galeri"
            className="h-20 w-20 rounded-xl border border-line object-cover"
          />
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted hover:bg-soft"
          >
            Ganti foto
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onPick}
          disabled={upload.phase === 'uploading'}
          className="block w-full text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover disabled:opacity-50"
        />
      )}

      {upload.phase === 'uploading' ? (
        <p className="mt-1 text-xs text-muted">Mengunggah…</p>
      ) : null}
      {upload.phase === 'error' ? (
        <p className="mt-1 text-xs text-alfa">{upload.message}</p>
      ) : (
        <p className="mt-1 text-xs text-muted">JPEG, PNG, atau WebP. Maksimum 5 MB.</p>
      )}
    </div>
  );
}

function EditSubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
    >
      {pending ? 'Menyimpan…' : 'Simpan'}
    </button>
  );
}

/** Satu baris item galeri: tampilan ringkas + mode Edit inline + konfirmasi Hapus. */
function GalleryItemRow({ item }: { item: GalleryItem }) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [editState, editAction] = useFormState(updateGaleriAction, INIT);
  // Perlakuan foto saat edit: default pertahankan foto lama.
  const [imageAction, setImageAction] = useState<'keep' | 'replace' | 'remove'>('keep');

  // Keluar dari mode edit begitu simpan berhasil (revalidatePath menyegarkan data).
  useEffect(() => {
    if (editState.status === 'ok') {
      setMode('view');
      setImageAction('keep');
    }
  }, [editState]);

  if (mode === 'edit') {
    return (
      <li className="px-6 py-4">
        <form action={editAction} className="space-y-3">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="imageAction" value={imageAction} />
          {editState.status === 'error' && editState.message ? (
            <Toast tone="error" message={editState.message} />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Tahun</label>
              <select
                name="year"
                defaultValue={String(item.year)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {Array.from(new Set([...YEARS, item.year])).sort((a, b) => a - b).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Judul</label>
              <input
                name="title"
                required
                defaultValue={item.title}
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink">Keterangan (opsional)</label>
            <textarea
              name="caption"
              rows={2}
              defaultValue={item.caption ?? ''}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            />
          </div>

          {/* Pilihan perlakuan foto */}
          <div>
            <p className="mb-1 text-xs font-medium text-ink">Foto</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-12 w-12 rounded-lg border border-line object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-line">—</span>
              )}
              <label className="flex items-center gap-1">
                <input type="radio" name="_imgopt" checked={imageAction === 'keep'} onChange={() => setImageAction('keep')} />
                Pertahankan
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="_imgopt" checked={imageAction === 'replace'} onChange={() => setImageAction('replace')} />
                Ganti foto
              </label>
              {item.imageUrl ? (
                <label className="flex items-center gap-1">
                  <input type="radio" name="_imgopt" checked={imageAction === 'remove'} onChange={() => setImageAction('remove')} />
                  Hapus foto
                </label>
              ) : null}
            </div>
            {imageAction === 'replace' ? (
              <div className="mt-2">
                <ImageUploadField label="Unggah foto baru" />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <EditSubmitBtn />
            <button
              type="button"
              onClick={() => {
                setMode('view');
                setImageAction('keep');
              }}
              className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-muted hover:bg-soft"
            >
              Batal
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-6 py-3">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-12 w-12 flex-shrink-0 rounded-lg border border-line object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
          —
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="text-xs text-muted">
          {item.year}
          {item.caption ? ` · ${item.caption}` : ''}
        </p>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Yakin hapus?</span>
          <button
            type="button"
            disabled={deleting}
            onClick={() => startDelete(() => deleteGaleriAction(item.id))}
            className="rounded-full bg-alfa-soft px-3 py-1 text-xs font-medium text-alfa hover:opacity-80 disabled:opacity-50"
          >
            {deleting ? 'Menghapus…' : 'Ya, hapus'}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirming(false)}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted hover:bg-soft"
          >
            Batal
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-soft"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-alfa hover:bg-alfa-soft"
          >
            Hapus
          </button>
        </div>
      )}
    </li>
  );
}

export function GaleriPanels({ existing }: { existing: GalleryItem[] }) {
  const [state, action] = useFormState(createGaleriAction, INIT);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHead title="Terbitkan Item Galeri" />
        <CardBody>
          <form action={action} className="space-y-3">
            {state.status !== 'idle' && state.message ? (
              <Toast tone={state.status === 'ok' ? 'success' : 'error'} message={state.message} />
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Tahun</label>
              <select
                name="year"
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Judul</label>
              <input
                name="title"
                required
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Keterangan (opsional)</label>
              <textarea
                name="caption"
                rows={3}
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
            </div>
            <ImageUploadField />
            <SubmitBtn />
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Item Galeri" />
        <CardBody className="p-0">
          {existing.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">Belum ada item galeri.</p>
          ) : (
            <ul className="divide-y divide-line">
              {existing.map((g) => (
                <GalleryItemRow key={g.id} item={g} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
