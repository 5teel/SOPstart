# Phase 10: Video Version Management - Research

**Researched:** 2026-04-07
**Domain:** Supabase Postgres schema migration, Next.js server actions, React list UI with inline CRUD
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Each generation creates a new version (new `video_generation_jobs` row). The UNIQUE constraint `(sop_id, format, sop_version)` must be dropped. Auto-incrementing `version_number` scoped to the SOP replaces it.
- **D-02:** Unlimited versions per SOP. Admin manages manually — archive to reduce clutter. No auto-deletion or cap.
- **D-03:** One published version per SOP at a time. Publishing a new version auto-unpublishes all others for that SOP. Workers only see the published version in the Video tab.
- **D-04:** Auto-label as v1, v2, v3 (creation order) plus optional admin-editable name (nullable `label` column on `video_generation_jobs`).
- **D-05:** Archive model — "deleting" marks as archived (hidden from main list, shown in collapsible "Archived" section). Permanent delete from archive only. No immediate storage cleanup.
- **D-06:** "Re-generate" always creates a new version row. Button renamed "Generate new version". Old version preserved.

### Claude's Discretion

- Version number assignment mechanism (DB sequence vs application-level counter)
- Archive UI layout (collapsible section vs separate tab vs toggle filter)
- Whether version comparison view is needed (side-by-side) — defer unless trivial
- Exact label character limit

### Deferred Ideas (OUT OF SCOPE)

- Version comparison (side-by-side video player)
- Auto-archive on publish (auto-archive previously published version)
- Storage quota management (total video storage per org)
- Version notes/changelog (why a version was created)
</user_constraints>

---

## Summary

Phase 10 is a **schema + server action + UI refactor** phase. The codebase already has a `video_generation_jobs` table with one row per SOP+format+version, a `published` boolean, and fully-working generation pipeline. The entire UNIQUE constraint (`sop_id, format, sop_version`) that enforces single-version-per-SOP must be dropped and replaced with a version sequence — this is the load-bearing migration. Everything else (UI version list, archive model, publish-one-unpublish-all, label editing) builds on top of that schema change.

The key insight is that the pipeline code (`pipeline.ts`, `generate-video` route, `regenerateVideo` action) never needs to know about version numbers — it just inserts a new row and runs. The version numbering is assigned at insert time via a DB-level mechanism (recommended: `ROW_NUMBER() OVER` at read time, or a simple app-level counter). The `regenerateVideo` server action currently reuses/resets an existing row — that logic must be replaced with unconditional new-row creation.

The worker experience (`useVideoGeneration`, `VideoTabPanel`) already filters `published=true` — no changes needed there. The admin video page needs the most work: replace single-job display with a version list UI, inline label editing, publish/archive/delete actions per row, and a collapsible archived section.

**Primary recommendation:** Migration first (drop UNIQUE, add `version_number` + `label` + `archived` columns, add DB function for atomic publish-and-unpublish-others), then server actions, then UI.

---

## Standard Stack

No new libraries are needed. All functionality is achievable with the existing stack.

### Core (existing, confirmed in codebase)
| Library | Purpose | Confirmed |
|---------|---------|-----------|
| Supabase JS (`@supabase/ssr`) | DB reads/writes, admin client for elevated ops | [VERIFIED: codebase grep] |
| Next.js 16 server actions (`'use server'`) | Mutations: publish, archive, label edit, delete | [VERIFIED: codebase grep] |
| TanStack React Query | Admin version list query + invalidation after mutations | [VERIFIED: codebase grep] |
| Supabase Realtime | Live status updates on generating versions | [VERIFIED: `VideoGenerationStatus.tsx`] |
| Lucide React | Icons (ChevronDown, Archive, Edit2, Trash2, etc.) | [VERIFIED: codebase grep] |
| Tailwind CSS 4 | All styling | [VERIFIED: codebase grep] |

### No new dependencies required
All patterns (inline confirm dialogs, collapsible sections, polling, server actions) are already established in the codebase.

---

## Architecture Patterns

### Recommended Project Structure

New/modified files for this phase:

