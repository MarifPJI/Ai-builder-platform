import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHead } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireSession } from '@/lib/auth/guard';
import { listSchools } from '@/lib/domain/school-service';

/**
 * Layar `A02` — Daftar Sekolah (identity-tenancy, R5.4/R5.5).
 *
 * - Diawali `requireSession({ requireRole: 'admin' })`: hanya Admin yang berhak;
 *   peran lain → `AccessDeniedError` → `X04` (via error boundary rute admin).
 * - Menampilkan daftar sekolah + zona waktu IANA via `schoolService.listSchools`
 *   yang berjalan di bawah RLS (admin membaca lintas sekolah).
 *
 * Server Component; otorisasi & data diambil di server (bukan UI hiding).
 */

// Halaman terautentikasi: WAJIB dinamis (per-request). Mencegah prerender statis
// yang akan memanggil requireSession/Cognito/DB saat build (fail-fast env kosong).
export const dynamic = 'force-dynamic';

/** Label zona waktu Indonesia dari IANA timezone (R5.5). */
function wibLabel(iana: string): string {
  switch (iana) {
    case 'Asia/Jakarta':
      return 'WIB';
    case 'Asia/Makassar':
      return 'WITA';
    case 'Asia/Jayapura':
      return 'WIT';
    default:
      return iana;
  }
}

export default async function SchoolsPage() {
  // Otorisasi: hanya admin (R3.12 bila bukan admin → X04). redirect ke U01 bila
  // tidak terautentikasi (R1.10) ditangani di dalam guard.
  const claims = await requireSession({ requireRole: 'admin' });

  const schools = await listSchools(claims);

  return (
    <AppShell
      brand="AI Builder"
      nav={adminNav('/admin/schools')}
      schoolLabel="Program Nasional"
      avatarInitials="AD"
    >
      <Card>
        <CardHead title="Daftar Sekolah Mitra" />
        <CardBody className="p-0">
          {schools.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              Belum ada sekolah terdaftar.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nama Sekolah</TH>
                  <TH>Zona Waktu</TH>
                </TR>
              </THead>
              <TBody>
                {schools.map((school) => (
                  <TR key={school.schoolId}>
                    <TD className="font-medium">
                      <a
                        href={`/admin/schools/${school.schoolId}`}
                        className="text-primary hover:underline"
                      >
                        {school.name}
                      </a>
                    </TD>
                    <TD>
                      <Badge tone="sakit">{wibLabel(school.ianaTimezone)}</Badge>{' '}
                      <span className="text-xs text-muted">
                        {school.ianaTimezone}
                      </span>
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
