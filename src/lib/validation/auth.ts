import { z } from 'zod';

/**
 * Skema validasi login & kata sandi (identity-tenancy).
 *
 * Requirements:
 * - R1.1: email resmi (format alamat email valid, maksimum 254 karakter)
 *   dan kata sandi (8 sampai 128 karakter).
 * - R1.9: kata sandi baru pada penggantian wajib harus 8 sampai 128 karakter.
 *
 * Catatan keamanan: pesan kesalahan bentuk (shape) boleh spesifik di sini.
 * Namun untuk kegagalan *login* (kredensial tidak cocok), lapisan Auth_Service
 * WAJIB tetap menampilkan pesan generik yang tidak membocorkan apakah email
 * atau kata sandi yang salah. Skema ini hanya memvalidasi bentuk masukan,
 * bukan mencocokkan kredensial, dan tidak melakukan kueri basis data.
 */

/** Batas panjang email resmi sesuai RFC/praktik umum. */
export const EMAIL_MAX_LENGTH = 254;

/** Batas panjang kata sandi. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Skema email resmi: wajib terisi, format alamat email valid, maksimum 254 karakter.
 */
export const emailSchema = z
  .string({
    required_error: 'Email resmi wajib diisi.',
    invalid_type_error: 'Email resmi tidak valid.',
  })
  .trim()
  .min(1, { message: 'Email resmi wajib diisi.' })
  .max(EMAIL_MAX_LENGTH, {
    message: `Email resmi maksimum ${EMAIL_MAX_LENGTH} karakter.`,
  })
  .email({ message: 'Format email resmi tidak valid.' });

/**
 * Skema kata sandi: wajib terisi, panjang 8 sampai 128 karakter.
 */
export const passwordSchema = z
  .string({
    required_error: 'Kata sandi wajib diisi.',
    invalid_type_error: 'Kata sandi tidak valid.',
  })
  .min(PASSWORD_MIN_LENGTH, {
    message: `Kata sandi minimum ${PASSWORD_MIN_LENGTH} karakter.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    message: `Kata sandi maksimum ${PASSWORD_MAX_LENGTH} karakter.`,
  });

/**
 * Skema login (R1.1): kombinasi email resmi dan kata sandi.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Skema kata sandi baru pada alur penggantian wajib FORCE_CHANGE_PASSWORD (R1.9).
 */
export const newPasswordSchema = z.object({
  password: passwordSchema,
});

/** Tipe hasil infer untuk masukan login. */
export type LoginInput = z.infer<typeof loginSchema>;

/** Tipe hasil infer untuk masukan kata sandi baru. */
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
