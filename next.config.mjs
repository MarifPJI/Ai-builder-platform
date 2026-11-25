/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hosting: Vercel (build Next.js native, tanpa `output: 'standalone'`).
  // Database/Auth/Storage: Supabase.
  // Secret (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, kunci S3) hanya dibaca di
  // sisi server — jangan pernah memberi prefix NEXT_PUBLIC_ pada nilai rahasia.
};

export default nextConfig;
