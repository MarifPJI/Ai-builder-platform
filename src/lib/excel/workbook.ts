/**
 * `excel/workbook` — helper pembangun workbook Excel (ExcelJS) untuk ekspor
 * Admin. Modul SERVER-ONLY (exceljs memakai API Node, bukan edge).
 *
 * Menyediakan helper reusable (styling header, auto-fit lebar kolom, format
 * tanggal WIB, peta label status) serta dua builder:
 *   - buildGlobalWorkbook(summary, sessions)       → Buffer
 *   - buildSchoolWorkbook(header, classes, roster, attendance) → Buffer
 *
 * Seluruh teks antarmuka berbahasa Indonesia. Angka ditulis sebagai sel integer
 * nyata (numFmt '0'); teks kosong ditampilkan '-'.
 */

import 'server-only';

import ExcelJS from 'exceljs';

import type {
  GlobalSchoolSummaryRow,
  NationalSessionRow,
  SchoolAttendanceExportRow,
  SchoolClassExportRow,
  SchoolExportHeader,
  SchoolRosterExportRow,
} from '@/lib/domain/admin-export-service';
import type { SchoolProgressRow } from '@/lib/domain/admin-progress-service';
import type { AttendanceStatus } from '@/lib/validation/attendance';

/* ──────────────────────────────────────────────────────────────────────────
 * Konstanta gaya
 * ────────────────────────────────────────────────────────────────────────── */

/** Warna brand Cosmic Indigo (#21245B) dalam ARGB untuk fill header. */
const HEADER_FILL_ARGB = 'FF21245B' as const;

/** Lebar kolom maksimum (karakter) saat auto-fit. */
const MAX_COL_WIDTH = 60;

/** Peta label status kehadiran → teks Indonesia untuk tampilan. */
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  sakit: 'Sakit',
  izin: 'Izin',
  alfa: 'Alfa',
};

/** Formatter tanggal WIB (Asia/Jakarta) — dipakai `formatWibDateTime`. */
const WIB_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/* ──────────────────────────────────────────────────────────────────────────
 * Helper reusable
 * ────────────────────────────────────────────────────────────────────────── */

/** Label status kehadiran; `null` → 'Belum ditandai'. */
export function statusLabel(status: AttendanceStatus | null): string {
  return status === null ? 'Belum ditandai' : STATUS_LABELS[status];
}

/** Label zona waktu Indonesia dari IANA timezone. */
export function wibLabel(iana: string): string {
  switch (iana) {
    case 'Asia/Jakarta':
      return 'WIB';
    case 'Asia/Makassar':
      return 'WITA';
    case 'Asia/Jayapura':
      return 'WIT';
    default:
      return iana;
  }
}

/**
 * Format `Date` (atau null) ke `DD/MM/YYYY HH:mm` di zona Asia/Jakarta.
 * `null` → '-'.
 */