```
supabase/migrations/
└── 00018_video_version_management.sql   # Drop UNIQUE, add version_number, label, archived

src/actions/
└── video.ts                             # Add: generateNewVersion, publishVersionExclusive,
                                         #      archiveVersion, unarchiveVersion, permanentDeleteVersion,
                                         #      updateVersionLabel
                                         # Remove: regenerateVideo (replaced by generateNewVersion)

src/components/admin/
├── VideoGeneratePanel.tsx               # Replace single-job display with version list UI
├── VideoVersionList.tsx                 # New: compact version rows with inline actions
├── VideoVersionRow.tsx                  # New: single version row (label, format, status, actions)
└── VideoGenerationStatus.tsx           # No changes — reused per-version for active jobs

src/app/(protected)/admin/sops/[sopId]/video/
└── page.tsx                            # Fetch all versions (non-archived), pass to panel

src/types/sop.ts                        # Extend VideoGenerationJob with version_number, label, archived

tests/
└── video-version-management.test.ts    # Phase 10 stubs
```

### Pattern 1: Drop UNIQUE Constraint + Version Number Assignment

**What:** Migration drops `video_generation_jobs_sop_format_version_unique`, adds `version_number INT NOT NULL DEFAULT 0`, `label TEXT`, `archived BOOLEAN NOT NULL DEFAULT false`. Version number is assigned application-level at insert time.

**Why application-level over DB sequence:** A DB sequence is global, not scoped per SOP. Computing `MAX(version_number) + 1` for a given `sop_id` at insert time is simpler and consistent with how the rest of the app works. Race condition risk is low (one admin per SOP at a time in practice). If needed, a DB function with advisory lock can guard the counter.

**Migration pattern:**
```sql
-- Source: [VERIFIED: analysis of supabase/migrations/00013_video_generation.sql]
ALTER TABLE public.video_generation_jobs
  DROP CONSTRAINT IF EXISTS video_generation_jobs_sop_format_version_unique;

ALTER TABLE public.video_generation_jobs
  ADD COLUMN IF NOT EXISTS version_number int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Backfill version_number for existing rows (assign 1 to all existing)
UPDATE public.video_generation_jobs
  SET version_number = 1
  WHERE version_number = 0;

-- Partial index: only one published per SOP
CREATE UNIQUE INDEX IF NOT EXISTS video_generation_jobs_one_published_per_sop
  ON public.video_generation_jobs (sop_id)
  WHERE published = true;
```

**The partial unique index** enforces D-03 (one published per SOP) at the DB level — far safer than relying purely on application logic.

### Pattern 2: Atomic Publish-and-Unpublish-Others

**What:** Publishing version X must atomically unpublish all other versions for that SOP, then publish X. Use two UPDATE calls inside a server action with the admin client. Supabase does not expose multi-statement transactions via the JS SDK directly, so sequence matters: unpublish-all first, then publish-one.

**Why not a transaction:** Supabase JS SDK doesn't support explicit transactions. Two sequential admin UPDATEs in the same server action call is effectively atomic from the UI perspective (the server action completes or fails — no partial state is ever returned to the client).

```typescript
// Source: [VERIFIED: pattern analysis of src/actions/video.ts]
// Step 1: unpublish all versions for this SOP
await admin
  .from('video_generation_jobs')
  .update({ published: false, updated_at: now })
  .eq('sop_id', sopId)
  .eq('published', true)

// Step 2: publish the target version
await admin
  .from('video_generation_jobs')
  .update({ published: true, updated_at: now })
  .eq('id', jobId)
  .eq('status', 'ready')
```

The partial unique index (`WHERE published = true`) will enforce that only one row ends up published.

### Pattern 3: generateNewVersion replaces regenerateVideo

**What:** The `regenerateVideo` server action currently reuses/resets the existing job row to work around the UNIQUE constraint. After the constraint is dropped, it must be replaced with a simple insert of a new row with incremented `version_number`.

**Before (current):**
```typescript
// regenerateVideo resets existing row — broken after D-01
await admin.from('video_generation_jobs').update({ status: 'queued', ... }).eq('id', existingJob.id)
```

**After:**
```typescript
// Source: [VERIFIED: based on analysis of src/actions/video.ts regenerateVideo + pipeline.ts]
// Get the current max version_number for this SOP
const { data: maxRow } = await admin
  .from('video_generation_jobs')
  .select('version_number')
  .eq('sop_id', sopId)
  .order('version_number', { ascending: false })
  .limit(1)
  .maybeSingle()

const nextVersion = (maxRow?.version_number ?? 0) + 1

const { data: newJob } = await admin
  .from('video_generation_jobs')
  .insert({
    organisation_id: auth.organisationId,
    sop_id: sopId,
    sop_version: sop.version,
    format,
    version_number: nextVersion,
    status: 'queued',
    created_by: auth.userId,
  })
  .select('id')
  .single()
```

