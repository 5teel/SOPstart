---
phase: 36-refresher-cadence-version-currency
plan: 07
subsystem: competency
tags: [version-currency, refresher-cadence, matrix-ui, axis-swap, cmp-04]

# Dependency graph
requires:
  - phase: 36-04
    provides: MatrixCell/RowRollup/ColRollup isOutdatedVersion/refresherDueAt/isRefresherOverdue fields
  - phase: 36-05
    provides: lineage-widened getTrainingMatrix/getTrainingRecordForPerson/getMyCompetencyStates feeding real (not placeholder) values into StatePill's three call sites
provides:
  - StatePill outdated-version + refresher sibling chips (consumed by TrainingMatrixView, TrainingRecordSection, CompetencySection with zero extra wiring)
  - TrainingMatrixView appended rollup tallies (row + column)
  - TrainingMatrixView transposed axis-swap toggle
  - tests/phase36/matrix-chips-and-axis-swap.spec.ts
affects: [36-08, 36-09, 36-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "StatePillProps.result widened with an intersected Partial<> block so every existing whole-object caller (MatrixCell/RequiredSopRecord/MyCompetencyState) picks up new optional chips automatically — no per-caller prop threading"
    - "Matrix axis-swap is a pure presentation remap (rowItems/colItems derived from people/sops just before render) — matrix.cells/rowRollups/colRollups and the server fetch are untouched; primaryTally() is the only shared helper (RowRollup 'competent' vs ColRollup 'signed off' label divergence), the three appended chip fragments stay literal JSX at each of the two render sites"

key-files:
  created:
    - tests/phase36/matrix-chips-and-axis-swap.spec.ts
  modified:
    - src/components/admin/competency/StatePill.tsx
    - src/components/admin/competency/TrainingMatrixView.tsx

key-decisions:
  - "Refresher/outdated chips render via bare {flag && <span/>} JSX guards only — no if-branch, no comparison, no disabled/onClick — mechanically proven by this plan's own GATE_PATTERN + attribute-substring assertions (mirrors tests/phase36/no-refresher-gate.spec.ts's idiom, which doesn't cover StatePill.tsx/TrainingMatrixView.tsx directly)"
  - "isCompact keys off colItems.length (the orientation-aware column count) instead of a hardcoded sops.length, closing the D-07 pitfall for the transposed shape"
  - "Folded todo moved to .planning/todos/completed/ (matching the existing completed/pending/resolved convention already in the repo, not a new done/ directory)"

requirements-completed: [CMP-03, REF-01, TRN-03]

# Metrics
duration: ~30min
completed: 2026-07-27
---

# Phase 36 Plan 07: Version-Currency + Refresher Chips, Rollup Tallies, Axis-Swap Summary

**Surfaced version-currency and refresher-due state as informational sibling chips on the existing competency pill (lighting up all three consuming surfaces in one change), appended outdated/refresher-overdue tallies to both matrix rollup axes, and closed a folded 2026-07-26 UAT todo by adding a presentation-only axis-swap toggle to the training matrix.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 (all auto)
- **Files modified:** 2 (StatePill.tsx, TrainingMatrixView.tsx), 1 created (matrix-chips-and-axis-swap.spec.ts)

## Accomplishments
- `StatePill` renders up to two new informational sibling chips — "Outdated version" (`--accent-voice`, orange) and "Refresher due {date}" / "Refresher overdue" (`--accent-decision`, amber, never red) — without ever changing the primary pill's label/colour/state (D-04). Because `TrainingMatrixView.tsx`, `TrainingRecordSection.tsx`, and `CompetencySection.tsx` all already spread whole objects (`MatrixCell`/`RequiredSopRecord`/`MyCompetencyState`) into `StatePill`, all three surfaces inherit the chips automatically.
- Both `TrainingMatrixView` rollup axes (column-header and sticky-row) append `· {N} on outdated version` and `· {N} refresher overdue` fragments, rendered only when their count is > 0, alongside the unchanged `signed off`/`competent`/`needs support` fragments (D-05 additive tally).
- Added a `transposed` axis-swap toggle (`Swap rows/columns`, `aria-pressed`) next to the Export CSV button, closing `.planning/todos/pending/2026-07-26-matrix-axis-swap.md`. The transpose is a pure presentation remap: `rowItems`/`colItems` are derived from `people`/`sops` immediately before render, `cellFor`/`onSelectCell` still resolve `(personId, sopId)` in their original semantic order, and `isCompact` now multiplies `COLUMN_WIDTH_PX` by `colItems.length` (the orientation-aware column count) instead of a hardcoded `sops.length`.
- `tests/phase36/matrix-chips-and-axis-swap.spec.ts` — 14 live source-contract assertions covering chip presence, the no-gate/no-disabled/no-onClick guard, undefined-CSS-token safety, appended rollup fragment counts, and axis-swap wiring (`transposed` state, `aria-pressed`, `isCompact` orientation-awareness, `onSelectCell` argument order, and the folded todo's removal from `pending/`).

## Task Commits

1. **Task 1: StatePill — outdated-version and refresher-due sibling chips** - `b97445d` (feat)
2. **Task 2: TrainingMatrixView — appended rollup tallies** - `dbd038e` (feat)
3. **Task 3: Axis-swap toggle + source-contract guard** - `13d55af` (feat)

## Files Created/Modified
- `src/components/admin/competency/StatePill.tsx` - widened `StatePillProps.result` with an optional `Partial<{isOutdatedVersion, refresherDueAt, isRefresherOverdue}>`; two new sibling chips
- `src/components/admin/competency/TrainingMatrixView.tsx` - appended rollup tally fragments (both axes); `transposed` state + toggle; `rowItems`/`colItems` presentation remap; `primaryTally()` helper; `isCompact` orientation fix
- `tests/phase36/matrix-chips-and-axis-swap.spec.ts` - new source-contract spec (auto-registered under the existing `phase36` Playwright project regex)
- `.planning/todos/completed/2026-07-26-matrix-axis-swap.md` - moved from `pending/` (folded todo closed)

## Decisions Made
- Kept the three appended rollup-tally chip fragments (`needsSupport`/`outdated`/`refresherOverdue`) as literal duplicated JSX at both the column-header and sticky-row render sites, rather than extracting them into one shared render function — preserves the exact `grep -c "on outdated version" == 2` / `grep -c "refresher overdue" == 2` acceptance contract from Task 2 through the Task 3 rewrite. Only the primary-tally label ("competent" vs "signed off") was factored into a small `primaryTally()` helper, since that's the one piece that genuinely diverges by rollup kind.
- Folded todo moved to `.planning/todos/completed/` rather than a new `done/` directory — matches the pre-existing `completed/`/`pending/`/`resolved/` convention already in the repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a stray "--accent-escalate" mention from StatePill.tsx's own header comment**
- **Found during:** Task 3 (writing the source-contract spec and running it against Task 1's code)
- **Issue:** Task 1's updated header comment said "...--accent-decision — coaching, never --accent-escalate/red...", which is prose, not code, but it still tripped the plan's own acceptance criterion `grep -c "accent-escalate" == 0`.
- **Fix:** Reworded the comment to "...coaching, never a red/alarm tone..." — same intent, no literal token match.
- **Files modified:** `src/components/admin/competency/StatePill.tsx`
- **Commit:** `13d55af`

**2. [Rule 1 - Bug] Adjusted the "no disabled/onClick" spec assertion to check attribute usage, not prose**
- **Found during:** Task 3, first spec run
- **Issue:** `StatePill.tsx`'s pre-existing (Phase 35) header comment reads "No onClick, no disabled/lock affordance" — a bare `.not.toContain('disabled')`/`.not.toContain('onClick')` substring check matched that documentation, not real code.
- **Fix:** Narrowed the spec to `onClick=` and `/\bdisabled[=>]/` (actual JSX attribute usage), which still catches a real gate but ignores prose.
- **Files modified:** `tests/phase36/matrix-chips-and-axis-swap.spec.ts`
- **Commit:** `13d55af`

## Issues Encountered
None beyond the two auto-fixed issues above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All three competency surfaces (matrix, per-worker record panel, worker profile) now display outdated-version/refresher chips with zero further wiring, since `StatePill` is the single shared renderer.
- The matrix's rollup tallies and axis-swap toggle are ready for any downstream UAT; `tests/phase36/version-breakdown-panel.spec.ts`'s "versions page wires the breakdown panel" assertion remains `test.skip`-guarded for 36-09.
- `npm run build` clean; bundle size `/sops/[sopId]/page` unchanged class (1057 KB, within ±2 KB tolerance) — this plan touches only admin-side components, so the worker bundle was expected to be unaffected.

---
*Phase: 36-refresher-cadence-version-currency*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/components/admin/competency/StatePill.tsx
- FOUND: src/components/admin/competency/TrainingMatrixView.tsx
- FOUND: tests/phase36/matrix-chips-and-axis-swap.spec.ts
- FOUND: .planning/todos/completed/2026-07-26-matrix-axis-swap.md
- FOUND commit: b97445d
- FOUND commit: dbd038e
- FOUND commit: 13d55af
