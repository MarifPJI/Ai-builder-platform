/**
 * `teacherAccountService` — typed domain service untuk pengelolaan akun Guru
 * oleh Admin pada layar `A03`.
 *
 * Identitas dikelola di Supabase Auth; profil aplikasi di tabel `profiles`.
 * Peran/school_id disimpan di `app_metadata` pengguna Supabase (hanya dapat
 * diubah oleh service-role) dan ikut tertanam di JWT.
 *
 * ── Alur `createTeacher` ─────────────────────────────────────────────────────
 *   1. Validasi BENTUK input (email, nama lengkap 1–150, school_id UUID).
 *   2. Verifikasi `school_id` TERDAFTAR via `schoolExists` (di bawah RLS).
 *   3. `auth.admin.createUser` dengan sandi sementara acak +
 *      `app_metadata { role: 'teacher', school_id, must_change_password: true }`.
 *      Guru WAJIB mengganti sandi pada login pertama (R1.8). Sandi sementara
 *      dikembalikan SEKALI ke Admin untuk disampaikan ke Guru; Supabase tidak
 *      mengirimkannya lewat email.
 *   4. Insert `profiles` (status `pending`) di bawah RLS. Bila insert gagal,
 *      user Supabase yang telanjur dibuat dihapus (kompensasi) agar tidak ada
 *      akun menggantung.
 *
 * ── Otorisasi ────────────────────────────────────────────────────────────────
 * HANYA Admin. `requireSession({ requireRole: 'admin' })` ditegakkan pada
 * Server Action pemanggil; service menerima `claims` Admin terverifikasi dan
 * memakainya sebagai konteks tenancy. RLS adalah lapis pertahanan kedua.
 *
 * ── Keamanan ─────────────────────────────────────────────────────────────────
 * - `import 'server-only'`: tidak ikut bundel klien. Kunci service-role hanya
 *   dibaca di server.
 * - Query diparameterisasi.
 *
 * _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 5.2, 5.3_
 */

import 'server-only';

import { randomInt } from 'node:crypto';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  APP_METADATA_MUST_CHANGE_PASSWORD_KEY,
  APP_METADATA_ROLE_KEY,
  APP_METADATA_SCHOOL_ID_KEY,
  getSupabaseAdminClient,
} from '@/lib/auth/supabase';
import type { SessionClaims } from '@/lib/auth/types';
import { withTenantTransaction } from '@/lib/db/tenant-transaction';
import { emailSchema } from '@/lib/validation/auth';
import {
  MAX_CSV_ROWS,
  parseTeacherCsvRow,
  type RawTeacherCsvRow,
} from '@/lib/validation/csv';
import { schoolIdSchema } from '@/lib/validation/school';

import { schoolExists } from './school-service';

/* ──────────────────────────────────────────────────────────────────────────
 * Kontrak masukan & keluaran
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Masukan pembuatan akun Guru.
 * - `email`    : email resmi Guru (login & kolom `profiles.email`).
 * - `fullName` : nama lengkap Guru (1–150 karakter).
 * - `schoolId` : UUID sekolah yang WAJIB terdaftar pada tabel `schools`.
 */
export interface CreateTeacherInput {
  email: string;
  fullName: string;
  schoolId: string;
}

/** Hasil pembuatan akun Guru. */
export interface CreateTeacherResult {
  /** ID pengguna Supabase Auth (disimpan di `profiles.cognito_sub`). */
  cognitoSub: string;
  /** Primary key (`id`) baris `profiles` yang baru di-insert. */
  profileId: string;
  /**
   * Sandi sementara (plaintext). Hanya ada di respons ini; tidak disimpan di
   * aplikasi. Admin menyampaikannya ke Guru, yang wajib menggantinya saat
   * login pertama.
   */
  temporaryPassword: string;
}

/** Error domain dengan pesan berbahasa Indonesia yang aman ditampilkan ke Admin. */
export class CreateTeacherError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CreateTeacherError';
  }
}

/** Item daftar akun Guru untuk layar admin `A03`. */
export interface TeacherListItem {
  id: string;
  cognitoSub: string;
  email: string;
  fullName: string;
  schoolId: string;
  activationStatus: string;
}

