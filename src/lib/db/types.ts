/**
 * Kontrak tipe untuk lapisan akses basis data (identity-tenancy).
 *
 * SUMBER KEBENARAN TUNGGAL:
 *   `Role` dan `SessionClaims` kini didefinisikan di `src/lib/auth/types.ts`
 *   (dibuat pada Task 7.1). Berkas ini melakukan RE-EXPORT dari sana agar hanya
 *   ada satu sumber kebenaran untuk bentuk klaim sesi, sembari menjaga agar
 *   pemanggil di lapisan DB (`pool.ts`, `tenant-transaction.ts`) tetap dapat
 *   mengimpor `Role`/`SessionClaims` dari `@/lib/db/types` tanpa perubahan.
 *
 * Latar belakang (mengapa dulu didefinisikan lokal):
 *   Task 4.1 (lapisan akses DB) dibuat sebelum Task 7.1 (konfigurasi Cognito +
 *   tipe klaim). Untuk sementara `Role`/`SessionClaims` didefinisikan lokal di
 *   sini agar lapisan DB tidak menggantung pada modul yang belum ada. Setelah
 *   `src/lib/auth/types.ts` tersedia, definisi lokal digantikan oleh re-export
 *   ini sesuai rencana penyelarasan (lihat design.md > Components and Interfaces).
 *
 * Bentuk tipe (dari design.md):
 *   type Role = 'admin' | 'teacher';
 *   interface SessionClaims { cognitoSub; email; role; schoolId: string | null }
 *
 * _Requirements: 4.1, 4.2, 4.8_
 */

export type { Role, SessionClaims } from '@/lib/auth/types';