### Pattern 4: Archive Model (Soft Delete)

**What:** `archived = true` hides a version from the main list. A separate collapsible section at the bottom of the admin video page shows archived versions. Permanent delete (hard delete) is only available from the archived section.

**Archive action:**
```typescript
// Source: [VERIFIED: D-05 + existing deleteVideoJob pattern in src/actions/video.ts]
await admin
  .from('video_generation_jobs')
  .update({ archived: true, published: false, updated_at: now })
  .eq('id', jobId)
```

Note: archiving a published version also unpublishes it (published + archived would violate D-03 semantics).

**UI structure:**
```
VideoGeneratePanel
├── "Generate new version" button (prominent, top)
├── VideoVersionList (non-archived, desc order)
│   ├── VideoVersionRow (active/generating — shows live stepper)
│   ├── VideoVersionRow (ready, published — highlighted)
│   ├── VideoVersionRow (ready, unpublished)
│   └── VideoVersionRow (failed)
└── Collapsible "Show N archived versions"
    └── VideoVersionRow (archived — only permanent delete action)
```

### Pattern 5: Inline Label Editing

**What:** Each version row has an optional label. Clicking an edit icon switches to an inline `<input>`. On blur/Enter, calls `updateVersionLabel` server action. Character limit: 60 chars [ASSUMED — 60 is a reasonable single-line label limit; confirm if needed].

**Pattern:**
```typescript
// Source: [VERIFIED: consistent with existing inline confirm pattern in VideoAdminPreview.tsx]
const [editing, setEditing] = useState(false)
const [labelValue, setLabelValue] = useState(version.label ?? '')
```

### Pattern 6: Admin Video Page — Multi-Version Fetch

**What:** The `video/page.tsx` currently fetches `limit(1)` (latest job). It must be changed to fetch ALL non-archived jobs for the SOP, ordered by `version_number DESC`, and ALL archived jobs separately.

```typescript
// Source: [VERIFIED: analysis of src/app/(protected)/admin/sops/[sopId]/video/page.tsx]
const { data: versions } = await admin
  .from('video_generation_jobs')
  .select('*')
  .eq('sop_id', sopId)
  .eq('archived', false)
  .order('version_number', { ascending: false })

const { data: archived } = await admin
  .from('video_generation_jobs')
  .select('*')
  .eq('sop_id', sopId)
  .eq('archived', true)
  .order('version_number', { ascending: false })
```

### Realtime Subscription Per Active Version

`VideoGenerationStatus` subscribes to a single `jobId`. For the version list, only the currently-generating version needs a live status subscription. All other rows are static (ready/failed/archived). The existing component can be used as-is — mount it only for the active job row.

### Anti-Patterns to Avoid

- **Running pipeline from a UNIQUE-constrained table:** The old idempotency check in `generate-video/route.ts` must be removed/simplified. Once the UNIQUE constraint is gone, the route simply always inserts a new row. The `existingJob` check block that resets failed jobs is no longer needed — failed jobs are now permanent records. [VERIFIED: route.ts lines 73-127]
- **Reusing the idempotency pattern for new versions:** `generateNewVersion` must NEVER re-use an existing row regardless of status. If an existing queued/active job exists for this SOP+format, surface a warning ("Generation already in progress") rather than creating a duplicate active job.
- **Not backfilling `version_number` on existing rows:** The migration must set `version_number = 1` on all existing rows before adding the NOT NULL constraint. [VERIFIED: current schema has no version_number column]
- **`sop_version` column confusion:** `sop_version` on `video_generation_jobs` is the SOP's text version (from `sops.version`) — it tracks which SOP content revision the video was generated from. `version_number` is the video generation attempt sequence. These are different concepts — don't conflate them.
- **Deleting a published version directly:** Archive action must also set `published = false`. The partial unique index will still enforce one-published-max even if application logic misses it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enforce one published per SOP | Application-only check | Partial unique index on `(sop_id) WHERE published = true` | DB-enforced; survives concurrent admin sessions |
| Version list TanStack Query invalidation | Custom event bus | `queryClient.invalidateQueries(['video-versions', sopId])` after each mutation | Already the established pattern in this codebase |
| Realtime for all version rows | Subscribe to every jobId | Only subscribe for the currently-active (non-ready, non-failed) job | Realtime channels are per-subscription; blanket subscription is wasteful |