/**
 * Masukan adopsi/perbaikan akun Guru yang SUDAH ada di Supabase Auth namun
 * belum punya profil di aplikasi (mis. dibuat manual lewat Dashboard).
 */
export interface AdoptAuthTeacherInput {
  email: string;
  fullName: string;
  schoolId: string;
}

/** Hasil adopsi/perbaikan akun Guru. */
export interface AdoptAuthTeacherResult {
  cognitoSub: string;
  profileId: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Impor CSV massal — kontrak masukan & keluaran (Property 7)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Satu baris yang DITOLAK pada impor CSV. `line` berbasis-1 atas baris DATA
 * (header tidak dihitung).
 */
export interface RejectedRow {
  line: number;
  reason: string;
}

/** Kredensial sementara satu akun yang berhasil dibuat lewat impor. */
export interface ImportedCredential {
  email: string;
  temporaryPassword: string;
}

/**
 * Ringkasan hasil impor CSV.
 *
 * INVARIAN (Property 7): `created + rejected.length === total`.
 * `credentials` berisi satu entri per akun yang berhasil dibuat.
 */
export interface ImportSummary {
  total: number;
  created: number;
  rejected: RejectedRow[];
  credentials: ImportedCredential[];
}

/**
 * Hasil aktivasi batch (Property 5): `activated` dan `failed` disjoint, union =
 * input unik; yang gagal tetap `pending`; aktivasi ulang idempoten.
 */
export interface ActivationResult {
  activated: string[];
  failed: string[];
}

/** Masukan CSV: baris yang sudah diparse, atau teks CSV mentah. */
export type CsvFile = { rows: RawTeacherCsvRow[] } | { text: string };

/**
 * Dilempar bila jumlah baris DATA CSV melebihi {@link MAX_CSV_ROWS} (R3.5).
 * Seluruh impor ditolak sebelum baris mana pun diproses.
 */
export class CsvRowLimitError extends Error {
  public constructor(
    message: string,
    public readonly rowCount: number,
    public readonly maxRows: number,
  ) {
    super(message);
    this.name = 'CsvRowLimitError';
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Validasi bentuk masukan
 * ────────────────────────────────────────────────────────────────────────── */

/** Batas panjang nama lengkap (sejalan CHECK `profiles.full_name` 1–150). */
export const FULL_NAME_MIN_LENGTH = 1 as const;
export const FULL_NAME_MAX_LENGTH = 150 as const;

const fullNameSchema = z
  .string({
    required_error: 'Nama lengkap wajib diisi.',
    invalid_type_error: 'Nama lengkap tidak valid.',
  })
  .trim()
  .min(FULL_NAME_MIN_LENGTH, { message: 'Nama lengkap wajib diisi.' })
  .max(FULL_NAME_MAX_LENGTH, {
    message: `Nama lengkap maksimum ${FULL_NAME_MAX_LENGTH} karakter.`,
  });

const createTeacherInputSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  schoolId: schoolIdSchema,
});

type ValidatedCreateTeacherInput = z.infer<typeof createTeacherInputSchema>;

function validateInput(input: CreateTeacherInput): ValidatedCreateTeacherInput {
  const result = createTeacherInputSchema.safeParse(input);
  if (!result.success) {
    const reasons = result.error.issues.map((issue) => issue.message);
    throw new CreateTeacherError(
      reasons.length > 0 ? reasons.join(' ') : 'Masukan akun Guru tidak valid.',
    );
  }
  return result.data;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dependensi yang dapat di-inject
 * ────────────────────────────────────────────────────────────────────────── */

export type SchoolExistsFn = (
  claims: SessionClaims,
  schoolId: string,
) => Promise<boolean>;

export type WithTenantTransactionFn = typeof withTenantTransaction;

export interface TeacherAccountServiceDeps {
  /** Klien Supabase service-role. Default: singleton produksi (lazy). */
  readonly adminClient?: SupabaseClient;
  readonly schoolExists?: SchoolExistsFn;
  readonly withTenantTransaction?: WithTenantTransactionFn;
}

export interface TeacherAccountService {
  /**
   * Membuat akun Guru (sandi sementara + ganti sandi wajib) dan profil
   * `pending`.
   *
   * @throws {CreateTeacherError} bila input invalid, `school_id` tak terdaftar,
   *   email sudah terdaftar, atau penyedia identitas gagal.
   */
  createTeacher(
    claims: SessionClaims,
    input: CreateTeacherInput,
  ): Promise<CreateTeacherResult>;

  /**
   * Impor massal dari CSV (R3.5–R3.8; Property 7). Maksimum
   * {@link MAX_CSV_ROWS} baris; baris invalid dilewati dan dicatat; kegagalan
   * satu baris tidak menggagalkan impor.
   *
   * @throws {CsvRowLimitError} bila baris data melebihi batas.
   */
  importTeachersCsv(
    claims: SessionClaims,
    csv: CsvFile,
  ): Promise<ImportSummary>;

  /** Aktivasi satuan/batch, idempoten, kegagalan sebagian (R3.9, R3.10). */
  activateTeachers(
    claims: SessionClaims,
    profileIds: string[],
  ): Promise<ActivationResult>;

  /** Daftar seluruh akun Guru + status aktivasi (di bawah RLS). */
  listTeachers(claims: SessionClaims): Promise<TeacherListItem[]>;

  /**
   * Adopsi/perbaikan akun Guru yang sudah ada di Supabase Auth tetapi belum
   * punya `profiles`: menyetel `app_metadata` (role teacher + school_id) lalu
   * upsert profil berstatus `pending` (TIDAK PERNAH mengaktifkan otomatis).
   * Menolak akun yang berperan `admin`.
   */
  adoptAuthTeacher(
    claims: SessionClaims,
    input: AdoptAuthTeacherInput,
  ): Promise<AdoptAuthTeacherResult>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Util internal
 * ────────────────────────────────────────────────────────────────────────── */

const PASSWORD_LOWER = 'abcdefghijkmnpqrstuvwxyz';
const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_DIGIT = '23456789';
const PASSWORD_SYMBOL = '!@#$%*?-_';
const PASSWORD_ALL =
  PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGIT + PASSWORD_SYMBOL;

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)]!;
}

