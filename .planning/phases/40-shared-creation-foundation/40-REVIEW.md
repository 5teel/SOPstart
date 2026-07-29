---
phase: 40-shared-creation-foundation
reviewed: 2026-07-29T12:00:00Z
depth: standard
files_reviewed: 55
files_reviewed_list:
  - scripts/apply-phase40-migration.mjs
  - scripts/backfill-sop-category.mjs
  - scripts/survey-sop-categories.mjs
  - scripts/verify-category-backfill.mjs
  - src/actions/governance.ts
  - src/actions/sops.ts
  - src/actions/versioning.ts
  - src/app/(protected)/admin/settings/page.tsx
  - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
  - src/app/(protected)/admin/sops/new/ai/AiDraftTabs.tsx
  - src/app/(protected)/admin/sops/new/ai/PromptClient.tsx
  - src/app/(protected)/admin/sops/new/ai/VoiceDraftClient.tsx
  - src/app/(protected)/admin/sops/new/ai/page.tsx
  - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
  - src/app/(protected)/admin/sops/new/blank/page.tsx
  - src/app/(protected)/admin/sops/page.tsx
  - src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
  - src/app/(protected)/admin/sops/upload/page.tsx
  - src/app/(protected)/sops/page.tsx
  - src/app/api/sops/[sopId]/publish/route.ts
  - src/app/api/sops/ai-prompt/route.ts
  - src/app/api/sops/parse/route.ts
  - src/app/api/sops/restructure/route.ts
  - src/app/api/sops/transcribe/route.ts
  - src/app/api/sops/youtube/route.ts
  - src/app/api/voice/query/route.ts
  - src/components/admin/AdminPageShell.tsx
  - src/components/admin/ParseJobStatus.tsx
  - src/components/admin/SopMetadataFields.tsx
  - src/components/admin/UploadDropzone.tsx
  - src/components/admin/VideoFormatSelectionModal.tsx
  - src/components/admin/governance/GovernanceQueueRow.tsx
  - src/components/sop/SopLibraryCard.tsx
  - src/components/sop/tabs/ReadTab.tsx
  - src/hooks/useAssignedSops.ts
  - src/lib/admin/job-stages.ts
  - src/lib/governance/cadences.ts
  - src/lib/governance/publish-core.ts
  - src/lib/org-model/sop-collections.ts
  - src/lib/sop-categories.ts
  - src/lib/upload/file-intake.ts
  - src/lib/upload/start-video-sop-upload.ts
  - src/lib/validators/sop.ts
  - src/types/database.types.ts
  - src/types/sop.ts
  - supabase/migrations/00058_sop_category_slug.sql
  - tests/phase40/dat01-category-column.spec.ts
  - tests/phase40/dat01-migration.spec.ts
  - tests/phase40/dup01-file-intake.spec.ts
  - tests/phase40/dup02-metadata-picker.spec.ts
  - tests/phase40/dup03-job-progress.spec.ts
  - tests/phase40/dup04-page-shell.spec.ts
  - tests/phase40/spine-freeze.spec.ts
findings:
  critical: 4
  warning: 4
  info: 4
  total: 12
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-07-29
**Depth:** standard
**Files Reviewed:** 55
**Status:** issues_found

## Summary

Phase 40's consolidation work itself (file-intake module, SopMetadataFields, AdminPageShell, job-stages, category_slug migration + backfill scripts) is well built — the backfill script in particular correctly applies the null-clobber, org-scoping, and audit-before-write rules from CLAUDE.md, and the migration/spec pairing pins order and clauses per the [2026-07-28] learning.