---

## Runtime State Inventory

> Phase 10 is a rename/refactor of the `video_generation_jobs` schema and UI logic. The runtime state audit is required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `video_generation_jobs` table rows — all existing rows have `version_number = 0` (column not yet added), no `label`, no `archived` column | Migration backfill: set `version_number = 1` on all existing rows |
| Stored data | Existing rows subject to the UNIQUE constraint `(sop_id, format, sop_version)` | Migration drops the constraint — existing rows unaffected, no data migration needed |
| Live service config | Supabase Realtime publication already includes `video_generation_jobs` (migration 00013) | No change needed |
| OS-registered state | None — no cron jobs, task scheduler entries, or PM2 processes reference video version concepts | None |
| Secrets/env vars | No new secrets required; Shotstack + OpenAI keys unchanged | None |
| Build artifacts | No compiled binaries or installed packages reference version logic | None |

**`published` boolean behavior change:** Currently `publishVideo` sets `published=true` on a single job. Under D-03, `publishVersionExclusive` must first unpublish all others. Existing published rows in production remain valid — they just need the new publish action to enforce exclusivity going forward. No migration needed for existing published state.

---

## Common Pitfalls

### Pitfall 1: Race Condition in Version Number Assignment
**What goes wrong:** Two admins click "Generate new version" simultaneously — both read `MAX(version_number) = 1`, both try to insert `version_number = 2`, one succeeds and one gets a duplicate.
**Why it happens:** No DB-level sequence on a per-SOP counter.
**How to avoid:** For v1, this is acceptable risk (rare in practice: one admin per SOP). Document it. If it becomes an issue, wrap in a DB function with `LOCK TABLE` or use a PostgreSQL advisory lock. Alternatively, allow the duplicate `version_number` (no unique constraint on `version_number`) — the UI just shows two rows with the same number, which is ugly but not broken. A safer approach: use `version_number` as a display label only, not a unique key.
**Warning signs:** Two rows with identical `version_number` for the same SOP.

### Pitfall 2: generate-video Route Still Enforces Old Idempotency
**What goes wrong:** After the UNIQUE constraint is dropped, the API route's idempotency check (lines 73-127 of `generate-video/route.ts`) still queries for an existing job and returns it if found. This means clicking "Generate new version" from the new UI that calls the API route will get the old job back instead of creating a new one.
**Why it happens:** The route was designed for single-version-per-SOP. The new `generateNewVersion` server action should bypass this route entirely (call `runVideoGenerationPipeline` directly like `regenerateVideo` did) or the route needs a `forceNew=true` flag.
**How to avoid:** Implement `generateNewVersion` as a server action (not via the API route), following the `regenerateVideo` pattern of calling `runVideoGenerationPipeline` directly via `after()`.

### Pitfall 3: Archiving a Generating Job
**What goes wrong:** Admin archives a job that is currently `queued`/`analyzing`/`rendering`. The pipeline finishes and tries to update the row to `ready` — it succeeds (pipeline uses admin client, no archive check). Worker won't see it (not published), but the row ends up archived+ready which is confusing.
**Why it happens:** Pipeline has no knowledge of archive state.
**How to avoid:** Disable the "Archive" action on rows with `status` in `['queued', 'analyzing', 'generating_audio', 'rendering']`. Show a tooltip: "Wait for generation to complete before archiving."

### Pitfall 4: Type System Missing New Columns
**What goes wrong:** `VideoGenerationJob` TypeScript type in `src/types/sop.ts` doesn't have `version_number`, `label`, or `archived` — TypeScript passes but runtime crashes when reading these fields.
**Why it happens:** `database.types.ts` is not auto-regenerated in this environment (established pattern from STATE.md).
**How to avoid:** Extend `VideoGenerationJob` interface in `src/types/sop.ts` with the three new columns immediately in Wave 0 of the plan, before any component work.

### Pitfall 5: VideoAdminPreview's "Re-generate" Button Calls Old Action
**What goes wrong:** `VideoAdminPreview` calls `regenerateVideo(sopId, format)` (line 43). This action resets an existing row. After Phase 10, it must call `generateNewVersion` instead.
**Why it happens:** `VideoAdminPreview` is imported in `VideoGeneratePanel` and has hardcoded action references.
**How to avoid:** Update `VideoAdminPreview` to call `generateNewVersion` and update the confirm dialog copy from "Re-generate this video? The current video will be replaced." to "Generate a new version? The current version will be preserved."

