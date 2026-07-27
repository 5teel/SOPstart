---
phase: 36-refresher-cadence-version-currency
plan: 06
subsystem: competency
tags: [version-currency, refresher-cadence, csv-export, trn-03, admin-client]

# Dependency graph
requires:
  - phase: 36-05
    provides: resolveLineage() batched lineage resolver, lineage-widened competency reads
  - phase: 36-04
    provides: TrainingCsvRow.onCurrentVersion/refresherDueDate fields + csv.ts headers (placeholders)
provides:
  - exportTrainingCsv on_current_version / refresher_due_date columns populated from real lineage data
  - getVersionCompletionBreakdown(sopId) — per-version completion counts + worker lists (TRN-03)
  - VersionCompletionBreakdown interface
affects: [36-09, 36-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "exportTrainingCsv widens its existing sops fetch (already keyed on distinct completion sop_ids) with version/parent_sop_id/refresher_interval_months and feeds it straight into resolveLineage() — no second lineage query introduced"
    - "getVersionCompletionBreakdown groups completions by the ACTUAL sop_id (per-version reporting), never remapped through canonicalBySopId — the opposite convention from the matrix/record reads, which DO remap onto the canonical current sop"
    - "TRN-03 read uses the versions page's existing STRICTER ['admin','safety_manager'] gate, not RECORDER_ROLES — mechanically enforced by a source-contract spec asserting both the gate string and the absence of RECORDER_ROLES in the function body"

key-files:
  created: []
  modified:
    - src/actions/competency.ts
    - tests/phase36/version-breakdown-panel.spec.ts

key-decisions:
  - "completionCount on VersionCompletionBreakdown counts DISTINCT workers per version (deduped by worker_id, keeping the latest submitted_at), not raw completion-row count — matches the requirement wording 'how many workers completed each version and who they were'"
  - "onCurrentVersion/refresherDueDate in the CSV export resolve each completion's canonical lineage entry via lineage.canonicalBySopId, then read currentVersionBySopId/refresherIntervalBySopId off that canonical id, falling back to the completion's own fetched sop row if no canonical mapping exists (defensive; resolveLineage's algorithm always sets one for every input row)"

requirements-completed: [TRN-03, REF-01, CMP-03]

# Metrics
duration: ~15min
completed: 2026-07-27
---

# Phase 36 Plan 06: CSV Version-Currency Columns + TRN-03 Breakdown Read Summary

**Populated the CSV export's `on_current_version`/`refresher_due_date` columns from real lineage data (replacing the 36-04 placeholders) and added `getVersionCompletionBreakdown`, the one TRN-03 read with no prior home, gated to the versions page's existing stricter admin/safety_manager boundary.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (both auto)
- **Files modified:** 2 (src/actions/competency.ts, tests/phase36/version-breakdown-panel.spec.ts)

## Accomplishments
- `exportTrainingCsv`'s `sops` fetch widened to `version, parent_sop_id, refresher_interval_months`, fed through the existing `resolveLineage()` helper (still exactly one `parent_sop_id.in.` query in the file) — each completion row resolves its canonical lineage entry, then reads current version / refresher interval off that entry to compute `onCurrentVersion` (via `isOutdatedVersion`) and `refresherDueDate` (via `refresherDueDate()`), falling back to the completion's own sop row when no canonical mapping exists
- `getVersionCompletionBreakdown(sopId)` added: verifies the caller-supplied `sopId` belongs to the caller's org BEFORE any further read, resolves the lineage, fetches completions across the whole lineage, groups by the ACTUAL sop_id (per-version, not canonical-remapped), dedupes to distinct workers per version (latest completion kept), marks `isCurrent` off the requested SOP's own `version`, and orders versions descending
- Role gate is `['admin', 'safety_manager']` (the versions page's existing boundary), explicitly NOT `RECORDER_ROLES` — commented inline with the rejected alternative and why (RESEARCH Open Question 1)
- `tests/phase36/version-breakdown-panel.spec.ts` activated live: export presence, `['admin', 'safety_manager']` gate string present / `RECORDER_ROLES` absent, org self-enforcement filter present, no write calls (`.update(`/`.insert(`/`.delete(`) present in the function body

## Task Commits

1. **Task 1: Populate on_current_version and refresher_due_date in exportTrainingCsv** - `3518bb4` (feat) — note: this commit also carries Task 2's `getVersionCompletionBreakdown` addition to `competency.ts` (see Deviations)
2. **Task 2: getVersionCompletionBreakdown (TRN-03) + live panel-action guard** - `20c73d2` (feat) — the `tests/phase36/version-breakdown-panel.spec.ts` half of this task

## Files Created/Modified
- `src/actions/competency.ts` - `exportTrainingCsv` lineage-widened for CSV columns; `getVersionCompletionBreakdown` + `VersionCompletionBreakdown` added
- `tests/phase36/version-breakdown-panel.spec.ts` - two new live assertions added (org self-enforcement, read-only) alongside the three Wave-0 assertions that self-activated

## Decisions Made
- `completionCount` = distinct worker count (not raw completion-row count) to match the requirement's "how many workers completed each version and who they were" framing; multiple completion events by the same worker against the same version collapse into one worker entry, keeping the latest `completedAt`.
- Fallback-to-own-sop-row logic in the CSV path is defensive: `resolveLineage`'s algorithm always populates `canonicalBySopId` for every input row, so the fallback is a belt-and-suspenders guard rather than a commonly-hit path.

## Deviations from Plan

### Auto-fixed Issues
None — both tasks' logic executed exactly as specified.

### Process note (not a code deviation)
Both tasks modify `src/actions/competency.ts`, and both edits were made to the file before the first commit checkpoint (verification was run once across both changes). As a result, Task 1's commit (`3518bb4`) contains the full `competency.ts` diff for both tasks, and Task 2's commit (`20c73d2`) contains only the spec-file half of Task 2. All code and test content described by both tasks is present and verified; only the commit boundary is imperfect relative to the plan's per-task file list. No functional impact.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CSV export now carries real version-currency/refresher data for every completion row (D-05/D-07 audit requirement closed).
- `getVersionCompletionBreakdown` is ready for 36-09 to wire into the versions page UI; the panel-side assertion in `version-breakdown-panel.spec.ts` remains `fs.existsSync`-guarded (skipped) until that plan renders it.
- `tests/phase36/version-currency-lineage.spec.ts`'s runtime probe (36-10) can now exercise the fully lineage-widened CSV + breakdown paths.

---
*Phase: 36-refresher-cadence-version-currency*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/actions/competency.ts
- FOUND: tests/phase36/version-breakdown-panel.spec.ts
- FOUND commit: 3518bb4
- FOUND commit: 20c73d2