/**
 * Membangkitkan sandi sementara acak 16 karakter (CSPRNG) yang memuat huruf
 * besar, kecil, angka, dan simbol agar lolos kebijakan sandi project mana pun.
 * Karakter yang mudah tertukar (0/O, 1/l/I) dikeluarkan.
 */
export function generateTemporaryPassword(): string {
  const chars = [
    pick(PASSWORD_LOWER),
    pick(PASSWORD_UPPER),
    pick(PASSWORD_DIGIT),
    pick(PASSWORD_SYMBOL),
  ];
  while (chars.length < 16) {
    chars.push(pick(PASSWORD_ALL));
  }
  // Fisher–Yates dengan CSPRNG agar posisi karakter wajib tidak dapat ditebak.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

/** Maksimum halaman `listUsers` yang dipindai saat mencari email (200/halaman). */
const MAX_LIST_USERS_PAGES = 50;
const LIST_USERS_PER_PAGE = 200;

/**
 * Mencari pengguna Supabase Auth berdasarkan email. Admin API tidak punya
 * filter email, jadi daftar dipindai per halaman (cukup untuk skala puluhan
 * sekolah).
 */
async function findAuthUserByEmail(
  client: SupabaseClient,
  email: string,
): Promise<User | null> {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= MAX_LIST_USERS_PAGES; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });
    if (error) {
      throw error;
    }
    const found = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (found) {
      return found;
    }
    if (data.users.length < LIST_USERS_PER_PAGE) {
      return null;
    }
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Parser CSV internal (sederhana & aman, tanpa dependency berat)
 * ────────────────────────────────────────────────────────────────────────── */

/** Kolom yang dikenali pada header CSV, dipetakan ke properti RawTeacherCsvRow. */
const CSV_HEADER_ALIASES: Readonly<Record<string, keyof RawTeacherCsvRow>> = {
  email: 'email',
  'email resmi': 'email',
  fullname: 'fullName',
  'full name': 'fullName',
  'nama lengkap': 'fullName',
  nama: 'fullName',
  schoolid: 'schoolId',
  'school id': 'schoolId',
  school_id: 'schoolId',
  'id sekolah': 'schoolId',
} as const;

/** Urutan kolom default bila CSV TIDAK memiliki baris header yang dikenali. */
const CSV_DEFAULT_COLUMNS: readonly (keyof RawTeacherCsvRow)[] = [
  'email',
  'fullName',
  'schoolId',
] as const;

