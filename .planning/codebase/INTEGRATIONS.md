# External Integrations

**Analysis Date:** 2026-06-01

## APIs & External Services

**SOP Document Processing:**
- OpenAI (GPT) - Parses Word/PDF documents into structured SOP JSON
  - SDK: `openai` 6.32.0
  - Auth: `OPENAI_API_KEY`
  - Used in: `src/lib/parsers/gpt-parser.ts`
  - Feature: Structured output via Claude-style tool definition (`SOP_TOOL`), system prompt in `src/app/api/sops/parse/route.ts`
  - Handles: document text + image tokens, outputs title, sections, steps, confidence scores, safety hazards, PPE recommendations

- Anthropic (Claude) - Adversarial SOP verification and flagging
  - SDK: `@anthropic-ai/sdk` 0.82.0
  - Auth: `ANTHROPIC_API_KEY`
  - Used in: `src/lib/parsers/ai-reviewer/` (Phase 21 AI verification pipeline)
  - Feature: Flags problematic parsed content, terminology mismatches, safety concerns

**Transcription:**
- Deepgram - Batch speech-to-text for recorded video SOPs
  - SDK: REST via fetch
  - Auth: `DEEPGRAM_API_KEY` (server-side only, never NEXT_PUBLIC)
  - Used in: `src/lib/parsers/transcribe-audio.ts`, `src/app/api/sops/transcribe/route.ts`

## Data Storage