The blockers are in the seams the consolidation touched: the version-clone path silently drops the new `category_slug` (violating this phase's own "a new version keeps the old version's category" contract), the shared retry surface (`ParseJobStatus`) destroys AI-prompt drafts, the new-version video branch extends the existing service-role-key-to-browser pattern to a third surface, and the three sopId-keyed parse routes remain cross-tenant destructive endpoints — the exact [2026-07-28] CR-01 class the project's Learnings flag.

## Critical Issues

### CR-01: `SUPABASE_SERVICE_ROLE_KEY` is returned to the browser as an upload token (3 server actions; phase 40 extended the pattern to a new surface)

**File:** `src/actions/versioning.ts:136`, `src/actions/sops.ts:184`, `src/actions/sops.ts:477`
**Issue:** `uploadNewVersion` (video branch, new in plan 40-07), `createVideoUploadSession`, and `createVideoSopPipelineSession` all return `token: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''` to the client, and `startVideoSopUpload` passes it as the TUS `accessToken`. Any admin/safety_manager of ANY tenant receives the full service-role key in their browser (visible in DevTools/network). The service-role key bypasses RLS entirely — a captured key grants cross-tenant read/write of the whole database via PostgREST and all storage buckets. This is a credential-disclosure hole, not just an upload-auth shortcut. Per rule #5 ("fix the scope"), all three sites must be closed together — plan 40-07 copied the pattern into a new surface instead of closing it.
**Fix:** Never ship the service-role key to the client. Options, in order of preference:
```ts
// 1. Use createSignedUploadUrl on the sop-videos bucket (same as the document
//    branch) and upload via uploadToSignedUrl / signed-URL TUS.
// 2. If TUS resumable upload is required for >6MB, use the caller's own
//    session access token (authSession.access_token) + a storage RLS policy
//    scoped to `{org_id}/...` path prefixes — this is what the document TUS
//    branch in UploadDropzone already does.
```

### CR-02: `/api/sops/parse`, `/api/sops/transcribe`, `/api/sops/restructure` do no auth/org/role check — any authenticated user can wipe and re-parse any org's SOP

**File:** `src/app/api/sops/parse/route.ts:37-80`, `src/app/api/sops/transcribe/route.ts:72-111`, `src/app/api/sops/restructure/route.ts:16-56`
**Issue:** All three routes take `sopId` from the request body, then operate exclusively through `createAdminClient()` (RLS bypass) keyed only by that client-supplied id. `parse/route.ts` immediately runs `admin.from('sop_images').delete().eq('sop_id', sopId)` and `admin.from('sop_sections').delete().eq('sop_id', sopId)` — a destructive cross-tenant write reachable by ANY authenticated user (worker role included; the middleware only requires a session cookie, and the org id used downstream is derived from the fetched row, i.e. attacker-influenced — the exact [2026-07-28] CR-01 class documented in CLAUDE.md Learnings). `transcribe` and `restructure` similarly let any user flip another org's SOP into `parsing`, replace its sections, and burn OpenAI/Anthropic spend. These routes were touched by this phase (category_slug repoint), so the sweep rule applies.
**Fix:** At the top of each route, resolve the session and enforce role + org before any admin-client operation:
```ts
const { userId, role, organisationId } = await getSessionContext()
if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
if (!role || !['admin', 'safety_manager'].includes(role))
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
const { data: sopOrg } = await admin.from('sops').select('organisation_id').eq('id', sopId).maybeSingle()
if (!sopOrg || sopOrg.organisation_id !== organisationId)
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

### CR-03: `cloneSopAsDraft` / `restoreVersionAsNew` drop `category_slug` — violates this phase's "a new version keeps the old version's category" contract

**File:** `src/actions/versioning.ts:358-393`
**Issue:** Plan 40 added `category_slug` carry-forward to `uploadNewVersion` (line 92: "a new version keeps the old version's category") but missed the sibling version-creation path: `cloneSopAsDraft` neither selects `category_slug` from the source SOP (line 360) nor writes it in the insert (lines 377-393). The insert even carries the comment "this insert is an explicit field list, so any future per-SOP column must be added here too" — the exact instruction this phase failed to follow. `restoreVersionAsNew` delegates to the same function, so both "Edit into new version" and "Restore" produce an uncategorised draft. Downstream effects on publish of that clone: the cadence lookup falls back to the 12-month default (`resolveCadenceMonths(null, …)`), the approval-chain gate in the publish route never matches (`.eq('category', '')` — a chain-gated category silently loses its approval requirement on the cloned version), and `ensureSopCollectionsForOrg` skips the collection join, dropping the SOP out of the grant system.
**Fix:**
```ts
// select:
.select('id, version, parent_sop_id, organisation_id, title, source_file_name, source_file_type, source_file_path, refresher_interval_months, category_slug')
// insert:
refresher_interval_months: sourceSop.refresher_interval_months ?? null,
category_slug: sourceSop.category_slug ?? null,
```
The approval-chain bypass on clones makes this a governance hole, not just a metadata loss.

### CR-04: "Try again" on a failed AI-prompt draft destroys the draft and strands the SOP in `parsing`

**File:** `src/components/admin/ParseJobStatus.tsx:242-265`, `src/actions/sops.ts:204-255`
**Issue:** `handleReparse` first calls `reparseSop(sopId)`, which deletes all `sop_sections` and sets `status: 'parsing'` — then checks the source file. For an `input_type === 'ai_prompt'` SOP, `source_file_path` is the synthetic `ai-prompt/{userId}/{ts}`, so the `createSignedUrl` check fails and `reparseSop` returns "Source file not found" — after the sections are already gone. Even if it got past that, the endpoint mapping `inputType === 'ai_prompt' ? '/api/sops/ai-prompt'` is wrong: that route requires `promptText` (Zod min 20 — the body only carries `sopId`, so it 400s, silently, because the `fetch(...).catch()` never inspects the response) and, even with a prompt, it creates a brand-new SOP rather than re-parsing the existing one. Net result: one click on the failed-state "Try again" button wipes an AI draft's sections and leaves the SOP stuck in `parsing` with no recovery path. Reachable from both PromptClient and VoiceDraftClient (both render `ParseJobStatus`).
**Fix:** For `ai_prompt` jobs, re-drive the existing job from its persisted `prompt_text` (parse_jobs already stores it) instead of routing through `reparseSop` + `/api/sops/ai-prompt`; minimally, hide "Try again" for `input_type === 'ai_prompt'` and gate `reparseSop`'s destructive deletes behind the source-file existence check (see WR-02).

## Warnings

### WR-01: WebP is accepted client-side and advertised in `INTAKE_HINT`, but the server rejects it — accept-then-fail, the exact class D-04 claims to fix

**File:** `src/lib/upload/file-intake.ts:23` vs `src/lib/validators/sop.ts:49-61`
**Issue:** The shared intake module lists `image/webp` in `ACCEPTED_MIME_TYPES`/`ACCEPT_ATTR` and `INTAKE_HINT` advertises "photos (JPEG/PNG/WebP/HEIC)", but `uploadFileSchema`'s `ACCEPTED_TYPES` in validators/sop.ts has no `image/webp` entry. A .webp passes `validateIntakeFile`, then `createUploadSession` 400s with the generic "Accepted formats…" message. The DUP-01 spec's "every ACCEPTED_MIME_TYPES entry is handled by getSourceFileType" test can't catch it: it greps the validators file for the mime string, which matches inside `getSourceFileType` (line 262) while the schema list drifts (see IN-03). `uploadNewVersion` and the pipeline session use `getSourceFileType` directly, so webp works there — the drift only breaks the primary dropzone path, making it worse to debug.
**Fix:** Add `'image/webp'` to `ACCEPTED_TYPES` in `src/lib/validators/sop.ts` — or better, derive that list from `ACCEPTED_MIME_TYPES` in file-intake.ts so there is genuinely ONE list (the phase's stated goal).

### WR-02: `reparseSop` performs destructive deletes before verifying its preconditions

**File:** `src/actions/sops.ts:204-255`
**Issue:** Order of operations: delete `sop_sections` (line 209) → reset status to `parsing` (line 212) → fetch SOP → verify source file exists in storage (line 236). When the source file is missing (incomplete upload, ai_prompt SOP, storage cleanup), the action returns an error but the SOP's sections are already destroyed and its status stuck at `parsing`. This is the root-cause half of CR-04 and also hits real document uploads whose original upload never completed. Also note: no role check — any authenticated org member can trigger it (RLS permits the deletes only for admins, but the status update path should still be verified).
**Fix:** Reorder — fetch SOP + verify source file first, then delete/reset:
```ts
const { data: sop } = await supabase.from('sops').select(...).eq('id', sopId).single()
if (!sop) return { error: 'SOP not found' }
const { data: fileCheck } = await admin.storage.from(bucket).createSignedUrl(sop.source_file_path, 10)
if (!fileCheck?.signedUrl) return { error: 'Source file not found…' } // nothing destroyed
await supabase.from('sop_sections').delete().eq('sop_id', sopId)
// ...then reset + queue
```

### WR-03: `/api/sops/ai-prompt` reads `departmentIds`/`allDepartments` from the raw body, bypassing its own Zod schema

**File:** `src/app/api/sops/ai-prompt/route.ts:50-52`
**Issue:** The route validates the body with `aiPromptSchema` and then reaches back into the unvalidated `body` for `departmentIds` (only `Array.isArray` checked — elements can be any type) and `allDepartments`. Safety currently rests entirely on `assignSopDepartments` filtering to the caller's org; if that function's guarantees ever loosen, this route has no defence of its own, and non-string array elements flow into a `.in()` filter. Validation at the trust boundary is explicitly a not-lazy-about item.
**Fix:** Extend the schema:
```ts
departmentIds: z.array(z.string().uuid()).max(20).optional().default([]),
allDepartments: z.boolean().optional().default(false),
```
and read both from `parseResult.data` (clients already send them in the same JSON body).

### WR-04: `GovernanceRow.category_slug` holds the vocabulary LABEL, not the slug — a type lie held together by comments

**File:** `src/actions/governance.ts:446`, `src/components/admin/governance/GovernanceQueueRow.tsx:68-73`
**Issue:** `listGovernanceQueue` maps `category_slug: categoryLabel(sop.category_slug)` — the field named `category_slug` (typed `string | null`) carries "Machine Operation", not `machine-operation`. Both sites carry warning comments telling future readers not to re-wrap it, which is the tell that the name is wrong: any new consumer that treats the field as a slug (e.g. `isValidCategorySlug(row.category_slug)`, a filter against `SOP_CATEGORIES`, a link `?category=`) silently gets null/no-match. Comments don't survive refactors; names do.
**Fix:** Rename the field to `categoryLabel: string | null` on `GovernanceRow` (or carry both `category_slug` and `categoryLabel`). One-line change at the mapper plus the single consumer.

## Info

### IN-01: Dead code — `sopCategoryOptions` and the `categories` prop in WizardClient (plus the `listBlockCategories()` fetch feeding it)

**File:** `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx:89-100`, `src/app/(protected)/admin/sops/new/blank/page.tsx:25-28`
**Issue:** After DUP-02 removed the old category select, `sopCategoryOptions` (useMemo at line 91) is never referenced in the render, making the `categories` prop — and the server-side `listBlockCategories()` fetch on the page — dead weight on every page load. (BlockPicker now receives `sopCategory={null}` explicitly.)
**Fix:** Delete `sopCategoryOptions`, the `categories` prop, and the `listBlockCategories()` call; BlockPicker's own kind filtering doesn't need them.

### IN-02: Lint-silencing dead code in ParseJobStatus

**File:** `src/components/admin/ParseJobStatus.tsx:299-307`
**Issue:** `failedStageMatch`/`failedStage`/`failedStageName` are computed and then discarded via `void failedStageName; void onRetry` with a comment claiming they're "wired through render branches below" — they are not; no render branch uses either. This is dead computation plus a misleading comment.
**Fix:** Delete the block (and the `onRetry` prop if nothing will ever call it), or actually render `failedStageName` in the failed-state panels.

### IN-03: DUP-01 spec's "handled by getSourceFileType without throwing" test asserts token presence, not behaviour — it passed while WR-01 shipped

**File:** `tests/phase40/dup01-file-intake.spec.ts:138-143`
**Issue:** The test's title promises a runtime guarantee but the body only checks each mime string appears somewhere in the validators source — the [2026-06-05] presence-vs-wiring class. `image/webp` appears in `getSourceFileType` so the test is green, while `uploadFileSchema` (the actual server gate for the dropzone path) rejects webp.
**Fix:** Import and call the real functions:
```ts
for (const mime of ACCEPTED_MIME_TYPES) {
  expect(() => getSourceFileType(mime)).not.toThrow()
  expect(uploadFileSchema.safeParse({ name: 'f', size: 1, type: mime }).success
    || (VIDEO_MIME_TYPES as readonly string[]).includes(mime)).toBe(true)
}
```

### IN-04: `setReviewCadence` has no caller, and its new slug gate rejects the `default` key the resolver still honours

**File:** `src/actions/governance.ts:274-311`, `src/lib/governance/cadences.ts:27`
**Issue:** No component in `src/` invokes `setReviewCadence` (the cadence editor appears to have been retired in the Phase 30 governance fold), so the T-40-05-04 `isValidCategorySlug` gate currently protects a dead export. Latent inconsistency: `resolveCadenceMonths` still reads `orgCadences['default']`, but the gate now makes `'default'` unmintable — if/when a cadence editor returns, the org-wide default cadence cannot be set through this action, and existing `default` rows are permanently frozen (the backfill also leaves them untouched, correctly).
**Fix:** Either whitelist `'default'` alongside vocabulary slugs (`if (category !== 'default' && !isValidCategorySlug(category))`) or drop the `default` branch from `resolveCadenceMonths` and delete the dead action.

---

_Reviewed: 2026-07-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