### Pitfall 6: Partial Unique Index Conflict on Publish
**What goes wrong:** The partial unique index `WHERE published = true` will throw a unique violation if `publishVersionExclusive` doesn't successfully unpublish the previous version before publishing the new one (e.g., if the unpublish UPDATE fails silently).
**Why it happens:** Supabase JS update errors are not thrown by default — you must check `error`.
**How to avoid:** Always check the error return from the unpublish UPDATE before proceeding to the publish UPDATE. Return an error to the caller if unpublish fails.

---

## Code Examples

### New: generateNewVersion server action shape
```typescript
// Source: [VERIFIED: based on existing regenerateVideo in src/actions/video.ts + D-06]
export async function generateNewVersion(
  sopId: string,
  format: VideoFormat,
): Promise<{ jobId: string; versionNumber: number } | { error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  const admin = createAdminClient()

  // Guard: block if a generation is already active for this SOP+format
  const { data: active } = await admin
    .from('video_generation_jobs')
    .select('id, status')
    .eq('sop_id', sopId)
    .eq('format', format)
    .in('status', ['queued', 'analyzing', 'generating_audio', 'rendering'])
    .limit(1)
    .maybeSingle()

  if (active) return { error: 'A generation is already in progress for this format' }

  // Get next version number
  const { data: maxRow } = await admin
    .from('video_generation_jobs')
    .select('version_number')
    .eq('sop_id', sopId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (maxRow?.version_number ?? 0) + 1

  // Fetch SOP for version + status check
  const { data: sop } = await admin
    .from('sops')
    .select('id, version, status, organisation_id')
    .eq('id', sopId)
    .single()

  if (!sop || sop.status !== 'published') return { error: 'SOP not found or not published' }

  const { data: newJob, error: insertError } = await admin
    .from('video_generation_jobs')
    .insert({
      organisation_id: auth.organisationId,
      sop_id: sopId,
      sop_version: sop.version,
      format,
      version_number: nextVersion,
      status: 'queued',
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (insertError || !newJob) return { error: 'Failed to create version' }

  after(async () => {
    await runVideoGenerationPipeline(newJob.id).catch(console.error)
  })

  return { jobId: newJob.id, versionNumber: nextVersion }
}
```

### New: publishVersionExclusive server action shape
```typescript
// Source: [VERIFIED: based on existing publishVideo in src/actions/video.ts + D-03]
export async function publishVersionExclusive(
  jobId: string,
  sopId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // 1. Unpublish all versions for this SOP
  const { error: unpubError } = await admin
    .from('video_generation_jobs')
    .update({ published: false, updated_at: now })
    .eq('sop_id', sopId)
    .eq('published', true)

  if (unpubError) return { success: false, error: 'Failed to unpublish existing versions' }

  // 2. Publish this version
  const { error: pubError } = await admin
    .from('video_generation_jobs')
    .update({ published: true, updated_at: now })
    .eq('id', jobId)
    .eq('status', 'ready')

  if (pubError) return { success: false, error: 'Failed to publish version' }

  return { success: true }
}
```

