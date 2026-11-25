# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile untuk AI Builder LMS (Next.js 14 App Router, output "standalone").
# Dipakai untuk AWS ECS Fargate dalam VPC agar dapat menjangkau Amazon RDS privat
# (lihat docs/DEPLOYMENT_STATUS.md #3). Multi-stage build untuk image kecil.
#
# Node 20 (match @types/node 20 & engine Next.js 14). Alpine untuk ukuran minimal.
# ─────────────────────────────────────────────────────────────────────────────

# ---- Stage 1: dependencies (cache npm ci) ----------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
# libc6-compat kadang diperlukan modul native di Alpine.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build --------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js standalone build. Env publik build-time tidak diperlukan di sini;
# seluruh konfigurasi (DATABASE_URL, Cognito) dibaca saat RUNTIME dari env ECS.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 3: runner (runtime minimal) -------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next standalone server mendengarkan di PORT (default 3000) & HOSTNAME.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Jalankan sebagai user non-root (keamanan).
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Salin artefak standalone + aset statis + public.
# `.next/standalone` berisi server.js + node_modules minimal hasil tracing.
# CATATAN: output "standalone" TIDAK otomatis menyertakan folder `public/`,
# jadi harus disalin eksplisit agar aset statis (mis. /logos/*.png, favicon)
# tersedia saat runtime. Tanpa baris ini, /logos/pji.png dkk. akan 404.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# CA bundle RDS (PEM publik) — di-trace oleh outputFileTracingIncludes, namun
# disalin eksplisit juga agar pasti tersedia di process.cwd()/certs saat runtime.
COPY --from=builder /app/certs ./certs

USER nextjs
EXPOSE 3000

# server.js dihasilkan oleh output standalone Next.js.
CMD ["node", "server.js"]
