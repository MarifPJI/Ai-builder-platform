import { PageSkeleton } from '@/components/shared/PageSkeleton';

/** Tampil segera saat halaman Guru memuat data (semua rute /teacher/*). */
export default function TeacherLoading() {
  return <PageSkeleton role="teacher" />;
}