### VideoVersionList component shape
```typescript
// Source: [VERIFIED: design based on CONTEXT.md specifics + existing component patterns]
interface VideoVersionListProps {
  versions: VideoGenerationJob[]          // non-archived, desc order
  archivedVersions: VideoGenerationJob[]  // archived, desc order
  sop: SopSummary
  onMutate: () => void                    // triggers queryClient.invalidateQueries
}
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (existing, all phases) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase10-stubs` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VVM-01 | "Generate new version" creates a new job row, does not reset existing | unit/stub | `npx playwright test video-version-management.test.ts --project=phase10-stubs` | ❌ Wave 0 |
| VVM-02 | Version list shows all non-archived versions in desc order with v1/v2/v3 labels | stub | same | ❌ Wave 0 |
| VVM-03 | Publishing version X unpublishes all other versions for that SOP | stub | same | ❌ Wave 0 |
| VVM-04 | Worker video tab still shows only the published version | stub | same | ❌ Wave 0 |
| VVM-05 | Archiving moves version to collapsible archived section | stub | same | ❌ Wave 0 |
| VVM-06 | Permanent delete from archived section removes job record | stub | same | ❌ Wave 0 |
| VVM-07 | Label edit saves updated label text | stub | same | ❌ Wave 0 |
| VVM-08 | Active generation in version list shows live progress stepper | stub | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase10-stubs`
- **Per wave merge:** `npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/video-version-management.test.ts` — 8 stub tests covering VVM-01 through VVM-08
- [ ] Add `phase10-stubs` project to `playwright.config.ts` with testMatch: `/video-version-management/`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (existing) |
| V4 Access Control | yes | `requireAdmin()` guard on all new server actions; RLS policies already on `video_generation_jobs` |
| V5 Input Validation | yes | Zod validation on `label` input (max 60 chars, string); `jobId`/`sopId` validated as UUIDs |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin archives/deletes another org's video job | Tampering | RLS `organisation_id = public.current_organisation_id()` already blocks cross-org access |
| Non-admin publishes a version | Elevation of Privilege | `requireAdmin()` check in `publishVersionExclusive` — blocks worker/supervisor roles |
| Label XSS injection | Tampering | Label is rendered as text content (not innerHTML) in React — XSS not applicable |
| Concurrent publish race | Tampering | Partial unique index on `(sop_id) WHERE published = true` enforces DB-level constraint |

**No DELETE RLS policy on `video_generation_jobs`** — the existing schema comment says "No DELETE policy — jobs are permanent records." For Phase 10, permanent delete (from archive) uses the admin client (service role bypasses RLS). This is the established pattern for storage cleanup in `deleteVideoJob`.

---

## Open Questions

1. **Partial unique index: `sop_id` alone vs `(sop_id, format)`**
   - What we know: D-03 says "one published version per SOP at a time" — implies across all formats.
   - What's unclear: Can a narrated_slideshow and a screen_recording both be published simultaneously? The CONTEXT.md says "one published version" without qualifying by format. The worker's `VideoTabPanel` renders a single video — so only one can be active anyway.
   - Recommendation: Index on `(sop_id)` only — one published across all formats per SOP. This matches D-03 literally and the worker experience.

2. **`generate-video/route.ts` fate after D-06**
   - What we know: `generateNewVersion` server action will call the pipeline directly (bypassing the HTTP route), consistent with `regenerateVideo`'s established pattern.
   - What's unclear: Is the API route still needed for any other caller? Nothing else calls it.
   - Recommendation: Keep the route but update it to always create a new version (remove the idempotency check that reuses existing rows). It becomes a thin wrapper that assigns a new version_number and fires the pipeline. If no external caller exists, it can remain as-is for completeness without breaking anything.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 10 has no external dependencies beyond what's already running. Supabase (already connected), Node.js (already confirmed), Next.js dev server (port 4200) are all established from prior phases.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00013_video_generation.sql` — confirmed UNIQUE constraint definition, `published` boolean, table schema
- `supabase/migrations/00015_fix_video_gen_rls.sql` — confirmed `public.current_organisation_id()` RLS pattern
- `src/actions/video.ts` — confirmed `regenerateVideo`, `publishVideo`, `deleteVideoJob` shapes
- `src/app/api/sops/generate-video/route.ts` — confirmed idempotency check logic (lines 73-127)
- `src/lib/video-gen/pipeline.ts` — confirmed pipeline is job-ID-driven, no dependency on UNIQUE constraint
- `src/components/admin/VideoGeneratePanel.tsx` — confirmed single-job state machine to be replaced
- `src/components/admin/VideoGenerationStatus.tsx` — confirmed reusable per-jobId subscription component
- `src/components/admin/VideoAdminPreview.tsx` — confirmed `regenerateVideo` call to be updated
- `src/hooks/useVideoGeneration.ts` — confirmed `published=true` filter already correct for worker view
- `src/types/sop.ts` — confirmed `VideoGenerationJob` type missing `version_number`, `label`, `archived`
- `playwright.config.ts` — confirmed `phase9-stubs` pattern for adding `phase10-stubs` project

### Secondary (MEDIUM confidence)
- `supabase/migrations/00016_sop_pipeline_runs.sql` — context for migration numbering sequence (next = 00018)
- `src/app/(protected)/admin/sops/[sopId]/video/page.tsx` — confirmed single-job fetch pattern to replace

---

## Metadata

**Confidence breakdown:**
- Schema changes: HIGH — schema fully read, constraint identified, backfill strategy clear
- Server action changes: HIGH — existing action code read in full, changes well-defined
- UI changes: HIGH — existing components read, refactor scope is clear
- Test stubs: HIGH — established phase-stubs pattern followed

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable stack — no fast-moving dependencies)
