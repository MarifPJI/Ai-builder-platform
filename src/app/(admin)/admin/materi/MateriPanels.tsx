'use client';

import { useState, useTransition } from 'react';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { normalizeCanvaEmbedUrl, normalizeVideoEmbedUrl } from '@/lib/domain/resource-url';
import type { MaterialResourceInput, ResourceType } from '@/lib/validation/material';

import {
  createMaterialWithResourcesAction,
  deleteMaterialAction,
  loadMaterialForEditAction,
  requestResourceUploadAction,
  unpublishMaterialAction,
  updateMaterialWithResourcesAction,
} from './actions';

/* ── Tipe tampilan ──────────────────────────────────────────────────────── */

interface ResourceSummary {
  total: number;
  canva: number;
  video: number;
  pdf: number;
  pptx: number;
  web: number;
}

interface MaterialListItem {
  id: string;
  title: string;
  timeAllocation: string | null;
  publishStatus: 'draft' | 'published';
  summary: ResourceSummary;
}

/** Sumber yang sedang disusun di form (draft lokal, belum disimpan). */
interface DraftResource {
  key: string; // id lokal untuk react key
  resourceType: ResourceType;
  title: string;
  externalUrl?: string;
  s3Bucket?: string;
  s3Key?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileName?: string; // tampilan nama berkas
}

const TYPE_META: Record<ResourceType, { label: string; badge: string; tone: string }> = {
  canva_embed: { label: '🎨 Canva Embed', badge: 'CANVA EMBED', tone: 'bg-primary-soft text-primary' },
  video_link: { label: '🎬 Video URL', badge: 'VIDEO', tone: 'bg-rose-100 text-rose-700' },
  pdf_file: { label: '📄 Berkas PDF', badge: 'PDF', tone: 'bg-red-100 text-red-700' },
  pptx_file: { label: '📊 Slide PPTX', badge: 'PPTX', tone: 'bg-amber-100 text-amber-700' },
  web_link: { label: '🔗 Tautan Web', badge: 'TAUTAN WEB', tone: 'bg-teal-100 text-teal-700' },
};

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `r_${Date.now()}_${keySeq}`;
}

/* ── Panel utama (dua kolom) ────────────────────────────────────────────── */

