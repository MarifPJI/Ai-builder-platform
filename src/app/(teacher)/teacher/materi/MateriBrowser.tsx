'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { isDirectMp4 } from '@/lib/domain/resource-url';
import type { ResourceType } from '@/lib/validation/material';

import { markReadAction } from './actions';

/* ── Tipe (sejajar dengan page.tsx) ─────────────────────────────────────── */

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
  summary: ResourceSummary;
  /** Hanya diisi di pratinjau Admin (Guru hanya melihat Materi terbit). */
  publishStatus?: 'draft' | 'published';
}

/**
 * `teacher`: tampilan Guru (tombol "Tandai Sudah Dibaca").
 * `admin`  : pratinjau Admin — tampilan sama, tanpa penanda baca, plus label Draf.
 */
export type MateriBrowserMode = 'teacher' | 'admin';

/** Sumber siap-tampil: URL Canva/Video sudah dinormalisasi; berkas sudah dipresign. */
export interface ViewerResource {
  id: string;
  resourceType: ResourceType;
  title: string;
  externalUrl: string | null;
  fileUrl: string | null; // presigned GET untuk pdf/pptx
  fileSizeBytes: number | null;
}

interface Detail {
  id: string;
  title: string;
  timeAllocation: string | null;
  summary: string | null;
  keyPoints: string | null;
  resources: ViewerResource[];
  publishStatus?: 'draft' | 'published';
}

const TYPE_LABEL: Record<ResourceType, string> = {
  canva_embed: 'CANVA EMBED',
  video_link: 'VIDEO',
  pdf_file: 'PDF',
  pptx_file: 'PPTX',
  web_link: 'TAUTAN WEB',
};

const TYPE_TONE: Record<ResourceType, string> = {
  canva_embed: 'bg-primary-soft text-primary',
  video_link: 'bg-rose-100 text-rose-700',
  pdf_file: 'bg-red-100 text-red-700',
  pptx_file: 'bg-amber-100 text-amber-700',
  web_link: 'bg-teal-100 text-teal-700',
};

/* ── Komponen utama (dua kolom) ─────────────────────────────────────────── */

