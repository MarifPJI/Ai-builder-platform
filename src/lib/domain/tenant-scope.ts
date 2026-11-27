/**
 * Filter sekolah eksplisit untuk query data Guru (defense-in-depth).
 *
 * Isolasi utama tetap RLS (`withTenantTransaction`). Namun RLS tidak berlaku
 * bila aplikasi terhubung dengan role yang BYPASSRLS/superuser (mis.
 * `DATABASE_URL` memakai user `postgres` alih-alih `app_runtime`). Karena itu
 * setiap query Guru juga memfilter `school_id` dari klaim sesi, sehingga data
 * sekolah lain tidak pernah terbaca walau RLS tidak aktif.
 */

import 'server-only';

import type { SessionClaims } from '@/lib/auth/types';

export class TenantScopeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/** `school_id` milik Guru dari klaim; menolak bila bukan Guru atau tanpa sekolah. */
export function teacherSchoolId(claims: SessionClaims): string {
  if (claims.role !== 'teacher' || !claims.schoolId) {
    throw new TenantScopeError('Akses ditolak: sesi bukan Guru dengan sekolah yang valid.');
  }
  return claims.schoolId;
}
