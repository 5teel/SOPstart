# Architecture Research

**Domain:** Multi-tenant SaaS PWA — SOP/procedure management for industrial field workers
**Researched:** 2026-03-23
**Confidence:** HIGH (core patterns well-established; specific technology choices to be confirmed in STACK research)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (PWA)                            │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Worker UI  │  │ Supervisor │  │ SOP Admin  │  │ Safety Mgr UI │  │
│  │(walkthrough│  │  UI (sign- │  │ UI (upload │  │ (reports,     │  │
│  │ / lookup)  │  │  off/review│  │  / review) │  │  compliance)  │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └───────┬───────┘  │
│        │               │               │                  │          │
│  ┌─────▼───────────────▼───────────────▼──────────────────▼───────┐  │
│  │               App Shell + Router + Auth Guard                   │  │
│  └─────────────────────────────┬───────────────────────────────────┘  │
│                                │                                      │
│  ┌─────────────────────────────▼───────────────────────────────────┐  │
│  │              Offline-First Data Layer                            │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │  │
│  │  │  IndexedDB   │  │  Sync Queue  │  │  Cache API (app shell) │  │  │
│  │  │(SOPs, steps, │  │(pending ops) │  │  + media assets        │  │  │
│  │  │  completions)│  └──────┬───────┘  └────────────────────────┘  │  │
│  │  └─────────────┘         │                                       │  │
│  │                          │                                       │  │
│  │  ┌───────────────────────▼───────────────────────────────────┐  │  │
│  │  │           Service Worker (Workbox)                         │  │  │
│  │  │  - Background Sync (flush queue on reconnect)             │  │  │
│  │  │  - Cache strategies per asset class                       │  │  │
│  │  │  - Push notification handler                              │  │  │
│  │  └───────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS REST / JSON
┌──────────────────────────────▼───────────────────────────────────────┐
│                        API LAYER                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  Auth Service  │  │  SOP Service   │  │  Completion Service    │  │
│  │  (JWT + tenant │  │  (CRUD, assign,│  │  (record, sign-off,    │  │
│  │   context)     │  │   versioning)  │  │   photo evidence)      │  │
│  └────────────────┘  └────────────────┘  └────────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  Tenant/Org    │  │  User/Role     │  │  Notification Service  │  │
│  │  Service       │  │  Service       │  │  (sign-off requests)   │  │
│  └────────────────┘  └────────────────┘  └────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              Tenant Context Middleware                           │  │
│  │  Extracts tenant_id from JWT → sets DB session variable         │  │
│  │  → RLS policies enforce isolation on every query                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                    ASYNC PROCESSING LAYER                             │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                  Document Parsing Pipeline                       │  │
│  │  Upload → Job Queue → Extract Text/Images → LLM Structuring     │  │
│  │  → Confidence Score → Admin Review Queue → Publish              │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────┐  ┌────────────────────────────────────┐   │
│  │   Job Queue Worker     │  │   File Storage (Object Store)      │   │
│  │   (parse jobs, photo   │  │   (original docs, extracted imgs,  │   │
│  │    resize jobs)        │  │    evidence photos)                │   │
│  └────────────────────────┘  └────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────┐
│                        DATA LAYER                                     │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │   PostgreSQL + RLS   │  │  Object Storage  │  │   Cache/KV     │  │
│  │   (tenant-isolated   │  │  (S3-compatible) │  │  (sessions,    │  │
│  │    all app data)     │  │                  │  │   job state)   │  │
│  └──────────────────────┘  └──────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Worker UI | Step-by-step SOP walkthrough, photo capture, offline access | Offline Data Layer, API (sync) |
| Supervisor UI | Review completed SOPs, provide sign-off, assign work | API (Completion Service, User Service) |
| SOP Admin UI | Upload documents, review parsed output, publish SOPs | API (SOP Service), Document Pipeline |
| Offline Data Layer | IndexedDB store for SOPs/completions, Sync Queue for writes | Service Worker, API |
| Service Worker | Cache strategies, Background Sync flush, push handling | IndexedDB, Cache API, API |
| Auth Service | JWT issuance, tenant context embedding, role claims | All services (middleware) |
| SOP Service | SOP CRUD, versioning, assignment to roles/workers | DB (RLS-enforced), Object Storage |
| Completion Service | Record step completion, evidence photo upload, sign-off workflow | DB, Object Storage, Notification Service |
| Tenant Context Middleware | Extract tenant_id from JWT, set DB session var before every query | PostgreSQL RLS policies |
| Document Parsing Pipeline | Word/PDF → text + image extraction → LLM structuring → confidence scoring | Job Queue, Object Storage, DB |
| Job Queue Worker | Process async jobs (parse, image resize) outside request cycle | Document Pipeline, Object Storage |
| PostgreSQL + RLS | Persist all application data with row-level tenant isolation | All API services |
| Object Storage | Store raw documents, extracted images, evidence photos | Parsing Pipeline, Completion Service |


## Recommended Project Structure

```
src/
├── app/                        # Next.js app router pages and layouts
│   ├── (worker)/               # Worker-facing routes (walkthrough, library)
│   ├── (supervisor)/           # Supervisor routes (review, sign-off)
│   ├── (admin)/                # SOP admin routes (upload, review parsed)
│   ├── (auth)/                 # Login, org selection
│   └── api/                   # API route handlers
│       ├── auth/
│       ├── sops/
│       ├── completions/
│       ├── tenants/
│       └── webhooks/          # Job completion callbacks
├── components/
│   ├── sop/                    # SOP display components (steps, hazards, PPE)
│   ├── completion/             # Walkthrough UI, photo capture, sign-off
│   └── ui/                    # Shared design system components
├── lib/
│   ├── db/                     # Database client, RLS context helpers
│   ├── auth/                   # JWT helpers, tenant extraction
│   ├── storage/                # Object storage client
│   └── queue/                  # Job queue client
├── workers/
│   ├── parse-document/         # Document parsing job handler
│   └── resize-image/           # Photo resize/optimize job handler
├── offline/
│   ├── service-worker.ts       # Workbox config, sync handlers
│   ├── db.ts                   # IndexedDB schema (Dexie or similar)
│   ├── sync-queue.ts           # Outbound operation queue
│   └── sync-engine.ts          # Flush queue, conflict resolution
└── types/                      # Shared TypeScript types
    ├── sop.ts
    ├── completion.ts
    └── tenant.ts
```

### Structure Rationale

- **app/api/**: Co-located API routes reduce infrastructure complexity at this stage; can extract to separate service if needed later
- **offline/**: Isolated module because service worker runs in a separate thread and cannot import from the main app bundle arbitrarily
- **workers/**: Job handlers are independent processes; isolating them makes it easy to move them to a separate worker service later
- **lib/db/**: All DB access goes through one place — this is where RLS context is always set, making it impossible to accidentally bypass tenant isolation


## Architectural Patterns

### Pattern 1: Tenant Context via JWT + RLS

**What:** Every JWT contains `tenant_id` and `role`. The API middleware extracts these and calls `SET LOCAL app.tenant_id = ?` before every DB query. Postgres RLS policies on every table enforce `WHERE tenant_id = current_setting('app.tenant_id')`.

**When to use:** All data queries. Always. No exceptions.

**Trade-offs:** Near-zero overhead at query time; all isolation logic lives in one place (DB policies); superuser connections bypass RLS so must use app-role connections only.

**Example:**
```typescript
// lib/db/context.ts
export async function withTenantContext<T>(
  tenantId: string,
  fn: (db: Db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx.execute(`SET LOCAL app.user_id = '${userId}'`);
    return fn(tx);
  });
}
```

### Pattern 2: Offline-First Write Queue

**What:** All user writes (step completion, photo evidence, sign-off submission) are written to IndexedDB first, then to an outbound sync queue. The UI updates immediately (optimistic). The Service Worker flushes the queue to the API when online, retrying on failure.

**When to use:** Any write action a worker performs. Reads use a cache-then-network pattern.

**Trade-offs:** Workers never see "failed to save" errors during offline use; adds complexity in conflict handling when the same SOP is completed by two devices simultaneously (rare in this domain — one worker per SOP completion).

**Example:**
```typescript
// offline/sync-queue.ts
interface PendingOperation {
  id: string;              // idempotency key (client-generated UUID)
  type: 'complete_step' | 'submit_completion' | 'upload_photo';
  payload: unknown;
  tenantId: string;
  createdAt: number;
  retryCount: number;
}

async function enqueue(op: Omit<PendingOperation, 'retryCount'>) {
  await db.syncQueue.add({ ...op, retryCount: 0 });
  await navigator.serviceWorker.ready.then(sw =>
    sw.sync.register('flush-queue')
  );
}
```

### Pattern 3: Async Document Parsing Pipeline

**What:** Document uploads are decoupled from the parsing result. Upload creates a job record and returns immediately. A background worker processes the job: extract text and images → call LLM with structured output schema → score confidence per section → write parsed SOP as a draft. Admins review drafts before publishing.

**When to use:** All document imports. Never parse synchronously in the request cycle.

**Trade-offs:** Parsing can take 30-120 seconds per document; async approach prevents request timeouts and allows retries; admin review gate catches LLM errors before workers see bad SOPs.

**Example:**
```typescript
// workers/parse-document/index.ts
async function parseDocument(job: ParseJob) {
  // 1. Fetch raw file from object storage
  const file = await storage.get(job.fileKey);
  // 2. Extract text + embedded images (docx parser or PDF parser)
  const { text, images } = await extractContent(file, job.mimeType);
  // 3. Call LLM with structured output schema
  const parsed = await llm.structuredOutput(SOP_SCHEMA, text);
  // 4. Score confidence per section
  const scored = scoreConfidence(parsed, text);
  // 5. Store draft + images, notify admin
  await db.sops.create({ ...scored, status: 'draft', tenantId: job.tenantId });
  await notifyAdmin(job.tenantId, 'sop_draft_ready');
}
```

### Pattern 4: Finite-State Machine for Completion Workflow

**What:** SOP completion records progress through explicit states: `not_started` → `in_progress` → `pending_sign_off` → `signed_off` (or `rejected`). State transitions are validated server-side; clients can only trigger valid transitions.

**When to use:** The supervisor sign-off workflow. Also useful for SOP publish lifecycle (draft → review → published → archived).

**Trade-offs:** Makes audit trail trivial; prevents partial completions appearing as signed-off; adds a little upfront schema design work.

```
Completion States:
  not_started → in_progress (worker starts walkthrough)
  in_progress → pending_sign_off (worker submits)
  pending_sign_off → signed_off (supervisor approves)
  pending_sign_off → rejected (supervisor rejects with notes)
  rejected → in_progress (worker re-attempts)

SOP Document States:
  uploading → parsing → draft → admin_review → published → archived
```


## Data Flow

### SOP Upload and Parse Flow

```
SOP Admin uploads .docx/.pdf
    ↓
API: create upload presigned URL (object storage)
    ↓
Client: PUT file directly to object storage
    ↓
API: create parse job record (status: queued)
    ↓ (job queue event)
Worker: fetch file → extract content → call LLM → score confidence
    ↓
Worker: write parsed SOP as draft, upload extracted images
    ↓
Worker: notify Admin UI via webhook / polling
    ↓
Admin: reviews parsed sections, corrects low-confidence items
    ↓
Admin: publishes SOP (status: published)
    ↓
Published SOP becomes available to assigned workers
```

### Worker Offline Walkthrough Flow

```
Worker opens app (may be offline)
    ↓
Service Worker: serve App Shell from Cache API (instant)
    ↓
Offline Data Layer: load assigned SOPs from IndexedDB (instant, offline)
    ↓
Worker: walks through steps, marks complete, captures photos
    ↓
Offline Data Layer: write completions + photos to IndexedDB immediately
Sync Queue: enqueue pending operations
    ↓ (optimistic UI — worker sees success immediately)
Background Sync: when online, flush queue to API
    ↓
API: validate tenant context, write completions to PostgreSQL
Object Storage: upload evidence photos
    ↓
Supervisor notified of pending sign-off
```

### Multi-Tenant Request Flow

```
Client request: POST /api/completions
    ↓
Auth Middleware: validate JWT → extract { userId, tenantId, role }
    ↓
Tenant Context Middleware: SET LOCAL app.tenant_id in DB session
    ↓
Completion Service: INSERT INTO completions (tenant_id=... is enforced by app + RLS)
    ↓
PostgreSQL RLS: policy verifies current_setting('app.tenant_id') = row.tenant_id
    ↓
Response: only this tenant's data ever touched
```

### SOP Sync to Device (Initial Load + Updates)

```
Worker opens app online
    ↓
API: GET /api/sops?assigned=me (returns index of SOPs + version numbers)
    ↓
Client: diff against IndexedDB (which versions are stale/missing?)
    ↓
API: GET /api/sops/:id (fetch only stale SOPs with full content + image URLs)
    ↓
Object Storage: download SOP images to Cache API
    ↓
IndexedDB: store full SOP content
    ↓ Worker is now ready for offline use
```


## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users | Monolith API + single Postgres instance. Async job worker as a separate process on the same machine. Fine. |
| 500-10k users | Add read replica for reporting queries. Move job workers to separate container. Add CDN for static assets and SOP images. |
| 10k-100k users | Pool (pgBouncer) for DB connections. Extract document parsing to dedicated worker service. Consider per-region deployments if factory sites are geographically distributed. |
| 100k+ users | Schema-per-tenant for largest customers (enterprise tier). Horizontal API scaling. Separate media CDN with tenant-scoped buckets. |

### Scaling Priorities

1. **First bottleneck: Document parsing throughput.** LLM calls are slow (30-120s per doc) and expensive. Queue depth grows if many orgs upload simultaneously. Fix: dedicated worker pool, concurrency limits per tenant.
2. **Second bottleneck: Offline sync conflicts.** If workers use the same SOP on multiple devices simultaneously (rare but possible), idempotency keys and last-write-wins on step completions handles this — completions are append-only records, not in-place updates.
3. **Third bottleneck: Photo storage at scale.** Evidence photos accumulate fast. Fix: client-side resize before upload, object lifecycle policies (move to cold storage after 90 days).


## Anti-Patterns

### Anti-Pattern 1: Synchronous Document Parsing

**What people do:** Accept the uploaded file and call the LLM parser inside the HTTP request handler, waiting for the response.

**Why it's wrong:** LLM parsing takes 30-120 seconds. HTTP requests time out at 30s. The upload fails even when parsing succeeds. Admin has no way to retry. Server is blocked.

**Do this instead:** Upload to object storage, enqueue a job, return `202 Accepted` with a job ID. Poll or use a webhook to notify when complete.

### Anti-Pattern 2: Skipping Tenant Context Enforcement at Any Layer

**What people do:** Trust that the application layer always filters by `tenant_id` correctly and skip RLS policies, or set up RLS but connect to the DB as a superuser (which bypasses RLS).

**Why it's wrong:** One missed WHERE clause leaks data across tenants. Superuser connections silently bypass RLS even when policies are correct. A security incident from data leakage is fatal for a SaaS product.

**Do this instead:** RLS as defence-in-depth at the DB layer, PLUS explicit `tenant_id` filters in all application queries. Connect to Postgres as a non-superuser app role. Test tenant isolation with an automated boundary test on every release.

### Anti-Pattern 3: Online-Required Writes

**What people do:** Send completion data directly to the API on each step and show an error if offline.

**Why it's wrong:** Factory floors have intermittent WiFi. Workers get blocked mid-procedure. Evidence photos are lost. This is the core usability failure of most enterprise mobile apps in industrial settings.

**Do this instead:** Write-to-local-first always. The API is a sync destination, not a write gate. Workers should never know or care if they are online.

### Anti-Pattern 4: Storing SOP Content as Unstructured Blobs

**What people do:** Save the parsed SOP as a single JSON blob or HTML string per document.

**Why it's wrong:** Step-level completion tracking, section-level navigation, hazard/PPE highlighting, and image display all require accessing individual sections. Querying inside a blob is fragile and slow. Updating a single step requires re-parsing and re-saving the whole document.

**Do this instead:** Store SOPs in a normalized, structured schema: `sops` → `sop_sections` → `sop_steps`, with explicit `type` fields (hazard, ppe, step, emergency). Images are foreign-keyed records pointing to object storage URLs.

### Anti-Pattern 5: Per-User Sync on Every App Open

**What people do:** Download all SOP content from the API every time the app loads.

**Why it's wrong:** Workers on factory floors open the app dozens of times per day. Full re-downloads are slow, burn mobile data, and fail offline.

**Do this instead:** Sync on demand using version numbers. The app loads from IndexedDB instantly. Background sync fetches only SOPs whose version number has changed since last sync.


## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| LLM Provider (OpenAI / Anthropic) | REST API from job worker, structured output (JSON schema) | Called only from async worker, never from API request path. Cache results — never re-parse an unchanged document. |
| Object Storage (S3-compatible) | Presigned URLs for direct client upload; server-side download for job workers | Keep original documents for re-parse if LLM model improves. Tenant-scoped key prefix for isolation. |
| Auth Provider (Supabase Auth / Clerk) | JWT issuance on login; JWT validation on every API request | Tenant context must be a claim in the JWT — do not rely on a separate DB lookup per request. |
| Push Notifications (Web Push API) | Service worker registration; server sends via push service (VAPID) | Used for supervisor sign-off notifications. Payload should not contain sensitive SOP content. |
| Email (transactional) | HTTP API call from Notification Service | Sign-off requests, new SOP assignments. Low volume — any transactional email provider works. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API → DB | Direct query via ORM with RLS context set | Never bypass withTenantContext wrapper |
| API → Object Storage | SDK calls with tenant-scoped paths | Presigned URLs expire quickly (15 min) |
| API → Job Queue | Enqueue message with job payload | Fire-and-forget; job worker is separate process |
| Job Worker → DB | Direct query via same ORM, tenant context from job payload | Job must carry tenantId — it runs outside request context |
| Client → Object Storage | Presigned URL upload (bypasses API for file bytes) | API issues URL, client uploads directly — keeps API fast |
| Service Worker → IndexedDB | Direct (same origin, background thread) | Keep sync-queue schema simple; avoid complex joins |
| Service Worker → API | Fetch calls during Background Sync | Must include JWT in Authorization header even from SW context |


## Build Order Implications

The component dependency graph dictates this build sequence:

1. **Data layer foundation** — PostgreSQL schema with RLS policies, tenant/org tables, user/role tables. Everything else depends on this.

2. **Auth + tenant context** — JWT issuance, middleware, `withTenantContext` DB wrapper. Nothing can be built safely until this enforces isolation.

3. **SOP data model + API** — `sops`, `sop_sections`, `sop_steps`, `sop_images` tables. SOP CRUD API. This is the core content model all features depend on.

4. **Document parsing pipeline** — Upload flow, job queue, LLM parser, admin review UI. Produces the SOPs that everything else consumes. Can be built in parallel with #5 if using test fixture SOPs.

5. **Worker mobile UI + offline layer** — App shell, IndexedDB schema, SOP walkthrough UI, service worker + sync queue. Depends on SOP data model shape being stable.

6. **Completion tracking + photo evidence** — Completion FSM, step recording, photo upload. Depends on offline layer and SOP data model.

7. **Sign-off workflow** — Supervisor UI, approval/rejection flow, notifications. Depends on completion tracking.

8. **Assignment + RBAC enforcement** — SOP-to-role/worker assignment, role-based UI gates. Can be layered on after core flows work.


## Sources

- LogRocket: Offline-first frontend apps in 2025 — https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/
- Wild Codes: How to architect a PWA for offline-first and real-time sync — https://wild.codes/candidate-toolkit-question/how-would-you-architect-a-pwa-for-offline-first-and-real-time-sync
- MDN: Offline and background operation (PWA) — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- Nile: Shipping multi-tenant SaaS using Postgres Row-Level Security — https://www.thenile.dev/blog/multi-tenant-rls
- WorkOS: How to design an RBAC model for multi-tenant SaaS — https://workos.com/blog/how-to-design-multi-tenant-rbac-saas
- AWS: Multi-tenant data isolation with PostgreSQL Row Level Security — https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/
- ACM: Design Patterns for Approval Processes — https://dl.acm.org/doi/fullHtml/10.1145/3628034.3628035
- GeeksForGeeks: Database Design for Workflow Management Systems — https://www.geeksforgeeks.org/dbms/database-design-for-workflow-management-systems/
- Explosion AI: From PDFs to AI-ready structured data — https://explosion.ai/blog/pdfs-nlp-structured-data
- GTC Systems: Data Synchronization in PWAs — https://gtcsys.com/comprehensive-faqs-guide-data-synchronization-in-pwas-offline-first-strategies-and-conflict-resolution/

---
*Architecture research for: Multi-tenant SaaS PWA — SOP management for industrial field workers*
*Researched: 2026-03-23*