export function MateriBrowser({
  materials,
  selectedId,
  detail,
  mode = 'teacher',
  basePath = '/teacher/materi',
}: {
  materials: MaterialListItem[];
  selectedId: string | null;
  detail: Detail | null;
  mode?: MateriBrowserMode;
  /** Halaman tujuan tautan daftar Materi (`?materialId=` ditambahkan). */
  basePath?: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <MaterialList materials={materials} selectedId={selectedId} basePath={basePath} />
      {detail ? (
        <MaterialDetail detail={detail} mode={mode} />
      ) : (
        <Card>
          <CardBody>
            <p className="py-10 text-center text-sm text-muted">
              {mode === 'admin'
                ? 'Materi tidak ditemukan. Pilih Materi dari daftar.'
                : 'Belum ada Materi terbit. Hubungi Admin.'}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DraftBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      DRAF
    </span>
  );
}

/* ── Kolom kiri: daftar Materi ──────────────────────────────────────────── */

function MaterialList({
  materials,
  selectedId,
  basePath,
}: {
  materials: MaterialListItem[];
  selectedId: string | null;
  basePath: string;
}) {
  return (
    <Card>
      <CardHead title="Daftar Materi" />
      <CardBody className="space-y-2">
        {materials.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Belum ada Materi.</p>
        ) : (
          materials.map((m) => {
            const active = m.id === selectedId;
            return (
              <a
                key={m.id}
                href={`${basePath}?materialId=${encodeURIComponent(m.id)}`}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'block rounded-2xl border border-primary bg-primary-soft/40 p-3'
                    : 'block rounded-2xl border border-line p-3 hover:bg-soft'
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{m.title}</p>
                  {m.publishStatus === 'draft' ? <DraftBadge /> : null}
                </div>
                {m.timeAllocation ? (
                  <p className="text-xs text-muted">{m.timeAllocation}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.summary.canva > 0 ? <MiniChip type="canva_embed" /> : null}
                  {m.summary.video > 0 ? <MiniChip type="video_link" /> : null}
                  {m.summary.pdf > 0 ? <MiniChip type="pdf_file" /> : null}
                  {m.summary.pptx > 0 ? <MiniChip type="pptx_file" /> : null}
                  {m.summary.web > 0 ? <MiniChip type="web_link" /> : null}
                  <span className="text-[11px] text-muted">{m.summary.total} Sumber</span>
                </div>
              </a>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}

/* ── Kolom kanan: detail materi + viewer ────────────────────────────────── */

function MaterialDetail({ detail, mode }: { detail: Detail; mode: MateriBrowserMode }) {
  const [activeId, setActiveId] = useState<string | null>(detail.resources[0]?.id ?? null);
  const [marked, setMarked] = useState(false);
  const [pending, startTransition] = useTransition();

  // Reset sumber aktif saat materi berganti.
  useEffect(() => {
    setActiveId(detail.resources[0]?.id ?? null);
    setMarked(false);
  }, [detail.id, detail.resources]);

  const active = detail.resources.find((r) => r.id === activeId) ?? null;
  const keyPointLines = (detail.keyPoints ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  function markRead() {
    startTransition(async () => {
      const res = await markReadAction(detail.id);
      if (res.status === 'ok') setMarked(true);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {detail.timeAllocation ? (
                <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-medium text-teal">
                  Alokasi Waktu: {detail.timeAllocation}
                </span>
              ) : null}
              <span className="rounded-full bg-indigo-soft px-3 py-1 text-xs font-medium text-indigo">
                {detail.resources.length} Sumber Materi Tersedia
              </span>
              {detail.publishStatus === 'draft' ? <DraftBadge /> : null}
            </div>
            {mode === 'teacher' ? (
              <button
                type="button"
                onClick={markRead}
                disabled={pending || marked}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {marked ? 'Sudah Dibaca ✓' : 'Tandai Sudah Dibaca'}
              </button>
            ) : null}
          </div>
          <h2 className="mt-3 text-lg font-semibold text-ink">{detail.title}</h2>
          {detail.summary ? (
            <p className="mt-1 text-sm text-muted">{detail.summary}</p>
          ) : null}
        </CardBody>
      </Card>

      {/* Panggung pratinjau (sumber aktif dipilih dari "Semua Sumber" di bawah) */}
      {detail.resources.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-muted">
              Materi ini belum memiliki sumber.
            </p>
          </CardBody>
        </Card>
      ) : active ? (
        <EmbedStage resource={active} />
      ) : null}

      {/* Semua Sumber & Lampiran — LEBAR PENUH agar judul tidak terpotong.
          Memilih sumber dilakukan di sini (Tampilkan untuk Canva/Video/PDF/PPTX,
          Buka untuk Tautan Web). */}
      <Card>
        <CardHead title={`Semua Sumber & Lampiran (${detail.resources.length})`} />
        <CardBody className="space-y-2">
          {detail.resources.length === 0 ? (
            <p className="text-sm text-muted">Belum ada sumber pada materi ini.</p>
          ) : (
            detail.resources.map((r) => {
              const isActive = r.id === activeId;
              return (
                <div
                  key={r.id}
                  className={
                    isActive
                      ? 'flex flex-wrap items-center gap-3 rounded-xl border border-primary bg-primary-soft/40 px-4 py-3'
                      : 'flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3'
                  }
                >
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_TONE[r.resourceType]}`}>
                    {TYPE_LABEL[r.resourceType]}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">{r.title}</span>
                  {r.resourceType === 'pdf_file' || r.resourceType === 'pptx_file' ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveId(r.id)}
                        className="rounded-full border border-line px-3 py-1 text-xs text-ink hover:bg-soft"
                      >
                        Tampilkan ↑
                      </button>
                      {r.fileUrl ? (
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"
                        >
                          Unduh
                        </a>
                      ) : (
                        <span className="text-xs text-muted">Tidak tersedia</span>
                      )}
                    </div>
                  ) : r.resourceType === 'web_link' && r.externalUrl ? (
                    <a
                      href={r.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"
                    >
                      Buka ↗
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveId(r.id)}
                      className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink hover:bg-soft"
                    >
                      Tampilkan ↑
                    </button>
                  )}
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      {/* Poin Kunci Penyampaian — blok sendiri, lebar penuh. */}
      <Card>
        <CardHead title="Poin Kunci Penyampaian di Kelas" />
        <CardBody>
          {keyPointLines.length === 0 ? (
            <p className="text-sm text-muted">Belum ada poin kunci.</p>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
              {keyPointLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Panggung pratinjau interaktif (16:9) ───────────────────────────────── */

function EmbedStage({ resource }: { resource: ViewerResource }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function goFullscreen() {
    const el = frameRef.current ?? videoRef.current;
    if (el && el.requestFullscreen) void el.requestFullscreen();
  }

  if (resource.resourceType === 'canva_embed' && resource.externalUrl) {
    return (
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <p className="truncate text-sm font-medium text-ink">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_TONE.canva_embed}`}>
              CANVA SMART EMBED
            </span>
            {resource.title}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goFullscreen}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink hover:bg-soft"
            >
              ⛶ Layar Penuh
            </button>
            <a
              href={resource.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line px-3 py-1 text-xs text-ink hover:bg-soft"
            >
              Buka di Canva ↗
            </a>
          </div>
        </div>
        <iframe
          ref={frameRef}
          src={resource.externalUrl}
          title={resource.title}
          loading="lazy"
          allowFullScreen
          allow="fullscreen"
          className="aspect-video w-full rounded-b-card border-0"
        />
      </Card>
    );
  }

  if (resource.resourceType === 'video_link' && resource.externalUrl) {
    const mp4 = isDirectMp4(resource.externalUrl);
    return (
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <p className="truncate text-sm font-medium text-ink">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_TONE.video_link}`}>
              VIDEO
            </span>
            {resource.title}
          </p>
          {!mp4 ? (
            <button
              type="button"
              onClick={goFullscreen}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink hover:bg-soft"
            >
              ⛶ Layar Penuh
            </button>
          ) : null}
        </div>
        {mp4 ? (
          <video ref={videoRef} src={resource.externalUrl} controls className="aspect-video w-full rounded-b-card" />
        ) : (
          <iframe
            ref={frameRef}
            src={resource.externalUrl}
            title={resource.title}
            allowFullScreen
            allow="fullscreen"
            className="aspect-video w-full rounded-b-card border-0"
          />
        )}
      </Card>
    );
  }

  if (resource.resourceType === 'pdf_file') {
    return (
      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <p className="truncate text-sm font-medium text-ink">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_TONE.pdf_file}`}>
              PDF
            </span>
            {resource.title}
          </p>
          {resource.fileUrl ? (
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"
            >
              Unduh PDF
            </a>
          ) : null}
        </div>
        {resource.fileUrl ? (
          <iframe
            src={resource.fileUrl}
            title={resource.title}
            className="aspect-video w-full rounded-b-card border-0"
          />
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">Berkas PDF tidak tersedia.</p>
        )}
      </Card>
    );
  }

  if (resource.resourceType === 'web_link') {
    // Tautan web umum (Notion/Doc/website): TIDAK di-iframe (banyak situs blokir
    // embed); tampilkan kartu + buka tab baru.
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TYPE_TONE.web_link}`}>
            TAUTAN WEB
          </span>
          <p className="text-sm font-medium text-ink">{resource.title}</p>
          {resource.externalUrl ? (
            <>
              <p className="max-w-md break-all text-xs text-muted">{resource.externalUrl}</p>
              <a
                href={resource.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Buka Tautan ↗
              </a>
            </>
          ) : (
            <span className="text-xs text-muted">Tautan tidak tersedia.</span>
          )}
        </CardBody>
      </Card>
    );
  }

  // pptx_file — tidak bisa dirender inline; kartu info + unduh.
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TYPE_TONE.pptx_file}`}>
          PPTX
        </span>
        <p className="text-sm font-medium text-ink">{resource.title}</p>
        <p className="max-w-sm text-xs text-muted">
          Slide PowerPoint tidak dapat ditampilkan langsung di halaman. Unduh berkas
          untuk membukanya di PowerPoint atau aplikasi serupa.
        </p>
        {resource.fileUrl ? (
          <a
            href={resource.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Unduh Slide PPTX
          </a>
        ) : (
          <span className="text-xs text-muted">Berkas tidak tersedia.</span>
        )}
      </CardBody>
    </Card>
  );
}

function MiniChip({ type }: { type: ResourceType }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_TONE[type]}`}>
      {TYPE_LABEL[type]}
    </span>
  );
}