**Primary Database:**
- Supabase (managed PostgreSQL)
  - Client: `@supabase/supabase-js` 2.99.3
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`
  - Auth: Via Supabase Auth (magic links, passwords)
  - Tables: organisations, organisation_members, sops, sop_sections, sop_steps, sop_images, sop_assignments, parse_jobs, video_generation_jobs, completions, completion_photos, escalation_reports, etc.
  - Security: Row-level security (RLS) policies on every table; org-scoped queries enforced via `organisation_id`
  - Migrations: 33 numbered migrations in `supabase/migrations/` (foundation → Phase 21 AI review)
  - Functions: RPC functions for complex operations (e.g., `reorder_sections`, `is_platform_admin()`, `can_sign_off_completion()`)

**File Storage:**
- Supabase Storage (S3-compatible object store)
  - Buckets:
    - `sop-documents` — Original uploaded Word/PDF files
    - `sop-images` — Extracted/parsed images from documents + step photos
    - `completion-photos` — Worker-captured photos during walkthrough
    - `escalation-attachments` — Photos/documents attached to escalation reports
  - RLS: Storage-level RLS policies mirror table permissions (org-scoped access)
  - Signing: Pre-signed URLs for time-limited access to private files

**Configuration Storage:**
- Environment variables (`.env.local` for dev, Railway secrets for prod)
  - Never committed: `.env.local` in `.gitignore`
  - Secrets location: Railway environment config (UI or `railway.json` at deploy time)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (PostgreSQL-backed, email + magic link)
  - Method: Email/password signup, magic link sign-in (confirmed by Supabase auth.admin.generateLink)
  - Session: JWT token stored in HTTP-only cookie (via `@supabase/ssr`)
  - Middleware: `src/app/middleware.ts` refreshes session on each request (server-side redirect gating)
  - Multi-tenant: Via `organisation_id` claim embedded in JWT (set when an admin invites a member)
  - Roles: Defined in `organisation_members` table (worker, supervisor, admin, safety_manager)
  - RLS: JWT claims (`organisation_id`, `user_role`) used in WHERE clauses

**JWT Claims:**
- Custom claims in access token:
  - `organisation_id` — org UUID (added at signup)
  - `user_role` — app_role enum (worker, supervisor, admin, safety_manager)
  - Decoded in API routes via `session.access_token` JWT parsing

**Admin Operations:**
- Service role client (`createAdminClient()`) — uses `SUPABASE_SERVICE_ROLE_KEY`
  - Used in server actions for role assignment, parsing job lifecycle
  - Never exposed to client; server actions only
  - Email confirmation bypass for programmatic user creation

## Monitoring & Observability

**Error Tracking:**
- Not detected — errors logged to console/Next.js default handler
- Parse job failures logged in `parse_jobs` table (status: 'failed', error_message field)

**Logs:**
- Approach: console.log/console.error in server actions + API routes
- Structured logging: JSON objects logged in parse jobs (error_message, current_stage, retry_count)
- Client-side: Browser console

**Performance:**

## CI/CD & Deployment

**Hosting:**
- Railway (railway.com) — auto-deploy on push to `master` branch
  - Build: NIXPACKS with Node.js 20 pinned
  - Environment: Linux container (not Windows)
  - Database: External Supabase Cloud (not Railway Postgres)

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, or Jenkins config)
- Manual testing via Playwright locally (`npm run test`)
- Contract validation in build step (`npm run prebuild`, `npm run postbuild`)

**Deployment Flow:**
1. Push to `master` → Railway detects
2. `npm run build` — TypeScript check, Next.js build, contract check, bundle size check
3. `next start -p $PORT` — starts production server
4. Health check: GET `/` must return 200 within 30s
5. Auto-restart on crash (3 retries, then stop)

## Environment Configuration

**Required env vars (dev + prod):**
- `NEXT_PUBLIC_SUPABASE_URL` — https://xxx.supabase.co
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — anon key (note: called PUBLISHABLE, not ANON)
- `SUPABASE_SERVICE_ROLE_KEY` — service role (server-side only)

**AI/Parsing env vars:**
- `OPENAI_API_KEY` — sk-... (OpenAI account)
- `ANTHROPIC_API_KEY` — sk-ant-... (Anthropic account)

**Transcription env vars:**
- `DEEPGRAM_API_KEY` — API key from Deepgram console (server-side only)

**Optional:**
- `NEXT_PUBLIC_MODEL_BLOCK_ENABLED` — "true"/"false" for 3D viewer (default: false)

**Secrets location:**
- **Development:** `.env.local` file (never committed, in .gitignore)
- **Production (Railway):** Environment variables in Railway dashboard or set via `railway env set KEY=value`
- **Supabase local:** `supabase/.env.local` for emulation (anon/service-role keys auto-generated by CLI)

## Webhooks & Callbacks

**Incoming:**
- None. Parse job completion is polled from the UI.

**Server Actions (internal RPC):**
- `signOut()` — clears session
- `inviteWorker()` — sends invite email via Supabase Auth
- `acceptInvite()` — joins org via invite code
- `submitCompletion()` — writes the completion to Postgres
- `uploadPhoto()` — stores completion photo to Supabase Storage
- `assignSopToRole()` / `assignSopToUser()` — manages SOP assignments
- `publishSop()` — transitions SOP from draft → published

## Data Flows

**SOP Parsing Pipeline:**
```
1. Worker uploads DOCX/PDF → POST /api/sops/parse
2. Server extracts text/images (mammoth, unpdf, tesseract)
3. OpenAI parses structured JSON (hazards, PPE, steps, etc.)
4. Anthropic reviews for safety flags (optional, Phase 21)
5. ParseJob record created (status: queued → processing → completed)
6. Admin reviews in builder UI, publishes to SOP table
7. Assigned workers read the published SOP from Supabase
```

**Walkthrough Completion:**
```
1. Worker reads SOP steps (fetched from Supabase)
2. Captures photos -> compressed in the browser -> uploaded to Supabase Storage
3. Marks steps complete in the walkthrough store
4. submitCompletion() -> Postgres
5. Supervisor reviews in Activity -> approves/rejects
```

## Rate Limiting & Quotas

**OpenAI:**
- Per-request cost: GPT parsing ~0.50 OPENAI tokens per document
- No explicit rate limit per codebase; relies on OpenAI account quota

**Anthropic:**
- AI reviewer per-document cost: ~0.30 input tokens, variable output
- No explicit backoff; retries via parse job `retry_count`

**Deepgram:**
- Billed per minute of audio transcribed

**Supabase:**
- Database: Query counted; RLS isolation + heavy queries may incur cost
- Storage: Per-GB egress + per-request pricing
- Auth: Magic link sent via email (quota-based)

---

*Integration audit: 2026-06-01*
