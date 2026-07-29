# Phase 40: Shared Creation Foundation - Research

**Researched:** 2026-07-29
**Domain:** Internal consolidation refactor — Next.js 16 client components, Supabase Postgres migration/backfill, Playwright source-contract testing
**Confidence:** HIGH (all findings verified by direct file read / grep against the live codebase and migrations — this is a refactor of code that already exists, not a new-library integration)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Category convergence (DAT-01)**
- D-01: New SOP-specific category vocabulary wins — BOTH existing columns (`sops.category` free text, `sops.category_tag` block_categories slug) retire. Seed a fresh SOP-category vocabulary from the real values currently in both columns.
- D-02: Backfill = exact/slug match first, AI-map the rest, null the unmappable. One-off script. A live query against prod must prove zero rows still carrying the retired columns (SC-5). Heed the [2026-07-05] null-clobber learning: failed AI-mapping steps must not overwrite good data — omit failed fields from writes.
- D-03: Vocabulary is a fixed seed, code/migration-managed. No org-editable CRUD surface this milestone.

**File intake (DUP-01)**
- D-04: One canonical accept list — level up, drop `.doc`. Documents: `.docx .pdf .xlsx .pptx .txt`; images: `jpeg png webp heic/heif` with HEIC→JPEG conversion available everywhere (single implementation); video: `mp4/mov`. Size limits carry forward (50MB docs / 2GB video).
- D-05: The list is IDENTICAL on all three surfaces — no per-context profiles. Simon explicitly chose this over named profiles.
- D-06: New-version video is wired through the existing Phase 6 transcription pipeline in THIS phase — the one deliberate user-visible addition, required so D-05's identical acceptance is honest.

**Job progress (DUP-03)**
- D-07: One plain-language stage vocabulary, mapped over untouched internal keys. DB stage keys are NOT renamed — mapping happens at render.
- D-08: `ParseJobStatus` is the base — extend it, retire `PipelineStepper`/`PipelineProgressClient` onto it. Realtime-with-polling-fallback implemented exactly once.

**Metadata picker (DUP-02)**
- D-09: The shared picker owns title + departments + category. Detail-level stays per-surface (AI-generation knob, not a picker field).
- D-10: One composite component (`SopMetadataFields` or similar), not a field kit. A surface may hide a field via prop only where its flow genuinely lacks it.
- D-11: Department writes stay on the Phase 33 grant-backed path — funnel through `assignSopDepartments`, never direct `sop_departments` writes.
- D-12: Upload does NOT get the picker this phase (CRE-02/Phase 42 scope). Phase 40 swaps the component into PromptClient, WizardClient, VoiceDraftClient only.

### Claude's Discretion
- DUP-04 page shell: not discussed — clear-cut. Every admin creation route renders shared `AdminNav`; implementation detail is Claude's call.
- New category column naming/shape (`category_id` FK vs slug text column), migration numbering/ordering, exact plain-language stage labels — planner/executor calls.
- Backfill script mechanics (Management API vs supabase-js, PGRST205 handling) — follow Learnings; Claude's call.

### Deferred Ideas (OUT OF SCOPE)
- Org-editable SOP-category vocabulary (admin-settings CRUD like Phase 34's `observation_labels`). Deferred — new capability inside a consolidation milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DUP-01 | One file-intake component owns accepted MIME types, blocked extensions, size limits, HEIC→JPEG conversion; every upload path uses it | Exact current accept lists/behaviour mapped for all 3 surfaces below (§ Don't Hand-Roll, § Architecture Patterns) |
| DUP-02 | One department/metadata picker used by every creation surface | Exact field-by-field diff of the 3 existing copies mapped below; title-field gap identified (AI-prompt path currently has no title input) |
| DUP-03 | One parse/job progress component serves both parse and video-gen flows; realtime+polling implemented once | `ParseJobStatus` vs `PipelineStepper`+`PipelineProgressClient` architecture compared; stage-set extension point identified |
| DUP-04 | All admin creation routes render the same page shell/nav | Verified via grep+read which of the 6 phase-scoped routes already render `AdminNav` (1 of 6) vs hand-roll a back-link (5 of 6) |
| DAT-01 | SOP category resolves to one column/vocabulary; existing rows backfilled | Both retiring columns' schema, seed data, and — critically — two undocumented downstream consumers (`sop_review_cadences`, org-model `sop-collections.ts`) identified via migration/action grep |
</phase_requirements>

## Summary

This phase is a pure internal consolidation refactor of code that already ships in production — there is no new library, framework, or external service to evaluate. All "research" is a precise map of what currently exists so the planner can write an accurate diff-based plan rather than rediscover the codebase mid-execution.

Four duplication clusters were verified directly:

1. **File intake** — `UploadDropzone.tsx` (docs+images+video, no `.webp`), `VideoFormatSelectionModal.tsx` (docs+images only, own HEIC copy), and `versions/page.tsx` (`.docx,.doc,.pdf,.jpg,.jpeg,.png,.webp` — the outlier with `.doc` and no xlsx/pptx/txt/heic/video) each hard-code their own `ACCEPTED_MIME_TYPES`/`ACCEPT` literal, `MAX_FILE_SIZE`, and (in two of three) their own HEIC→JPEG conversion call. `BLOCKED_EXTENSIONS` is already identical across the two files that have it.
2. **Metadata picker** — `PromptClient.tsx`, `WizardClient.tsx`, and `VoiceDraftClient.tsx` each independently wire `DepartmentPicker` + `DChip` in `localOnly` mode, but diverge on category (free-text `<select>` vs controlled-vocab hidden state vs hardcoded `null`) and none but `WizardClient` collects a title. `WizardClient.categoryTag` state is set once at declaration and never mutated by any UI control — it is already-dead state feeding the wizard's block-library pre-filter.
3. **Job progress** — `ParseJobStatus.tsx` (Realtime `parse_jobs` row + 5s polling fallback, stage-set keyed by `input_type`) and `PipelineStepper.tsx`/`PipelineProgressClient.tsx` (Realtime across 4 tables + a different 5s/15s grace-then-poll timing model, stage keyed by cross-table state derivation) are structurally different implementations of the same realtime-plus-polling idea, not just cosmetically different.
4. **Page shell** — of the 6 routes this phase touches, only `/admin/sops/new/page.tsx` (the picker) renders `AdminNav`. `/admin/sops/upload`, `/admin/sops/new/blank`, `/admin/sops/new/ai`, `/admin/sops/[sopId]/versions`, and `/admin/sops/pipeline/[pipelineId]` each hand-roll their own "Back to library" `<Link>` or (in the pipeline case) a bespoke sticky header.

The category data model has **two undocumented downstream consumers beyond the two obvious write paths** that the planner must account for or the migration will silently orphan data: `sop_review_cadences` (governance review-cadence lookup, keyed by the free-text `sops.category` value, not a FK) and `src/lib/org-model/sop-collections.ts` (`ensureSopCollectionsForOrg`, called from both `grants.ts` and the frozen `publish-core.ts`, auto-creates an org-model Collection node per distinct `sops.category` string). Both read the retiring `category` column directly and will keep working against stale/orphaned values unless the migration or a follow-up code change repoints them.

**Primary recommendation:** Treat this as four independent, mechanically-provable component extractions plus one two-column-to-one-column data migration with two hidden downstream readers. No new packages are needed (`heic2any@0.0.4`, already installed, remains the sole conversion library). Sequence the migration research/plan carefully around `sop_review_cadences` and `sop-collections.ts` — missing either produces a governance feature that silently stops matching SOPs to their cadence, or a Collection tree that free-floats away from reality.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File accept-list / size-limit / HEIC conversion | Browser / Client | — | All three existing copies are `'use client'` components validating `File` objects before upload; no server involvement in validation itself |
| Metadata picker (title/dept/category) | Browser / Client | API / Backend (write) | Client collects/validates via RHF+Zod; writes land through existing server actions (`assignSopDepartments`) and the `ai-prompt` API route — picker itself stays presentational |
| Job progress (realtime+polling) | Browser / Client | Database / Storage | Client subscribes to Supabase Realtime `postgres_changes` on `parse_jobs`/`sop_pipeline_runs`/etc.; Postgres publication config is the enabling backend piece, already in place |
| Admin page shell/nav | Frontend Server (SSR) | Browser / Client | `AdminNav` is a server-renderable component already used by 6 admin pages; no client hook required for the nav itself (`NavPendingSpinner` is the only client sliver) |
| SOP category (single column/vocabulary) | Database / Storage | API / Backend | The column lives in Postgres; every write path (ai-prompt route, wizard server action) and every read path (governance cadence, org-model collections, library filters) is API/Backend-tier code reading/writing that one column |

## Standard Stack

No new dependencies. This phase collapses existing, already-installed code paths.

### Core (existing, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `heic2any` | 0.0.4 (installed; matches npm registry latest — `npm view heic2any version` confirms) | HEIC→JPEG client-side conversion | Already the sole conversion implementation in both existing copies (`UploadDropzone.tsx:149`, `VideoFormatSelectionModal.tsx:71`) — DUP-01 collapses call sites, does not replace the library |
| `react-hook-form` + `@hookform/resolvers/zod` + `zod` | already in package.json | Form state + validation for the shared metadata picker | Already used by `PromptClient.tsx`, `WizardClient.tsx`'s title step |
| `@supabase/supabase-js` Realtime (`postgres_changes`) | already in package.json | Job-progress realtime subscription | Both existing progress components already use this; DUP-03 unifies the client-side implementation, not the transport |

### Alternatives Considered
None — introducing a new upload/progress/form library for a pure consolidation refactor would contradict the phase's own goal (fewer moving parts, not more).

**Installation:** none required.

**Version verification performed:**
```
npm view heic2any version   → 0.0.4 (matches installed ^0.0.4)
```

## Package Legitimacy Audit

**Not applicable — this phase installs no new external packages.** All work reuses already-installed, already-approved dependencies (`heic2any`, `react-hook-form`, `zod`, `@supabase/supabase-js`). No `slopcheck`/registry audit needed; skip the Package Legitimacy Gate for this phase.

