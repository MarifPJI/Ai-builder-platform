import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { requireSession } from '@/lib/auth/guard';
import { listGalleryForAdmin } from '@/lib/domain/gallery-service';

import { GaleriPanels } from './GaleriPanels';

export const dynamic = 'force-dynamic';

export default async function AdminGaleriPage() {
  const claims = await requireSession({ requireRole: 'admin' });
  const existing = await listGalleryForAdmin(claims);

  return (
    <AppShell brand="AI Builder" nav={adminNav('/admin/galeri')} schoolLabel="Program Nasional" avatarInitials="AD">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Galeri Kegiatan</h1>
        <p className="mt-1 text-sm text-muted">
          Terbitkan dokumentasi kegiatan yang tampil di halaman publik.
        </p>
      </div>
      <GaleriPanels existing={existing} />
    </AppShell>
  );
}
