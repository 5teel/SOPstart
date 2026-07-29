# Phase 40: Shared Creation Foundation - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** ~14 new/modified files (4 extraction targets + swap sites + migration/backfill)
**Analogs found:** 14/14 (this is a consolidation refactor — every "analog" is the existing duplicate being merged; RESEARCH.md already contains verified line-level excerpts, reused here rather than re-read)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog(s) (the duplicates being merged) | Match Quality |
|---|---|---|---|---|
| `src/components/admin/FileIntake.tsx` (new, or `UploadDropzone.tsx` extended in place) | component | file-I/O | `UploadDropzone.tsx` (base/most complete), `VideoFormatSelectionModal.tsx` (better HEIC fallback), `versions/page.tsx` inline `<input accept>` (outlier to delete) | exact — same role, all 3 already do this job |
| `src/components/admin/SopMetadataFields.tsx` (new) | component | request-response (form state, no direct write) | `WizardClient.tsx` (title+dept+categoryTag), `PromptClient.tsx` (dept+category select, no title), `VoiceDraftClient.tsx` (dept only, category hardcoded null, no title) | exact — same role, 3 near-identical copies |
| `src/components/admin/ParseJobStatus.tsx` (extended, not new) | component | event-driven (realtime + polling fallback) | itself (base, D-08) + `PipelineStepper.tsx`/`PipelineProgressClient.tsx` (donor: stale-watchdog timer model, cross-table stage derivation) | exact — literally the merge target |
| `src/components/admin/AdminNav.tsx` (reused, wired into 5 more routes) | component | request-response (server-renderable nav) | itself — already correct pattern, just under-adopted | exact |
| `supabase/migrations/000XX_sop_category_vocabulary.sql` (new) | migration | batch | `supabase/migrations/00022_block_library_phase13.sql` (fixed-seed vocab table + app-layer validation, since Postgres CHECK can't subquery), `00043_ownership_review_governance.sql` (`sop_review_cadences` schema, the hidden downstream consumer) | role-match — same fixed-seed-vocab-table shape |
| `scripts/backfill-sop-category.mjs` (new) | utility | batch | `scripts/backfill-agent-metadata.mjs` (null-clobber anti-pattern to avoid), `scripts/backfill-owner-review.mjs` (.env-loading pattern), `scripts/backfill-section-layouts.ts` (idempotent, only-touch-qualifying-rows pattern) | exact — same one-off backfill role |
| `scripts/apply-phase40-migration.mjs` (new) | utility | batch | `scripts/apply-phase37-migration.mjs` (the one with the incomplete-file-list/assertion bug from the [2026-07-28] learning — copy the FIX, not the original mistake), `scripts/apply-phase36-migration.mjs` | exact |
| `scripts/verify-category-backfill.mjs` (new) | utility | batch | `scripts/backfill-owner-review.mjs` (.env pattern) + the [2026-07-28] learning's "assert every clause, cross-checked against the migration SQL" rule | role-match |
| `tests/phase40/dup0{1..4}-*.spec.ts`, `dat01-migration.spec.ts` | test | request-response | `tests/lint/no-bulk-verify-ui.spec.ts` (source-contract sweep pattern), `tests/lint/no-undefined-css-tokens.spec.ts` (grep-based guard registered in a Playwright project) | exact |
| `PromptClient.tsx`, `WizardClient.tsx`, `VoiceDraftClient.tsx` (modified: swap in `SopMetadataFields`) | component | request-response | each other (pre-merge state) | n/a — modification, not new |
| `versions/page.tsx` (modified: swap in `FileIntake`, wire video→transcription) | component | file-I/O | Phase 6 video transcription pipeline (`src/lib/parsers/` video path) for D-06's new wiring | role-match |
| `src/actions/governance.ts` (modified: repoint `resolveCadenceMonths`) | service | CRUD | itself — must be repointed to new category column, not a new pattern | n/a |
| `src/lib/org-model/sop-collections.ts` (modified: repoint `ensureSopCollectionsForOrg`) | utility | event-driven | itself | n/a |

## Pattern Assignments

### `src/components/admin/FileIntake.tsx` (component, file-I/O)

**Primary analog:** `src/components/admin/UploadDropzone.tsx` (most complete accept list — start here)
**Secondary donor:** `src/components/admin/VideoFormatSelectionModal.tsx` (more defensive HEIC check — port its extension-fallback logic in)
**Delete target:** `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx:446` inline `<input accept>`

**Canonical accept-list shape to converge on** (`UploadDropzone.tsx:26-43`, extend per D-04 — add `.webp`, drop nothing else):
```typescript
const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',                                                               // .txt
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime', // MOV
  // D-04 addition: 'image/webp'
]
const BLOCKED_EXTENSIONS = ['.xlsm', '.xlsb', '.xltm', '.pptm', '.potm', '.ppam'] // preserve verbatim — macro-file block, security-relevant (ASVS V5)
```

**Outlier being deleted** (`versions/page.tsx:446` — has `.doc`, an unparseable-by-mammoth silent-fail bug per D-04, and no xlsx/pptx/txt/heic/video):
```typescript
accept=".docx,.doc,.pdf,.jpg,.jpeg,.png,.webp"
```

**HEIC conversion — pick the more defensive of the two copies** (`VideoFormatSelectionModal.tsx:64-88` checks `HEIC_EXTENSIONS` as a fallback in addition to MIME type; `UploadDropzone.tsx:147-164` is MIME-only). Port `VideoFormatSelectionModal`'s extension-fallback check into the merged component; both call the same `heic2any` API so no new library.

**Data-flow note:** all 3 existing copies are `'use client'` File-object validators — no server round-trip for validation itself. `FileIntake` stays client-only, same as its analogs.

---

### `src/components/admin/SopMetadataFields.tsx` (component, request-response)

**Analogs (3 near-identical copies, diverging on category/title):**

`WizardClient.tsx` — has title + localOnly DepartmentPicker + categoryTag (dead-state select feeding a pre-filter, not written anywhere else):
```typescript
// src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
title: z.string().min(1, 'Title is required').max(200),
const [categoryTag, setCategoryTag] = useState<string | null>(null)
// Phase 25: department multi-select — localOnly (A4: sopId doesn't exist yet, write on submit).
<DepartmentPicker
  localOnly
  ...
/>
```

`PromptClient.tsx` — DepartmentPicker + a live `categoryTag` `<select>`, NO title field:
```typescript
// src/app/(protected)/admin/sops/new/ai/PromptClient.tsx
import { DepartmentPicker } from '@/components/admin/departments/DepartmentPicker'
defaultValues: { promptText: '', categoryTag: null, detailLevel: 3 },
<DepartmentPicker localOnly ... />
<select id="categoryTag" {...register('categoryTag')}>
  {/* Anti-pattern per RESEARCH.md: this select is populated from a live
      DISTINCT sops.category query in new/ai/page.tsx:26-37 — must NOT
      survive DAT-01; replace with a fixed-seed vocabulary read. */}
```

`VoiceDraftClient.tsx` — DepartmentPicker only, category hardcoded `null`, NO title field:
```typescript
// src/app/(protected)/admin/sops/new/ai/VoiceDraftClient.tsx
categoryTag: null,
<DepartmentPicker localOnly ... />
```

**Composition pattern to copy:** `localOnly` mode on `DepartmentPicker` is already the correct shape (D-10/Pattern 3 in RESEARCH.md) — parent owns state, writes fire on final submit through `assignSopDepartments` (D-11), never a direct `sop_departments` write. `SopMetadataFields` wraps `DepartmentPicker localOnly` + `DChip` (unchanged) + a title `<input>` (RHF `register('title')` per `WizardClient.tsx:306-309`) + a category select sourced from the new vocab table (not the live distinct-query anti-pattern above).

**API-contract gotcha to carry into the plan (not this agent's call, but must be visible):** `PromptClient`/`VoiceDraftClient` POST to `/api/sops/ai-prompt` with no title field today — title is derived post-parse by `ensureSopTitle()` (`src/lib/parsers/sop-title.ts`, called at `ai-prompt/route.ts:126`). Adding the shared picker's title field means `aiPromptSchema` needs a new optional `title`, and the route needs precedence rules (admin-supplied should likely win).

---

### `src/components/admin/ParseJobStatus.tsx` (extended in place — component, event-driven)

**Base (keep and extend):** `ParseJobStatus.tsx:44-51` — `STAGE_SETS` keyed by `input_type`, already generalized:
```typescript
const STAGE_SETS: Record<string, ReadonlyArray<StageEntry>> = {
  video_file: VIDEO_STAGES_ORIGINAL,
  youtube_url: VIDEO_STAGES_ORIGINAL,
  ai_prompt: AI_STAGES,
  // D-08: add a video_generation key here
}
```

**Donor to port in, then delete (`PipelineStepper.tsx` + `PipelineProgressClient.tsx`):** the three-timer grace+stale-watchdog model is strictly more robust than `ParseJobStatus`'s current flat 5s-delay poll — port this in wholesale:
```typescript
// src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:196-208
const startPollingTimeout = setTimeout(() => {
  if (Date.now() - lastUpdateRef.current >= REALTIME_GRACE_MS) startPolling()
}, REALTIME_GRACE_MS)
const staleWatchdog = setInterval(() => {
  if (Date.now() - lastUpdateRef.current >= REALTIME_STALE_MS) startPolling()
}, REALTIME_STALE_MS)
```

**D-07 mapping layer (new, additive, not extracted from anywhere):** a plain-language label map sits ABOVE `stage.key` — DB values (`parse_jobs.current_stage`, `video_generation_jobs.current_stage`) are NOT renamed; map only at render, matching the Phase 30 UX-07 plain-language pass precedent.

---

### `src/components/admin/AdminNav.tsx` (wired into 5 more routes — no code changes to the component itself expected, only new call sites)

**Analog:** itself — already correctly built (Phase 30 UX-02), currently rendered by `/admin/sops`, `/admin/sops/new`, `/admin/team`, `/admin/settings`, `/admin/departments`, `/admin/blocks`.

**Routes needing the swap (currently hand-roll a back-link):** `/admin/sops/upload`, `/admin/sops/new/blank`, `/admin/sops/new/ai`, `/admin/sops/[sopId]/versions`, `/admin/sops/pipeline/[pipelineId]`.

**Anti-pattern flagged in RESEARCH.md (do not silently regress):** `/admin/sops/[sopId]/versions` and the pipeline progress page link back to a SPECIFIC SOP's builder — `AdminNav`'s `active` prop only expresses top-level sections (`sops|governance|blocks|team|settings`), no per-SOP concept. Layer `AdminNav` alongside the existing contextual "back to this SOP" link; do not replace it.

---

### `supabase/migrations/000XX_sop_category_vocabulary.sql` (migration, batch)

**Analog — fixed-seed vocab table + app-layer validation pattern:** `supabase/migrations/00022_block_library_phase13.sql` (its own comment explicitly notes "Postgres CHECK cannot subquery" — same constraint applies here; validate the new category column against the seed table at the application layer, not a DB CHECK).

**Numbering convention:** sequential, next free number after `00057_restore_sop_observations_cross_org_guard.sql` → start at `00058`.

**Hidden downstream consumers this migration must NOT orphan (RESEARCH.md Runtime State Inventory — not visible to a source-only grep):**
- `sop_review_cadences` (from `00043_ownership_review_governance.sql`) — keyed by `(organisation_id, category)` free text, read by `resolveCadenceMonths()` in `src/actions/governance.ts:84-100,212-222`.
- `src/lib/org-model/sop-collections.ts`'s `ensureSopCollectionsForOrg()` — auto-creates one Collection node per distinct `sops.category` string; called from `src/actions/grants.ts:40` and the **frozen** `src/lib/governance/publish-core.ts:7`.

**Retiring write sites to repoint:**
```typescript
// src/app/api/sops/ai-prompt/route.ts:174 — free-text write, retires
category: parsed.category ?? categoryTag ?? null,

// src/actions/sops.ts:551 — controlled-vocab write, retires
category_tag: parsed.data.categoryTag ?? null,
```

---

### `scripts/backfill-sop-category.mjs` (utility, batch)

**Analog to copy the SHAPE from:** `scripts/backfill-section-layouts.ts` — idempotent, only touches qualifying rows.

**Anti-pattern analog (what NOT to do — the incident this must avoid):** `scripts/backfill-agent-metadata.mjs` null-clobbered all 5 prod embeddings by writing `embedding: null` unconditionally on a failed step. Rule from the [2026-07-05] learning, directly applicable to D-02's "AI-map the rest, null the unmappable": each of the 3 backfill passes (exact/slug match → AI-map remaining unmapped only → explicit null for genuinely untouched rows) must **omit the field from the write payload** on a failed step, never write a blanket `null`/overwrite an already-resolved row.

**`.env`-loading pattern to copy:** `scripts/backfill-owner-review.mjs`.

---

### `scripts/apply-phase40-migration.mjs` (utility, batch)

**Analog — copy the FIX, not the bug:** `scripts/apply-phase37-migration.mjs` is the script named directly in this repo's [2026-07-28] learning: its fallback applied only its own migration and its assertions didn't pin the restored clause, silently re-dropping a later corrective migration. For phase40:
1. The migration file list passed to the applier must include every migration in the phase, in index order (assert the ordering, don't just glob).
2. The post-apply assertion script must pin **every** clause SC-5 requires — "zero rows carry the retired columns" is a live COUNT query, not a schema-existence check — cross-checked against the migration SQL itself, per the same learning.

**Structurally sound sibling to model the happy path on:** `scripts/apply-phase36-migration.mjs`.

---

### `tests/phase40/*.spec.ts` (test, request-response — source-contract sweeps)

**Analog — grep-based guard registered in a Playwright project:**
```typescript
// tests/lint/no-bulk-verify-ui.spec.ts — pattern to copy:
// assert a forbidden pattern has ZERO matches across src/
```
Also see `tests/lint/no-undefined-css-tokens.spec.ts` for the "fallback-less var() has zero matches" style of exhaustive negative-assertion sweep.

**Critical process step (per [2026-05-25] learning, directly applicable):** any new file under `tests/phase40/` MUST be registered in a `phase40` Playwright project `testMatch` regex in `playwright.config.ts` (pattern: `phase34`–`phase37` entries, ~line 501) — verify with `npx playwright test --list --project=phase40` after each plan adds specs, or the guard silently never runs.

**Behavioral wiring caveat (per [2026-06-05] learning):** DUP-02's "single import site" sweep proves presence, not that the picker's `onChange` actually reaches `assignSopDepartments` — pair the source-contract sweep with at least one runtime test that exercises the write path, don't rely on grep alone for D-11 compliance.

## Shared Patterns

### Fixed-seed vocabulary + app-layer validation (not DB CHECK)
**Source:** `supabase/migrations/00022_block_library_phase13.sql`
**Apply to:** the new SOP-category migration and its validation in `SopMetadataFields`
```sql
-- comment pattern to replicate: "Postgres CHECK cannot subquery" —
-- validate against the seed table in application code, same as block_categories today
```

### Realtime + polling fallback, three-timer model
**Source:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:196-208`
**Apply to:** the extended `ParseJobStatus.tsx` (D-08) — grace timer + stale watchdog, ported wholesale, replacing `ParseJobStatus`'s simpler flat-delay poll.

### `localOnly` composable picker mode
**Source:** `src/components/admin/departments/DepartmentPicker.tsx` (`localOnly` prop)
**Apply to:** `SopMetadataFields` — parent owns state pre-submission, writes go through `assignSopDepartments` on final submit (D-11), never a direct `sop_departments` write.

### Null-clobber-safe partial writes
**Source:** CLAUDE.md [2026-07-05] learning + `scripts/backfill-agent-metadata.mjs` incident
**Apply to:** `scripts/backfill-sop-category.mjs` — every conditional write must omit failed fields from the payload rather than writing `null`/overwriting.

### Migration-applier completeness + assertion-pinning
**Source:** CLAUDE.md [2026-07-28] learning + `scripts/apply-phase37-migration.mjs`
**Apply to:** `scripts/apply-phase40-migration.mjs` and `tests/phase40/dat01-migration.spec.ts` — file list must include every corrective migration in order; assertions must pin every SC-5 clause, not just schema existence.

### Source-contract sweep registered in Playwright project
**Source:** `tests/lint/no-bulk-verify-ui.spec.ts`, `tests/lint/no-undefined-css-tokens.spec.ts`, `playwright.config.ts` phase34-37 project entries
**Apply to:** all `tests/phase40/dup0{1..4}` + `dat01` specs — must be added to a `phase40` project regex and verified with `--list`.

## No Analog Found

None — this phase is a pure consolidation of existing duplicated code; every target file has 2-3 direct analogs already in the codebase (the copies being merged) plus, for the migration/backfill/applier scripts, direct sibling scripts from prior phases.

## Metadata

**Analog search scope:** `src/components/admin/`, `src/app/(protected)/admin/sops/**`, `supabase/migrations/`, `scripts/`, `tests/lint/`
**Files scanned:** ~20 (mostly already verified in RESEARCH.md's direct file reads; this pass added `WizardClient.tsx`, `PromptClient.tsx`, `VoiceDraftClient.tsx` category/title grep confirmation, `supabase/migrations/` tail listing, `scripts/` backfill+applier listing)
**Pattern extraction date:** 2026-07-29
