/**
 * `admin-progress-service` — data PROGRES MENGAJAR lintas sekolah untuk
 * Dashboard Admin dan ekspor Excel (read-only).
 *
 * Definisi "pelajaran tuntas" untuk sebuah kelas: ada sesi bertipe
 * `full` (Sesi Penuh) atau `final` (Sesi Terakhir) untuk Materi TERBIT itu,
 * dan sesi tersebut SUDAH berisi presensi. Sesi yang hanya dijadwalkan belum
 * dihitung. Sesi lama tanpa tipe (sebelum migrasi 0022) tidak dihitung.
 *
 * Semua query berjalan dalam SATU `withTenantTransaction` (peran admin, RLS
 * admin SELECT lintas sekolah). Parameter hanya daftar nama sekolah uji coba.
 */

import 'server-only';

import type { PoolClient } from 'pg';

import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';

import {
  CLASS_TARGET,
  isTestSchool,
  ratioPercent,
  schoolProgress,
  TEST_SCHOOL_NAMES,
  type SchoolProgress,
} from './progress-calc';

export interface SchoolProgressRow {
  schoolId: string;
  schoolName: string;
  isTest: boolean;
  /** Nama guru (dipisah koma); null bila belum ada akun guru. */
  teacherNames: string | null;
  jumlahGuru: number;
  guruAktif: number;
  jumlahKelas: number;
  jumlahSiswa: number;
  sesiTerjadwal: number;
  /** Sesi yang sudah berisi presensi. */
  sesiSelesai: number;
  /** Sesi selesai yang punya jurnal DAN minimal satu foto. */
  sesiTerdokumentasi: number;
  /** % kehadiran (hadir ÷ semua baris presensi); null bila belum ada presensi. */
  kehadiranPersen: number | null;
  /** Pelajaran tuntas per kelas, urut menurun. */
  pelajaranPerKelas: { className: string; completed: number }[];
  progress: SchoolProgress;
  lastActivity: Date | null;
}

export interface WeeklySessions {
  /** Senin awal minggu (WIB), format YYYY-MM-DD. */
  weekStart: string;
  sessions: number;
}

export interface NationalProgress {
  /** Sekolah mitra (tanpa sekolah uji coba). */
  totalSekolah: number;
  sekolahMulai: number;
  sekolahTercapai: number;
  rataRataPersen: number;
  sesiSelesai: number;
  /** Kelas yang sudah menuntaskan 10 pelajaran, dari target totalSekolah × 3. */
  kelasTercapai: number;
  targetKelas: number;
}

export interface TeachingProgress {
  schools: SchoolProgressRow[];
  weekly: WeeklySessions[];
  national: NationalProgress;
  /** Jumlah Materi terbit saat ini (target per kelas = 10). */
  materiTerbit: number;
}

const WEEKS = 12;

interface SchoolDbRow {
  school_id: string;
  name: string;
  teacher_names: string | null;
  jumlah_guru: number;
  guru_aktif: number;
  jumlah_kelas: number;
  jumlah_siswa: number;
  sesi_terjadwal: number;
  sesi_selesai: number;
  sesi_terdokumentasi: number;
  hadir: number;
  presensi_total: number;
  last_activity: Date | null;
}

interface ClassDbRow {
  school_id: string;
  class_name: string;
  completed: number;
}

