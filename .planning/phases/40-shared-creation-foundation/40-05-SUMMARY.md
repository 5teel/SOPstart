---
phase: 40-shared-creation-foundation
plan: 05
subsystem: database
tags: [supabase, next.js, governance, org-model, bundle-size]

# Dependency graph
requires:
  - phase: 40-04
    provides: "sops.category_slug column (migration 00058, applied live), src/lib/sop-categories.ts (SOP_CATEGORIES, categoryLabel, isValidCategorySlug, normaliseToCategorySlug)"
provides:
  - "Every governance/collections/display/filter reader on sops.category_slug instead of the retiring free-text category column"
  - "sop_review_cadences and approval_chains (the two hidden category-keyed settings tables) repointed to slug values, with org-scope pinned by a new test"
  - "ensureSopCollectionsForOrg keyed off category_slug, naming new Collections with the vocabulary label"
  - "dat01-category-column.spec.ts reader-half assertions live (2 of 3 un-fixme'd)"
affects: [40-06, 41-one-sop-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings tables (sop_review_cadences, approval_chains) keep their `category` column name/type; only stored VALUES migrate to slugs (plan 40-06's job) — repointed call sites read/write the column unchanged, just typed as a slug now"
    - "GovernanceRow.category_slug stores the resolved label (via categoryLabel at read time in governance.ts), not the raw slug — consumers render it directly, never re-wrap in categoryLabel"

key-files:
  created: []
  modified:
    - src/actions/governance.ts
    - src/lib/governance/cadences.ts
    - src/lib/governance/publish-core.ts
    - src/app/api/sops/[sopId]/publish/route.ts
    - src/lib/org-model/sop-collections.ts
    - src/app/(protected)/admin/settings/page.tsx
    - src/app/(protected)/admin/sops/page.tsx
    - src/app/(protected)/sops/page.tsx
    - src/components/sop/SopLibraryCard.tsx
    - src/components/sop/tabs/ReadTab.tsx
    - src/components/admin/governance/GovernanceQueueRow.tsx
    - src/hooks/useAssignedSops.ts
    - src/app/api/voice/query/route.ts
    - tests/phase40/dat01-category-column.spec.ts
    - .bundle-baseline.json

key-decisions:
  - "sop_review_cadences.category and approval_chains.category keep their column name/type (00043/00045 schema unchanged) — only the values migrate, via plan 40-06's backfill"
  - "Existing collections rows are never renamed/merged (RESEARCH open question 2) — ensureSopCollectionsForOrg reads category_slug but names NEW collections via categoryLabel(), matching an existing same-named collection by string equality"
  - "GovernanceRow.category_slug holds the resolved LABEL, not the raw slug, computed once in governance.ts — GovernanceQueueRow.tsx renders it directly rather than re-wrapping in categoryLabel"
  - "Recaptured .bundle-baseline.json (1056->1059 KB) to absorb sop-categories.ts entering the worker /sops/[sopId] bundle via ReadTab.tsx's new categoryLabel() call — a one-time, plan-mandated cost, following the script's own established recapture precedent"

patterns-established:
  - "Settings-table selects (sop_review_cadences/approval_chains) are excluded from the .from('sops') category sweep by scoping the regex to the actual table name, not just the bare word 'category'"

requirements-completed: [DAT-01]

# Metrics
duration: 19min
completed: 2026-07-29
---

# Phase 40 Plan 05: Repoint Category Readers Summary

**Governance cadences, approval-chain lookup, org-model Collections, and every display/filter surface now read `sops.category_slug` instead of the retiring free-text `category` column — including the two hidden settings tables (`sop_review_cadences`, `approval_chains`) that a source-only grep would have missed.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-07-29T17:30Z (base commit `9f4bce3`)
- **Completed:** 2026-07-29T17:49Z
- **Tasks:** 2/2
- **Files modified:** 15 (14 source/test files + `.bundle-baseline.json`)

## Accomplishments

- Repointed `resolveCadenceMonths`, `confirmSopCurrent`, `listGovernanceQueue`, and `setReviewCadence`'s vocabulary gate onto `category_slug` (`src/actions/governance.ts`, `src/lib/governance/cadences.ts`)
- Repointed the frozen publish spine's cadence block (`publish-core.ts`, cadence-lines-only diff verified) and the `approval_chains` chain-gate lookup (`publish/route.ts`) — both hidden settings-table consumers now read the slug value while their column names/types stay unchanged (plan 40-06 owns the value remap)
- `ensureSopCollectionsForOrg` reads `category_slug` and names new Collections via `categoryLabel()`, preserving existing admin-customised collections (RESEARCH open question 2 resolved in code)
- Retired the live `DISTINCT sops.category` query on `/admin/settings` in favour of the fixed `SOP_CATEGORIES` seed merged with legacy `approval_chains` keys
- Every worker/admin display surface (`admin/sops`, `sops` list + library card, `ReadTab`, governance queue row, voice-query grounding select) and the offline filter hook (`useAssignedSops`) now read/filter on `category_slug`
- `tests/phase40/dat01-category-column.spec.ts`: un-fixme'd 2 of 3 remaining assertions; added a new assertion pinning `organisation_id` scoping on both hidden settings tables per the CLAUDE.md [2026-07-28] "pin every clause" rule

## Task Commits

1. **Task 1: Repoint the three category-keyed settings consumers** - `783b76a` (feat)
2. **Task 2: Repoint the display and filter surfaces** - `4756d50` (feat)

_No separate plan-metadata commit — orchestrator owns STATE.md/ROADMAP.md updates centrally after the wave merges._

## Files Created/Modified

- `src/actions/governance.ts` - `GovernanceRow.category` renamed to `category_slug` (holds the resolved label); cadence read/write and governance-queue select/map on `category_slug`; `setReviewCadence` gates its input with `isValidCategorySlug`
- `src/lib/governance/cadences.ts` - `resolveCadenceMonths` first param renamed `categorySlug` (lookup logic unchanged)
- `src/lib/governance/publish-core.ts` - cadence block reads `category_slug`; `assertPublishGates` untouched (verified via `git diff`)
- `src/app/api/sops/[sopId]/publish/route.ts` - `approval_chains` lookup keyed by `category_slug`
- `src/lib/org-model/sop-collections.ts` - `ensureSopCollectionsForOrg` reads `category_slug`, names new Collections via `categoryLabel()`
- `src/app/(protected)/admin/settings/page.tsx` - retired the live DISTINCT query; category list sourced from `SOP_CATEGORIES` + legacy chain keys
- `src/app/(protected)/admin/sops/page.tsx` - `SOP_SELECT` lists `category_slug`
- `src/app/(protected)/sops/page.tsx` - `LibrarySop` row + query + meta line render `categoryLabel(sop.category_slug)`
- `src/components/sop/SopLibraryCard.tsx` - meta line renders `categoryLabel(sop.category_slug)`
- `src/components/sop/tabs/ReadTab.tsx` - Category `MetaRow` renders `categoryLabel(sop.category_slug)`
- `src/components/admin/governance/GovernanceQueueRow.tsx` - renders `row.category_slug` directly (already a resolved label from `governance.ts`)
- `src/hooks/useAssignedSops.ts` - filter option renamed `category_slug`; free-text search matches the resolved label
- `src/app/api/voice/query/route.ts` - dropped dead `category`/`category_tag` selects (neither rendered to the model), replaced with `category_slug`
- `tests/phase40/dat01-category-column.spec.ts` - un-fixme'd 2 assertions, added the settings-table org-scope pin, left the `category_tag`-zero-occurrences sweep as `test.fixme`
- `.bundle-baseline.json` - recaptured 1056 -> 1059 KB (see Deviations)

## Decisions Made

- `sop_review_cadences.category` and `approval_chains.category` keep their column name/type — only stored values migrate (plan 40-06)
- Existing `collections` rows are left in place, never renamed/merged; `ensureSopCollectionsForOrg` matches by the vocabulary label so an already-correctly-named collection keeps gaining members
- `GovernanceRow.category_slug` stores the resolved LABEL (not the raw slug) — consumers must not re-wrap it in `categoryLabel()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed `GovernanceQueueRow.tsx`'s `row.category` reference to keep `tsc`/build green**
- **Found during:** Task 1 (immediately after the `GovernanceRow.category` -> `category_slug` rename)
- **Issue:** `GovernanceQueueRow.tsx` (a Task 2-listed file) statically referenced the old `row.category` field; the Task 1 type rename broke it at compile time before Task 2 ran
- **Fix:** Renamed the reference to `row.category_slug`, rendered directly (not re-wrapped in `categoryLabel`, since `governance.ts` already resolves the label at read time) — this satisfies Task 2's "contains category_slug" acceptance criterion for this file without a double-lookup bug
- **Files modified:** `src/components/admin/governance/GovernanceQueueRow.tsx`
- **Verification:** `npx tsc --noEmit` clean
- **Committed in:** `783b76a` (Task 1 commit)

**2. [Rule 1 - Bug avoidance] Refined the un-fixme'd `dat01-category-column.spec.ts` regex to exclude the intentionally-unchanged settings-table selects**
- **Found during:** Task 2 (running the un-fixme'd test)
- **Issue:** The pre-existing `test.fixme`'s regex (`\.select\(['"][^'"]*\bcategory\b(?!_slug)`) matches ANY select string containing bare `category`, including `sop_review_cadences.select('category, months')` — a table this plan deliberately keeps column-name-unchanged. Un-fixming it as written would have failed on correct, plan-mandated code.
- **Fix:** Scoped the check to `.from('sops')...select(...)` chains only (`hasBareCategoryOnSopsSelect`), leaving settings-table selects unaffected
- **Files modified:** `tests/phase40/dat01-category-column.spec.ts`
- **Verification:** `npx playwright test --project=phase40` passes
- **Committed in:** `4756d50` (Task 2 commit)

**3. [Rule 3 - Blocking] Recaptured `.bundle-baseline.json` after the worker-bundle-size gate hard-failed**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `ReadTab.tsx`'s new `categoryLabel()` call (mandated by the plan) pulled `src/lib/sop-categories.ts` into the client bundle for `/sops/[sopId]/page` for the first time, tripping it into its own webpack-shared chunk. First Load JS grew from 1056 KB to 1059 KB — 3 KB over the postbuild gate's ±2 KB tolerance (`scripts/check-bundle-size.ts`, SB-LINE-06)
- **Fix:** Ran `npx tsx scripts/capture-bundle-baseline.ts` to recapture the baseline at 1059 KB, per the script's own documented precedent ("re-captured... to absorb the one-time cost... any further drift is a regression"). Prior baseline (1056 KB) preserved as `previousBaseline` history
- **Files modified:** `.bundle-baseline.json`
- **Verification:** `npm run build` postbuild check passes (`Δ 0 KB`)
- **Committed in:** `4756d50` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking-issue fixes, 1 bug avoidance)
**Impact on plan:** All three were necessary to land Task 1/Task 2 exactly as specified without breaking the build or the test suite. No scope creep — no file outside the plan's stated scope was modified as a result.

## Known Stubs / Gaps

- **`tests/phase40/dat01-category-column.spec.ts`'s "zero occurrences of `category_tag`" sweep remains `test.fixme`.** Investigation found it depends on files outside this plan's scope and outside every other 40-0x plan's `files_modified` list:
  - `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx` reads `initialSop.category_tag` and feeds it into `sopCategory` for `match-blocks.ts`/`BlockPicker.tsx` — the Phase 13 BLOCK LIBRARY's category-tag taxonomy (`area-forming`, `area-machine-repair`, ...), a **different vocabulary** from the `SOP_CATEGORIES` slugs this phase introduces. Renaming this read to `category_slug` would silently break block soft-filtering (wrong vocabulary supplied), not fix a bug — this needs its own decision, not a mechanical rename.
  - `src/app/(protected)/admin/sops/new/ai/page.tsx`'s categories query is explicitly listed in **plan 40-08's** `files_modified` (confirmed by reading `40-08-PLAN.md`) — out of this plan's scope per the `<parallel_execution>` sibling-agent boundary.
  - `src/lib/builder/match-blocks.test.ts`, `src/lib/voice/__tests__/sop-pack.test.ts`, `src/lib/voice/__tests__/voice-qa-cache.test.ts` carry stale `category_tag`/`category` mock fields — harmless (extra properties on mock objects, no type error), not owned by any 40-0x plan's file list.
  - `src/types/database.types.ts`/`src/types/sop.ts` still declare `category_tag`/`category` as `@deprecated` fields — intentional per plan 40-04 (the DB column still exists until plan 40-06's backfill nulls it).
  This is a genuine cross-plan gap, not something to mechanically fix by touching sibling-agent files or files with no clear owner. Recommend the phase orchestrator route `BuilderClient.tsx`'s block-matching-vs-SOP-vocabulary conflict to a follow-up decision before the `category_tag` column is dropped in 40-06.

## Issues Encountered

None beyond the deviations documented above.

## Self-Check

- `src/actions/governance.ts` contains `category_slug` and `isValidCategorySlug` - FOUND
- `src/lib/org-model/sop-collections.ts` contains `categoryLabel(` and `sopRow.organisation_id !== orgId` - FOUND
- `git diff src/lib/governance/publish-core.ts` touches only the cadence block - CONFIRMED (verified during execution)
- Commit `783b76a` - FOUND
- Commit `4756d50` - FOUND
- `npx tsc --noEmit` - clean
- `npm run build` - clean, bundle-size gate passes (Δ 0 KB post-recapture)
- `npx playwright test --project=phase40` - 26 passed, 14 skipped (test.fixme), 0 failed; `spine-freeze.spec.ts` green

## Self-Check: PASSED

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All thirteen reader sites from the plan's objective are on `category_slug`; the frozen publish spine is untouched
- Plan 40-06 (AI-mapping backfill + null-out of the two retired columns) is unblocked — every settings-table and org-model consumer this plan touches already tolerates slug values
- Flagged for the phase orchestrator: `BuilderClient.tsx`'s `category_tag` read feeds a DIFFERENT vocabulary (block-library category tags) than `SOP_CATEGORIES` — needs an explicit decision before 40-06 nulls the column it currently reads from

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