/**
 * Memisah satu baris CSV menjadi field-field, menghormati kutip ganda, escape
 * `""`, dan koma pemisah. Lokal per baris (tanpa newline di dalam field).
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Baris dianggap header bila SETIAP selnya adalah alias kolom yang dikenali. */
function looksLikeHeader(cells: string[]): boolean {
  if (cells.length === 0) {
    return false;
  }
  return cells.every((cell) =>
    Object.prototype.hasOwnProperty.call(
      CSV_HEADER_ALIASES,
      cell.trim().toLowerCase(),
    ),
  );
}

/**
 * Mem-parse teks CSV mentah menjadi daftar {@link RawTeacherCsvRow}. Baris
 * kosong dilewati; header (bila dikenali) menentukan pemetaan kolom dan tidak
 * dihitung sebagai data.
 */
function parseCsvFile(text: string): RawTeacherCsvRow[] {
  const rawLines = text.split('\n').map((line) => line.replace(/\r$/, ''));

  const nonEmpty: string[][] = [];
  for (const line of rawLines) {
    if (line.trim() === '') {
      continue;
    }
    nonEmpty.push(splitCsvLine(line));
  }

  if (nonEmpty.length === 0) {
    return [];
  }

  let columns: (keyof RawTeacherCsvRow)[];
  let dataRows: string[][];

  if (looksLikeHeader(nonEmpty[0]!)) {
    columns = nonEmpty[0]!.map(
      (cell) => CSV_HEADER_ALIASES[cell.trim().toLowerCase()]!,
    );
    dataRows = nonEmpty.slice(1);
  } else {
    columns = [...CSV_DEFAULT_COLUMNS];
    dataRows = nonEmpty;
  }

  return dataRows.map((cells) => {
    const row: RawTeacherCsvRow = {};
    columns.forEach((col, index) => {
      const value = cells[index];
      if (value !== undefined) {
        row[col] = value.trim();
      }
    });
    return row;
  });
}