export function MateriPanels({ materials }: { materials: MaterialListItem[] }) {
  // Mode form: 'create' atau 'edit' (materialId termuat).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [timeAllocation, setTimeAllocation] = useState('');
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [resources, setResources] = useState<DraftResource[]>([]);
  const [formMsg, setFormMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setTimeAllocation('');
    setSummary('');
    setKeyPoints('');
    setResources([]);
    setFormMsg(null);
  }

  function addResource(r: DraftResource) {
    setResources((prev) => [...prev, r]);
  }
  function removeResource(key: string) {
    setResources((prev) => prev.filter((r) => r.key !== key));
  }
  function moveResource(key: string, dir: -1 | 1) {
    setResources((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item!);
      return copy;
    });
  }

  function toPayloadResources(): MaterialResourceInput[] {
    return resources.map((r) => ({
      resourceType: r.resourceType,
      title: r.title,
      externalUrl: r.externalUrl,
      s3Bucket: r.s3Bucket,
      s3Key: r.s3Key,
      mimeType: r.mimeType,
      fileSizeBytes: r.fileSizeBytes,
    }));
  }

  function save(publish: boolean) {
    if (!title.trim()) {
      setFormMsg({ tone: 'error', text: 'Judul Materi wajib diisi.' });
      return;
    }
    const payload = {
      title: title.trim(),
      timeAllocation: timeAllocation.trim() || undefined,
      summary: summary.trim() || undefined,
      keyPoints: keyPoints.trim() || undefined,
      resources: toPayloadResources(),
      publish,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateMaterialWithResourcesAction(editingId, payload)
        : await createMaterialWithResourcesAction(payload);
      if (res.ok) {
        setFormMsg({ tone: 'ok', text: res.message ?? 'Tersimpan.' });
        resetForm();
      } else {
        setFormMsg({ tone: 'error', text: res.message ?? 'Gagal menyimpan.' });
      }
    });
  }

  function loadForEdit(materialId: string) {
    startTransition(async () => {
      const res = await loadMaterialForEditAction(materialId);
      if (!res.ok || !res.material) {
        setFormMsg({ tone: 'error', text: res.message ?? 'Gagal memuat Materi.' });
        return;
      }
      const m = res.material;
      setEditingId(m.id);
      setTitle(m.title);
      setTimeAllocation(m.timeAllocation ?? '');
      setSummary(m.summary ?? '');
      setKeyPoints(m.keyPoints ?? '');
      setResources(
        m.resources.map((r) => ({
          key: nextKey(),
          resourceType: r.resourceType,
          title: r.title,
          externalUrl: r.externalUrl ?? undefined,
          s3Bucket: r.s3Bucket ?? undefined,
          s3Key: r.s3Key ?? undefined,
          mimeType: r.mimeType ?? undefined,
          fileSizeBytes: r.fileSizeBytes ?? undefined,
          fileName: r.s3Key ? r.s3Key.split('/').pop() : undefined,
        })),
      );
      setFormMsg({ tone: 'ok', text: `Mengelola sumber: ${m.title}` });
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BuildMaterialPanel
        editingId={editingId}
        title={title}
        setTitle={setTitle}
        timeAllocation={timeAllocation}
        setTimeAllocation={setTimeAllocation}
        summary={summary}
        setSummary={setSummary}
        keyPoints={keyPoints}
        setKeyPoints={setKeyPoints}
        resources={resources}
        addResource={addResource}
        removeResource={removeResource}
        moveResource={moveResource}
        onSave={save}
        onCancelEdit={resetForm}
        pending={pending}
        formMsg={formMsg}
      />
      <MaterialListPanel materials={materials} onManage={loadForEdit} pending={pending} />
    </div>
  );
}

/* ── Panel kiri: Buat / Kelola Materi + Multi-Source Builder ────────────── */

function BuildMaterialPanel(props: {
  editingId: string | null;
  title: string;
  setTitle: (v: string) => void;
  timeAllocation: string;
  setTimeAllocation: (v: string) => void;
  summary: string;
  setSummary: (v: string) => void;
  keyPoints: string;
  setKeyPoints: (v: string) => void;
  resources: DraftResource[];
  addResource: (r: DraftResource) => void;
  removeResource: (key: string) => void;
  moveResource: (key: string, dir: -1 | 1) => void;
  onSave: (publish: boolean) => void;
  onCancelEdit: () => void;
  pending: boolean;
  formMsg: { tone: 'ok' | 'error'; text: string } | null;
}) {
  const {
    editingId,
    title,
    setTitle,
    timeAllocation,
    setTimeAllocation,
    summary,
    setSummary,
    keyPoints,
    setKeyPoints,
    resources,
    addResource,
    removeResource,
    moveResource,
    onSave,
    onCancelEdit,
    pending,
    formMsg,
  } = props;

  return (
    <Card>
      <CardHead
        title={editingId ? 'Kelola Sumber Materi' : 'Buat Materi Baru'}
        action={
          editingId ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-sm text-muted hover:text-ink"
            >
              Batal
            </button>
          ) : (
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              {resources.length} Sumber Terlampir
            </span>
          )
        }
      />
      <CardBody className="space-y-4">
        <p className="text-sm text-muted">
          Satu Materi dapat memiliki banyak sumber sekaligus (Canva, Video, PDF, PPTX).
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Judul Materi" value={title} onChange={setTitle} required />
          <TextField
            label="Alokasi Waktu (opsional)"
            value={timeAllocation}
            onChange={setTimeAllocation}
            placeholder="mis. 60 Menit (2 JP)"
          />
        </div>
        <TextArea
          label="Ringkasan (opsional)"
          value={summary}
          onChange={setSummary}
          rows={2}
        />
        <TextArea
          label="Poin Kunci Penyampaian (opsional — 1 baris 1 poin)"
          value={keyPoints}
          onChange={setKeyPoints}
          rows={3}
        />

        <MultiSourceBuilder onAdd={addResource} pending={pending} />

        <AttachedResourceList
          resources={resources}
          onRemove={removeResource}
          onMove={moveResource}
        />

        {formMsg ? (
          <p
            className={
              formMsg.tone === 'ok'
                ? 'rounded-xl bg-teal-soft px-3 py-2 text-sm text-teal'
                : 'rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700'
            }
          >
            {formMsg.text}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => onSave(true)}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {editingId ? 'Simpan Perubahan Materi' : `Buat & Terbitkan Materi (${resources.length} Sumber)`}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSave(false)}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink hover:bg-soft disabled:opacity-50"
          >
            Simpan sebagai Draf
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Multi-source builder (segmented selector + input + tombol tambah) ──── */

function MultiSourceBuilder({
  onAdd,
  pending,
}: {
  onAdd: (r: DraftResource) => void;
  pending: boolean;
}) {
  const [type, setType] = useState<ResourceType>('canva_embed');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<
    { s3Bucket: string; s3Key: string; mimeType: string; fileName: string; fileSizeBytes: number } | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  const isLink = type === 'canva_embed' || type === 'video_link' || type === 'web_link';

  function reset() {
    setTitle('');
    setUrl('');
    setUploaded(null);
    setErr(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const kind = type === 'pdf_file' ? 'pdf' : 'pptx';
      const presign = await requestResourceUploadAction(kind);
      const putRes = await fetch(presign.url, {
        method: 'PUT',
        headers: { 'Content-Type': kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
        body: file,
      });
      if (!putRes.ok) throw new Error('Unggah berkas gagal.');
      setUploaded({
        s3Bucket: presign.bucket,
        s3Key: presign.s3Key,
        mimeType: file.type || (kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
        fileName: file.name,
        fileSizeBytes: file.size,
      });
    } catch {
      setErr('Gagal mengunggah berkas. Coba lagi.');
    } finally {
      setUploading(false);
    }
  }

  function add() {
    setErr(null);
    if (!title.trim()) {
      setErr('Judul sumber wajib diisi.');
      return;
    }
    if (isLink) {
      if (!url.trim()) {
        setErr('URL wajib diisi.');
        return;
      }
      // Normalisasi awal di klien (server menormalkan ulang sebagai sumber kebenaran).
      // web_link dipakai apa adanya (tanpa normalisasi embed).
      const normalized =
        type === 'canva_embed'
          ? normalizeCanvaEmbedUrl(url)
          : type === 'video_link'
            ? normalizeVideoEmbedUrl(url)
            : url.trim();
      onAdd({ key: nextKey(), resourceType: type, title: title.trim(), externalUrl: normalized });
    } else {
      if (!uploaded) {
        setErr('Unggah berkas terlebih dahulu.');
        return;
      }
      onAdd({
        key: nextKey(),
        resourceType: type,
        title: title.trim(),
        s3Bucket: uploaded.s3Bucket,
        s3Key: uploaded.s3Key,
        mimeType: uploaded.mimeType,
        fileSizeBytes: uploaded.fileSizeBytes,
        fileName: uploaded.fileName,
      });
    }
    reset();
  }

  return (
    <div className="rounded-2xl border border-line bg-soft/40 p-4">
      <p className="mb-3 text-sm font-semibold text-ink">Tambah Sumber &amp; Bahan Materi (Multi-Sumber)</p>

      {/* Segmented selector */}
      <div className="mb-3 flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
        {(Object.keys(TYPE_META) as ResourceType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setUploaded(null);
              setErr(null);
            }}
            className={
              t === type
                ? 'rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary'
                : 'rounded-full px-3 py-1.5 text-xs text-muted hover:text-ink'
            }
          >
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <TextField
          label="Judul Sumber / Bahan Ajar"
          value={title}
          onChange={setTitle}
          placeholder={type === 'canva_embed' ? 'mis. Slide Canva: Komputasional Thinking' : 'Judul sumber'}
        />
        {isLink ? (
          <TextField
            label={
              type === 'canva_embed'
                ? 'URL Canva Smart Embed'
                : type === 'video_link'
                  ? 'URL Video (YouTube/Vimeo/MP4)'
                  : 'URL Tautan Web (Notion, Google Doc, website)'
            }
            value={url}
            onChange={setUrl}
            placeholder={
              type === 'canva_embed'
                ? 'https://www.canva.com/design/DAG.../view'
                : type === 'video_link'
                  ? 'https://www.youtube.com/watch?v=...'
                  : 'https://notion.so/... atau https://docs.google.com/...'
            }
          />
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              {type === 'pdf_file' ? 'Berkas PDF (.pdf)' : 'Slide PPTX (.pptx)'}
            </label>
            <input
              type="file"
              accept={type === 'pdf_file' ? '.pdf,application/pdf' : '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation'}
              onChange={handleFile}
              disabled={uploading}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary"
            />
            {uploading ? <p className="mt-1 text-xs text-muted">Mengunggah…</p> : null}
            {uploaded ? (
              <p className="mt-1 text-xs text-teal">Terunggah: {uploaded.fileName}</p>
            ) : null}
          </div>
        )}

        {err ? <p className="text-xs text-red-600">{err}</p> : null}

        <button
          type="button"
          onClick={add}
          disabled={pending || uploading}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          + Tambah Sumber ke Materi
        </button>
      </div>
    </div>
  );
}

/* ── Daftar sumber terlampir ────────────────────────────────────────────── */

function AttachedResourceList({
  resources,
  onRemove,
  onMove,
}: {
  resources: DraftResource[];
  onRemove: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
}) {
  if (resources.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
        Belum ada sumber. Tambahkan minimal satu sumber di atas.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">Daftar Sumber pada Materi Ini ({resources.length})</p>
      <ul className="space-y-2">
        {resources.map((r, i) => {
          const meta = TYPE_META[r.resourceType];
          return (
            <li
              key={r.key}
              className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2"
            >
              <span className="text-xs font-semibold text-muted">#{i + 1}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
                {meta.badge}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                <p className="truncate text-xs text-muted">{r.externalUrl ?? r.fileName ?? r.s3Key}</p>
              </div>
              <div className="flex items-center gap-1">
                <IconBtn label="Naik" onClick={() => onMove(r.key, -1)}>↑</IconBtn>
                <IconBtn label="Turun" onClick={() => onMove(r.key, 1)}>↓</IconBtn>
                <IconBtn label="Hapus" onClick={() => onRemove(r.key)}>✕</IconBtn>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Panel kanan: Daftar Materi (bersih, tanpa input di baris) ──────────── */

function MaterialListPanel({
  materials,
  onManage,
  pending,
}: {
  materials: MaterialListItem[];
  onManage: (id: string) => void;
  pending: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listMsg, setListMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [, startTransition] = useTransition();

  function unpublish(id: string) {
    setBusyId(id);
    setListMsg(null);
    startTransition(async () => {
      const res = await unpublishMaterialAction(id);
      setBusyId(null);
      if (!res.ok) setListMsg({ tone: 'error', text: res.message ?? 'Gagal membatalkan terbit.' });
    });
  }

  function remove(m: MaterialListItem) {
    const ok = window.confirm(
      `Hapus Materi "${m.title}"? Seluruh sumber (Canva/Video/PDF/PPTX) dan ` +
        'penanda "sudah dibaca" Guru akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.',
    );
    if (!ok) return;
    setBusyId(m.id);
    setListMsg(null);
    startTransition(async () => {
      const res = await deleteMaterialAction(m.id);
      setBusyId(null);
      if (res.ok) {
        setListMsg({ tone: 'ok', text: 'Materi dihapus.' });
      } else {
        setListMsg({ tone: 'error', text: res.message ?? 'Gagal menghapus Materi.' });
      }
    });
  }

  return (
    <Card>
      <CardHead title={`Daftar Materi (${materials.length})`} />
      <CardBody className="space-y-3">
        {listMsg ? (
          <p
            className={
              listMsg.tone === 'ok'
                ? 'rounded-xl bg-teal-soft px-3 py-2 text-sm text-teal'
                : 'rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700'
            }
          >
            {listMsg.text}
          </p>
        ) : null}
        {materials.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Belum ada Materi.</p>
        ) : (
          materials.map((m) => (
            <div key={m.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.title}</p>
                  {m.timeAllocation ? (
                    <p className="text-xs text-muted">{m.timeAllocation}</p>
                  ) : null}
                </div>
                <span
                  className={
                    m.publishStatus === 'published'
                      ? 'shrink-0 rounded-full bg-teal-soft px-2.5 py-1 text-xs font-medium text-teal'
                      : 'shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-muted'
                  }
                >
                  {m.publishStatus === 'published' ? 'Terbit' : 'Draf'}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {m.summary.canva > 0 ? <Chip tone={TYPE_META.canva_embed.tone}>CANVA</Chip> : null}
                {m.summary.video > 0 ? <Chip tone={TYPE_META.video_link.tone}>VIDEO</Chip> : null}
                {m.summary.pdf > 0 ? <Chip tone={TYPE_META.pdf_file.tone}>PDF</Chip> : null}
                {m.summary.pptx > 0 ? <Chip tone={TYPE_META.pptx_file.tone}>PPTX</Chip> : null}
                {m.summary.web > 0 ? <Chip tone={TYPE_META.web_link.tone}>WEB</Chip> : null}
                <span className="text-xs text-muted">
                  {m.summary.total} Sumber aktif
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onManage(m.id)}
                  className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  ✎ Edit &amp; Kelola Sumber
                </button>
                <a
                  href={`/teacher/materi?materialId=${m.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-line px-4 py-1.5 text-sm text-ink hover:bg-soft"
                >
                  Pratinjau Guru →
                </a>
                {m.publishStatus === 'published' ? (
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => unpublish(m.id)}
                    className="rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:bg-soft disabled:opacity-50"
                  >
                    Batalkan Terbit
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => remove(m)}
                  className="rounded-full border border-red-200 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Hapus Materi
                </button>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/* ── Primitif kecil ─────────────────────────────────────────────────────── */

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
      />
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:bg-soft hover:text-ink"
    >
      {children}
    </button>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{children}</span>
  );
}
