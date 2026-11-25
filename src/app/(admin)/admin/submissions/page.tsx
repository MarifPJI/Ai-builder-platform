import { AppShell } from '@/components/shared/AppShell';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireSession } from '@/lib/auth/guard';
import { adminNav } from '@/components/shared/adminNav';
import { listForAdmin } from '@/lib/domain/showcase-service';

import { SubmissionActions } from './SubmissionRow';

export const dynamic = 'force-dynamic';

export default async function AdminSubmissionsPage() {
  const claims = await requireSession({ requireRole: 'admin' });
  const submissions = await listForAdmin(claims);

  return (
    <AppShell brand="AI Builder" nav={adminNav('/admin/submissions')} schoolLabel="Program Nasional" avatarInitials="AD">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Kiriman Proyek Siswa</h1>
        <p className="mt-1 text-sm text-muted">
          Daftar kiriman dari formulir publik (untuk tinjauan &amp; pencatatan).
        </p>
      </div>
      <Card>
        <CardHead title="Daftar Kiriman" />
        <CardBody className="p-0">
          {submissions.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">Belum ada kiriman.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Judul</TH>
                  <TH>Pengirim</TH>
                  <TH>Asal Sekolah</TH>
                  <TH>Kategori</TH>
                  <TH>Status / Aksi</TH>
                </TR>
              </THead>
              <TBody>
                {submissions.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.title}</TD>
                    <TD>{s.submitterName ?? '—'}</TD>
                    <TD>{s.schoolName}</TD>
                    <TD>{s.category}</TD>
                    <TD>
                      <SubmissionActions id={s.id} status={s.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </AppShell>
  );
}
