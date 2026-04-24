# SafeStart — SOP Assistant PWA

## Project Description

SafeStart is a multi-tenant SaaS progressive web app that helps blue-collar tradespeople and inspectors follow Standard Operating Procedures (SOPs) on-site. Organizations upload existing SOP documents (Word/PDF), AI parses them into structured mobile-friendly procedures, and workers walk through them step-by-step on their phones — with photo capture, completion tracking, and supervisor sign-off.

**Target market:** New Zealand industrial/manufacturing organizations (glass manufacturing, machine shops, etc.) with 50-500 SOPs across departments.

## Technology Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 (PostCSS plugin)
- **Database/Auth**: Supabase (Postgres, Auth, Storage, RLS policies)
- **State**: Zustand (client stores), TanStack React Query (server state)
- **Offline**: Serwist (service worker / PWA), Dexie (IndexedDB), idb-keyval
- **AI Parsing**: OpenAI API (GPT) for document-to-structured-SOP conversion
- **File Parsing**: mammoth (DOCX), unpdf (PDF), tesseract.js (OCR)
- **Forms**: React Hook Form + Zod validation
- **Testing**: Playwright (integration + E2E)
- **Icons**: Lucide React
- **Theme**: next-themes (dark mode default)
- **Dev port**: 4200 (`npm run dev`)

## Architecture

### Route Structure (App Router)
- `(auth)/` — Login, sign-up, invite, join flows
- `(protected)/` — Authenticated routes behind middleware
  - `dashboard/` — Worker/supervisor home
  - `sops/` — SOP library browse, `[sopId]` detail, `[sopId]/walkthrough` step-by-step mode
  - `activity/` — Completion records, supervisor review (`[completionId]`)
  - `admin/sops/` — SOP management, upload, `[sopId]/review`, `[sopId]/assign`, `[sopId]/versions`
  - `admin/team/` — Team/org member management
- `api/sops/` — REST API routes (parse, publish, assignments, sections, download-url, parse-job)
- `~offline/` — Offline fallback page

### Key Directories
- `src/actions/` — Server actions (auth, sops, assignments, completions, versioning)
- `src/components/sop/` — SOP-specific UI (walkthrough, steps, photos, sections, search)
- `src/components/activity/` — Completion/activity UI
- `src/components/admin/` — Admin panel UI
- `src/components/layout/` — Shared layout (nav, sidebar, etc.)
- `src/components/providers/` — React context providers
- `src/hooks/` — Custom hooks (useAssignedSops, useCompletions, useOnlineStatus, usePhotoQueue, useSopDetail, useSopSync, useNotifications)
- `src/stores/` — Zustand stores (completionStore, network, walkthrough)
- `src/lib/parsers/` — File parsing pipeline (extract-docx, extract-pdf, gpt-parser, image-uploader, ocr-fallback)
- `src/lib/offline/` — Offline infrastructure (db, photo-compress, query-persister, sync-engine)
- `src/lib/supabase/` — Supabase client variants (client, server, admin, middleware)
- `src/lib/validators/` — Zod schemas (auth, sop)
- `src/types/` — TypeScript types (sop, auth, database.types)

### Data Model (core types)
- **Sop** — Top-level SOP record (title, status, version, source file, confidence scores, OCR flag)
- **SopSection** — Sections within an SOP (type, title, content, sort_order, confidence, approved flag)
- **SopStep** — Individual steps within sections (text, warning/caution/tip, tools, time estimate, photo_required)
- **SopImage** — Images attached to SOPs/sections/steps (stored in Supabase Storage)
- **ParseJob** — Tracks async AI parsing pipeline (queued → processing → completed/failed)
- Statuses: SOP lifecycle is `uploading → parsing → draft → published`

### Multi-tenant & Roles
- Organization-scoped data with RLS policies
- Roles: Worker, Supervisor, SOP Admin, Safety Manager
- SOP assignment by role/trade

### Offline Strategy
- Service worker via Serwist for asset caching
- Dexie (IndexedDB) for offline SOP data
- Photo queue with compression for deferred upload
- Sync engine for reconnection reconciliation

