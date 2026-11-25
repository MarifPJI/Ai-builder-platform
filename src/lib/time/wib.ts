/**
 * Helper konversi waktu WIB (Asia/Jakarta, UTC+7) — MURNI, tanpa DB, tanpa
 * `server-only`, dapat diimpor Server Component / Server Action / komponen
 * client / unit test.
 *
 * Seluruh sekolah program diperlakukan WIB (termasuk SMAN 10 Samarinda, per
 * keputusan user). Konversi TIDAK bergantung pada zona waktu mesin server
 * (produksi berjalan di UTC), sehingga aman: input `datetime-local` tanpa zona
 * selalu ditafsirkan sebagai jam dinding WIB.
 *
 * Catatan: logika `toIso` SENGAJA diselaraskan dengan helper `toIso` pada
 * `src/app/(teacher)/teacher/sesi/actions.ts`. Ia diletakkan di modul netral ini
 * (bukan diimpor dari file guru) agar file guru tidak tersentuh, sekaligus
 * dapat dibagi oleh komponen admin + diuji unit.
 */

/** Offset WIB (UTC+7) terhadap UTC, dalam menit. */
export const WIB_OFFSET_MINUTES = 7 * 60;

/**
 * Mengubah nilai `datetime-local` ("YYYY-MM-DDTHH:mm", TANPA zona) menjadi ISO
 * 8601 UTC ber-offset, dengan MEMPERLAKUKAN input sebagai waktu WIB (UTC+7) —
 * BUKAN waktu lokal server. JANGAN memakai `new Date(raw).toISOString()` yang
 * akan menafsirkan input sebagai UTC dan menggeser +7 jam.
 */
export function toIso(raw: string): string | null {
  // Terima "YYYY-MM-DDTHH:mm" atau dengan detik "YYYY-MM-DDTHH:mm:ss".
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  // Jam dinding WIB (UTC+7) → instant UTC sebenarnya = dikurangi 7 jam.
  const instant = new Date(utcMs - WIB_OFFSET_MINUTES * 60 * 1000);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString();
}

/**
 * Mengubah `Date` (instant UTC) menjadi string `datetime-local`
 * ("YYYY-MM-DDTHH:mm") dalam jam dinding WIB, untuk prefill `<input
 * type="datetime-local">`. Deterministik (tidak bergantung zona mesin).
 */
export function toWibDatetimeLocal(d: Date): string {
  const wib = new Date(d.getTime() + WIB_OFFSET_MINUTES * 60 * 1000);
  return wib.toISOString().slice(0, 16);
}