export async function getTeachingProgress(claims: SessionClaims): Promise<TeachingProgress> {
  return withTenantTransaction(claims, async (tx: PoolClient) => {
    const schoolsRes = await tx.query<SchoolDbRow>(
      `SELECT
         s.school_id,
         s.name,
         (SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) FROM profiles p
            WHERE p.school_id = s.school_id AND p.role = 'teacher') AS teacher_names,
         (SELECT count(*) FROM profiles p
            WHERE p.school_id = s.school_id AND p.role = 'teacher')::int AS jumlah_guru,
         (SELECT count(*) FROM profiles p
            WHERE p.school_id = s.school_id AND p.role = 'teacher'
              AND p.activation_status = 'active')::int AS guru_aktif,
         (SELECT count(*) FROM classes c WHERE c.school_id = s.school_id)::int AS jumlah_kelas,
         (SELECT count(*) FROM class_students cs WHERE cs.school_id = s.school_id)::int AS jumlah_siswa,
         (SELECT count(*) FROM class_sessions se WHERE se.school_id = s.school_id)::int AS sesi_terjadwal,
         (SELECT count(*) FROM class_sessions se
            WHERE se.school_id = s.school_id
              AND EXISTS (SELECT 1 FROM session_attendance a WHERE a.session_id = se.id))::int AS sesi_selesai,
         (SELECT count(*) FROM class_sessions se
            WHERE se.school_id = s.school_id
              AND EXISTS (SELECT 1 FROM session_attendance a WHERE a.session_id = se.id)
              AND EXISTS (SELECT 1 FROM session_journals j WHERE j.session_id = se.id)
              AND EXISTS (SELECT 1 FROM session_photos ph WHERE ph.session_id = se.id))::int
           AS sesi_terdokumentasi,
         (SELECT count(*) FROM session_attendance a
            WHERE a.school_id = s.school_id AND a.status = 'hadir')::int AS hadir,
         (SELECT count(*) FROM session_attendance a WHERE a.school_id = s.school_id)::int AS presensi_total,
         GREATEST(
           (SELECT max(c.created_at)  FROM classes c            WHERE c.school_id  = s.school_id),
           (SELECT max(se.created_at) FROM class_sessions se    WHERE se.school_id = s.school_id),
           (SELECT max(a.updated_at)  FROM session_attendance a WHERE a.school_id  = s.school_id),
           (SELECT max(j.updated_at)  FROM session_journals j   WHERE j.school_id  = s.school_id),
           (SELECT max(ph.created_at) FROM session_photos ph    WHERE ph.school_id = s.school_id)
         ) AS last_activity
       FROM schools s
       ORDER BY s.name ASC`,
    );

    const classesRes = await tx.query<ClassDbRow>(
      `SELECT c.school_id, c.name AS class_name,
              (SELECT count(DISTINCT se.material_id)
                 FROM class_sessions se
                 JOIN materials m ON m.id = se.material_id AND m.publish_status = 'published'
                WHERE se.class_id = c.id
                  AND se.session_kind IN ('full', 'final')
                  AND EXISTS (SELECT 1 FROM session_attendance a WHERE a.session_id = se.id))::int
                AS completed
         FROM classes c
        ORDER BY c.name ASC`,
    );

    const weeklyRes = await tx.query<{ week_start: string; sessions: number }>(
      `WITH weeks AS (
         SELECT generate_series(
                  date_trunc('week', now() AT TIME ZONE 'Asia/Jakarta') - ($2::int - 1) * interval '1 week',
                  date_trunc('week', now() AT TIME ZONE 'Asia/Jakarta'),
                  interval '1 week') AS wk
       )
       SELECT to_char(w.wk, 'YYYY-MM-DD') AS week_start,
              (SELECT count(*) FROM class_sessions se
                 JOIN schools s ON s.school_id = se.school_id
                WHERE date_trunc('week', se.scheduled_at AT TIME ZONE 'Asia/Jakarta') = w.wk
                  AND NOT (lower(trim(s.name)) = ANY($1::text[]))
                  AND EXISTS (SELECT 1 FROM session_attendance a WHERE a.session_id = se.id))::int
                AS sessions
         FROM weeks w
        ORDER BY w.wk ASC`,
      [[...TEST_SCHOOL_NAMES], WEEKS],
    );

    const materiRes = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM materials WHERE publish_status = 'published'`,
    );

    const classesBySchool = new Map<string, { className: string; completed: number }[]>();
    for (const row of classesRes.rows) {
      const list = classesBySchool.get(row.school_id) ?? [];
      list.push({ className: row.class_name, completed: Number(row.completed ?? 0) });
      classesBySchool.set(row.school_id, list);
    }

    const schools: SchoolProgressRow[] = schoolsRes.rows.map((row) => {
      const perClass = (classesBySchool.get(row.school_id) ?? []).sort(
        (a, b) => b.completed - a.completed,
      );
      return {
        schoolId: row.school_id,
        schoolName: row.name,
        isTest: isTestSchool(row.name),
        teacherNames: row.teacher_names,
        jumlahGuru: Number(row.jumlah_guru ?? 0),
        guruAktif: Number(row.guru_aktif ?? 0),
        jumlahKelas: Number(row.jumlah_kelas ?? 0),
        jumlahSiswa: Number(row.jumlah_siswa ?? 0),
        sesiTerjadwal: Number(row.sesi_terjadwal ?? 0),
        sesiSelesai: Number(row.sesi_selesai ?? 0),
        sesiTerdokumentasi: Number(row.sesi_terdokumentasi ?? 0),
        kehadiranPersen: ratioPercent(Number(row.hadir ?? 0), Number(row.presensi_total ?? 0)),
        pelajaranPerKelas: perClass,
        progress: schoolProgress(perClass.map((c) => c.completed)),
        lastActivity: row.last_activity,
      };
    });

    const partners = schools.filter((s) => !s.isTest);
    const national: NationalProgress = {
      totalSekolah: partners.length,
      sekolahMulai: partners.filter((s) => s.progress.covered > 0).length,
      sekolahTercapai: partners.filter((s) => s.progress.achieved).length,
      rataRataPersen: partners.length
        ? Math.round(partners.reduce((sum, s) => sum + s.progress.percent, 0) / partners.length)
        : 0,
      sesiSelesai: partners.reduce((sum, s) => sum + s.sesiSelesai, 0),
      kelasTercapai: partners.reduce(
        (sum, s) => sum + Math.min(s.progress.classesAtTarget, CLASS_TARGET),
        0,
      ),
      targetKelas: partners.length * CLASS_TARGET,
    };

    return {
      schools,
      weekly: weeklyRes.rows.map((r) => ({ weekStart: r.week_start, sessions: Number(r.sessions ?? 0) })),
      national,
      materiTerbit: Number(materiRes.rows[0]?.n ?? 0),
    };
  });
}