## Architecture Patterns

### System Architecture Diagram — current state (3 duplicated flows → target: 1 shared flow)

```
CURRENT (3 independent copies per concern):

UploadDropzone.tsx ──┐
                      ├─ own ACCEPTED_MIME_TYPES / MAX_FILE_SIZE / HEIC branch
VideoFormatSelectionModal.tsx ──┤
                      │
versions/page.tsx (inline <input accept=...>) ──┘  (no video, no HEIC parity)

PromptClient.tsx ──┐
                    ├─ own DepartmentPicker wiring + own category UI (free-text <select>)
WizardClient.tsx ───┤    (own category UI = dead state; title lives here only)
                    │
VoiceDraftClient.tsx ┘  (no category UI at all — hardcodes null; no title)

ParseJobStatus.tsx ── realtime(parse_jobs) + 5s-delay poll, stage keyed by input_type
PipelineStepper.tsx + PipelineProgressClient.tsx ── realtime(4 tables) + 5s-grace/15s-stale
                                                       poll, stage DERIVED from cross-table state

AdminNav.tsx ── rendered by: /admin/sops, /admin/sops/new (picker), /admin/team,
                /admin/settings, /admin/departments, /admin/blocks
                NOT rendered by: /admin/sops/upload, /admin/sops/new/blank,
                /admin/sops/new/ai, /admin/sops/[sopId]/versions,
                /admin/sops/pipeline/[pipelineId]  (each hand-rolls a back-link/header)

TARGET (this phase):

  [FileIntake component] ← UploadDropzone, VideoFormatSelectionModal, versions/page all call this
  [SopMetadataFields component] ← PromptClient, WizardClient, VoiceDraftClient all call this
  [ParseJobStatus, extended] ← every progress-showing surface calls this (PipelineStepper/
                                 PipelineProgressClient retire)
  [AdminNav] ← every admin creation route renders this in its shell
  [sops.<new category column>] ← every write path writes here; sop_review_cadences and
                                   sop-collections.ts read here (not the retired columns)
```

### Recommended extraction shape (Claude's-discretion naming — planner may rename)
```
src/components/admin/
├── FileIntake.tsx (or extend UploadDropzone.tsx as the base — D-04/D-05 canonical accept list,
│                    BLOCKED_EXTENSIONS, MAX_FILE_SIZE/MAX_VIDEO_FILE_SIZE, HEIC conversion helper)
├── SopMetadataFields.tsx (D-10 composite: title input + DepartmentPicker/DChip + category select,
│                           each field hideable via prop per D-10's "surface may hide a field only
│                           where its flow genuinely lacks it")
└── ParseJobStatus.tsx (D-08 base — extended with a video-generation stage set + PipelineProgressClient's
                          realtime-table-fanout + grace/stale-poll timing, replacing both)
```

### Pattern 1: Stage-set extension (D-07/D-08) — reuse `ParseJobStatus`'s existing shape
**What:** `ParseJobStatus.tsx` already generalises stages via `STAGE_SETS: Record<string, ReadonlyArray<StageEntry>>` keyed by `parse_jobs.input_type` (`video_file`/`youtube_url`/`ai_prompt` today).
**When to use:** Add a `video_generation` (or similar) key to `STAGE_SETS` for the video-gen pipeline's stages, and extend the realtime subscription to also watch `sop_pipeline_runs`/`video_generation_jobs` (currently `PipelineProgressClient`-only tables) alongside the existing `parse_jobs` watch.
**Example (existing pattern to extend):**
```typescript
// Source: src/components/admin/ParseJobStatus.tsx:44-48
const STAGE_SETS: Record<string, ReadonlyArray<StageEntry>> = {
  video_file: VIDEO_STAGES_ORIGINAL,
  youtube_url: VIDEO_STAGES_ORIGINAL,
  ai_prompt: AI_STAGES,
  // D-08: add a video-generation set here; PipelineProgressClient's
  // deriveStage() cross-table logic (sop_pipeline_runs/video_generation_jobs)
  // becomes the new realtime watch this component needs to add.
}
```
**D-07 mapping layer:** a separate plain-language label map (worker-facing "Reading your document" etc.) sits ABOVE the existing internal `stage.key` values — do not rename `parse_jobs.current_stage` or `video_generation_jobs.current_stage` DB values; map at render only, per the explicit decision.

### Pattern 2: Realtime-with-polling-fallback — reconcile two different timing models
**What:** `ParseJobStatus` uses a flat "poll starts 5s after mount if realtime hasn't connected" model. `PipelineProgressClient` uses a more defensive three-timer model: `REALTIME_GRACE_MS` (5s, start polling if nothing has arrived), plus a separate `REALTIME_STALE_MS` (15s) watchdog that starts polling even if realtime connected-then-went-silent — `ParseJobStatus` has no equivalent stale-watchdog.
**When to use:** D-08 requires implementing this exactly once. The stale-watchdog behaviour in `PipelineProgressClient` is strictly more robust (catches silent realtime drops after initial connect); prefer porting that three-timer model into the merged component rather than keeping `ParseJobStatus`'s simpler one.
**Example:**
```typescript
// Source: src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:196-208
const startPollingTimeout = setTimeout(() => {
  if (Date.now() - lastUpdateRef.current >= REALTIME_GRACE_MS) startPolling()
}, REALTIME_GRACE_MS)
const staleWatchdog = setInterval(() => {
  if (Date.now() - lastUpdateRef.current >= REALTIME_STALE_MS) startPolling()
}, REALTIME_STALE_MS)
```

