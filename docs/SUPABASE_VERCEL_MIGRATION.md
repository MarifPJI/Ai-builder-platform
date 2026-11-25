# Migrating AI Builder LMS to Supabase + Vercel

> **Status: kode sudah dimigrasi (Path B, S3-compatible).** Untuk langkah deploy ikuti
> `DEPLOY_VERCEL_SUPABASE.md`. Dokumen ini dipertahankan sebagai catatan rencana awal.

Target stack: **Supabase** (Postgres + Auth + Storage) and **Vercel** (Next.js hosting).
This replaces the current AWS stack (RDS + Cognito + S3 + ECS Fargate + ALB).

Effort rating, low to high:
1. Database → Supabase Postgres — **low**
2. Hosting → Vercel — **low-to-medium** (needs 3 code tweaks, below)
3. Storage → Supabase Storage — **medium**
4. Auth → Supabase Auth (replace Cognito) — **high** (real rewrite)

> Honest take: the DB and hosting moves are easy. Auth is the real project.
> Do a staging spike (Parts 2 + 7) before committing to the auth rewrite.

---

## Why Vercel needs 3 code changes (this is the important part)

The app was built for a long-lived container (ECS Fargate) with a private DB.
Vercel runs Next.js as **serverless functions**, which breaks three assumptions:

### A. The RDS CA file read will not work on Vercel
`src/lib/db/pool.ts` reads `certs/rds-global-bundle.pem` from `process.cwd()` at
runtime, and `next.config.mjs` uses `output: 'standalone'` +
`outputFileTracingIncludes` to ship that file into the container. On Vercel there
is no standalone container and the file-trace include is not honored the same way,
so the file read returns `undefined` and the pool silently falls back to
`rejectUnauthorized: false` (encrypted but unverified).

**Fix:** stop relying on the file; pass the Supabase CA via the existing
`RDS_CA_BUNDLE` env var (the code already prefers env over file). Supabase's CA is
a standard chain, so you may not even need a custom CA — Supabase certs are signed
by a public CA Node already trusts, meaning plain verified TLS works. Net: set
`PGSSLMODE`/ssl appropriately; often you can drop the custom CA entirely on
Supabase. Also remove `output: 'standalone'` + the `outputFileTracingIncludes`
block from `next.config.mjs` for Vercel (Vercel ignores standalone; harmless to
leave, cleaner to remove).

### B. The `pg` Pool must use Supabase's connection POOLER, not a direct connection
Each Vercel serverless invocation can spin up its own connection. A direct Postgres
connection (port 5432) will exhaust Supabase's connection limit fast. Supabase
provides **Supavisor**, a connection pooler:
- **Transaction mode (port 6543)** — use this for serverless. It pools per
  transaction. CRITICAL: your RLS relies on `set_config('app.current_user_role',
  …, true)` (the `true` = transaction-local). Transaction-mode pooling keeps a
  connection for the duration of a transaction, so `withTenantTransaction`'s
  `BEGIN … set_config(…, true) … COMMIT` stays correct. Session-level state would
  NOT survive, but you don't use any — all context is set inside the transaction,
  so you are safe.
