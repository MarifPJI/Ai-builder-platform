import { PageSkeleton } from '@/components/shared/PageSkeleton';

/** Tampil segera saat halaman admin memuat data (semua rute /admin/*). */
export default function AdminLoading() {
  return <PageSkeleton role="admin" />;
}
