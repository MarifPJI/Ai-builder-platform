'use server';

import { revalidatePath } from 'next/cache';

import { requireSession } from '@/lib/auth/guard';
import {
  ClassError,
  createClass,
  listStudents,
  type ClassStudent,
} from '@/lib/domain/class-service';
import {
  addStudentManual,
  importRoster,
  removeStudent,
  RosterError,
  type RosterSummary,
} from '@/lib/domain/roster-service';
/**
 * Server Actions Kelas (T02). Semua diawali
 * requireSession({ requireRole: 'teacher' }), lalu memanggil service, dan
 * ditutup revalidatePath. Mengikuti pola KaryaFormState dari karya/actions.ts.
 * Penjadwalan sesi dipindah ke src/app/(teacher)/teacher/sesi/actions.ts.
 */
export interface TeacherFormState {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

/** State khusus impor roster: membawa ringkasan untuk ditampilkan. */
export interface RosterFormState extends TeacherFormState {
  summary?: RosterSummary;
}

const OK: (message: string) => TeacherFormState = (message) => ({ status: 'ok', message });

export async function createClassAction(
  _prev: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  const claims = await requireSession({ requireRole: 'teacher' });
  const name = String(formData.get('name') ?? '').trim();
  const gradeLevel = String(formData.get('gradeLevel') ?? '').trim();
  const materialId = String(formData.get('materialId') ?? '').trim();

  try {
    await createClass(claims, {
      name,
      gradeLevel: gradeLevel || undefined,
      materialId: materialId || undefined,
    });
    revalidatePath('/teacher/kelas');
    revalidatePath('/teacher');
    return OK('Kelas berhasil dibuat.');
  } catch (err) {
    if (err instanceof ClassError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal membuat kelas. Silakan coba lagi.' };
  }
}

export async function importRosterAction(
  _prev: RosterFormState,
  formData: FormData,
): Promise<RosterFormState> {
  const claims = await requireSession({ requireRole: 'teacher' });
  const classId = String(formData.get('classId') ?? '').trim();
  const text = String(formData.get('text') ?? '');

  if (!classId) {
    return { status: 'error', message: 'Pilih kelas terlebih dahulu.' };
  }

  try {
    const summary = await importRoster(claims, classId, { text });
    revalidatePath('/teacher/kelas');
    revalidatePath('/teacher');
    return {
      status: 'ok',
      message: `Impor selesai: ${summary.saved} tersimpan, ${summary.rejected.length} ditolak dari ${summary.total} baris.`,
      summary,
    };
  } catch (err) {
    if (err instanceof RosterError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal mengimpor daftar siswa. Silakan coba lagi.' };
  }
}

export async function addStudentManualAction(
  _prev: TeacherFormState,
  formData: FormData,
): Promise<TeacherFormState> {
  const claims = await requireSession({ requireRole: 'teacher' });
  const classId = String(formData.get('classId') ?? '').trim();
  const nis = String(formData.get('nis') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();

  if (!classId) {
    return { status: 'error', message: 'Pilih kelas terlebih dahulu.' };
  }

  try {
    await addStudentManual(claims, classId, nis, fullName);
    revalidatePath('/teacher/kelas');
    revalidatePath('/teacher');
    return OK('Siswa berhasil ditambahkan.');
  } catch (err) {
    if (err instanceof RosterError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menambahkan siswa. Silakan coba lagi.' };
  }
}

/**
 * Menghapus satu siswa dari kelas. Dipanggil langsung (argumen posisional) dari
 * handler onClick pada panel kanan, bukan via (prev, FormData).
 */
export async function removeStudentAction(
  classId: string,
  studentId: string,
): Promise<TeacherFormState> {
  const claims = await requireSession({ requireRole: 'teacher' });
  const cid = classId.trim();
  const sid = studentId.trim();

  if (!cid) {
    return { status: 'error', message: 'Pilih kelas terlebih dahulu.' };
  }
  if (!sid) {
    return { status: 'error', message: 'Siswa tidak valid.' };
  }

  try {
    await removeStudent(claims, cid, sid);
    revalidatePath('/teacher/kelas');
    revalidatePath('/teacher');
    return OK('Siswa berhasil dihapus.');
  } catch (err) {
    if (err instanceof RosterError) return { status: 'error', message: err.message };
    return { status: 'error', message: 'Gagal menghapus siswa. Silakan coba lagi.' };
  }
}

/**
 * Memuat daftar siswa untuk kelas terpilih. Dipanggil dari panel kanan saat
 * sebuah kelas diklik atau setelah mutasi (impor/tambah/hapus).
 */
export async function getStudentsAction(classId: string): Promise<ClassStudent[]> {
  const claims = await requireSession({ requireRole: 'teacher' });
  const cid = classId.trim();
  if (!cid) return [];
  return listStudents(claims, cid);
}

