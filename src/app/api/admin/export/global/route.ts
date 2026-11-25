/**
 * Route Handler — ekspor GLOBAL (nasional) ke Excel (Admin).
 *
 * GET /api/admin/export/global
 *   1. requireSession({ requireRole: 'admin' }) di dalam try/catch (guard dapat
 *      `redirect()` → NEXT_REDIRECT, atau lempar AccessDeniedError). Keduanya
 *      dipetakan ke 401/403 agar Route Handler tidak melakukan redirect HTML.
 *   2. Ambil ringkasan sekolah + rekap sesi nasional, bangun workbook.
 *   3. Kirim sebagai lampiran .xlsx.
 *
 * exceljs memakai API Node → WAJIB runtime 'nodejs' (bukan edge).
 */

import { AccessDeniedError, requireSession } from '@/lib/auth/guard';
import {
  getGlobalSchoolSummary,
  listNationalSessions,
} from '@/lib/domain/admin-export-service';
import { buildGlobalWorkbook, todayStampJakarta } from '@/lib/excel/workbook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  // 1. Otorisasi admin (tangani redirect/akses-ditolak → 401/403).
  let claims;
  try {
    claims = await requireSession({ requireRole: 'admin' });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return new Response('Forbidden', { status: 403 });
    }
    // Termasuk NEXT_REDIRECT (tidak terautentikasi) & error lain → 401.
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Agregasi data + bangun workbook.
  const [summary, sessions] = await Promise.all([
    getGlobalSchoolSummary(claims),
    listNationalSessions(claims),
  ]);
  const buf = await buildGlobalWorkbook(summary, sessions);

  // 3. Kirim sebagai lampiran .xlsx.
  const filename = `Rekap_Nasional_AI_Builder_${todayStampJakarta()}.xlsx`;
  return new Response(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
