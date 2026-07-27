---
phase: 36-refresher-cadence-version-currency
plan: 04
subsystem: competency
tags: [training-matrix, csv-export, pure-functions, version-currency, refresher-cadence]

# Dependency graph
requires:
  - phase: 36-02
    provides: isOutdatedVersion (version-currency.ts), refresherDueDate/isRefresherOverdue (refresher.ts)
  - phase: 35
    provides: buildMatrix/classifyCompetency training matrix assembler, generateTrainingCsv/csvField CSV generator
provides:
  - MatrixSop.currentVersion / refresherIntervalMonths inputs
  - MatrixCell.isOutdatedVersion / refresherDueAt / isRefresherOverdue derived fields
  - RowRollup/ColRollup.outdatedCount / refresherOverdueCount tallies
  - TrainingCsvRow.onCurrentVersion / refresherDueDate + on_current_version/refresher_due_date CSV columns
affects: [36-05, 36-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derivation layered on a frozen classification ladder: version-currency/refresher fields computed AFTER classifyCompetency() and appended as new counters — never alter state/competentCount/signedOffCount (CMP-03 never-demote rule)"
    - "nowIso resolved once at the top of buildMatrix (not per-cell) so the pure module stays deterministic and unit-testable with a pinned clock"

key-files:
  created: []
  modified:
    - src/lib/competency/matrix.ts
    - src/lib/competency/csv.ts
    - src/lib/competency/__tests__/matrix.test.ts
    - src/lib/competency/__tests__/csv.test.ts
    - src/actions/competency.ts

key-decisions:
  - "competency.ts sops/CSV-row mappings patched with null/false placeholders (Rule 3 blocking-issue fix) so the plan's required interface fields type-check now; 36-05 wires the real DB columns (version, refresher_interval_months) into these same mapping sites"
  - "refresherDueAt is computed from the latest completion regardless of sign-off status (D-03) — a worker is never penalized with an overdue refresher just because a supervisor hasn't signed off yet"
  - "Test extensions (Task 3 behavior) were committed alongside their owning implementation file (matrix.ts+matrix.test.ts, csv.ts+csv.test.ts) rather than as a separate third commit — no value in splitting impl from its own test coverage across commits"

patterns-established:
  - "Additive-only rollup extension: increment new counters alongside existing ones in the same loop iteration, never touch the existing counters' conditions"

requirements-completed: [CMP-03, REF-01, REF-02]

# Metrics
duration: ~10min
completed: 2026-07-27
---

# Phase 36 Plan 04: Version-Currency + Refresher Fields on Matrix/CSV Summary

**Layered isOutdatedVersion + refresherDueAt/isRefresherOverdue derivations onto the pure Phase 35 matrix assembler and CSV generator, with rollup tallies and two new CSV columns — zero changes to the competency classification ladder.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 3 (matrix.ts, csv.ts, test extensions — committed as 2 atomic commits with tests alongside their implementation file)
- **Files modified:** 5

## Accomplishments
- `MatrixCell` now carries `isOutdatedVersion`, `refresherDueAt`, `isRefresherOverdue`, computed from the latest completion per (person, SOP) pair
- `RowRollup`/`ColRollup` gained `outdatedCount`/`refresherOverdueCount`, appended without touching `competentCount`/`signedOffCount`/`needsSupportCount`
- `generateTrainingCsv` emits `on_current_version` (yes/no) and `refresher_due_date` (ISO or empty) as the final two columns, both through `csvField()`
- `classify.ts` remains byte-unchanged — verified via `git diff --stat` empty at every checkpoint

## Task Commits

1. **Task 1: matrix.ts — version-currency + refresher fields** - `2bf4729` (feat) — includes matrix.test.ts extensions and the necessary competency.ts sops-mapping placeholder fix
2. **Task 2: csv.ts — on_current_version + refresher_due_date columns** - `d5c8048` (feat) — includes csv.test.ts extensions and the necessary competency.ts CSV-row placeholder fix

_Note: Task 3 (extend unit tests) content is present in both commits above, alongside the file it tests — see Decisions._

## Files Created/Modified
- `src/lib/competency/matrix.ts` - MatrixSop/BuildMatrixInput/MatrixCell/RowRollup/ColRollup extended with version-currency + refresher fields; `buildMatrix` now builds a `sopsById` map and computes the three derived cell fields per iteration
- `src/lib/competency/csv.ts` - TrainingCsvRow + HEADER + row-mapping array extended with the two new columns
- `src/lib/competency/__tests__/matrix.test.ts` - fixtures updated with `currentVersion`/`refresherIntervalMonths`; 6 new test cases covering outdated/current/no-completion cells, D-02 unset-interval, D-03 overdue-without-signoff, and rollup tallies
- `src/lib/competency/__tests__/csv.test.ts` - fixture updated with new fields; header assertion extended; 3 new test cases for yes/no emission and null/set due-date handling
- `src/actions/competency.ts` - `getTrainingMatrix`'s sops mapping and `exportTrainingCsv`'s row mapping supply placeholder values (`null`/`false`) for the new required fields, ponytail-commented as wired for real in 36-05

## Decisions Made
- Patched `src/actions/competency.ts` (not in this plan's `files_modified` list) with minimal null/false placeholders — this was a direct, unavoidable compile break caused by making `MatrixSop`/`TrainingCsvRow` fields required rather than optional per the plan's exact interface spec. Placeholders preserve current behavior exactly (no outdated flags, no refresher due-dates) until 36-05 wires the real DB columns. Scoped to two 5-line hunks, non-functional otherwise.
- Combined Task 3's test extensions into the commits for Task 1/2 respectively rather than a separate third commit, since each file's tests belong with its implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] competency.ts required placeholder fields to keep `tsc --noEmit` clean**
- **Found during:** Task 1 (matrix.ts) and Task 2 (csv.ts)
- **Issue:** Making `MatrixSop.currentVersion`/`refresherIntervalMonths` and `TrainingCsvRow.onCurrentVersion`/`refresherDueDate` required (non-optional) fields — as the plan's interface spec calls for — broke `src/actions/competency.ts`'s two existing object-literal constructions, which is out of this plan's scope (36-05's job).
- **Fix:** Added `currentVersion: null, refresherIntervalMonths: null` to the sops mapping in `getTrainingMatrix`, and `onCurrentVersion: false, refresherDueDate: null` to the row mapping in `exportTrainingCsv`. Both are ponytail-commented as 36-05 placeholders. Null/false reproduce the exact pre-Phase-36 output (no outdated chip, no refresher due-date) since `isOutdatedVersion`/`refresherDueDate` already treat null inputs as "no data."
- **Files modified:** src/actions/competency.ts
- **Verification:** `npx tsc --noEmit` exits 0; full phase35-unit suite (41 tests) green
- **Committed in:** `2bf4729` (sops-mapping hunk), `d5c8048` (CSV-row hunk)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Necessary and minimal — no logic added beyond type-satisfying placeholders; zero behavior change to the currently-shipped competency matrix/CSV export.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pure derivation layer (matrix.ts, csv.ts) is fully unit-tested and ready for 36-05/36-06 to wire real `currentVersion`/`refresherIntervalMonths` values from the database into `getTrainingMatrix` and `exportTrainingCsv`, replacing the placeholder nulls added here.
- `classify.ts` untouched throughout — the competency ladder remains a single source of truth for state, unaffected by this plan.

---
*Phase: 36-refresher-cadence-version-currency*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/lib/competency/matrix.ts
- FOUND: src/lib/competency/csv.ts
- FOUND: .planning/phases/36-refresher-cadence-version-currency/36-04-SUMMARY.md
- FOUND commit: 2bf4729
- FOUND commit: d5c8048
