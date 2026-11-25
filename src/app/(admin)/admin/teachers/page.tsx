import { AppShell } from '@/components/shared/AppShell';
import { adminNav } from '@/components/shared/adminNav';
import { requireSession } from '@/lib/auth/guard';
import { getTeacherAccountService } from '@/lib/domain/teacher-account-service';
import { schoolService } from '@/lib/domain/school-service';

import { TeacherAdminPanels } from './TeacherAdminPanels';

/**
 * Layar `A03` — Kelola & Aktivasi Akun Guru (identity-tenancy).
 *
 * Diawali `requireSession({ requireRole: 'admin' })`: hanya Admin yang berhak
 * membuka layar ini (R3.1/R3.12). Peran lain → `AccessDeniedError` → `X04`
 * (error boundary rute admin). Guru tidak pernah melihat/memanggil alur ini,
 * sehingga pembuatan/aktivasi dari `U01` tidak mungkin (R3.13).
 *
 * Server Component untuk gate otorisasi; interaksi form di `TeacherAdminPanels`.
 */

// Halaman terautentikasi: WAJIB dinamis (per-request). Mencegah prerender statis
// yang akan memanggil requireSession/Cognito/DB saat build (fail-fast env kosong).
export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  const claims = await requireSession({ requireRole: 'admin' });

  const [teachers, schools] = await Promise.all([
    getTeacherAccountService().listTeachers(claims),
    schoolService.listSchools(claims),
  ]);
  const schoolOptions = schools.map((s) => ({
    schoolId: s.schoolId,
    name: s.name,
  }));

  return (
    <AppShell
      brand="AI Builder"
      nav={adminNav('/admin/teachers')}
      schoolLabel="Program Nasional"
      avatarInitials="AD"
    >
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-ink">Akun Guru</h1>
        <p className="mt-1 text-sm text-muted">
          Buat, undang, impor, dan aktifkan akun Guru pengampu.
        </p>
      </div>
      <TeacherAdminPanels teachers={teachers} schools={schoolOptions} />
    </AppShell>
  );
}