### Pattern 3: `localOnly` picker mode (D-10/D-11) — already the right shape, just needs a title field added
**What:** `DepartmentPicker` already supports a `localOnly` prop (no server action fires; parent owns state, writes on final submit) — this is exactly the composability D-10 wants for the new `SopMetadataFields`.
**When to use:** `SopMetadataFields` should wrap `DepartmentPicker localOnly` + `DChip` (unchanged) + a category `<select>`/combobox sourced from the new vocabulary + a title `<input>` — and expose an `onChange` that returns `{ title, departmentIds, allDepartments, categoryId }` for the parent form to include in its submit payload (D-11: writes still go through `assignSopDepartments`, never a direct `sop_departments` write).
**Gotcha (not in CONTEXT.md — verified in code):** `PromptClient`'s `/api/sops/ai-prompt` POST and `VoiceDraftClient`'s identical POST currently send **no title field at all**; the SOP title is derived post-parse by `ensureSopTitle()` (`src/lib/parsers/sop-title.ts`, called at `ai-prompt/route.ts:126`). Adding a title field to the shared picker on these two surfaces is a genuine (small) API-contract change: `aiPromptSchema` needs a new optional `title` field, and the route needs to decide precedence (admin-supplied title should almost certainly win over the AI-derived fallback — but this is undecided and belongs in the plan, not assumed here).

### Anti-Patterns to Avoid
- **Per-surface accept-list literals:** D-05 explicitly rejects named per-context profiles — do not build a "profile" abstraction; one literal list, full stop.
- **Category `<select>` sourced from live `DISTINCT sops.category` query:** `/admin/sops/new/ai/page.tsx` currently does this (`supabase.from('sops').select('category').not('category','is',null)`) — this pattern must NOT survive DAT-01, since it queries the very column being retired. The new picker's category options come from the new fixed-seed vocabulary table (D-03), not a live distinct-query.
- **Assuming `AdminNav` alone satisfies "shared page shell" for per-SOP subpages:** `/admin/sops/[sopId]/versions` and the pipeline progress page currently link back to a *specific SOP's builder* (`/admin/sops/builder/{sopId}`), which is contextual navigation `AdminNav` cannot express (its `active` prop is one of `sops|governance|blocks|team|settings`, not a per-SOP concept). DUP-04 likely means layering `AdminNav` (top-level admin section nav) alongside — not instead of — the existing contextual "back to this SOP" link. Flagged as an open question below; do not silently drop the contextual link when adding `AdminNav`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC→JPEG conversion | A third bespoke `heic2any` wrapper | The existing conversion call, extracted once into the shared file-intake component | Two near-identical copies already exist (`UploadDropzone.tsx:147-164`, `VideoFormatSelectionModal.tsx:64-88`) differing only in whether extension-matching backs up MIME-type matching — pick the more defensive one (`VideoFormatSelectionModal`'s, which also checks `HEIC_EXTENSIONS` as a fallback) as the canonical version |
| Realtime+polling fallback for async job status | A third timing model | `PipelineProgressClient`'s three-timer (grace + stale-watchdog) model, ported into the merged `ParseJobStatus` | Already battle-tested in production for the video pipeline; simpler to strengthen `ParseJobStatus` than to re-derive the watchdog logic from scratch |
| Department multi-select UI | A new picker for the metadata component | `DepartmentPicker` (`localOnly` mode) + `DChip`, unchanged | Already exactly the composable shape D-10 wants; zero reason to touch it |
| Category vocabulary validation | A Postgres CHECK subquery | Application-layer validation against the seed table (mirrors the existing `block_categories` pattern: `00022_block_library_phase13.sql` comment explicitly notes "Postgres CHECK cannot subquery") | Same constraint applies to the new SOP-category table; follow the established pattern rather than trying a DB-level constraint that Postgres can't express |

**Key insight:** every "don't hand-roll" item here is "don't hand-roll a *third* copy of something the codebase already built twice" — this phase's entire job is picking the better of the two existing implementations per concern and deleting the other, not inventing new patterns.

## Runtime State Inventory

