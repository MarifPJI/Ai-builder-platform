/**
 * Route Handler — ekspor DETAIL satu sekolah ke Excel (Admin).
 *
 * GET /api/admin/export/school/[schoolId]
 *   1. requireSession({ requireRole: 'admin' }) di dalam try/catch (guard dapat
 *      `redirect()` → NEXT_REDIRECT, atau lempar AccessDeniedError). Keduanya
 *      dipetakan ke 401/403.
 *   2. Validasi `schoolId` berbentuk UUID (guard dasar) → 400 bila invalid.
 *   3. Ambil header/kelas/roster/presensi; header null → 404.
 *   4. Bangun workbook, kirim sebagai lampiran .xlsx dengan nama sekolah
 *      disanitasi.
 *
 * exceljs memakai API Node → WAJIB runtime 'nodejs' (bukan edge).
 */

import { AccessDeniedError, requireSession } from '@/lib/auth/guard';
import {
  getSchoolExportHeader,
  listSchoolAttendanceForExport,
  listSchoolClassesForExport,
  listSchoolRosterForExport,
} from '@/lib/domain/admin-export-service';
import { buildSchoolWorkbook, todayStampJakarta } from '@/lib/excel/workbook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Pola UUID (RFC 4122, 8-4-4-4-12 heksadesimal). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sanitasi nama sekolah untuk nama berkas: non-alfanumerik → '_', kolaps. */
function sanitizeName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Sekolah'
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { schoolId: string } },
): Promise<Response> {
  // 1. Otorisasi admin (tangani redirect/akses-ditolak → 401/403).
  let claims;
  try {
    claims = await requireSession({ requireRole: 'admin' });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return new Response('Forbidden', { status: 403 });
    }
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Guard dasar: schoolId wajib UUID.
  const schoolId = params.schoolId;
  if (!schoolId || !UUID_PATTERN.test(schoolId)) {
    return new Response('Bad Request', { status: 400 });
  }

  // 3. Agregasi data sekolah.
  const header = await getSchoolExportHeader(claims, schoolId);
  if (header === null) {
    return new Response('Not Found', { status: 404 });
  }
  const [classes, roster, attendance] = await Promise.all([
    listSchoolClassesForExport(claims, schoolId),
    listSchoolRosterForExport(claims, schoolId),
    listSchoolAttendanceForExport(claims, schoolId),
  ]);

  // 4. Bangun workbook + kirim sebagai lampiran .xlsx.
  const buf = await buildSchoolWorkbook(header, classes, roster, attendance);
  const filename = `Detail_${sanitizeName(header.name)}_${todayStampJakarta()}.xlsx`;
  return new Response(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
