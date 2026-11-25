'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import type { Karya } from '@/lib/domain/karya-service';
import type { PublicImageContentType } from '@/lib/s3/presign';

import {
  createKaryaAction,
  requestKaryaImageUploadAction,
  type KaryaFormState,
} from './actions';

const INIT: KaryaFormState = { status: 'idle' };

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
      {pending ? 'Menerbitkan…' : 'Terbitkan Karya'}
    </button>
  );
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'done'; publicUrl: string; bucket: string; s3Key: string }
  | { phase: 'error'; message: string };

/** Unggah thumbnail Karya ke bucket publik via presigned PUT. */
function ThumbnailUploadField() {
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
      const presign = await requestKaryaImageUploadAction(contentType);
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
    } catch {
      setUpload({ phase: 'error', message: 'Gagal mengunggah thumbnail. Coba lagi.' });
    }
  }

  function reset() {
    setUpload({ phase: 'idle' });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">Thumbnail (opsional)</label>

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
            alt="Pratinjau thumbnail karya"
            className="h-20 w-20 rounded-xl border border-line object-cover"
          />
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted hover:bg-soft"
          >
            Ganti gambar
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

export function KaryaPanels({ existing }: { existing: Karya[] }) {
  const [state, action] = useFormState(createKaryaAction, INIT);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHead title="Terbitkan Karya" />
        <CardBody>
          <form action={action} className="space-y-3">
            {state.status !== 'idle' && state.message ? (
              <Toast tone={state.status === 'ok' ? 'success' : 'error'} message={state.message} />
            ) : null}
            {/* Satu jenis karya saja: Inovasi Siswa. */}
            <input type="hidden" name="type" value="student" />
            <Input name="title" label="Judul" />
            <Input name="category" label="Kategori" />
            <Input name="schoolName" label="Asal Sekolah" />
            <Input name="mentor" label="Kelas & Guru Pembimbing" required={false} />
            <Input name="demoUrl" label="Tautan Demo (opsional)" type="url" required={false} />
            <TextArea name="summary" label="Ringkasan Solusi AI" rows={3} />
            <TextArea name="detail" label="Detail (opsional)" rows={4} required={false} />
            <ThumbnailUploadField />
            <SubmitBtn />
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Karya Terbit" />
        <CardBody className="p-0">
          {existing.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">Belum ada karya.</p>
          ) : (
            <ul className="divide-y divide-line">
              {existing.map((k) => (
                <li key={k.id} className="flex items-center gap-3 px-6 py-3">
                  {k.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={k.imageUrl}
                      alt={k.title}
                      className="h-12 w-12 flex-shrink-0 rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
                      —
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{k.title}</p>
                    <p className="text-xs text-muted">
                      Inovasi Siswa · {k.schoolName}
                      {k.published ? '' : ' · (disembunyikan)'}
                    </p>
                  </div>
                  <a href={`/showcase/${k.id}`} target="_blank" rel="noreferrer" className="flex-shrink-0 text-sm text-teal hover:underline">
                    Lihat →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Input({
  name,
  label,
  type = 'text',
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      />
    </div>
  );
}

function TextArea({
  name,
  label,
  rows,
  required = true,
}: {
  name: string;
  label: string;
  rows: number;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <textarea
        name={name}
        rows={rows}
        required={required}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      />
    </div>
  );
}
