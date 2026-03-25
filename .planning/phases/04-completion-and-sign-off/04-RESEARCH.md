# Phase 4: Completion and Sign-off - Research

**Researched:** 2026-03-26
**Domain:** Completion recording FSM, offline photo capture, append-only audit trail, supervisor sign-off workflow
**Confidence:** HIGH (all patterns verified against existing codebase Phases 1-3 + established project architecture)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Completion Recording**
- D-01: Manual submit — worker taps "Submit Completion" button after finishing all steps (not automatic after last step)
- D-02: Progress saves automatically — worker can close and resume later (partial completion persisted)
- D-03: Workers can complete the same SOP multiple times — every completion is a separate record (workers redo SOPs regularly for recurring procedures)
- D-04: Completion record captures: SOP version number, content hash, worker user ID, server-side timestamp, all photo references, step completion data

**Photo Evidence**
- D-05: Per-step photo requirement — admin marks specific steps as requiring photo evidence during SOP review (not all steps, not all SOPs)
- D-06: Multiple photos per step — worker can attach several photos (e.g., before/after shots)
- D-07: Photos queue locally and auto-upload when back online — offline photo capture fully supported
- D-08: Photos compressed client-side before IndexedDB write (Canvas resize ~200KB target per research)

**Supervisor Review**
- D-09: Activity feed layout — chronological list (newest first) with filters for grouping by SOP and by worker
- D-10: Summary card in the list — worker name, SOP title, date, photo count, status. Tap for full detail view.
- D-11: Full detail view — step-by-step showing what the worker did, their photos per step, timestamps
- D-12: Reject with reason — supervisor must enter a reason when rejecting. Worker gets notified to redo.
- D-13: Supervisors see only their explicitly-assigned workers (from Phase 1 D-12)
- D-14: Safety Manager sees ALL completions org-wide (from Phase 1 D-14)

**Audit Trail**
- D-15: App-enforced immutability — app prevents edits/deletes on completion records, but database allows for emergency corrections by service role
- D-16: Full snapshot at completion — SOP version number + content hash + worker ID + server-side timestamp + all photo references + step completion timestamps
- D-17: Supervisor sign-off creates a second immutable record (the approval/rejection is its own timestamped record, not a mutation of the completion)

### Claude's Discretion
- Completion FSM state machine design (not_started → in_progress → pending_sign_off → signed_off/rejected)
- Photo compression implementation details
- Offline photo queue and sync implementation
- Activity feed pagination approach
- Filter UI design for supervisor feed
- How "photo required" flag is stored on steps (likely a boolean on sop_steps)
- Notification to worker on rejection

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | Worker's SOP completion is recorded with server-side timestamp | Append-only `sop_completions` table; `created_at` is DB default `now()`, never client-supplied |
| COMP-02 | Worker can capture photos as evidence during specific SOP steps | Canvas API compression + `<input capture="environment">` iOS fallback + Dexie photo queue |
| COMP-03 | Photos are tied to the specific step they were captured on | `completion_photos` table with `step_id` FK; photo queue payload carries `step_id` |
| COMP-04 | Completion records reference the specific SOP version that was followed | `sop_id`, `sop_version`, `content_hash` columns on `sop_completions`; hash computed from step text at submission time |
| COMP-05 | Supervisor can view completion records for workers they oversee | `/activity` route with role-aware query; `supervisor_assignments` table already in schema; RLS scoping |
| COMP-06 | Supervisor can approve or reject a worker's SOP completion | `completion_sign_offs` table (second immutable record); reject reason stored; notification inserted for worker |
| COMP-07 | Completion records are immutable (append-only audit trail) | No UPDATE/DELETE RLS policies on `sop_completions`; app-enforced via server action design |
</phase_requirements>

---

## Summary

Phase 4 closes the loop from SOP assignment through worker execution to supervisor verification. The codebase entering this phase has a complete offline-first Dexie DB, a working sync engine (`syncAssignedSops`), a `walkthrough.ts` Zustand store tracking in-memory step completions, a `worker_notifications` table with polling, and the `supervisor_assignments` table linking supervisors to their workers. The completion system builds directly on top of these.

The three core technical problems are: (1) recording completions durably with an offline-first pattern, (2) handling per-step photo capture with client-side compression and a queued upload pipeline, and (3) providing a supervisor review UI gated by the `supervisor_assignments` table. All three have clear precedent in the existing codebase.

The most important architectural insight for planning is that the Dexie DB needs two new tables (`completions`, `photoQueue`), the Supabase schema needs two new tables (`sop_completions`, `completion_photos`) and a column addition (`photo_required` on `sop_steps`), and the sync engine needs two new flush paths mirroring the existing SOP sync pattern. The walkthrough store must be extended (or a new `completionStore` created) to persist partial completion progress to Dexie rather than memory only — this is the key change for D-02 (resume after close).