export function formatWibDateTime(value: Date | null): string {
  if (value === null) {
    return '-';
  }
  // Intl id-ID menghasilkan "DD/MM/YYYY HH.MM" (pemisah jam bisa titik).
  const parts = WIB_DATE_FORMATTER.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/** Tanggal hari ini (Asia/Jakarta) dalam format `YYYYMMDD` untuk nama berkas. */
export function todayStampJakarta(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}`;
}

/**
 * Menata satu baris header: fill Cosmic Indigo, font tebal putih, rata tengah,
 * dengan border tipis di tiap sel.
 */
function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL_ARGB },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
}

/**
 * Auto-fit lebar kolom berdasar panjang teks maksimum (header & sel).
 * `column.width = min(MAX, max(headerLen, maxCellLen) + 2)`.
 */
function autoFitColumns(sheet: ExcelJS.Worksheet): void {
  sheet.columns.forEach((column) => {
    let maxLen = 0;
    // `eachCell` dengan includeEmpty false hanya menelusuri sel berisi.
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const value = cell.value;
      const text =
        value === null || value === undefined ? '' : String(value);
      if (text.length > maxLen) {
        maxLen = text.length;
      }
    });
    column.width = Math.min(MAX_COL_WIDTH, Math.max(maxLen, 1) + 2);
  });
}

/**
 * Menulis baris data ke sheet dari daftar nilai. Nilai `number` ditulis sebagai
 * sel numerik (numFmt '0'); lainnya ditulis apa adanya (string).
 */
function appendDataRow(
  sheet: ExcelJS.Worksheet,
  values: (string | number)[],
): ExcelJS.Row {
  const row = sheet.addRow(values);
  row.eachCell((cell) => {
    if (typeof cell.value === 'number') {
      cell.numFmt = '0';
    }
  });
  return row;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Builder: GLOBAL workbook
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Membangun workbook ekspor GLOBAL (nasional):
 *   - Sheet "Ringkasan Sekolah" + baris TOTAL (bold).
 *   - Sheet "Rekap Sesi & Presensi Nasional".
 */
export async function buildGlobalWorkbook(
  summary: GlobalSchoolSummaryRow[],
  sessions: NationalSessionRow[],
  progress?: SchoolProgressRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  /* Sheet 1 — Ringkasan Sekolah */
  const s1 = wb.addWorksheet('Ringkasan Sekolah');
  const s1Header = s1.addRow([
    'No',
    'Nama Sekolah',
    'Jumlah Guru',
    'Jumlah Kelas',
    'Jumlah Siswa',
    'Total Sesi Presensi',
  ]);
  styleHeaderRow(s1Header);

  let totalGuru = 0;
  let totalKelas = 0;
  let totalSiswa = 0;
  let totalSesi = 0;
  summary.forEach((row, index) => {
    totalGuru += row.jumlahGuru;
    totalKelas += row.jumlahKelas;
    totalSiswa += row.jumlahSiswa;
    totalSesi += row.totalSesiPresensi;
    appendDataRow(s1, [
      index + 1,
      row.name,
      row.jumlahGuru,
      row.jumlahKelas,
      row.jumlahSiswa,
      row.totalSesiPresensi,
    ]);
  });

  const totalRow = appendDataRow(s1, [
    '',
    'TOTAL',
    totalGuru,
    totalKelas,
    totalSiswa,
    totalSesi,
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true };
  });
  autoFitColumns(s1);

  /* Sheet 2 — Rekap Sesi & Presensi Nasional */
  const s2 = wb.addWorksheet('Rekap Sesi & Presensi Nasional');
  const s2Header = s2.addRow([
    'Nama Sekolah',
    'Nama Guru',
    'Nama Kelas',
    'Nama Sesi',
    'Jadwal',
    'Total Hadir',
    'Total Siswa',
  ]);
  styleHeaderRow(s2Header);
  sessions.forEach((row) => {
    appendDataRow(s2, [
      row.schoolName,
      row.teacherName ?? '-',
      row.className,
      row.sessionName,
      formatWibDateTime(row.scheduledAt),
      row.totalHadir,
      row.totalSiswa,
    ]);
  });
  autoFitColumns(s2);

  /* Sheet 3 — Progres Mengajar (opsional, bila data progres tersedia) */
  if (progress) {
    const s3 = wb.addWorksheet('Progres Mengajar');
    const s3Header = s3.addRow([
      'No',
      'Nama Sekolah',
      'Guru',
      'Progres (%)',
      'Pelajaran Tuntas',
      'Target Pelajaran',
      'Kelas Tuntas 10 Pelajaran',
      'Rincian per Kelas',
      'Jumlah Kelas',
      'Jumlah Siswa',
      'Sesi Selesai',
      'Sesi Terjadwal',
      'Kehadiran (%)',
      'Sesi Terdokumentasi',
      'Aktivitas Terakhir',
      'Keterangan',
    ]);
    styleHeaderRow(s3Header);
    progress.forEach((row, index) => {
      appendDataRow(s3, [
        index + 1,
        row.schoolName,
        row.teacherNames ?? '-',
        row.progress.percent,
        row.progress.covered,
        row.progress.target,
        row.progress.classesAtTarget,
        row.pelajaranPerKelas.length
          ? row.pelajaranPerKelas.map((c) => `${c.className}: ${c.completed}/10`).join('; ')
          : '-',
        row.jumlahKelas,
        row.jumlahSiswa,
        row.sesiSelesai,
        row.sesiTerjadwal,
        row.kehadiranPersen ?? '-',
        row.sesiTerdokumentasi,
        row.lastActivity ? formatWibDateTime(row.lastActivity) : '-',
        row.isTest ? 'Sekolah uji coba' : row.progress.achieved ? 'Target tercapai' : '-',
      ]);
    });
    autoFitColumns(s3);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ──────────────────────────────────────────────────────────────────────────
 * Builder: SINGLE-SCHOOL workbook
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Membangun workbook ekspor satu sekolah:
 *   - Sheet "Ringkasan & Daftar Kelas" (metadata + tabel kelas).
 *   - Sheet "Daftar Siswa Lengkap".
 *   - Sheet "Presensi & Sesi Kelas".
 */
export async function buildSchoolWorkbook(
  header: SchoolExportHeader,
  classes: SchoolClassExportRow[],
  roster: SchoolRosterExportRow[],
  attendance: SchoolAttendanceExportRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  /* Sheet 1 — Ringkasan & Daftar Kelas */
  const s1 = wb.addWorksheet('Ringkasan & Daftar Kelas');

  // Metadata label/value.
  const metaRows: [string, string | number][] = [
    ['Nama Sekolah', header.name],
    ['Zona Waktu', wibLabel(header.ianaTimezone)],
    ['Total Guru', header.totalGuru],
    ['Total Kelas', header.totalKelas],
    ['Total Siswa', header.totalSiswa],
  ];
  metaRows.forEach(([label, value]) => {
    const row = s1.addRow([label, value]);
    const labelCell = row.getCell(1);
    labelCell.font = { bold: true };
    const valueCell = row.getCell(2);
    if (typeof valueCell.value === 'number') {
      valueCell.numFmt = '0';
    }
  });

  s1.addRow([]); // Baris kosong pemisah.

  const s1Header = s1.addRow([
    'No',
    'Nama Kelas',
    'Tingkat / Grade',
    'Guru Pengampu',
    'Jumlah Siswa',
  ]);
  styleHeaderRow(s1Header);
  classes.forEach((cls, index) => {
    appendDataRow(s1, [
      index + 1,
      cls.name,
      cls.gradeLevel ?? '-',
      cls.teacherName ?? '-',
      cls.jumlahSiswa,
    ]);
  });
  autoFitColumns(s1);

  /* Sheet 2 — Daftar Siswa Lengkap */
  const s2 = wb.addWorksheet('Daftar Siswa Lengkap');
  const s2Header = s2.addRow([
    'No',
    'Nama Kelas',
    'NIS / ID Siswa',
    'Nama Lengkap Siswa',
  ]);
  styleHeaderRow(s2Header);
  roster.forEach((student, index) => {
    appendDataRow(s2, [
      index + 1,
      student.className,
      student.nis,
      student.fullName,
    ]);
  });
  autoFitColumns(s2);

  /* Sheet 3 — Presensi & Sesi Kelas */
  const s3 = wb.addWorksheet('Presensi & Sesi Kelas');
  const s3Header = s3.addRow([
    'Nama Sesi',
    'Kelas',
    'Jadwal / Waktu Sesi',
    'Status Sesi',
    'NIS',
    'Nama Siswa',
    'Status Kehadiran',
    'Waktu Presensi',
  ]);
  styleHeaderRow(s3Header);
  attendance.forEach((row) => {
    appendDataRow(s3, [
      row.sessionName,
      row.className,
      formatWibDateTime(row.scheduledAt),
      row.sessionState,
      row.nis,
      row.fullName,
      statusLabel(row.status),
      formatWibDateTime(row.attendanceAt),
    ]);
  });
  autoFitColumns(s3);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
