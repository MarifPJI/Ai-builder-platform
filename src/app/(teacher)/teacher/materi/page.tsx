import { AppShell } from '@/components/shared/AppShell';
import { teacherNav } from '@/components/shared/teacherNav';
import { requireSession } from '@/lib/auth/guard';
import {
  getWithResourcesPublished,
  listPublishedWithSummary,
  presignResourceDownload,
  type MaterialWithResources,
} from '@/lib/domain/material-service';
import { getSchoolName } from '@/lib/domain/school-service';

import { MateriBrowser, type ViewerResource } from './MateriBrowser';

/**
 * T03 Materi (`/teacher/materi`) — Server Component.
 *
 * Multi-Source Interactive Learning Viewer: daftar Materi terbit (kiri) + detail
 * materi terpilih dengan pemilih sumber & panggung pratinjau (kanan). Berkas
 * PDF/PPTX dipresign di SERVER (GET sementara) sebelum dikirim ke klien; URL
 * Canva/Video sudah dinormalisasi saat disimpan Admin.
 */
export const dynamic = 'force-dynamic';

export default async function TeacherMateriPage({
  searchParams,
}: {
  searchParams?: { materialId?: string };
}) {
  const claims = await requireSession({ requireRole: 'teacher' });
  const schoolName = (await getSchoolName(claims, claims.schoolId!)) ?? 'Sekolah Anda';

  const materials = await listPublishedWithSummary(claims);
  const selectedId = searchParams?.materialId ?? materials[0]?.id ?? null;

  let detail: MaterialWithResources | null = null;
  if (selectedId) {
    try {
      detail = await getWithResourcesPublished(claims, selectedId);
    } catch {
      detail = null;
    }
  }

  // Presign berkas (pdf/pptx) di server → URL GET sementara untuk render/unduh.
  let viewerResources: ViewerResource[] = [];
  if (detail) {
    viewerResources = await Promise.all(
      detail.resources.map(async (r) => {
        let fileUrl: string | null = null;
        if (r.resourceType === 'pdf_file' || r.resourceType === 'pptx_file') {
          try {
            fileUrl = await presignResourceDownload(claims, r.id);
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
    <AppShell
      brand="AI Builder"
      nav={teacherNav('/teacher/materi')}
      schoolLabel={schoolName}
      avatarInitials="GU"
    >
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Materi Pembelajaran</h1>
        <p className="mt-1 text-sm text-muted">
          Baca panduan mengajar, tampilkan presentasi Canva interaktif atau video di
          kelas, dan unduh modul PDF/PPTX dari Admin.
        </p>
      </div>
      <MateriBrowser
        materials={materials.map((m) => ({
          id: m.id,
          title: m.title,
          timeAllocation: m.timeAllocation,
          summary: m.resourceSummary,
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
              }
            : null
        }
      />
    </AppShell>
  );
}