**Primary recommendation:** Build in the order of the three plans — FSM/recording first (schema + offline write path), then photo capture/queue (compression + upload), then supervisor UI (feed + sign-off action). Each plan is independently deployable and testable.

---

## Standard Stack

### Core (all already installed — Phase 1-3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 4.3.0 | IndexedDB for offline completions + photo queue | Already used for SOP caching; same pattern applied to completions |
| Supabase JS | 2.99.3 | Postgres persistence; Storage for photos | RLS, presigned upload URLs, server-side timestamps |
| Zustand | 5.0.12 | Completion progress UI state | Already used in `walkthrough.ts`; new `completionStore` follows same pattern |
| TanStack Query | 5.95.0 | Supervisor feed data fetching; invalidation on sign-off | Already used for SOP data; `networkMode: 'offlineFirst'` |
| React Hook Form + Zod | 7.72.0 / 4.3.6 | Reject-reason textarea form | Established pattern in `src/actions/` |
| Next.js server actions | 16.2.1 | submitCompletion, signOff actions | Established pattern — all mutations go through server actions with Zod validation |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sharp | 0.34.5 | Server-side image validation/resize | Receipt-side validation after presigned upload if needed (optional for v1; client Canvas handles primary compression) |
| lucide-react | (installed) | Camera icon, check icons, status icons | Consistent with existing StepItem, StatusBadge patterns |

### New Packages Required

None. All required libraries are installed. The Canvas API for photo compression is a browser built-in; no library needed.

**Installation:** No new `npm install` required for Phase 4.

---

## Architecture Patterns

### Recommended File Structure (Phase 4 additions)

```
src/
├── app/(protected)/
│   ├── activity/
│   │   ├── page.tsx                  # Role-aware: worker history OR supervisor feed
│   │   └── [completionId]/
│   │       └── page.tsx              # Completion detail + sign-off
│   └── sops/[sopId]/walkthrough/
│       └── page.tsx                  # Extended (photo capture + Submit Completion)
├── actions/
│   └── completions.ts                # submitCompletion, signOff server actions
├── components/
│   ├── completion/
│   │   ├── CompletionCard.tsx        # Summary card for activity feed
│   │   ├── CompletionDetail.tsx      # Full step-by-step detail view
│   │   ├── SignOffPanel.tsx          # Approve/Reject with reason textarea
│   │   └── ActivityFeed.tsx          # Feed with filter pills
│   └── sop/
│       └── StepPhotoZone.tsx         # Camera capture + thumbnail strip within StepItem
├── stores/
│   └── completionStore.ts            # Zustand: per-SOP in-progress completion state (persisted to Dexie)
├── hooks/
│   ├── useCompletions.ts             # TanStack Query: supervisor feed, worker history
│   └── usePhotoQueue.ts              # Dexie photo queue state + flush trigger
└── lib/offline/
    ├── db.ts                         # Extended: +completions, +photoQueue tables (version 2)
    ├── sync-engine.ts                # Extended: +flushCompletions, +flushPhotoQueue
    └── photo-compress.ts             # Canvas API compress-to-200KB utility
supabase/migrations/
├── 00010_completion_schema.sql       # sop_completions, completion_photos, photo_required on sop_steps
└── 00011_completion_rls.sql          # RLS policies for completions + sign-offs
```

### Pattern 1: Completion FSM (not_started → in_progress → pending_sign_off → signed_off / rejected)

**What:** Each SOP walkthrough attempt has an explicit state. Transitions are server-validated. The FSM state is stored in `sop_completions.status` (Postgres enum). The client reads the current state from Dexie and the server validates transitions via server actions.

**State transitions:**
```
not_started      → in_progress        (worker begins walkthrough; Dexie record created)
in_progress      → pending_sign_off   (worker taps "Submit Completion"; server action called)
pending_sign_off → signed_off         (supervisor approves; sign-off record inserted)
pending_sign_off → rejected           (supervisor rejects with reason; sign-off record inserted)
rejected         → in_progress        (worker starts a NEW completion record — not mutating old one)
```

**Key design:** `rejected → in_progress` creates a **new** `sop_completions` row (D-03 — multiple completions per SOP). The old rejected record is preserved (D-07, COMP-07). This means "retry" is implemented as "start fresh completion" not as "edit previous."

**Dexie record creation:** When a worker first marks any step complete, an `in_progress` completion record is written to Dexie immediately (D-02 — resume support). This is the critical change from Phase 3 where the walkthrough store was memory-only.

