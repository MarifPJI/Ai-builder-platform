import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routing berbasis host untuk dua domain (public-showcase R1):
 *   - `awsinstem.id` (root)       → halaman publik U01 di `/`.
 *   - `lms.awsinstem.id` (subdomain) → aplikasi LMS; akar `/` diarahkan ke `/login`.
 *
 * Hanya menangani path akar `/` (lihat `config.matcher`), sehingga rute lain
 * (`/login`, `/admin/*`, `/teacher/*`, `/api/*`, aset) tidak terpengaruh dan
 * tetap dapat diakses pada kedua host.
 *
 * Catatan: pencocokan host memakai prefiks `lms.` agar tahan terhadap port
 * atau variasi. Jika di belakang ALB header host diteruskan apa adanya
 * (`Host`), ini bekerja; `x-forwarded-host` dipertimbangkan sebagai cadangan.
 */
export function middleware(req: NextRequest): NextResponse {
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const isLmsSubdomain = host.toLowerCase().startsWith('lms.');

  if (isLmsSubdomain) {
    // lms.awsinstem.id/  → /login
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // awsinstem.id/ → biarkan halaman publik '/' dilayani apa adanya.
  return NextResponse.next();
}

export const config = {
  // Hanya akar; jangan sentuh rute aplikasi/aset.
  matcher: ['/'],
};