- Connection string: `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

Set `DATABASE_URL` to the **pooler (6543)** string. Keep the direct (5432) string
only for running migrations (below).

**Fix:** no code change needed in `pool.ts` beyond pointing `DATABASE_URL` at the
pooler — but verify `pool.ts`'s `max` connections is low (e.g. `max: 1`) to avoid
piling up per-invocation. If `createPool()` doesn't set `max`, add `max: 1` for
the Vercel/serverless case.

### C. Route handlers and exceljs need the Node runtime (already correct)
Your export route handlers already declare `export const runtime = 'nodejs'` and
`dynamic = 'force-dynamic'`. Keep those — exceljs and `pg` cannot run on Vercel's
Edge runtime. Good news: no change needed. Just confirm none of the auth/DB code
accidentally runs on Edge (middleware runs on Edge by default — see Part 5).

---

## Part 1 — Database → Supabase Postgres (low effort)

1. Create a Supabase project (pick a region near Indonesia, e.g. Singapore).
2. **Apply migrations as the DB owner** using the DIRECT connection (port 5432),
   not the pooler, in numeric order:
   ```bash
   for f in db/migrations/0*.sql; do
     psql "postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres" \
       -v ON_ERROR_STOP=1 -f "$f"
   done
   ```
   - Migration `0003` creates the least-privilege `app_runtime` role; set its
     password with `ALTER ROLE app_runtime WITH PASSWORD '…'`.
   - RLS carries over unchanged — your policies use `current_setting('app.*', true)`,
     which is standard Postgres and works identically on Supabase.
   - VERIFY: Supabase's default `postgres` role can run every statement in
     0001–0020. Most will; watch for any that assume AWS-specific extensions
     (there shouldn't be any — the schema is plain Postgres).
3. **Data migration** (if not starting fresh): `pg_dump` from RDS →
   `psql` restore into Supabase (direct connection). Use `--no-owner
   --no-privileges`. If you applied schema via migrations first, dump
   `--data-only`.
4. **Runtime `DATABASE_URL`** = the POOLER string (6543), role `app_runtime`.

> IMPORTANT: run migrations on **5432 (direct)**; run the app on **6543 (pooler)**.

---

## Part 2 — Validate the DB move before anything else (recommended spike)

Restore (or recreate) the schema on a free Supabase project and prove tenant
isolation still holds there. You deleted the RLS test in the lean cleanup, but it's
recoverable from git history:
```bash
git checkout 9688d5a -- tests/integration/rls-tenant-isolation.test.ts vitest.config.ts
RUN_DB_TESTS=1 \
TEST_DATABASE_URL="postgresql://app_runtime:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
npx vitest run tests/integration/rls-tenant-isolation.test.ts
```
Expect 7/7 pass. This settles the database + RLS + pooler questions (the easy 80%)
before you invest in the auth rewrite (the hard 20%).

---

## Part 3 — Storage → Supabase Storage (medium effort)

Only `src/lib/s3/presign.ts` talks to object storage; every domain service calls
through it (`presignPut`, `presignPutImage`, `presignPutPublicImage`, `presignGet`,
`deleteObject`, `publicObjectUrl`). Two options:

**Option 1 — Supabase's S3-compatible endpoint (least code change).** Supabase
Storage exposes an S3-compatible API. Point the AWS SDK S3 client at it:
- In `getS3Client()`, add `endpoint: 'https://<project-ref>.storage.supabase.co/storage/v1/s3'`,
  `forcePathStyle: true`, `region: '<supabase-region>'`, and credentials from
  Supabase Storage access keys (set as env `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`).
- Create two buckets (private + public) in Supabase Storage.
- `publicObjectUrl()` already supports `S3_PUBLIC_BASE_URL` — set it to
  `https://<project-ref>.storage.supabase.co/storage/v1/object/public/<public-bucket>`.
- VERIFY: presigned PUT/GET URLs work through the Supabase S3 endpoint from the
  browser (CORS). Test an upload end-to-end.

**Option 2 — Supabase Storage SDK (more idiomatic, more rewrite).** Replace the
presign functions with `@supabase/storage-js` signed URLs. Cleaner long-term but
touches the function signatures — budget more time.

**Data copy:** `aws s3 sync` from the old buckets to the Supabase S3 endpoint, or
re-upload. Gallery/karya images under `gallery/*` and Materi/session photos.

---

## Part 4 — Auth → Supabase Auth (HIGH effort, the real work)

This is the only tightly-coupled piece. Files tied to Cognito:
`src/lib/auth/cognito.ts`, `auth-service.ts`, `guard.ts`, `types.ts`;
`src/lib/domain/teacher-account-service.ts` (admin creates/activates/adopts
teachers); `src/app/(auth)/login/actions.ts`; and the "Adopsi/Perbaiki Guru dari
Cognito" admin feature (`admin/teachers/*`).

### Two paths

**Path A — Keep Cognito even on Vercel (fastest).** Cognito is reachable over the
public internet; Vercel functions just need IAM user keys
(`AWS_ACCESS_KEY_ID`/`SECRET`) + the pool/client env vars. ZERO auth code change.
You'd run Supabase (DB+storage) + Vercel (host) + Cognito (auth). Pragmatic if the
auth rewrite isn't worth it yet.

**Path B — Replace with Supabase Auth (full migration).** Rewrite the auth module.
The rest of the app only needs the resulting `SessionClaims { role, schoolId,
cognitoSub, email }`, so if you preserve that shape the blast radius stays in
`src/lib/auth/`. Work involved:
- JWT verification: swap `aws-jwt-verify` for Supabase JWT verification
  (`@supabase/supabase-js` or verifying the Supabase JWT with the project's JWT
  secret). Map Supabase user → `SessionClaims`.
- Role + `school_id`: Cognito stored these as groups + `custom:school_id`. In
  Supabase, store them in the user's `app_metadata` (set server-side by admin
  actions) or a `profiles` join (you already have a `profiles` table keyed by
  `cognito_sub` — repurpose that column to the Supabase user id, or add
  `supabase_uid`).
- Admin "create/activate/adopt teacher" flow: reimplement with Supabase Admin API
  (`auth.admin.createUser`, set `app_metadata.role`/`school_id`, invite email).
