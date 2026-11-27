/**
 * Perhitungan progres mengajar sekolah (modul MURNI, tanpa DB) — dipakai
 * Dashboard Admin dan ekspor Excel.
 *
 * Target program: setiap sekolah mengajar minimal 3 KELAS, dan setiap kelas
 * menuntaskan 10 PELAJARAN (Materi terbit). Satu pelajaran boleh lebih dari satu
 * sesi, tetapi dihitung SEKALI per kelas.
 *
 * Progres sekolah = jumlah pelajaran tuntas di 3 kelas TERBAIK (masing-masing
 * maks. 10) ÷ 30. Kelas ke-4 dst. tetap tampil di tabel tetapi tidak membuat
 * progres melewati 100%.
 */

export const CLASS_TARGET = 3;
export const LESSONS_PER_CLASS = 10;
export const LESSON_TARGET_TOTAL = CLASS_TARGET * LESSONS_PER_CLASS;

/** Nama sekolah uji coba (huruf kecil) — tampil di tabel, tidak masuk angka nasional. */
export const TEST_SCHOOL_NAMES = ['sman 10 samarinda'] as const;

export function isTestSchool(name: string): boolean {
  return (TEST_SCHOOL_NAMES as readonly string[]).includes(name.trim().toLowerCase());
}

export interface SchoolProgress {
  /** Pelajaran tuntas yang dihitung (3 kelas terbaik, maks. 10 per kelas). */
  covered: number;
  target: number;
  /** 0..100, dibulatkan. */
  percent: number;
  /** Kelas yang sudah menuntaskan 10 pelajaran. */
  classesAtTarget: number;
  achieved: boolean;
}

/** @param completedPerClass jumlah pelajaran tuntas untuk tiap kelas sekolah. */
export function schoolProgress(completedPerClass: readonly number[]): SchoolProgress {
  const capped = completedPerClass.map((n) =>
    Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 0, 0), LESSONS_PER_CLASS),
  );
  const covered = [...capped]
    .sort((a, b) => b - a)
    .slice(0, CLASS_TARGET)
    .reduce((sum, n) => sum + n, 0);
  return {
    covered,
    target: LESSON_TARGET_TOTAL,
    percent: Math.round((covered / LESSON_TARGET_TOTAL) * 100),
    classesAtTarget: capped.filter((n) => n >= LESSONS_PER_CLASS).length,
    achieved: covered >= LESSON_TARGET_TOTAL,
  };
}

/** Persentase aman (0 bila penyebut 0), dibulatkan. */
export function ratioPercent(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 100);
}