## Conventions

- Dark theme by default (`bg-steel-900`, `text-brand-yellow` palette)
- PWA-first: large tap targets (glove-friendly), mobile-optimized
- Supabase RLS for all data access; `admin.ts` client for elevated operations only
- Server actions in `src/actions/` for mutations; API routes for complex operations (parsing, file handling)
- Zod schemas in `src/lib/validators/` for all form/API validation
- Database migrations in `supabase/migrations/` (numbered sequentially)

## Commands

```bash
npm run dev          # Dev server on port 4200
npm run build        # Production build
npm run lint         # ESLint
npm run test         # All Playwright tests
npm run test:integration  # Integration tests only
npm run test:e2e     # E2E tests only
```

## Learnings

_Log mistakes, errors, and patterns discovered during development sessions here._

- **[2026-04-04] Windows-only npm packages break Railway (Linux) builds** — `@tailwindcss/oxide-win32-x64-msvc` and `lightningcss-win32-x64-msvc` must be in `optionalDependencies`, not `dependencies`. npm fails hard on platform mismatch in `dependencies` but gracefully skips `optionalDependencies`.
- **[2026-04-04] Railway uses dynamic $PORT** — Never hardcode port in start command for Railway. Use `next start -p $PORT` in `railway.json` deploy.startCommand. Local dev keeps `-p 4200`.
- **[2026-04-04] Railway Node version defaults to 18** — Supabase SDK and Tailwind v4 require Node 20+. Pin via `engines` in package.json AND `nixpacksPlan.phases.setup.nixPkgs: ["nodejs_20"]` in railway.json.
- **[2026-04-04] Parallel worktree merges cause duplicate functions** — When multiple executor agents add the same function (e.g. `createVideoUploadSession`), merge produces duplicates. Always check for duplicate declarations after merging parallel worktree branches.
- **[2026-04-04] Railway custom domains need TXT verification** — CNAME alone is not enough. Railway requires a `_railway-verify.{subdomain}` TXT record. Target hostnames can change when you re-add a domain — always check "Show DNS records" for the current values.
- **[2026-04-24] Worktree executors can leak files to main working tree** — During Phase 12 Wave 2, the executor agent for plan 12-02 wrote new files (`src/components/sop/blocks/*.tsx`) into both the worktree AND the main repo root, blocking the merge with "untracked files would be overwritten". Mitigation: instruct executor prompts explicitly that writes must use paths relative to the worktree cwd, never absolute `C:\Development\SOPstart\src\…` paths. Recovery: commits still live in reflog even after branch deletion — `git branch <name> <reflog-sha>` + clean-then-merge. (Phase 12)
- **[2026-04-24] Windows Next.js 16 webpack dev mode has transient file-lock races** — `next dev --webpack` on Windows 11 repeatedly emits `UNKNOWN: open '.next/dev/static/chunks/app/layout.js'` (errno -4094 / UV_UNKNOWN) after small edits or rapid navigation, returning 500s to the browser. Cleaning `.next` helps for one request, then recurs. Workaround for UAT: switch to `next build && next start` (production mode) — no HMR chunks, stable. Root cause likely antivirus file-lock race. (Phase 12 UAT)
- **[2026-04-24] `reorder_sections` RPC uses `p_sop_id` + `p_ordered_section_ids`** — Not `sop_id_input`/`section_ids_input`. Check migration 00020 when calling the RPC from scripts; Supabase JS `sb.rpc(...)` resolves function by parameter name, so mismatched keys fail with "function … not found in schema cache" even though the function exists. (Phase 12)
- **[2026-04-24] Magic-link session install via hash-fragment cookies** — `sb.auth.admin.generateLink({type:'magiclink'})` returns a hash-fragment token that @supabase/ssr doesn't auto-exchange. For Playwright UAT against a local dev server, set `sb-{projectRef}-auth-token` cookie with `base64-` + `btoa(JSON.stringify({access_token, refresh_token, expires_at, expires_in, token_type, user:null}))` format. Next page navigation picks up the session. (Phase 12 UAT)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