```typescript
// src/stores/completionStore.ts — Zustand store persisted to Dexie
// (NOT to be confused with walkthrough.ts which remains memory-only for safety ack)
interface InProgressCompletion {
  localId: string          // client UUID (idempotency key)
  sopId: string
  sopVersion: number
  contentHash: string      // computed at submission time
  stepCompletions: Record<string, number>  // stepId → timestamp (ms)
  status: 'in_progress'
  startedAt: number
}
```

**Server-side completion record (Postgres):**
```sql
-- src: 00010_completion_schema.sql
CREATE TABLE public.sop_completions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sop_id           uuid NOT NULL REFERENCES public.sops(id),
  worker_id        uuid NOT NULL REFERENCES auth.users(id),
  sop_version      int  NOT NULL,
  content_hash     text NOT NULL,
  status           public.completion_status NOT NULL DEFAULT 'pending_sign_off',
  step_data        jsonb NOT NULL,  -- { stepId: completedAtMs, ... }
  submitted_at     timestamptz NOT NULL DEFAULT now(),  -- server-side, COMP-01
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- No UPDATE policy — append-only enforced by RLS (COMP-07)
```

**Content hash computation (client-side at submission):**
```typescript
// Computed from step texts at time of submission — COMP-04
async function computeContentHash(steps: SopStep[]): Promise<string> {
  const canonical = steps
    .sort((a, b) => a.step_number - b.step_number)
    .map(s => `${s.step_number}:${s.text}`)
    .join('|')
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
// Source: Web Crypto API (browser built-in, no library needed)
// Confidence: HIGH
```

### Pattern 2: Photo Capture and Offline Queue

**What:** Worker taps a camera button on a step, which triggers `<input type="file" accept="image/*" capture="environment">` (iOS-safe fallback). The captured image is compressed via Canvas API to ~200KB and written to the Dexie `photoQueue` table. The queue is flushed on reconnect.

**iOS-safe camera input (already validated in project pitfalls research):**
```typescript
// src/components/sop/StepPhotoZone.tsx
// The <input> approach is the ONLY reliable method on iOS PWA
// getUserMedia() can fail to get camera permission on iOS PWA
function triggerCapture(inputRef: React.RefObject<HTMLInputElement>) {
  inputRef.current?.click()
}

// In JSX:
<input
  ref={inputRef}
  type="file"
  accept="image/*"
  capture="environment"
  className="sr-only"
  onChange={handleFileSelected}
  aria-label="Take photo"
/>
```

**Canvas compression to ~200KB (client-side before Dexie write):**
```typescript
// src/lib/offline/photo-compress.ts
export async function compressPhoto(
  file: File,
  maxDimension = 1200,
  targetBytes = 200_000
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      // Binary search quality to approach targetBytes
      let lo = 0.1, hi = 0.9, best: Blob | null = null
      function tryQuality(q: number) {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          best = blob
          if (blob.size > targetBytes && q > 0.2) {
            hi = q
            tryQuality((lo + hi) / 2)
          } else {
            resolve(best!)
          }
        }, 'image/jpeg', q)
      }
      tryQuality(hi)
    }
    img.onerror = reject
    img.src = url
  })
}
// Source: Pitfalls research + Smashing Magazine offline image upload (2025)
// Confidence: HIGH — pattern confirmed in PITFALLS.md
```

**Dexie photo queue schema (appended to db.ts version 2):**
```typescript
// The photoQueue stores Blob in an unindexed field (Dexie anti-pattern to index binary)
interface QueuedPhoto {
  localId: string          // UUID — idempotency key
  completionLocalId: string
  stepId: string
  blob: Blob               // unindexed — never create Dexie index on Blob
  contentType: string      // 'image/jpeg'
  capturedAt: number
  uploaded: boolean
  storagePath: string | null  // filled after upload
}

db.version(2).stores({
  // existing tables unchanged from version 1
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  // NEW in version 2:
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
})
// Note: blob is NOT listed in index string — only localId, completionLocalId, stepId, uploaded
// Source: Dexie "don't index binary data" rule — confirmed in PITFALLS.md + STACK.md
// Confidence: HIGH
```

