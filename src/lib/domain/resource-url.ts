/**
 * Helper normalisasi URL sumber Materi (MURNI — dipakai server & client).
 *
 * Tidak ada `server-only`: modul ini sengaja aman diimpor di Client Component
 * (form builder Admin) maupun di Server Action/Service, agar logika normalisasi
 * TUNGGAL dan tidak menyimpang antar sisi.
 *
 * - `normalizeCanvaEmbedUrl`: mengubah URL desain Canva (`/view`, `/edit`, atau
 *   polos) menjadi bentuk embed `...view?embed` agar dapat dirender di dalam
 *   <iframe> tanpa error X-Frame-Options.
 * - `normalizeVideoEmbedUrl`: mengubah tautan YouTube (`watch?v=` / `youtu.be/`)
 *   menjadi `https://www.youtube.com/embed/<id>`. MP4 langsung & penyedia lain
 *   dikembalikan apa adanya (pemutar menentukan <iframe> vs <video>).
 */

/** Membuang query & hash, menormalkan trailing slash untuk pemrosesan path. */
function stripQueryHash(url: string): string {
  const noHash = url.split('#')[0] ?? url;
  return noHash.split('?')[0] ?? noHash;
}

/**
 * Menormalkan URL Canva menjadi bentuk embed yang dapat di-iframe.
 *
 * Contoh:
 *   https://www.canva.com/design/DAGxxxx/yyyy/view        -> .../view?embed
 *   https://www.canva.com/design/DAGxxxx/yyyy/edit        -> .../view?embed
 *   https://www.canva.com/design/DAGxxxx/yyyy/view?embed  -> tetap (idempoten)
 *   https://www.canva.com/design/DAGxxxx/yyyy             -> .../view?embed
 *
 * URL non-Canva dikembalikan apa adanya (dipangkas spasi). Input kosong/invalid
 * dikembalikan setelah trim; validasi bentuk URL dilakukan di lapisan validasi.
 */
export function normalizeCanvaEmbedUrl(inputUrl: string): string {
  const url = inputUrl.trim();
  if (!url) return url;

  let host: string;
  let path: string;
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname;
  } catch {
    return url; // bukan URL absolut yang valid — biar lapisan validasi menolak.
  }

  if (!host.endsWith('canva.com')) {
    return url;
  }

  // Ambil basis path desain: /design/<DESIGN_ID>/<TOKEN>
  const base = stripQueryHash(url);
  // Buang sufiks /view, /edit, /watch, atau trailing slash agar seragam.
  const withoutAction = base.replace(/\/(view|edit|watch)\/?$/i, '').replace(/\/+$/, '');

  // Hanya normalkan bila ini memang path desain Canva.
  if (!/\/design\//i.test(path)) {
    return url;
  }

  return `${withoutAction}/view?embed`;
}

/**
 * Menormalkan tautan video menjadi URL embed bila YouTube; selain itu apa adanya.
 *
 * Contoh:
 *   https://www.youtube.com/watch?v=ABC123         -> https://www.youtube.com/embed/ABC123
 *   https://youtu.be/ABC123                        -> https://www.youtube.com/embed/ABC123
 *   https://youtube.com/embed/ABC123               -> tetap (idempoten)
 *   https://example.com/video.mp4                  -> tetap (pemutar pakai <video>)
 *   https://vimeo.com/123456                        -> tetap (dibiarkan; <iframe> langsung)
 */
export function normalizeVideoEmbedUrl(inputUrl: string): string {
  const url = inputUrl.trim();
  if (!url) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const host = parsed.hostname.toLowerCase();

  // youtu.be/<id>
  if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
    const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }

  // youtube.com/watch?v=<id>  atau sudah /embed/<id>
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    if (/^\/embed\//.test(parsed.pathname)) {
      return url; // sudah embed.
    }
    const id = parsed.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }

  // Penyedia lain / MP4 langsung — biarkan; lapisan render yang memutuskan.
  return url;
}

/** True bila URL menunjuk ke berkas MP4 langsung (dirender via <video>). */
export function isDirectMp4(url: string): boolean {
  return /\.mp4(\?|#|$)/i.test(url.trim());
}