- `cognitoSub` naming: either keep the field name (store Supabase uid in it) or
  rename across the ~6 files that reference it (`guard.ts` reads
  `profiles.cognito_sub`).

### Behavior gaps Supabase does NOT give you out of the box
Your current login handles two things Cognito provided that Supabase lacks:
- **`force_change_password` challenge** (R1.8) — Cognito's forced new-password flow.
  Supabase has no direct equivalent; you'd implement a "must reset password" flag
  (e.g. in `app_metadata`) and gate the UI on it.
- **Account lockout after failed attempts** (R1.5, `locked` status). Supabase Auth
  has rate limiting but not the same lockout-with-retry-minutes. You'd build this
  in-app or accept Supabase's defaults.

### User migration
Cognito cannot export password hashes, so **every teacher/admin resets their
password** on first login (password-reset email). Export users from Cognito
(`list-users`), create them in Supabase with role + `school_id` in `app_metadata`,
and reconcile `profiles` rows so each profile's id column matches the new Supabase
uid.

---

## Part 5 — Hosting → Vercel (low-to-medium)

1. Connect the GitHub repo (`MarifPJI/ai-builder-lms`) to Vercel. Framework
   preset: Next.js. No `Dockerfile`/`buildspec`/`amplify.yml` needed — Vercel
   builds Next.js natively (you can delete those AWS CI files, or ignore them).
2. **Env vars** (Vercel project settings → Environment Variables, all server-side):
   - `DATABASE_URL` = Supabase POOLER (6543) string, role `app_runtime`
   - `APP_AWS_REGION` — still read by the region resolver even for Supabase S3;
     set to your Supabase/S3 region
   - Supabase Auth vars (Path B): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` — OR keep the Cognito vars
     (Path A)
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — Supabase Storage keys (Path A
     also needs these for Cognito). Vercel has no IAM role, so keys are required.
   - `S3_PUBLIC_BASE_URL`, `S3_PRIVATE_BUCKET`, `S3_PUBLIC_BUCKET` → Supabase bucket
     values
   - Optionally drop `RDS_CA_BUNDLE` if Supabase's public CA suffices.
3. **next.config.mjs:** remove `output: 'standalone'` and the
   `outputFileTracingIncludes` certs block (both are ECS-container artifacts,
   irrelevant on Vercel).
4. **Middleware runs on Edge.** `src/middleware.ts` does host-based routing
   (`awsinstem.id` vs `lms.awsinstem.id`) — that's fine on Edge (no DB/Node APIs).
   But if you later add auth checks to middleware, keep DB/`pg` calls OUT of it
   (Edge can't run `pg`). Verify middleware imports nothing that pulls in `pg`/node.
5. **`pg` pooling on serverless:** set `max: 1` in the Pool (Part B above) and use
   the Supabase pooler URL. Consider `idleTimeoutMillis` low so idle functions
   don't hold connections.
6. **Domains:** add `awsinstem.id` + `lms.awsinstem.id` in Vercel; update DNS
   (Vercel gives records) — move the Route 53 records or transfer DNS. Vercel
   issues TLS automatically.

---

## Part 6 — Cutover order

1. Supabase project + migrations (5432) + data restore.
2. Run the RLS isolation test against the Supabase pooler (Part 2). Must pass.
3. Supabase Storage buckets + copy objects; wire `presign.ts` (Part 3).
4. Decide auth path. If Path B, do the rewrite + user migration on a branch.
5. Deploy to Vercel (preview URL) with all env vars; apply the 3 code tweaks.
6. Smoke test on the preview: public landing, login, an upload, admin Excel export,
   teacher sees only their school.
7. Point DNS to Vercel; remove `COOKIE_INSECURE`.
8. Decommission AWS (RDS snapshot + S3 backup first).

---

## Part 7 — What to verify (not yet confirmed)

- Supabase `postgres` role can run every statement in migrations 0001–0020
  (expected yes; confirm on a real project).
- Presigned PUT/GET through Supabase's S3-compatible endpoint works from the
  browser with CORS (the uploads are direct browser→storage).
- Transaction-mode pooler (6543) preserves `set_config(…, true)` across your
  `BEGIN…COMMIT` — expected yes (that's the point of transaction mode), but prove
  it with the RLS test.
- `pg` Pool behavior on Vercel serverless with `max: 1` under concurrent requests
  — watch Supabase connection count.
- Edge middleware does not transitively import `pg`/`server-only` Node modules.

## Known gaps vs the current AWS setup (accept or rebuild)
- No ECS task role on Vercel → you MUST use static IAM/Supabase keys in env.
- Cognito's forced-password-change + lockout have no Supabase equivalent — rebuild
  in-app if required.
- All users reset passwords (no hash export from Cognito).
