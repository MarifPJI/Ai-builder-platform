import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { requireSession } from '@/lib/auth/guard';
import { listKaryaForAdmin } from '@/lib/domain/karya-service';

import { KaryaPanels } from './KaryaPanels';

export const dynamic = 'force-dynamic';

export default async function AdminKaryaPage() {
  const claims = await requireSession({ requireRole: 'admin' });
  const existing = await listKaryaForAdmin(claims);

  return (
    <AppShell brand="AI Builder" nav={adminNav('/admin/karya')} schoolLabel="Program Nasional" avatarInitials="AD">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Showcase Karya</h1>
        <p className="mt-1 text-sm text-muted">
          Terbitkan karya yang tampil di halaman publik awsinstem.id.
        </p>
      </div>
      <KaryaPanels existing={existing} />
    </AppShell>
  );
}
