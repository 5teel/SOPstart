---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 10
subsystem: testing
tags: [deployed-eval, phase-gate, screenshots, validation, decision-ledger]
requires: [56-07, 56-08, 56-09]
provides:
  - Completed tests/evals/sop-ledger.eval.ts (six areas, two minted sessions)
  - 56-EVAL.md (34 passed / 0 failed / 1 skipped on the pushed HEAD fa65313)
  - Signed-off 56-VALIDATION.md (nyquist_compliant true, status complete)
  - CLAUDE.md data-model bullets and a Learnings entry
affects: []
key-files:
  created:
    - .planning/phases/56-a-simpler-sop-the-decision-ledger/56-EVAL.md
    - src/lib/builder/block-findings.ts
  modified:
    - tests/evals/sop-ledger.eval.ts
    - scripts/verify-gate-check.tsx
    - src/actions/sop-section-blocks.ts
    - .planning/phases/56-a-simpler-sop-the-decision-ledger/56-VALIDATION.md
    - CLAUDE.md
key-decisions:
  - "Eval A scopes to SOPs created before the last conversion run: the converter runs on demand until Phase 58, and two post-apply Phase46 probe SOPs (leaked by rate-limited live probes in the same gate run) are out of scope"
  - "The two gate regressions were fixed at their cause (harness collaborator stub; admin read moved to a plain module), not by loosening the route or the guard"
requirements-completed: [SOP-01, SOP-02, SOP-03, DEC-01, DEC-03, DEC-04]
duration: ~70 min
completed: 2026-10-04
---

# Phase 56 Plan 10: Phase gate Summary

**The deployed eval proves all five success criteria on sopstart.com (six sop-ledger tests green on pushed HEAD fa65313), the full suite is back inside the Phase 55 baseline after two gate regressions were fixed, and every ledger screenshot was read.**

## Eval result

`npm run eval -- --phase 56` against `https://sopstart.com`, commit `fa65313`: **34 passed / 0 failed / 1 skipped** (the skip is the pre-existing "org with no site" plant test). The six sop-ledger tests:

| Test | Proves |
|---|---|
| A | Every SOP that predates the last run has an ok latest conversion run (70 of 72; the 2 newer are probe residue); convert fixture hazard 4 / ppe 1 (both items) / check 1 / one photo step; each warning hazard sorts before its step; `after.hazard` >= `before.hazardSources`; 32 library-linked SOPs all converted |
| B | Old SOP page and builder still render the fixture's original content; each step appears once; the walk counter reads `of 2` |
| C | Standard add, attach to SOP and a section, worker sees the label (SOP line, Read heading, walk meta row), rename shows `EVAL LOTO 2` and not `EVAL LOTO`, remove takes it away |
| D | Plant fixture shows `EVAL Press · Forming`; walk fixture shows `Whole site` |
| E | Owner change through `/governance`, completion rejection through `/activity/<id>`, and an AI write through `/api/ai-fields/write` each wrote exactly one decision naming the actor; the AI one is `actor_kind=agent`, `actor_name=SOPstart assistant` |
| F | Backfilled ledger non-empty; service-key UPDATE and DELETE on the oldest decision refused with the row unchanged; unnamed agent insert refused with `23514` |

## Screenshots read

All 13 `ledger-*.png` files were opened; verdicts are in `56-EVAL.md` ("Screenshots read"). None shows a missing tint, invisible control, overflow or overlapping text. One cosmetic note: in `ledger-c-panel.png` the builder Tools menu popover stays open behind the Standards modal (not a failure, not fixed here).

## Full suite (run once) vs 55-BASELINE-FAILURES.md

First run: 1846 passed / 23 failed / 193 skipped.

- **Live probes:** 6 `phase46` specs, all `verifyOtp ... rate limit` (environment, baseline lists 8).
- **Non-live baseline failures (14):** phase11-stubs (8: sb-auth-builder, sb-layout-editor x6, sb-section-schema), phase12.5-stubs (5: sb-ux-blocks x4, sb-ux-blueprint), phase25-integration wizard sentinel (1). All are in the baseline list.
- **New non-live failures (2 tests, 3 rows):** found and fixed before the eval (below). Re-run once on the affected projects only (phase26, phase20-parsers, phase21-unit, phase56, phase15-stubs): 304 passed.

The non-live failure list is now a subset of 55-BASELINE-FAILURES.md.

## Deviations from Plan

**1. [Rule 1 - Bug] `verify-gate-check.tsx` crashed on `server-only`**
- **Found during:** full-suite gate (`tests/phase26/verify-gate.spec.ts`).
- **Issue:** `publish-core` now calls `recordDecision` (56-05), which imports `server-only`; that package is not installed, so the tsx harness could not load the real publish route.
- **Fix:** the harness's `Module._load` collaborator list stubs `lib/decisions/record`. The route is untouched.
- **Commit:** `e624ca4`

**2. [Rule 1 - Bug] Admin client inside `src/actions/sop-section-blocks.ts`**
- **Found during:** full-suite gate (`parser-creates-junctions.test.ts`, projects phase20-parsers and phase21-unit).
- **Issue:** 56-08's `findingsFor` read `parse_jobs` with `createAdminClient()` in the action file, tripping the Phase 46 CR-01 guard.
- **Fix:** moved the read to the plain module `src/lib/builder/block-findings.ts` (same session-org filter); the action imports it. `verifyBlock` / `unverifyBlock` signatures unchanged. `npm run build` clean, bundle gate unchanged (818 KB vs 817 KB baseline, +1 KB).
- **Commit:** `e624ca4` (pushed before the eval so `/api/version` matched)

**3. [Eval scope] Test A excluded SOPs created after the last conversion run.** The first eval run failed on two `Phase46 approver-edit probe SOP` rows created by the same gate run's rate-limited live probes after the production apply. The converter runs on demand until Phase 58, so those are out of scope. Commit `6b463e3`.

**4. [Eval locator] Test B opened the Procedure section first.** The builder canvas shows one section at a time (Hazards first); the `Hydraulic pressure` assertion needed the rail click. Commit `fa65313`.

## Side effects in production

- Eval-site org only: decisions written by the eval are permanent by design (several owner_change / reject / ai_field_write rows from the iterations). `EVAL LOTO%` standards, the eval completion, the plant owner and the draft title were all reset by the eval's afterAll.
- Two leaked throwaway orgs/SOPs from the rate-limited `phase46` probes during the full-suite run (`Phase46 Junction Reorder Org 1791073049890` / `Non-Approver Org 1791073051818`), the same pre-existing leak pattern as the 30+ older ones. Not cleaned up here.

## A-05 limit

Step-level standard labels show in the Standards panel only this phase; the old walk renders the original rows, so step labels reach the walk with the Phase 58 focus screen.

## Commits

- `e5a4854` test(56-10): complete the deployed sop-ledger eval
- `e624ca4` fix(56-10): clear the two regressions the phase gate found
- `6b463e3` test(56-10): scope eval A to SOPs that predate the last conversion run
- `fa65313` test(56-10): open the Procedure section before asserting the builder canvas

## Known Stubs

None.

## Threat Flags

None. T-56-15 (org guard), T-56-18 (two sessions, suite once) and T-56-27 (permanent eval decisions, eval-site org only) as planned.

## Self-Check: PASSED

- sop-ledger.eval.ts, 56-EVAL.md, 56-VALIDATION.md (nyquist_compliant true), block-findings.ts present; `grep -c test.fixme` 0; `signInAs(` count 2; `recordDecision` in CLAUDE.md.
- Commits e5a4854, e624ca4, 6b463e3, fa65313 on master and pushed.
