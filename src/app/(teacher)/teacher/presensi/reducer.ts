import type { AttendanceEntry } from '@/lib/domain/attendance-service';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/validation/attendance';

/**
 * Reducer MURNI presensi T06B (tanpa React / DOM) agar dapat diuji unit.
 *
 * State presensi dimodelkan sebagai `Map<studentId, AttendanceStatus | null>`
 * di mana `null` = belum ditandai (Decision 2). Fungsi di sini tidak memutasi
 * Map masukan; selalu mengembalikan Map baru.
 */
export type AttendanceStateMap = Map<string, AttendanceStatus | null>;

/** Daftar nilai status yang valid untuk penerapan bulk (re-ekspor dari validasi). */
export const STATUS_VALUES = ATTENDANCE_STATUSES;

/** Membangun state awal dari daftar siswa + status awal (null = belum ditandai). */
export function seedState(
  rows: { studentId: string; status: AttendanceStatus | null }[],
): AttendanceStateMap {
  return new Map(rows.map((r) => [r.studentId, r.status]));
}

/** Menandai SELURUH siswa sebagai 'hadir'. */
export function markAllPresent(state: AttendanceStateMap): AttendanceStateMap {
  const next: AttendanceStateMap = new Map();
  for (const key of state.keys()) {
    next.set(key, 'hadir');
  }
  return next;
}

/** Menerapkan satu status ke HANYA baris yang tercentang (`checkedIds`). */
export function applyToChecked(
  state: AttendanceStateMap,
  checkedIds: Iterable<string>,
  status: AttendanceStatus,
): AttendanceStateMap {
  const next = new Map(state);
  for (const id of checkedIds) {
    if (next.has(id)) {
      next.set(id, status);
    }
  }
  return next;
}

/** Menetapkan status satu baris siswa. */
export function setRow(
  state: AttendanceStateMap,
  studentId: string,
  status: AttendanceStatus,
): AttendanceStateMap {
  const next = new Map(state);
  if (next.has(studentId)) {
    next.set(studentId, status);
  }
  return next;
}

/**
 * Membangun payload simpan: HANYA baris yang sudah ditandai eksplisit
 * (status non-null). Baris `null` (belum ditandai) DILEWATI (Decision 2).
 */
export function toSavePayload(state: AttendanceStateMap): AttendanceEntry[] {
  const entries: AttendanceEntry[] = [];
  for (const [studentId, status] of state) {
    if (status !== null) {
      entries.push({ studentId, status });
    }
  }
  return entries;
}

/** Ringkasan hitung per status dari state saat ini (untuk tampilan). */
export function summarize(state: AttendanceStateMap): Record<AttendanceStatus, number> {
  const summary: Record<AttendanceStatus, number> = {
    hadir: 0,
    sakit: 0,
    izin: 0,
    alfa: 0,
  };
  for (const status of state.values()) {
    if (status !== null) {
      summary[status] += 1;
    }
  }
  return summary;
}