> Included because DAT-01 is a column-retirement + backfill migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) `sops.category` (free text, written by `/api/sops/ai-prompt` route, `youtube` route, doc-parse pipeline) and `sops.category_tag` (block_categories slug, written by `createSopFromWizard` in `src/actions/sops.ts:551`) — both retiring per D-01. (2) `sop_review_cadences` table (migration `00043_ownership_review_governance.sql`) — rows keyed by `(organisation_id, category)` where `category` is a **free-text string copied from `sops.category` values**, not a FK. `resolveCadenceMonths()` in `src/actions/governance.ts:84-100` does an in-memory `category -> months` lookup against this table using the SOP's live `category` value (`governance.ts:212-222`). (3) `collections` rows (org-model, Phase 32) auto-created one-per-distinct-category by `ensureSopCollectionsForOrg()` in `src/lib/org-model/sop-collections.ts` — called from `src/actions/grants.ts:40` and the **frozen** `src/lib/governance/publish-core.ts:7`. | (1) is the core data migration (D-02 backfill script). (2) needs EITHER a parallel remap of `sop_review_cadences.category` keys to the new vocabulary (so existing per-category cadence overrides survive) OR a decision to re-key `resolveCadenceMonths` off the new column/table with cadences reset to default — must be an explicit plan decision, not silently dropped. (3) `sop-collections.ts` must be repointed to read whatever column DAT-01 lands on; existing `collections` rows named after now-retired free-text values will NOT auto-rename and may need either a rename-in-place migration step or acceptance that old collections go stale (flag as an open question below — CONTEXT.md doesn't address this). |
| **Live service config** | None found — no external service (n8n, Datadog, etc. equivalent) stores category data outside Postgres. | None. |
| **OS-registered state** | None found — not applicable to this phase. | None. |
| **Secrets/env vars** | None found — category data involves no secret/env-var names. | None. |
| **Build artifacts / installed packages** | None found — no installed package or build artifact embeds the `category`/`category_tag` column names. | None. |

**The canonical question answered:** after every file/column in the repo is updated, `sop_review_cadences` (governance cadence overrides) and `collections` (org-model) rows in Postgres still carry the OLD free-text category strings as their identity/key — both are runtime data, not code, and a source-only sweep will never find them. The plan must explicitly decide their fate.

## Common Pitfalls

