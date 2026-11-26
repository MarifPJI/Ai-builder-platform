import { MateriBrowser, type ViewerResource } from '@/app/(teacher)/teacher/materi/MateriBrowser';
import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { requireSession } from '@/lib/auth/guard';
import {
  getWithResourcesForAdmin,
  listAllForAdminWithSummary,
  presignResourceForAdmin,
  type MaterialWithResources,
} from '@/lib/domain/material-service';

/**
 * Pratinjau Materi untuk Admin (`/admin/materi/pratinjau?materialId=`).
 *
 * Menampilkan Materi persis seperti yang dilihat Guru di `/teacher/materi`,
 * tetapi memakai sesi Admin: Materi draf ikut tampil (berlabel DRAF) dan tidak
 * ada penanda "Sudah Dibaca". Berkas PDF/PPTX dipresign di server.
 */
export const dynamic = 'force-dynamic';

export default async function AdminMateriPreviewPage({
  searchParams,
}: {
  searchParams?: { materialId?: string };
}) {
  const claims = await requireSession({ requireRole: 'admin' });

  const materials = await listAllForAdminWithSummary(claims);
  const requestedId = typeof searchParams?.materialId === 'string' ? searchParams.materialId : null;
  const selectedId = requestedId ?? materials[0]?.id ?? null;

  let detail: MaterialWithResources | null = null;
  if (selectedId) {
    try {
      detail = await getWithResourcesForAdmin(claims, selectedId);
    } catch {
      detail = null;
    }
  }

  let viewerResources: ViewerResource[] = [];
  if (detail) {
    viewerResources = await Promise.all(
      detail.resources.map(async (r) => {
        let fileUrl: string | null = null;
        if (r.resourceType === 'pdf_file' || r.resourceType === 'pptx_file') {
          try {
            fileUrl = await presignResourceForAdmin(claims, r.id);
          } catch {
            fileUrl = null;
          }
        }
        return {
          id: r.id,
          resourceType: r.resourceType,
          title: r.title,
          externalUrl: r.externalUrl,
          fileUrl,
          fileSizeBytes: r.fileSizeBytes,
        };
      }),
    );
  }

  return (
    <AppShell brand="AI Builder" nav={adminNav('/admin/materi')} schoolLabel="Program Nasional" avatarInitials="AD">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Pratinjau Materi</h1>
          <p className="mt-1 text-sm text-muted">
            Tampilan Materi seperti yang dilihat Guru. Materi berlabel DRAF belum
            terlihat oleh Guru sampai diterbitkan.
          </p>
        </div>
        <a
          href="/admin/materi"
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink hover:bg-soft"
        >
          ← Kembali ke Kelola Materi
        </a>
      </div>
      <MateriBrowser
        mode="admin"
        basePath="/admin/materi/pratinjau"
        materials={materials.map((m) => ({
          id: m.id,
          title: m.title,
          timeAllocation: m.timeAllocation,
          summary: m.resourceSummary,
          publishStatus: m.publishStatus,
        }))}
        selectedId={selectedId}
        detail={
          detail
            ? {
                id: detail.id,
                title: detail.title,
                timeAllocation: detail.timeAllocation,
                summary: detail.summary,
                keyPoints: detail.keyPoints,
                resources: viewerResources,
                publishStatus: detail.publishStatus,
              }
            : null
        }
      />
    </AppShell>
  );
}
