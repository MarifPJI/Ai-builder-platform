import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { requireSession } from '@/lib/auth/guard';
import { listAllForAdminWithSummary } from '@/lib/domain/material-service';

import { MateriPanels } from './MateriPanels';

export const dynamic = 'force-dynamic';

export default async function AdminMateriPage() {
  const claims = await requireSession({ requireRole: 'admin' });
  const materials = await listAllForAdminWithSummary(claims);

  return (
    <AppShell brand="AI Builder" nav={adminNav('/admin/materi')} schoolLabel="Program Nasional" avatarInitials="AD">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Materi Pegangan Guru</h1>
        <p className="mt-1 text-sm text-muted">
          Buat, terbitkan, dan lampirkan banyak sumber belajar (Canva Smart Embed,
          Tautan Video, PDF, atau PPTX) dalam satu Materi.
        </p>
      </div>
      <MateriPanels
        materials={materials.map((m) => ({
          id: m.id,
          title: m.title,
          timeAllocation: m.timeAllocation,
          publishStatus: m.publishStatus,
          summary: m.resourceSummary,
        }))}
      />
    </AppShell>
  );
}