**Photo upload flush (extends sync-engine.ts):**
```typescript
// src/lib/offline/sync-engine.ts — new export
export async function flushPhotoQueue(
  supabase: AnySupabaseClient
): Promise<{ uploaded: number; errors: string[] }> {
  const pending = await db.photoQueue
    .where('uploaded').equals(0).toArray()  // Dexie boolean false = 0

  const errors: string[] = []
  let uploaded = 0

  for (const photo of pending) {
    // 1. Get a presigned upload URL from server action
    const { url, path, error } = await getPhotoUploadUrl({
      localId: photo.localId,
      contentType: photo.contentType,
    })
    if (error) { errors.push(error); continue }

    // 2. PUT directly to Supabase Storage (bypasses Next.js 4MB body limit — same pattern as SOP upload)
    const res = await fetch(url, {
      method: 'PUT',
      body: photo.blob,
      headers: { 'Content-Type': photo.contentType },
    })
    if (!res.ok) { errors.push(`HTTP ${res.status}`); continue }

    // 3. Mark uploaded in Dexie
    await db.photoQueue.update(photo.localId, { uploaded: true, storagePath: path })
    uploaded++
  }
  return { uploaded, errors }
}
// Source: existing versioning.ts presigned URL pattern + STACK.md "Photos compressed client-side"
// Confidence: HIGH
```

### Pattern 3: Supervisor Sign-off (second immutable record — D-17)

**What:** Supervisor approves or rejects from the completion detail page. The action does NOT mutate the completion record. It inserts a new `completion_sign_offs` row. On rejection, it also inserts a `worker_notifications` row (reusing the existing notifications table + `useNotifications` hook).

**Sign-off schema:**
```sql
-- sop_completions.status is updated ONLY via a Postgres trigger or trusted server action
-- that verifies the previous status was 'pending_sign_off' before transitioning.
-- Direct client UPDATE is blocked by RLS.

CREATE TABLE public.completion_sign_offs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  completion_id    uuid NOT NULL REFERENCES public.sop_completions(id),
  supervisor_id    uuid NOT NULL REFERENCES auth.users(id),
  decision         text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason           text,  -- required when decision = 'rejected'; enforced in server action
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- No UPDATE or DELETE policies — this is a second immutable record (D-17)
```

**Server action pattern (follows existing src/actions/ pattern):**
```typescript
// src/actions/completions.ts
'use server'

export async function signOffCompletion(input: {
  completionId: string
  decision: 'approved' | 'rejected'
  reason?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Zod validate input
  // 2. Verify caller is supervisor/safety_manager (JWT claim)
  // 3. For 'rejected': verify reason is non-empty
  // 4. For supervisor: verify the completion's worker_id is in supervisor_assignments
  //    for safety_manager: no extra check (sees all — D-14)
  // 5. INSERT into completion_sign_offs
  // 6. UPDATE sop_completions.status to 'signed_off' or 'rejected' (admin client bypasses RLS)
  // 7. If rejected: INSERT into worker_notifications with type = 'completion_rejected'
  // 8. Invalidate TanStack Query cache via revalidatePath('/activity')
}
```

**RLS for completions — key policies:**
```sql
-- Workers: see their own completions
-- Supervisors: see completions for workers they supervise (via supervisor_assignments)
-- Safety managers: see all completions in the org
-- NO UPDATE policy for authenticated users — status updates go via admin client in server action
-- NO DELETE policy for authenticated users (D-15)

CREATE POLICY "workers_see_own_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND worker_id = auth.uid()
  );

CREATE POLICY "supervisors_see_supervised_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM public.supervisor_assignments sa
      WHERE sa.supervisor_id = auth.uid()
        AND sa.worker_id = sop_completions.worker_id
        AND sa.organisation_id = public.current_organisation_id()
    )
  );

CREATE POLICY "safety_managers_see_all_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'safety_manager'
  );

CREATE POLICY "workers_can_insert_own_completions"
  ON public.sop_completions FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id = public.current_organisation_id()
    AND worker_id = auth.uid()
  );
-- Intentionally no UPDATE or DELETE for authenticated role
```

### Pattern 4: Activity Feed with Role-Aware Rendering

**What:** The `/activity` page is a single route that renders differently based on the user's role (JWT claim). Workers see their own completion history. Supervisors and safety managers see the feed with filter pills (D-09). This follows the `dashboard/page.tsx` pattern of role-branching at the server component level.

**Route structure:**
```typescript
// src/app/(protected)/activity/page.tsx — Server Component
export default async function ActivityPage() {
  const role = await getRole()  // from JWT, server-side
  if (role === 'worker') return <WorkerHistory />
  if (role === 'supervisor' || role === 'safety_manager') return <SupervisorFeed />
  redirect('/dashboard')
}
```

**Pagination:** Cursor-based on `submitted_at` (newest-first). Load 20 at a time. The TanStack Query `useInfiniteQuery` pattern handles cursor management. Supervisor feed can have hundreds of entries for large orgs — pagination is required to avoid the performance trap documented in PITFALLS.md ("Loading all completion records in one query").

