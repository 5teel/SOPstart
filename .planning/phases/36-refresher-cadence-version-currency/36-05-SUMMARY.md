---
phase: 36-refresher-cadence-version-currency
plan: 05
subsystem: competency
tags: [version-currency, refresher-cadence, evidence-orphaning, rls, admin-client]

# Dependency graph
requires:
  - phase: 36-02
    provides: isOutdatedVersion (version-currency.ts), refresherDueDate/isRefresherOverdue (refresher.ts)
  - phase: 36-04
    provides: MatrixSop.currentVersion/refresherIntervalMonths inputs, RequiredSopRecord/MyCompetencyState placeholder shape
provides:
  - resolveLineage() — batched, org-scoped version-lineage resolver
  - lineage-widened getTrainingMatrix / getTrainingRecordForPerson / getMyCompetencyStates
  - RequiredSopRecord.isOutdatedVersion/refresherDueAt/isRefresherOverdue
  - MyCompetencyState.isOutdatedVersion/refresherDueAt/isRefresherOverdue
affects: [36-06, 36-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lineage resolution is flat (root = parent_sop_id ?? id), one batched .or(parent_sop_id.in.(...),id.in.(...)) query — never a recursive walker or per-SOP loop"
    - "Evidence rows are remapped onto the canonical (current) required sop id BEFORE reaching the pure layer — matrix.ts/classify.ts never learn about versions"
    - "A root shared by two required rows (lingering superseded-version junction) attributes to the HIGHEST-version required row, preventing double-counted evidence"
    - "Currency comes solely from the monotonic `version` integer, never `superseded_by` (unset by cloneSopAsDraft/performPublish)"

key-files:
  created:
    - tests/phase36/lineage-widening.spec.ts
  modified:
    - src/actions/competency.ts

key-decisions:
  - "getMyCompetencyStates calls resolveLineage with the SESSION client and orgId=null — org_members_can_view_sops already grants org-wide SELECT on sops, so lineage resolution needs no admin client and the self-scoped/no-admin-client posture (D-04) is preserved"
  - "getTrainingRecordForPerson's completions/observations fetch stays UNSCOPED by sop_id (as before) — the orphaning bug there was in the GROUPING (raw sop_id key), not the query, so only the grouping keys and a small extra 'other sop' title lookup changed"
  - "Refresher due-date clock is always the latest COMPLETION (D-03), computed identically in all three reads: getTrainingRecordForPerson, getMyCompetencyStates, and matrix.ts's buildMatrix (36-04)"

patterns-established:
  - "resolveLineage is the single lineage-resolution seam for all three competency reads — any future competency read must call it rather than re-deriving parent_sop_id chains inline"

requirements-completed: [CMP-03, REF-01, REF-02]

# Metrics
duration: ~25min
completed: 2026-07-27
---

# Phase 36 Plan 05: Lineage-Widened Competency Evidence Reads Summary

**Closed the evidence-orphaning gap (CMP-03) by adding a batched, org-scoped `resolveLineage()` helper and wiring it into all three competency reads, so a worker's pre-supersede completions/observations never silently reset to `not_started` the instant a SOP is republished.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 (all auto)
- **Files modified:** 1 (src/actions/competency.ts), 1 created (tests/phase36/lineage-widening.spec.ts)

## Accomplishments
- `resolveLineage()` — module-private helper computing `allSopIds`, `canonicalBySopId`, `currentVersionBySopId`, `refresherIntervalBySopId` from one batched `.or('parent_sop_id.in.(...),id.in.(...)')` query, org-scoped when an admin client calls it
- `getTrainingMatrix` fetches `version`/`parent_sop_id`/`refresher_interval_months` on the same `sops` query, widens completion/observation filters to `lineage.allSopIds`, and remaps rows onto the canonical current sop before assembling `MatrixCompletion`/`MatrixObservation` — replacing the 36-04 null/false placeholders with real DB-backed values
- `getTrainingRecordForPerson`'s `completionsBySop`/`observationsBySop` grouping now keys through `canonicalBySopId`, so a completion against a superseded sop_id attributes to the current required SOP instead of falling into `otherCompletedSops`; `RequiredSopRecord` gained `isOutdatedVersion`/`refresherDueAt`/`isRefresherOverdue`
- `getMyCompetencyStates` widened WITHOUT an admin client — `org_members_can_view_sops`'s org-wide SELECT already lets the session client see superseded lineage rows, preserving the self-scoped/no-admin-client posture (D-04); `MyCompetencyState` gained the same three derived fields
- `tests/phase36/lineage-widening.spec.ts` — 9 source-contract assertions proving `resolveLineage` is wired into all three function bodies separately (not a whole-file grep), the lineage query is batched exactly once, org self-enforcement is present, and `getMyCompetencyStates` still contains no `createAdminClient(`

## Task Commits

1. **Task 1: resolveLineage helper + lineage-widened getTrainingMatrix** - `6554a6e` (feat)
2. **Task 2: Lineage-widen getTrainingRecordForPerson** - `6f67326` (feat)
3. **Task 3: Lineage-widen getMyCompetencyStates + source-contract guard** - `df20340` (feat)

## Files Created/Modified
- `src/actions/competency.ts` - `resolveLineage()` helper added; `getTrainingMatrix`, `getTrainingRecordForPerson`, `getMyCompetencyStates` all lineage-widened; module header updated to document the Phase 36 posture
- `tests/phase36/lineage-widening.spec.ts` - source-contract guard (new file, auto-registered under the existing `phase36` playwright project regex)

## Decisions Made
- Kept `getTrainingRecordForPerson`'s completion/observation queries unscoped by sop_id exactly as before (per the plan's framing: the bug was in the grouping, not the fetch) — only added the required-sop-rows fetch (for lineage inputs) and a small follow-up query for non-required "other" sop titles.
- `resolveLineage`'s `client` parameter is typed `any` (matches the existing admin-client `any`-cast convention throughout this file) so it accepts both the admin client and the plain session client without a union type.

## Deviations from Plan
None — plan executed exactly as written. Two minor TypeScript inference issues (an unassignable type-predicate against `MatrixCompletion`/`MatrixObservation` after a `.map().filter(null)` chain) were fixed inline during Task 1 by switching to `NonNullable<typeof x>` predicates, the same pattern already used elsewhere in this file — not a deviation from plan intent, just an implementation detail.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three competency reads are lineage-widened, org-scoped, and mechanically guarded — 36-06 (CSV export widening) and 36-10 (the `version-currency-lineage.spec.ts` fixme runtime probe) can now build on real `isOutdatedVersion`/`refresherDueAt`/`isRefresherOverdue` values instead of the 36-04 placeholders.
- `exportTrainingCsv`'s `onCurrentVersion`/`refresherDueDate` placeholders (added in 36-04) were NOT touched by this plan — they are out of scope here (36-05's `files_modified` covers `getTrainingMatrix`/`getTrainingRecordForPerson`/`getMyCompetencyStates` only) and remain 36-06's job.

---
*Phase: 36-refresher-cadence-version-currency*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/actions/competency.ts
- FOUND: tests/phase36/lineage-widening.spec.ts
- FOUND commit: 6554a6e
- FOUND commit: 6f67326
- FOUND commit: df20340