function normalizeCsvInput(csv: CsvFile): RawTeacherCsvRow[] {
  if ('rows' in csv) {
    return csv.rows;
  }
  return parseCsvFile(csv.text);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pabrik service
 * ────────────────────────────────────────────────────────────────────────── */

export function createTeacherAccountService(
  deps: TeacherAccountServiceDeps = {},
): TeacherAccountService {
  // Lazy: env Supabase baru dibaca saat operasi dipanggil (aman saat build).
  const admin = (): SupabaseClient => deps.adminClient ?? getSupabaseAdminClient();
  const schoolExistsFn = deps.schoolExists ?? schoolExists;
  const runInTenantTransaction =
    deps.withTenantTransaction ?? withTenantTransaction;

  /**
   * Inti pembuatan akun untuk masukan yang SUDAH tervalidasi bentuknya; dipakai
   * bersama oleh {@link createTeacher} dan {@link importTeachersCsv}.
   */
  async function createValidatedTeacher(
    claims: SessionClaims,
    valid: ValidatedCreateTeacherInput,
  ): Promise<CreateTeacherResult> {
    // 1. Verifikasi school_id TERDAFTAR (R5.2/R5.3) di bawah RLS.
    const exists = await schoolExistsFn(claims, valid.schoolId);
    if (!exists) {
      throw new CreateTeacherError(
        'ID sekolah tidak terdaftar. Akun Guru tidak dapat dibuat.',
      );
    }

    // 2. Buat user Supabase: sandi sementara + peran/school_id di app_metadata.
    const temporaryPassword = generateTemporaryPassword();
    const { data, error } = await admin().auth.admin.createUser({
      email: valid.email,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: {
        [APP_METADATA_ROLE_KEY]: 'teacher',
        [APP_METADATA_SCHOOL_ID_KEY]: valid.schoolId,
        [APP_METADATA_MUST_CHANGE_PASSWORD_KEY]: true,
      },
      user_metadata: { full_name: valid.fullName },
    });

    if (error || !data.user) {
      if (error?.code === 'email_exists' || error?.code === 'user_already_exists') {
        throw new CreateTeacherError(
          'Email sudah terdaftar. Gunakan "Adopsi / Perbaiki Guru" bila akunnya ' +
            'sudah ada di penyedia identitas.',
        );
      }
      throw new CreateTeacherError(
        'Gagal membuat akun Guru di penyedia identitas. Silakan coba lagi.',
      );
    }

    const authUserId = data.user.id;

    // 3. Insert `profiles` (pending) di bawah RLS. Gagal → hapus user Supabase
    //    (kompensasi best-effort) agar tidak ada akun menggantung.
    try {
      const profileId = await runInTenantTransaction(claims, async (tx) => {
        const result = await tx.query<{ id: string }>(
          `INSERT INTO profiles
             (cognito_sub, email, full_name, role, school_id, activation_status)
           VALUES ($1, $2, $3, 'teacher', $4, 'pending')
           RETURNING id`,
          [authUserId, valid.email, valid.fullName, valid.schoolId],
        );
        const row = result.rows[0];
        if (!row) {
          throw new CreateTeacherError('Gagal menyimpan profil Guru.');
        }
        return row.id;
      });
      return { cognitoSub: authUserId, profileId, temporaryPassword };
    } catch (insertError) {
      await compensateDeleteAuthUser(authUserId);
      if (insertError instanceof CreateTeacherError) {
        throw insertError;
      }
      throw new CreateTeacherError(
        'Gagal menyimpan profil Guru. Pembuatan akun dibatalkan.',
      );
    }
  }

  /**
   * Kompensasi best-effort: hapus user Supabase yang telanjur dibuat. Kegagalan
   * ditelan agar tidak menutupi penyebab utama.
   */
  async function compensateDeleteAuthUser(authUserId: string): Promise<void> {
    try {
      await admin().auth.admin.deleteUser(authUserId);
    } catch {
      // Sengaja diabaikan (best-effort).
    }
  }

  async function createTeacher(
    claims: SessionClaims,
    input: CreateTeacherInput,
  ): Promise<CreateTeacherResult> {
    const valid = validateInput(input);
    return createValidatedTeacher(claims, valid);
  }

  async function importTeachersCsv(
    claims: SessionClaims,
    csv: CsvFile,
  ): Promise<ImportSummary> {
    const rows = normalizeCsvInput(csv);

    // Batas 1000 baris (R3.5) SEBELUM memproses baris mana pun.
    if (rows.length > MAX_CSV_ROWS) {
      throw new CsvRowLimitError(
        `Jumlah baris CSV (${rows.length}) melebihi batas maksimum ` +
          `${MAX_CSV_ROWS} baris. Impor dibatalkan; tidak ada akun yang dibuat.`,
        rows.length,
        MAX_CSV_ROWS,
      );
    }

    const total = rows.length;
    const rejected: RejectedRow[] = [];
    const credentials: ImportedCredential[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const line = index + 1;
      const parsed = parseTeacherCsvRow(rows[index]!);

      if (!parsed.valid) {
        rejected.push({ line, reason: parsed.reason });
        continue;
      }

      try {
        const result = await createValidatedTeacher(claims, parsed.value);
        credentials.push({
          email: parsed.value.email,
          temporaryPassword: result.temporaryPassword,
        });
      } catch (error) {
        // Kegagalan satu baris valid tidak menggagalkan impor (Property 7).
        const reason =
          error instanceof CreateTeacherError
            ? error.message
            : 'Gagal membuat akun Guru untuk baris ini. Silakan coba lagi.';
        rejected.push({ line, reason });
      }
    }

    return { total, created: credentials.length, rejected, credentials };
  }

  async function activateTeachers(
    claims: SessionClaims,
    profileIds: string[],
  ): Promise<ActivationResult> {
    const uniqueIds = Array.from(new Set(profileIds));

    const activated: string[] = [];
    const failed: string[] = [];

    // Tiap akun pada transaksi TERPISAH agar kegagalan satu akun tidak
    // memengaruhi yang lain (R3.10).
    for (const profileId of uniqueIds) {
      try {
        const didActivate = await runInTenantTransaction(claims, async (tx) => {
          const result = await tx.query<{ id: string }>(
            `UPDATE profiles
                SET activation_status = 'active',
                    updated_at = now()
              WHERE id = $1
                AND role = 'teacher'
            RETURNING id`,
            [profileId],
          );
          return result.rowCount !== null && result.rowCount > 0;
        });

        if (didActivate) {
          activated.push(profileId);
        } else {
          failed.push(profileId);
        }
      } catch {
        failed.push(profileId);
      }
    }

    return { activated, failed };
  }

  async function listTeachers(
    claims: SessionClaims,
  ): Promise<TeacherListItem[]> {
    return runInTenantTransaction(claims, async (tx) => {
      const result = await tx.query<{
        id: string;
        cognito_sub: string;
        email: string;
        full_name: string;
        school_id: string;
        activation_status: string;
      }>(
        `SELECT id, cognito_sub, email, full_name, school_id, activation_status
           FROM profiles
          WHERE role = 'teacher'
          ORDER BY (activation_status = 'active') ASC, full_name ASC`,
      );
      return result.rows.map((row) => ({
        id: row.id,
        cognitoSub: row.cognito_sub,
        email: row.email,
        fullName: row.full_name,
        schoolId: row.school_id,
        activationStatus: row.activation_status,
      }));
    });
  }

  async function adoptAuthTeacher(
    claims: SessionClaims,
    input: AdoptAuthTeacherInput,
  ): Promise<AdoptAuthTeacherResult> {
    const valid = validateInput(input);

    const exists = await schoolExistsFn(claims, valid.schoolId);
    if (!exists) {
      throw new CreateTeacherError(
        'ID sekolah tidak terdaftar. Akun Guru tidak dapat diadopsi.',
      );
    }

    let user: User | null;
    try {
      user = await findAuthUserByEmail(admin(), valid.email);
    } catch {
      throw new CreateTeacherError(
        'Gagal membaca data pengguna di penyedia identitas. Silakan coba lagi.',
      );
    }
    if (!user) {
      throw new CreateTeacherError(
        'Pengguna tidak ditemukan di penyedia identitas.',
      );
    }

    // Jangan pernah menurunkan admin menjadi guru lewat jalur ini.
    const currentMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    if (currentMeta[APP_METADATA_ROLE_KEY] === 'admin') {
      throw new CreateTeacherError(
        'Akun ini berperan Admin dan tidak dapat diadopsi sebagai Guru.',
      );
    }

    // Setel role + school_id HANYA bila hilang/berbeda.
    if (
      currentMeta[APP_METADATA_ROLE_KEY] !== 'teacher' ||
      currentMeta[APP_METADATA_SCHOOL_ID_KEY] !== valid.schoolId
    ) {
      const { error } = await admin().auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...currentMeta,
          [APP_METADATA_ROLE_KEY]: 'teacher',
          [APP_METADATA_SCHOOL_ID_KEY]: valid.schoolId,
        },
      });
      if (error) {
        throw new CreateTeacherError(
          'Gagal memperbarui data pengguna di penyedia identitas.',
        );
      }
    }

    // Upsert profil. Status WAJIB `pending` pada INSERT dan TIDAK disentuh pada
    // DO UPDATE (aktivasi hanya oleh Admin lewat alur aktivasi).
    const authUserId = user.id;
    const profileId = await runInTenantTransaction(claims, async (tx) => {
      const result = await tx.query<{ id: string }>(
        `INSERT INTO profiles
           (cognito_sub, email, full_name, role, school_id, activation_status)
         VALUES ($1, $2, $3, 'teacher', $4, 'pending')
         ON CONFLICT (cognito_sub) DO UPDATE SET
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           school_id = EXCLUDED.school_id
         RETURNING id`,
        [authUserId, valid.email, valid.fullName, valid.schoolId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new CreateTeacherError('Gagal menyimpan profil Guru.');
      }
      return row.id;
    });

    return { cognitoSub: authUserId, profileId };
  }

  return {
    createTeacher,
    importTeachersCsv,
    activateTeachers,
    listTeachers,
    adoptAuthTeacher,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Instance default (produksi, lazy)
 * ────────────────────────────────────────────────────────────────────────── */

let defaultTeacherAccountService: TeacherAccountService | undefined;

export function getTeacherAccountService(): TeacherAccountService {
  if (!defaultTeacherAccountService) {
    defaultTeacherAccountService = createTeacherAccountService();
  }
  return defaultTeacherAccountService;
}