```typescript
// src/hooks/useCompletions.ts
import { useInfiniteQuery } from '@tanstack/react-query'

export function useSupervisorCompletions(filter: 'all' | 'by_sop' | 'by_worker') {
  return useInfiniteQuery({
    queryKey: ['completions', 'supervisor', filter],
    queryFn: ({ pageParam }) => fetchSupervisorCompletions({ cursor: pageParam, filter }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    networkMode: 'offlineFirst',
  })
}
```

### Anti-Patterns to Avoid

- **Storing the content hash on the client only:** The hash must be computed client-side (from Dexie-cached step texts) and sent to the server as part of the `submitCompletion` payload. The server does NOT recompute it — the point is to capture what the worker actually saw (the version in their Dexie cache). The server validates that the `sop_id` + `sop_version` combination exists, but stores the client-computed hash verbatim.
- **Using `upsert` on completion records:** Always use `insert` for `sop_completions`. `upsert` would silently overwrite on idempotency key collision — which is wrong for an append-only log. Use the `localId` as the Postgres `id` (pass as the UUID) to achieve idempotent inserts via `INSERT ... ON CONFLICT (id) DO NOTHING`.
- **Mutating the walkthrough Zustand store for completion persistence:** The existing `walkthrough.ts` is intentionally memory-only (safety re-acknowledgement per session — Phase 3 decision). D-02 (resume support) is implemented via a SEPARATE `completionStore` that writes to Dexie, not by persisting the walkthrough store.
- **Blocking "Mark Step Complete" until photo uploads finish:** Photo upload is always async/queued. The step complete button should be enabled as soon as the photo is compressed and written to Dexie. The orange "uploading" border on the thumbnail communicates pending state without blocking workflow.
- **Loading photos inline in the activity feed:** Load photo thumbnails lazily in the completion detail view only. The summary card in the feed shows only a photo count number, not actual images. This prevents the feed from making N×M Storage requests on first render.
- **Using `current_timestamp` from the client for `submitted_at`:** The `submitted_at` column uses `DEFAULT now()` at the Postgres level. The server action does NOT pass a timestamp in the INSERT — it relies on the DB default. This ensures COMP-01 (server-side timestamp).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Photo MIME type detection | Custom magic-byte parser | `file.type` from the File API input event | Browser already exposes MIME type; no library needed |
| Canvas quality binary search | Fixed quality level | The binary-search compressor in `photo-compress.ts` | Fixed quality produces unpredictable sizes; binary search achieves the ~200KB target reliably |
| Client-side UUID generation | Custom ID generator | `crypto.randomUUID()` (browser built-in) | Globally unique, cryptographically random, no library |
| Role-based feed filtering | Application-layer WHERE | Supabase RLS with `supervisor_assignments` JOIN | Database enforces isolation; application layer is display-only |
| Push notification for rejection | Web Push API + VAPID setup | Existing `worker_notifications` table + `useNotifications` polling hook (60s interval) | Phase 3 already built this; add a new `type` value (`completion_rejected`) and the existing badge and hook handle delivery |
| Photo URL expiry management | Custom URL refresh | Supabase Storage `createSignedUrl` with short TTL | Already the project pattern for SOP images; completion photos follow the same path |

**Key insight:** The notification system, the presigned URL pattern, the offline sync pattern, and the Dexie schema are all pre-built. Phase 4 is fundamentally an extension of existing infrastructure, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Completion Progress Lost on App Close (D-02 Regression)

**What goes wrong:** Developer uses the existing in-memory `walkthrough.ts` store for tracking which steps the worker has completed during a completion attempt. When the app is closed (common on factory floors — workers get interrupted), all progress is lost. Worker has to redo all steps.

**Why it happens:** The Phase 3 walkthrough store was deliberately kept memory-only for safety re-acknowledgement. It is tempting to extend it for completion persistence, but that breaks the safety design.

**How to avoid:** Create a new `completionStore.ts` that writes to Dexie on every step completion. The walkthrough page reads both stores: `walkthroughStore` for safety acknowledgement gating, `completionStore` for durable step progress. On page load, if a Dexie completion record exists for `(sopId, worker_id)` with `status = 'in_progress'`, restore into `completionStore`.

**Warning signs:** `completions` table not in Dexie schema; no "resume" logic in walkthrough page load.

### Pitfall 2: Photo Queue Orphaned After Completion Sync Fails

**What goes wrong:** Worker submits completion. Server action creates the `sop_completions` row but then fails (timeout, network loss). The Dexie completion record is not cleared. Next time the worker opens the walkthrough, they see a "completion already submitted" state but the server has no record. Or conversely: the server record exists but `photoQueue` entries reference a `completionLocalId` that no longer maps to anything.

**How to avoid:** Use a two-phase commit pattern in the sync engine:
1. Flush photo queue first (all photos get `uploaded = true` and `storagePath` set)
2. Only then call `submitCompletion` server action (which reads photo storage paths from Dexie)
3. On success: mark the Dexie completion record as `synced`, clear photo queue entries