### Pitfall 1: Migration-applier omits the two hidden downstream consumers
**What goes wrong:** A migration that adds the new category column + backfills `sops` rows looks complete (green assertions on `sops`), but `sop_review_cadences` lookups and `sop-collections.ts` keep reading the old `sops.category` column (if it's dropped, this is a hard `42703` runtime error in the governance queue and on every publish; if it's kept-but-unwritten, it's a silent staleness bug).
**Why it happens:** Same root-cause class as the `[2026-07-28]` learning in this repo's CLAUDE.md — a migration script's success criteria checked the object it directly touched, not every consumer of the column it retired.
**How to avoid:** Before writing the migration, grep `\.category\b` and `category_tag` across `src/` (36 files matched in this research) and classify each hit as read/write/display — the plan's task list must explicitly cover `governance.ts` (cadence resolution) and `sop-collections.ts` (org-model), not just the two obvious write sites (`ai-prompt/route.ts`, `actions/sops.ts`).
**Warning signs:** Governance queue "review overdue" badges stop matching expected cadences after the migration; org-model Collections tree stops growing / has orphaned nodes named after pre-migration category strings.

### Pitfall 2: Best-effort AI-mapping backfill null-clobbers already-good rows
**What goes wrong:** D-02's "AI-map the rest, null the unmappable" step, if implemented as a blanket upsert, can overwrite a row that already resolved via exact/slug match with `null` if the AI-mapping pass re-touches every row instead of only the ones still unmapped.
**Why it happens:** Exactly the `[2026-07-05]` null-clobber pattern already logged in this repo's CLAUDE.md (`backfill-agent-metadata.mjs` prod incident).
**How to avoid:** Three-phase backfill script: (1) exact/slug match pass writes only matched rows; (2) AI-mapping pass reads ONLY rows still unmapped after (1) and writes only successful AI-mapping results (omit the field entirely from the write payload on failure, per the existing learning); (3) final pass explicitly sets `null`/"uncategorised" only for rows untouched by (1) and (2), never blanket.
**Warning signs:** Row count with the new category column populated goes DOWN between backfill runs, or previously-categorised rows show "uncategorised" after a re-run.

### Pitfall 3: PostgREST schema-cache staleness right after the DDL migration
**What goes wrong:** A post-migration assertion script run immediately after `supabase db push` reports the new category table/column as missing (`PGRST205`) even though the migration succeeded.
**Why it happens:** Documented in this repo's `[2026-06-15]` learning — PostgREST's schema cache doesn't reload instantly.
**How to avoid:** Either `NOTIFY pgrst, 'reload schema';` via the Management API before running assertions, or verify existence via `to_regclass()`/raw SQL rather than the supabase-js REST client immediately post-push.

### Pitfall 4: Migration assertion pins only some clauses, not every security/behaviour-relevant one
**What goes wrong:** A migration-applier's post-apply assertion checks that the new category column exists and has SOME non-null values, but doesn't assert (a) zero rows still carry the retired columns (SC-5's actual bar) or (b) that `sop_review_cadences`/`sop-collections.ts` were actually repointed.
**Why it happens:** The `[2026-07-28]` learning in this repo's CLAUDE.md — an assertion that doesn't pin every clause certifies whatever happens to be live, not what was intended.
**How to avoid:** SC-5 explicitly requires "a live query against prod proves zero rows left behind" — this must be a runnable script (not just a migration-time assertion) that a human/CI runs post-deploy, per the Validation Architecture below.

### Pitfall 5: Adding `AdminNav` to a per-SOP subpage silently drops the contextual "back to this SOP" link
**What goes wrong:** `/admin/sops/[sopId]/versions` and the pipeline progress page currently link back to a SPECIFIC SOP's builder, not to the library. If DUP-04 is implemented by naively swapping the hand-rolled back-link for bare `AdminNav`, the admin loses the ability to navigate back to the specific SOP they came from.
**Why it happens:** `AdminNav`'s `active` prop only expresses top-level admin sections (`sops|governance|blocks|team|settings`), not a per-SOP concept — it was designed (Phase 30) for section-level nav, not record-level nav.
**How to avoid:** Layer `AdminNav` above the existing contextual back-link rather than replacing it, or extend the page shell pattern to accept an optional contextual breadcrumb slot. This is a design decision the plan must make explicitly (see Open Questions).

## Code Examples

### Existing canonical accept-list literal (most complete of the three — extend, don't replace)
```typescript
// Source: src/components/admin/UploadDropzone.tsx:26-43 (closest to D-04's target shape;
// missing only .webp per D-04's "add webp to images" requirement)
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
]
const BLOCKED_EXTENSIONS = ['.xlsm', '.xlsb', '.xltm', '.pptm', '.potm', '.ppam']
```

### Existing outlier to replace entirely
```typescript
// Source: src/app/(protected)/admin/sops/[sopId]/versions/page.tsx:446
// Current — .doc (unparseable by mammoth, silent-accept-then-fail bug per D-04),
// no xlsx/pptx/txt/heic/video. This is the accept list DUP-01/D-06 must replace.
accept=".docx,.doc,.pdf,.jpg,.jpeg,.png,.webp"
```

### Existing stage-set generalisation to extend for video-gen (D-08)
```typescript
// Source: src/components/admin/ParseJobStatus.tsx:44-51
const STAGE_SETS: Record<string, ReadonlyArray<StageEntry>> = {
  video_file: VIDEO_STAGES_ORIGINAL,
  youtube_url: VIDEO_STAGES_ORIGINAL,
  ai_prompt: AI_STAGES,
}
```

### Existing category-write sites to repoint (DAT-01)
```typescript
// Source: src/app/api/sops/ai-prompt/route.ts:174 — free-text write, retires
category: parsed.category ?? categoryTag ?? null,

// Source: src/actions/sops.ts:551 — controlled-vocab write, retires
category_tag: parsed.data.categoryTag ?? null,
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Two parallel category concepts (`category` free text from AI paths, `category_tag` from `block_categories` vocab for the wizard path) | Single SOP-category column backed by one fixed-seed vocabulary (this phase) | Phase 40 (2026-07-29 decision) | Every "browse/filter by category" surface (worker library display, admin cadence rules, org-model collections) becomes queryable/filterable consistently for the first time since Phase 22 (blocks) vs Phase 2 (original `sops.category`) diverged |
| 3 independent realtime+polling implementations (parse, video pipeline, and — not yet unified — nothing else) | 1 implementation, 2 stage-sets | Phase 40 | Simplifies Phase 41/42's nav and creation-flow convergence per the phase's own stated purpose |

**Deprecated/outdated:**
- `sops.category` (free text) and `sops.category_tag` (block_categories-sourced) — both retire onto the new column per D-01.
- `PipelineStepper.tsx` / `PipelineProgressClient.tsx` as standalone components — retire onto extended `ParseJobStatus` per D-08.
- The live `DISTINCT sops.category` query in `/admin/sops/new/ai/page.tsx:26-37` that populates the AI-prompt category dropdown — replaced by a fixed-seed vocabulary read (D-03).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `VideoFormatSelectionModal`'s HEIC conversion (MIME + extension fallback check) is the more defensive of the two existing implementations and should be the canonical one, over `UploadDropzone`'s (MIME-only check) | Don't Hand-Roll | Low — both call the same `heic2any` API; picking the "wrong" one just means porting one extra `HEIC_EXTENSIONS.some(...)` fallback check, not a functional gap |
| A2 | Admin-supplied title (once added to the AI-prompt/voice-draft paths via the shared picker) should take precedence over the AI-derived `ensureSopTitle()` fallback | Architecture Patterns, Pattern 3 | Medium — if the plan instead decides AI-derived title always wins, the new title field becomes decorative/ignored, which would confuse admins who typed a title expecting it to stick. This is flagged as needing an explicit plan decision, not asserted as fact. |
| A3 | `sop_review_cadences.category` and `sop-collections.ts`'s category-keyed Collection creation are in-scope for DAT-01's migration (not deferred) | Runtime State Inventory | High if wrong — if the planner treats these as out of scope, governance cadence resolution and org-model collections silently diverge from the new category vocabulary post-migration, with no test coverage currently existing to catch it (see Open Questions) |

**If this table is empty:** N/A — see above, 3 assumptions requiring plan-level confirmation.

## Open Questions

1. **Does `sop_review_cadences` need its own remap, or does it reset to defaults?**
   - What we know: it's a real Postgres table, org-scoped, keyed by `(organisation_id, category)` text, read by `resolveCadenceMonths()` to compute REV-01's review-due dates. Not mentioned anywhere in CONTEXT.md's decisions.
   - What's unclear: whether Simon wants existing per-category cadence overrides preserved (requires a parallel remap using the same D-02 exact/slug/AI-map/null logic) or accepts they reset to the org's default cadence post-migration (simpler, but is a governance-feature regression for any org that customised cadences).
   - Recommendation: surface this explicitly to the planner/discuss-phase before locking the migration script scope — it's a genuine product decision, not an implementation detail.

2. **Do stale `collections` rows (Phase 32 org-model) get renamed, merged, or left orphaned?**
   - What we know: `ensureSopCollectionsForOrg()` auto-creates one Collection node per distinct category value seen; called on grant-assignment and on publish (frozen `publish-core.ts`).
   - What's unclear: whether existing Collection nodes named after now-retired free-text category strings should be renamed to match the new vocabulary, merged where multiple old strings map to one new vocab entry, or left as-is (in which case they'll simply stop gaining new members but won't disappear).
   - Recommendation: same as above — flag for an explicit decision; the safest default is probably "leave existing Collections alone, only new SOPs populate collections named after the new vocabulary" but this should be a stated choice, not an accident.

3. **Does `AdminNav` get added to `/admin/sops/[sopId]/versions` and the pipeline progress page, or do those get a lighter shared shell?**
   - What we know: both currently have SOP-specific contextual back-links (`AdminNav` has no per-SOP concept). Both are named as refactor targets in the phase's "Depends on" list.
   - What's unclear: whether DUP-04's "shared page shell" means literally `<AdminNav active="sops" />` on every route, or a lighter shared header component that these SOP-contextual pages use instead (preserving their "back to this SOP" link while still being ONE component, not five).
   - Recommendation: planner should design a page-shell abstraction that has room for an optional contextual back-link slot, so DUP-04 doesn't regress per-SOP navigation while still satisfying "no route hand-rolls its own back-link."

## Environment Availability

Skipped — this phase has no new external dependencies (code/DB-migration/config changes only; Supabase, already relied upon by the whole app, is the only "external" system touched and is already verified available throughout the existing codebase).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (via `@playwright/test`), per-phase project convention |
| Config file | `playwright.config.ts` (project list; latest phase pattern at `phase37`, line ~501) |
| Quick run command | `npx playwright test --project=phase40` (once registered) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DUP-01 | Same file accepted/rejected identically across all 3 upload surfaces | source-contract sweep (grep for old per-file literal accept-list patterns, assert zero matches outside the one shared module) + unit test on the shared validate function (extension/size/MIME table-driven) | `npx playwright test tests/phase40/dup01-*.spec.ts` | ❌ Wave 0 |
| DUP-02 | Changing a label/option in the picker changes it everywhere | source-contract sweep asserting `PromptClient.tsx`, `WizardClient.tsx`, `VoiceDraftClient.tsx` each import the ONE shared component and contain no local department/category JSX of their own | `npx playwright test tests/phase40/dup02-*.spec.ts` | ❌ Wave 0 |
| DUP-03 | Parse and video-gen jobs report progress through the same component with realtime+polling | source-contract sweep (only one file implements the timer/channel logic) + a channel-mock runtime test exercising the grace-then-poll and stale-watchdog paths | `npx playwright test tests/phase40/dup03-*.spec.ts` | ❌ Wave 0 |
| DUP-04 | Every admin creation route renders the shared shell | source-contract sweep: grep every route file under `src/app/(protected)/admin/sops/**` named in the phase's "Depends on" list for the shared shell import; zero hand-rolled `Back to library`/bespoke-header literals remaining | `npx playwright test tests/phase40/dup04-*.spec.ts` | ❌ Wave 0 |
| DAT-01 | Single category column/vocabulary; every row backfilled | (a) migration-time assertion pinning every clause (per `[2026-07-28]` learning: assert the new column exists, retired columns are either dropped or provably unwritten, AND `sop_review_cadences`/`sop-collections.ts` read sites are repointed) (b) a **live prod query script** — NOT a CI test — proving zero rows carry the retired columns, per SC-5's explicit "against prod" requirement | migration assertion: `npx playwright test tests/phase40/dat01-migration.spec.ts`; prod proof: `node scripts/verify-category-backfill.mjs` (human/operator-run, mirrors `scripts/backfill-owner-review.mjs`'s `.env`-loading pattern) | ❌ Wave 0 (both) |

### Sampling Rate
- **Per task commit:** targeted `npx playwright test --project=phase40` subset for the file(s) touched
- **Per wave merge:** `npx playwright test --project=phase40` (full phase project) + `npx tsc --noEmit` (full scope, not just `next build`'s narrower typecheck — per the `[2026-06-02]` learning)
- **Phase gate:** full suite (`npm run test`) green, `npm run build` clean, AND the prod-query backfill proof script run manually before `/gsd-verify-work` — SC-5 cannot be satisfied by CI alone.

### Wave 0 Gaps
- [ ] Register a `phase40` Playwright project in `playwright.config.ts` with `testMatch: /tests\/phase40\/.*\.(spec|test)\.ts$/` (deliberately broad, per the established convention — verify with `npx playwright test --list --project=phase40` after each plan adds specs)
- [ ] `tests/phase40/dup01-file-intake.spec.ts` — accept-list/size-limit/HEIC source-contract + unit coverage
- [ ] `tests/phase40/dup02-metadata-picker.spec.ts` — single-import-site source-contract sweep
- [ ] `tests/phase40/dup03-job-progress.spec.ts` — single-implementation source-contract sweep + timer-model runtime test
- [ ] `tests/phase40/dup04-page-shell.spec.ts` — AdminNav-import sweep across the 5 non-compliant routes
- [ ] `tests/phase40/dat01-migration.spec.ts` — migration clause-pinning assertions (new column, retired-column write-absence, `sop_review_cadences`/`sop-collections.ts` repoint)
- [ ] `scripts/verify-category-backfill.mjs` — human/operator-run live prod query proving zero rows on retired columns (SC-5), following the `.env`-loading pattern already established in `scripts/backfill-owner-review.mjs`

*(Framework itself is already installed and configured — only phase-specific spec files and the project registration are missing.)*

## Security Domain

> `security_enforcement` not set in `.planning/config.json` → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase touches no auth logic |
| V3 Session Management | No | Not touched |
| V4 Access Control | Yes (indirect) | The migration script and any new server action touching `sop_review_cadences`/`sop-collections.ts` must self-enforce org-scope exactly like the existing code does (`resolveCadenceMonths` and `ensureSopCollectionsForOrg` are already org-scoped reads/writes — do not regress this while repointing the column they read) |
| V5 Input Validation | Yes | The unified file-intake component is the single validation boundary for MIME type/extension/size across all 3 upload surfaces (Zod schema for the new title field on the metadata picker) |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Macro-enabled Office file upload (`.xlsm`/`.xlsb`/etc.) | Tampering | Already mitigated via `BLOCKED_EXTENSIONS` check, consistent across all 3 existing copies — preserve this check verbatim in the unified component |
| Migration script silently cross-tenant-writing during backfill (service-role bypasses RLS) | Elevation of Privilege | The `[2026-06-15]`/`[2026-07-05]` recurring pattern in this repo: any service-role backfill script (D-02's category backfill) must filter/scope by `organisation_id` explicitly per row it touches — service-role has no automatic org-scoping |
| Stale `sop_review_cadences`/`collections` rows referencing retired category strings being read by a role-unaware query | Information Disclosure (low) | Not a new hole (existing org-scoping on both tables already holds), but the migration should not introduce a NEW cross-org read path while repointing columns |

## Sources

### Primary (HIGH confidence — direct file read/grep against this repo)
- `src/components/admin/UploadDropzone.tsx` — accept list, HEIC conversion, size limits (read in full)
- `src/components/admin/VideoFormatSelectionModal.tsx` — accept list, HEIC conversion, size limit (read in full)
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` — accept list outlier, no video/HEIC parity, no AdminNav (read in full)
- `src/components/admin/ParseJobStatus.tsx` — stage-set architecture, realtime+polling model (read in full)
- `src/components/admin/PipelineStepper.tsx` + `PipelineProgressClient.tsx` — second realtime+polling implementation, cross-table stage derivation (read in full)
- `src/components/admin/AdminNav.tsx` — shared nav component, `active` prop shape (read in full)
- `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx`, `WizardClient.tsx`, `VoiceDraftClient.tsx` — 3 picker copies, title/category divergence (read in full)
- `src/app/(protected)/admin/sops/new/page.tsx`, `new/blank/page.tsx`, `new/ai/page.tsx`, `upload/page.tsx` — AdminNav presence/absence verified per route (read in full)
- `supabase/migrations/00003_sop_schema.sql`, `00022_block_library_phase13.sql`, `00043_ownership_review_governance.sql` — `sops.category` origin, `sops.category_tag`/`block_categories` origin, `sop_review_cadences` origin (read/grepped)
- `src/lib/org-model/sop-collections.ts`, `src/actions/governance.ts` — the two undocumented downstream category consumers (grepped + read)
- `src/types/database.types.ts` — confirms both `category` and `category_tag` columns live on `sops` today (grepped)
- `playwright.config.ts` — phase-project registration convention (grepped, `phase34`–`phase37` pattern)
- `npm view heic2any version` — confirms 0.0.4 matches installed version

### Secondary (MEDIUM confidence)
- None — all findings this round were directly verifiable in-repo; no external web research was needed for a pure internal-refactor phase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing dependency versions confirmed against npm registry
- Architecture: HIGH — every claim traced to a specific file/line read in this session
- Pitfalls: HIGH — five of five pitfalls are either directly-observed code patterns or explicitly cross-referenced against this repo's own documented `CLAUDE.md` Learnings entries (not generic advice)

**Research date:** 2026-07-29
**Valid until:** Until Phase 40 executes (this research describes the CURRENT state of code about to be refactored — it goes stale the moment any of the mapped files change, which should be within this same phase's execution window)
