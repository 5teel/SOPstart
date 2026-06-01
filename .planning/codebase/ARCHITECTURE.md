<!-- refreshed: 2026-06-01 -->
# Architecture

**Analysis Date:** 2026-06-01

## System Overview

SafeStart is a multi-tenant Next.js 16 App Router SaaS PWA that implements a three-tier architecture: **Client (React Components)** → **Server Actions & API Routes** → **Supabase (Auth, RLS, Storage, Postgres)**. The system separates concerns into feature layers: authentication (route guards via middleware), SOP management (parsing → review → publishing), worker walkthrough execution (with offline Dexie caching), and supervisor sign-off workflows.

```text
┌────────────────────────────────────────────────────────────────────┐
│                          Client Layer                               │
│  React Components (Pages & Layouts)                                 │
│  `src/app/(auth)/`, `src/app/(protected)/`, `src/app/~offline`     │
└────────────────────┬──────────────────────────────────────────────┘
                     │
    ┌────────────────┼───────────────────────┐
    │                │                       │
    ▼                ▼                       ▼
┌───────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Server       │ │  API Routes      │ │  Zustand Stores  │
│  Actions      │ │ & Hooks          │ │  & React Query   │
│ `src/actions` │ │ `src/app/api`    │ │ `src/stores`     │
└───────┬───────┘ │ `src/hooks`      │ │ `src/lib/offline`│
        │         └────────┬─────────┘ └────────┬─────────┘
        │                  │                    │
        └──────────────────┼────────────────────┘
                           │
                    ┌──────▼──────────┐
                    │  Supabase SDK   │
                    │  & Auth Layer   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌────────────┐   ┌──────────────┐   ┌──────────────┐
    │ PostgreSQL │   │ Auth Service │   │ Storage      │
    │ RLS Policy │   │ & Sessions   │   │ (Buckets)    │
    │ Tables     │   │              │   │              │
    └────────────┘   └──────────────┘   └──────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **App Router** | Route structure & layouts, middleware protection, metadata | `src/app/layout.tsx`, `src/lib/supabase/middleware.ts` |
| **Auth Routes** | Login, sign-up, join, invite acceptance (unprotected) | `src/app/(auth)/` |
| **Protected Routes** | Worker/supervisor/admin views (gated by `updateSession`) | `src/app/(protected)/` |
| **Server Actions** | Mutations: SOP creation, parsing, completions, versioning | `src/actions/*.ts` |
| **API Routes** | Complex operations: document parsing, video gen, schema introspection | `src/app/api/sops/*.ts` |
| **Components** | React UI: SOP display, walkthrough views, admin builders | `src/components/` |
| **Hooks** | Client-side queries: `useSopDetail`, `useCompletions`, `useOnlineStatus` | `src/hooks/*.ts` |
| **Zustand Stores** | Ephemeral client state: walkthrough progress, completion photos | `src/stores/*.ts` |
| **Offline DB** | Dexie IndexedDB cache for assigned SOPs, photo queue, voice notes | `src/lib/offline/db.ts` |
| **Supabase Clients** | `client.ts` (anon), `server.ts` (session), `admin.ts` (service-role) | `src/lib/supabase/*.ts` |
| **Validators** | Zod schemas for forms, API input, GPT structured outputs | `src/lib/validators/*.ts` |

## Pattern Overview

**Overall:** Next.js 16 App Router with hybrid server/client boundary using Next.js Server Actions, React Query for async state, Zustand for ephemeral UI state, and Supabase Postgres + Auth + RLS for multi-tenant isolation.

**Key Characteristics:**
- **Server-first**: Data mutations via Server Actions (`'use server'` functions), fetches via React Query or server-side layout reads
- **RLS-enforced isolation**: Supabase Row-Level Security policies filter data by `organisation_id` and role; admin client bypasses RLS only where explicitly needed
- **Offline-capable**: Assigned SOPs synced to Dexie; walkthroughs read from cache; completions queued and flushed on reconnect
- **Streaming & PWA**: Serwist service worker caches assets; HTML shell cached for offline fallback at `src/app/~offline/page.tsx`

## Layers

**Route Handler Layer:**
- Purpose: Route guards and navigation
- Location: `src/app/`, `src/lib/supabase/middleware.ts`
- Contains: Next.js route groups `(auth)`, `(protected)`, API routes under `api/`
- Depends on: Supabase Auth, middleware via `updateSession`
- Used by: Browser navigation, form submissions

**Server Action Layer:**
- Purpose: Encapsulate mutations (create, update, delete); enforce auth and role checks via JWT claims
- Location: `src/actions/*.ts`
- Contains: `sops.ts`, `completions.ts`, `blocks.ts`, `assignments.ts`, `versioning.ts`, etc.
- Depends on: Zod validators, Supabase clients (server, admin)
- Used by: Form submissions, click handlers in client components

**API Route Layer:**
- Purpose: Complex operations requiring longer execution (parsing, video generation, file processing)
- Location: `src/app/api/sops/` and sub-routes
- Contains: `parse/route.ts` (300s timeout), `generate-video/`, `pipeline/`, `transcribe/`, etc.
- Depends on: File extraction libs, GPT API, Supabase storage
- Used by: Background jobs, long-running tasks

**Component Layer:**
- Purpose: UI rendering and user interaction
- Location: `src/components/`
- Contains: Page routes (`(auth)/login/page.tsx`), layout components (`layout/*.tsx`), feature components (`sop/`, `admin/`, `activity/`)
- Depends on: Hooks, stores, Supabase client
- Used by: App router pages

**Data Query Layer:**
- Purpose: Fetch data from Supabase or cache
- Location: `src/hooks/`, `src/lib/offline/sync-engine.ts`
- Contains: `useSopDetail`, `useCompletions`, `useAssignedSops`, sync engine
- Depends on: React Query, Dexie, Supabase client
- Used by: Components via `useQuery` or direct Dexie reads

**Client State Layer:**
- Purpose: Ephemeral UI state (form values, walkthrough progress, modal open/close)
- Location: `src/stores/*.ts`
- Contains: `walkthrough.ts` (step completion, ack trace), `completionStore.ts`, `network.ts`
- Depends on: Zustand
- Used by: Components, hooks

**Offline Sync Layer:**
- Purpose: Reconcile offline changes with server on reconnect
- Location: `src/lib/offline/sync-engine.ts`, `voice-queue.ts`
- Contains: `syncAssignedSops` (Dexie → Supabase), photo upload queue, voice note queue
- Depends on: Dexie, Supabase client, server actions
- Used by: Service worker, component lifecycle hooks

## Data Flow

### Primary Request Path: Worker Walkthrough

1. **Navigation** → Worker browses SOPs at `/sops` (list) or `/sops/[sopId]` (detail)
2. **Server-side Fetch** (`useSopDetail` hook, `src/hooks/useSopDetail.ts:10`)
   - Try Dexie first (offline cache of assigned SOPs)
   - Fallback: Fetch from Supabase with RLS (only SOPs visible to user's org/role)
3. **React Query Caching** → Result stored in memory; stale time 5 min
4. **Component Render** → `WalkthroughSwitcher` (`src/components/sop/walkthrough/WalkthroughSwitcher.tsx`) dispatches to `MobileWalkthrough` or `DesktopWalkthrough` based on viewport
5. **Step Interaction** → Worker taps "I've done this" on each step
   - `walkthrough.ts` store marks step complete (memory state)
   - Photo capture writes to local `QueuedPhoto` in Dexie (`src/lib/offline/db.ts:23-32`)
6. **Submission** → Worker taps "Submit" button
   - Client generates `contentHash` (deterministic JSON hash of walkthrough state)
   - `submitCompletion` server action (`src/actions/completions.ts:20`) inserts into `sop_completions` table with idempotent UUID
   - Photo queue flushed: `getPhotoUploadUrl` server action generates presigned URLs, uploads to Storage bucket `completion-photos`
7. **Offline Behavior** → No network? Photos/completion queued locally via `syncEngine` reconnect handler

### Secondary Path: SOP Parsing & Publishing

1. **Upload** → Admin uploads file at `/admin/sops/upload`
2. **Session Created** → `createUploadSession` server action (`src/actions/sops.ts:9`) creates SOP record (status: `uploading`) and presigned URL
3. **Client Upload** → File POSTed to Supabase Storage presigned URL
4. **Parse Job Queued** → `parse_jobs` table row created (status: `queued`)
5. **Async Parse** → External trigger (manual or webhook) POSTs to `/api/sops/parse` route
   - Route extracts file from Storage, calls `extractDocx` / `extractPdf` / OCR as needed
   - Calls `parseSopWithGPT` (OpenAI structured output) to transform text → sections/steps
   - Calls `parsedSopToPerSectionLayoutData` to generate layout JSON (Puck blocks)
   - Inserts `SopSection` rows, `SopStep` rows, and optional `SopImage` rows
   - Updates parse job (status: `completed`)
6. **Review** → Admin views at `/admin/sops/[sopId]/review`, edits sections/steps via builder
7. **Publish** → `publishSop` server action updates status to `published`
8. **Assignment** → Admin assigns to roles/trades at `/admin/sops/[sopId]/assign`

### Tertiary Path: Supervisor Sign-Off

1. **Activity View** → Supervisor visits `/activity` (TanStack query fetches completions)
2. **Review Detail** → Click completion ID to view `/activity/[completionId]`
   - Shows step data (timestamps), photos, ack trace (proof of sequential reading)
3. **Sign-Off Decision** → Supervisor approves or rejects
   - `signOffCompletion` server action (`src/actions/completions.ts:104`) inserts immutable `completion_sign_offs` record
   - Updates `sop_completions.status` (signed_off / rejected)
   - On rejection: inserts notification for worker
4. **Notification** → Worker sees notification, can resubmit walkthrough

**State Management:**
- **Server-side**: Supabase Postgres (SSOT for all durable state)
- **Client-side session**: React Query cache (`useSopDetail`, `useCompletions`) — 5-min stale time
- **Ephemeral UI state**: Zustand stores (`walkthrough.ts`, `completionStore.ts`) — reset on navigation or logout
- **Offline durability**: Dexie (`LocalCompletion`, `QueuedPhoto`, `DraftLayout`) — synced on reconnect via `syncEngine`

## Key Abstractions

**SopWithSections:**
- Purpose: Represents a complete SOP with nested sections and steps
- Examples: Used by `useSopDetail` hook, `WalkthroughSwitcher` component, `syncAssignedSops` sync engine
- Pattern: PostgREST auto-joins via `select('*, sop_sections(*, sop_steps(...), sop_images(...))')` syntax; client code expects sorted arrays

**BlockContent (discriminated union):**
- Purpose: Validates and types SOP section content blocks (text, photo, callout, measurement, decision, escalate, voice-note, etc.)
- Examples: `TextBlock`, `PhotoBlock`, `MeasurementBlock` components in `src/components/sop/blocks/`
- Pattern: Zod schema in `src/lib/validators/blocks.ts` defines allowed block types; Puck visual builder reads/writes this schema

**ParsedSop (GPT output schema):**
- Purpose: Intermediate shape after GPT parsing; distinct from final `SopSection` database rows
- Examples: Sections with confidence scores, steps with image indexes
- Pattern: Zod schema validates GPT `zodResponseFormat`; transformer `parsedSopToPerSectionLayoutData` converts to layout blocks

**LocalCompletion (offline durability):**
- Purpose: Tracks in-progress walkthrough in Dexie with client-generated UUID (idempotency key)
- Examples: Stores step completion times, content hash, ack trace
- Pattern: UUID used as primary key to `sop_completions`; enables offline submission + idempotent retry

**DraftLayout (builder autosave):**
- Purpose: Caches per-section Puck layout data (opaque JSON) in Dexie during builder editing
- Examples: `layout_data` field stores Puck editor state; `syncState` tracks dirty vs synced
- Pattern: Monotonic `layout_version` pin; LWW (last-write-wins) merge on sync

## Entry Points

**Public Entry:**
- Location: `src/app/layout.tsx` (root)
- Triggers: Browser loads app
- Responsibilities: Metadata, favicon, theme setup, body HTML wrapper

**Auth Entry:**
- Location: `src/app/(auth)/login/page.tsx`
- Triggers: Unauthenticated user
- Responsibilities: Email/password form, magic link, error handling

**Protected Entry:**
- Location: `src/app/(protected)/layout.tsx`
- Triggers: `updateSession` middleware redirects authenticated users here
- Responsibilities: Role-based navigation (workers → `/sops`, supervisors → `/activity`, admins → `/dashboard`)

**Middleware (Session Gate):**
- Location: `src/lib/supabase/middleware.ts`
- Triggers: Every request
- Responsibilities: Session refresh, auth route guard, public route whitelist (login, sign-up, `/api/schema`)

**API Entry (Parsing):**
- Location: `src/app/api/sops/parse/route.ts`
- Triggers: Manual POST or external webhook after file upload
- Responsibilities: Download source file, extract text/images, call GPT, materialize layout blocks

**API Entry (Schema Introspection):**
- Location: `src/app/api/schema/route.ts`
- Triggers: External AI agents or integrations
- Responsibilities: Return SOP data model metadata (block types, enums, JSON-Schema) — public, no RLS

## Architectural Constraints

- **Threading:** Single-threaded event loop (Node.js + Next.js); no worker threads. Long tasks (parsing, video gen) run sequentially; Vercel's 300s timeout enforced for `/api/sops/parse`.
- **Global state:** Zustand stores are per-component-instance (no global singleton); Dexie is a true singleton (IndexedDB per origin). Supabase client instances are created fresh per request (server actions) to avoid session cross-contamination.
- **Circular imports:** None detected; feature modules (`sop`, `admin`, `activity`) are independent; shared utilities in `lib/` do not import from `components/`.
- **RLS recursion:** Avoided via Phase 13 learnings — cross-table RLS policies must not exist (e.g., junction table policies checked parent AND parent checked junction → infinite recursion). Use `SECURITY DEFINER` helpers or drop junction policies if rows are non-sensitive.
- **Serialization boundary:** Server actions and API routes return plain JSON; no Date, class instances, or non-serializable types cross the boundary. Timestamps stored as ISO strings.
- **Service worker interaction:** Serwist intercepts all requests; if an asset is stale but offline, it serves the cached version. Search-param-only URL changes via `router.push()` trigger RSC fetches (Phase 13 learning); use `useState` + `history.replaceState` for hot click paths.

## Anti-Patterns

### Cross-Org Data Leakage via Missing RLS

**What happens:** A Supabase table is created without explicit RLS policies; queries that omit `organisation_id` filter leak data across tenants.

**Why it's wrong:** Multi-tenant violation; supervisor from Org A sees Org B's completions or assignments.

**Do this instead:** Every table with `organisation_id` column must have a base policy: `using (organisation_id = auth.jwt() ->> 'organisation_id')`. Check `supabase/migrations/` for the pattern in existing tables like `sops`, `sop_completions`, `organisation_members` (migration 00001, 00005, etc.).

### Calling `createAdminClient()` from User-Facing Code

**What happens:** A user-facing component calls admin client directly, intending to bypass RLS for a "shortcut."

**Why it's wrong:** Defeats security isolation; requires service-role key on client (compromises key if client is bundled or inspected). RLS is bypassed silently.

**Do this instead:** Put the protected operation in a Server Action or API route where the admin client is legitimately used. For example, `publishSop` must bypass RLS to update status; it's wrapped in `src/actions/sops.ts:150` and called via a button handler that triggers the server action.

### Synchronous Await on Dexie Writes in Hot Paths

**What happens:** A click handler awaits `db.sops.put(...)` before rendering the next step, blocking the UI for 100-500ms.

**Why it's wrong:** Perceived lag; workers think the app is slow when Dexie latency is the bottleneck.

**Do this instead:** Fire and forget if it's non-critical (e.g., caching a read). For completions, use Zustand in-memory store first, queue the Dexie write as a background side-effect, and let the submission happen async. Phase 15 learning: `router.push` on search-param changes is slower than `useState + history.replaceState` because it triggers RSC fetch.

### Unvalidated Zod Parse in API Routes

**What happens:** An API route accepts user input without calling `schema.safeParse()`, trusting the TypeScript type.

**Why it's wrong:** Runtime input mismatch (TypeScript types are compile-time only); attacker sends malformed JSON, causing 500 or silent failures.

**Do this instead:** Always use `.safeParse()` and check the result. Example from `src/app/api/sops/parse/route.ts:35-40`:
```typescript
const body = await request.json()
const { sopId } = body as { sopId: string }
if (!sopId) {
  return NextResponse.json({ error: 'sopId is required' }, { status: 400 })
}
```

### Missing Idempotency Keys on Retryable Operations

**What happens:** A network hiccup causes a user to click "Submit" twice; two identical completions are inserted.

**Why it's wrong:** Supervisor sees duplicate records; reports are inflated.

**Do this instead:** Use client-generated UUID as primary key. `submitCompletion` in `src/actions/completions.ts:52` inserts with `id: localId` (client UUID); if the network retries the submission, the second insert hits a unique constraint (23505) and is treated as idempotent success.

---

*Architecture analysis: 2026-06-01*