If step 1 fails: leave everything in Dexie and retry on next reconnect (idempotent — same `localId`).
If step 2 fails: photos are already in Storage (idempotent presigned upload). Retry `submitCompletion` with the same `localId` → `INSERT ... ON CONFLICT DO NOTHING` prevents duplicates.

**Warning signs:** `submitCompletion` action reads photo blobs directly from the request (not from Storage paths); no retry/idempotency handling in sync engine.

### Pitfall 3: Supervisor Feed Shows Completions from Non-Supervised Workers

**What goes wrong:** RLS policy on `sop_completions` is not correctly joined to `supervisor_assignments`. A supervisor can see all completions in the org — a data privacy issue and a confusing UX (supervisor is responsible only for their assigned workers per D-13).

**How to avoid:** The `supervisors_see_supervised_completions` RLS policy must JOIN to `supervisor_assignments` using both `supervisor_id = auth.uid()` AND `worker_id = sop_completions.worker_id`. Test this explicitly with a two-supervisor fixture (same pattern as the RLS isolation test in `tests/rls-isolation.test.ts`).

**Warning signs:** No join in the RLS policy; feed query uses application-layer filtering only.

### Pitfall 4: "Photo Required" Blocks Completion Without Clear UI Signal

**What goes wrong:** A step has `photo_required = true`. The worker taps "Mark Step Complete" without taking a photo. The system either silently lets them proceed (wrong — defeats the evidence requirement) or shows a generic error (confusing — worker doesn't know what to do). In both cases adoption drops.

**How to avoid:** The "Mark Step N Complete" button in the walkthrough bottom bar is disabled (with visual indicator) when the active step has `photo_required = true` AND no photos have been captured for that step in the Dexie `photoQueue`. The orange camera zone in the step row is the visual signal. The disabled button state has an aria-label explaining why it is disabled.

**Warning signs:** `photo_required` flag not checked before enabling the complete button; no visual distinction between required and optional photo steps.

### Pitfall 5: Content Hash Computed from Server Data at Submit Time (Not What Worker Saw)

**What goes wrong:** When the worker submits, the server action re-fetches the SOP from Postgres to compute the content hash. But the SOP might have been updated between when the worker downloaded it and when they submitted. The stored hash then reflects the new version, not what the worker actually followed.

**How to avoid:** The content hash is computed entirely on the client from the Dexie-cached step texts at the moment the worker taps "Submit Completion." The hash travels to the server in the server action payload. The server stores it verbatim — it is the worker's evidence, not a server-computed value. The server only validates that `sop_id` and `sop_version` exist; it does not recompute the hash.

**Warning signs:** `computeContentHash` called inside a server action; hash missing from the client-side `submitCompletion` call payload.

---

## Code Examples

### Server Action: submitCompletion

```typescript
// src/actions/completions.ts
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SubmitCompletionSchema = z.object({
  localId: z.string().uuid(),           // client-generated UUID — idempotency key
  sopId: z.string().uuid(),
  sopVersion: z.number().int().positive(),
  contentHash: z.string().length(64),   // SHA-256 hex
  stepData: z.record(z.string(), z.number()),  // { stepId: completedAtMs }
  photoStoragePaths: z.array(z.object({
    localId: z.string().uuid(),
    stepId: z.string().uuid(),
    storagePath: z.string(),
    contentType: z.string(),
  })),
})

export async function submitCompletion(
  rawInput: unknown
): Promise<{ success: true; completionId: string } | { success: false; error: string }> {
  const parsed = SubmitCompletionSchema.safeParse(rawInput)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const orgId = /* extract from JWT */ null as string | null
  if (!orgId) return { success: false, error: 'No organisation found' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sop_completions')
    .insert({
      id: parsed.data.localId,          // use client UUID as PK — enables idempotent retry
      organisation_id: orgId,
      sop_id: parsed.data.sopId,
      worker_id: user.id,
      sop_version: parsed.data.sopVersion,
      content_hash: parsed.data.contentHash,
      status: 'pending_sign_off',
      step_data: parsed.data.stepData,
      // submitted_at: omitted — uses DEFAULT now() for COMP-01 server-side timestamp
    })
    .select('id')
    .single()

  if (error) {
    // Idempotency: conflict on PK means already submitted — not an error
    if (error.code === '23505') return { success: true, completionId: parsed.data.localId }
    return { success: false, error: error.message }
  }

  // Insert completion_photos rows
  if (parsed.data.photoStoragePaths.length > 0) {
    await admin.from('completion_photos').insert(
      parsed.data.photoStoragePaths.map(p => ({
        completion_id: data.id,
        step_id: p.stepId,
        storage_path: p.storagePath,
        content_type: p.contentType,
      }))
    )
  }

  return { success: true, completionId: data.id }
}
// Source: established versioning.ts pattern + COMP-01 requirement
// Confidence: HIGH
```

### Presigned URL for Photo Upload

```typescript
// src/actions/completions.ts — getPhotoUploadUrl
export async function getPhotoUploadUrl(input: {
  localId: string
  contentType: string
  orgId: string
  completionLocalId: string
}): Promise<{ url: string; path: string } | { error: string }> {
  const admin = createAdminClient()
  // Path structure follows the org-scoped pattern: {org_id}/completions/{completion_id}/{photo_id}.jpg
  const ext = input.contentType === 'image/jpeg' ? 'jpg' : 'png'
  const path = `${input.orgId}/completions/${input.completionLocalId}/${input.localId}.${ext}`

  const { data, error } = await admin.storage
    .from('completion-photos')      // separate bucket from sop-documents
    .createSignedUploadUrl(path)

  if (error || !data) return { error: error?.message ?? 'Failed to get upload URL' }
  return { url: data.signedUrl, path }
}
// Source: sops.ts createUploadSession — exact same pattern
// Confidence: HIGH
```

### Dexie DB Version 2 (extending existing db.ts)

```typescript
// src/lib/offline/db.ts — version 2 additions
export interface LocalCompletion {
  localId: string
  sopId: string
  sopVersion: number
  contentHash: string
  stepCompletions: Record<string, number>  // stepId → completedAt (ms)
  status: 'in_progress' | 'submitted'
  startedAt: number
}

export interface QueuedPhoto {
  localId: string
  completionLocalId: string
  stepId: string
  blob: Blob               // NOT indexed
  contentType: string
  capturedAt: number
  uploaded: boolean
  storagePath: string | null
}

// Extend existing type union:
type SopAssistantDB = Dexie & {
  // ... existing tables ...
  completions: EntityTable<LocalCompletion, 'localId'>
  photoQueue: EntityTable<QueuedPhoto, 'localId'>
}

// Add version 2 schema (Dexie additive migrations):
db.version(2).stores({
  sops: 'id, organisation_id, status, version, category, department, _cachedAt',
  sections: 'id, sop_id, section_type, sort_order',
  steps: 'id, section_id, step_number',
  images: 'id, sop_id, section_id, step_id',
  syncMeta: 'key',
  completions: 'localId, sopId, status',
  photoQueue: 'localId, completionLocalId, stepId, uploaded',
  // blob is intentionally NOT listed here — Dexie indexes should never include binary fields
})
// Source: db.ts version 1 pattern + Dexie "don't index binary" from PITFALLS.md
// Confidence: HIGH
```

### photo_required Column Migration

```sql
-- supabase/migrations/00010_completion_schema.sql (partial)
-- Add photo_required to sop_steps for D-05
ALTER TABLE public.sop_steps
ADD COLUMN photo_required boolean NOT NULL DEFAULT false;

-- Admin can update this column during SOP review
-- Workers can read it via existing org_members_can_view_steps policy
```

### Worker Rejection Notification (extends existing worker_notifications pattern)

```typescript
// Inside signOffCompletion server action when decision = 'rejected':
await admin.from('worker_notifications').insert({
  organisation_id: orgId,
  user_id: completion.worker_id,
  sop_id: completion.sop_id,
  type: 'completion_rejected',   // new type value — hook already handles any string type
  read: false,
})
// The existing useNotifications hook polls every 60s and the NotificationBadge renders the count.
// No changes needed to the hook or badge — they are agnostic to notification type.
// Source: useNotifications.ts — confirmed type is string, not an enum
// Confidence: HIGH
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Background Fetch API for SW photo upload | Queue in Dexie, flush in React component on `online` event | iOS never supported it | Background Fetch has <50% support; our queue approach is iOS-safe |
| `getUserMedia()` for camera in PWA | `<input type="file" capture="environment">` | iOS 14+ PWA limitation | Permission re-prompts on iOS PWA make getUserMedia unreliable; input fallback is stable |
| Base64 string in JSON column for photos | Blob in unindexed Dexie field + Storage upload | Known IndexedDB perf issue | Base64 is 33% larger, crashes mobile IndexedDB on 10+ photos |
| Mutable completion status (UPDATE) | Separate sign-off table + admin-only status update | Compliance requirement | Append-only enables legally defensible audit trail |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (already configured) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase4-stubs` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Completion record has server-side timestamp (not client clock) | integration | `npx playwright test tests/completion-recording.test.ts -x` | No — Wave 0 |
| COMP-02 | Worker can capture photo during a step | e2e | `npx playwright test tests/photo-capture.test.ts -x` | No — Wave 0 |
| COMP-03 | Photo is linked to the step it was captured on | integration | `npx playwright test tests/completion-recording.test.ts -x` | No — Wave 0 |
| COMP-04 | Completion record references SOP version + content hash | integration | `npx playwright test tests/completion-recording.test.ts -x` | No — Wave 0 |
| COMP-05 | Supervisor sees completions for supervised workers only | integration | `npx playwright test tests/sign-off.test.ts -x` | No — Wave 0 |
| COMP-06 | Supervisor can approve/reject; reject requires reason | e2e | `npx playwright test tests/sign-off.test.ts -x` | No — Wave 0 |
| COMP-07 | Completion records cannot be deleted or edited | integration | `npx playwright test tests/completion-recording.test.ts -x` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase4-stubs`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/completion-recording.test.ts` — covers COMP-01, COMP-03, COMP-04, COMP-07 (stubs with `test.fixme`)
- [ ] `tests/photo-capture.test.ts` — covers COMP-02 (stub with `test.fixme`)
- [ ] `tests/sign-off.test.ts` — covers COMP-05, COMP-06 (stubs with `test.fixme`)
- [ ] `playwright.config.ts` — add `phase4-stubs` project with testMatch pattern covering the three new test files (consistent with `phase3-stubs` approach)

**No new test framework needed** — Playwright is already installed and configured. Wave 0 is only adding stub test files and updating playwright.config.ts.

---

## Open Questions

1. **Photo bucket name and RLS**
   - What we know: SOP documents use `sop-documents` bucket. Completion photos should use a separate bucket (`completion-photos`) for isolation and separate lifecycle policies.
   - What's unclear: Whether the Supabase project already has this bucket or needs migration to create it.
   - Recommendation: Migration 00010 creates the bucket programmatically via `storage.buckets` insert, or the Plan calls out manual bucket creation as a Wave 0 task.

2. **`photo_required` flag editability post-publish**
   - What we know: Admin marks steps as `photo_required` during SOP review (D-05). The admin RLS policy on `sop_steps` allows updates.
   - What's unclear: Whether changing `photo_required` on a published SOP should trigger a version bump (safety concern — changing evidence requirements retroactively).
   - Recommendation: For v1, treat it as a metadata edit (no version bump). Flag for v2 consideration. The existing `admins_can_manage_steps` RLS policy already allows this update.

3. **iOS PWA Push notification delivery for rejection**
   - What we know: STATE.md blocker: "Push notification delivery on iOS requires PWA installed to home screen and iOS 16.4+". The existing notification system uses 60-second polling, which is the reliable fallback.
   - What's unclear: Nothing new for Phase 4 — the polling fallback is already built.
   - Recommendation: Phase 4 uses polling (existing `useNotifications` + new `completion_rejected` type). Push is a v2 enhancement.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/offline/db.ts` — Existing Dexie schema (verified locally)
- `src/stores/walkthrough.ts` — Existing Zustand store pattern (verified locally)
- `src/lib/offline/sync-engine.ts` — Existing sync pattern (verified locally)
- `src/actions/versioning.ts` — Presigned URL pattern, idempotency approach (verified locally)
- `src/hooks/useNotifications.ts` — Notification polling pattern (verified locally)
- `supabase/migrations/00001-00009` — Full existing schema (verified locally)
- `.planning/research/PITFALLS.md` — Photo storage bloat, legal defensibility, iOS camera (project research 2026-03-23)
- `.planning/research/STACK.md` — Canvas compression target, sharp, Dexie binary indexing rule (project research 2026-03-23)
- `.planning/research/ARCHITECTURE.md` — Completion FSM states, append-only pattern (project research 2026-03-23)
- Web Crypto API (`crypto.subtle.digest`) — Browser built-in, MDN HIGH confidence
- Canvas API (`canvas.toBlob`) — Browser built-in, MDN HIGH confidence

### Secondary (MEDIUM confidence)

- Smashing Magazine "Building an Offline-Friendly Image Upload System" (2025) — binary search quality approach for Canvas compression (cited in PITFALLS.md)
- Dexie "Keep storing large images, just don't index the binary data itself" — David Fahlander (cited in PITFALLS.md)

### Tertiary (LOW confidence)

None — all findings grounded in existing codebase or previously verified project research.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used in Phases 1-3
- Architecture: HIGH — patterns are extensions of working Phase 3 code, not new designs
- Pitfalls: HIGH — drawn from project PITFALLS.md (verified 2026-03-23) + existing code inspection
- Database schema: HIGH — extends established migration pattern with clear precedent

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack; no fast-moving dependencies in scope)
