---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 01
subsystem: testing
tags: [playwright, evals, fixtures, repoint-inventory, baseline]
requires: []
provides:
  - phase63 Playwright project (tests/phase63/**)
  - repoint inventory (69 files, retire/repoint with owning plans)
  - ensureLibraryAreas eval fixture
  - home / home-addresses / start eval skeletons
  - 63-BASELINE.md
affects: [63-02..63-21]
tech-stack:
  added: []
  patterns: [repoint-inventory guard (60-01 style), own-marker fixture guard]
key-files:
  created:
    - tests/phase63/repoint-inventory.spec.ts
    - tests/evals/lib/library-fixture.ts
    - tests/evals/home.eval.ts
    - tests/evals/home-addresses.eval.ts
    - tests/evals/start.eval.ts
    - .planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/63-BASELINE.md
  modified:
    - playwright.config.ts
key-decisions:
  - "Retire rows are exempt from the stale-token check until their owner is live (a file slated for deletion is not stale)"
  - "Row owner: evals -> 63-18; spec edits for 63-13/14/16 tokens -> that plan; room-code specs retired or repointed -> 63-19; specs that import the place module -> 63-20"
requirements-completed: [GATE-01, EVAL-01]
duration: 40min
completed: 2026-10-08
---

# Phase 63 Plan 01: Wave 0 harness Summary

**phase63 Playwright project, a 69-file repoint inventory, untouched-tree baselines, a four-area eval-site fixture and three named eval skeletons.**

## Accomplishments

- `phase63` project registered with a broad `tests/phase63/**` match; `repoint-inventory.spec.ts` passes (4 tests) with `LIVE_PLANS = []`.
- Inventory: 69 files (19 retire, 50 repoint). By owner: 63-13 x3, 63-14 x11, 63-16 x1, 63-18 x8 (evals, one retired), 63-19 x43, 63-20 x4. 40 RETIRED tokens across plans 63-11..63-20.
- Baseline (`63-BASELINE.md`): bundle `/sops/[sopId]/page` 795 KB (baseline 795, d 0), `/page` 836 KB (baseline 834, d +2, at tolerance edge). Phases 52/57/58/59/60: 724 passed, 25 skipped, 0 failed (no environment failures).
- `ensureLibraryAreas(db)`: eval-site org only (refuses the real org), departments `EVAL Area Packing` / `EVAL Area Lab`, three published SOPs with four focus steps each (guard on the `new:eval-area-` marker), packing and lab tagged to their department, site-wide untagged. Run live twice against the eval-site org: idempotent, 12 steps. The existing machine-linked SOP supplies the fourth area (Forming).
- Skeletons: `home.eval.ts` 10 fixme, `home-addresses.eval.ts` 4, `start.eval.ts` 4; all listed by the evals project.

## Task Commits

1. Task 1: `dc90d1c5` test(63-01): phase63 project, repoint inventory and untouched-tree baselines
2. Task 2: `33031b2e` test(63-01): multi-area eval fixture and the three Phase 63 eval skeletons

## Sibling-eval edits

None. Every counting assertion was read: the only ones that count the eval-site org's rows are `office.eval` ledger polls (`>=`, `> before`), `one-screen.eval` pin counts (retired by 63-18), and `site-templates.eval` (its own throwaway org). The new rows are owned by the org admin (no "No owner" inbox row) and carry the `EVAL area` prefix.

## Deviations from Plan

- Inventory owners differ slightly from the plan's loose wording: no row is owned by 63-20 except the place-module importers (4 rows); the plan's acceptance count (`plan: '63-20'` >= 20 lines) is met by the RETIRED token lines (27).
- GATE-01 and EVAL-01 are NOT ticked in REQUIREMENTS.md: both span plans through 63-21 (CLAUDE.md 2026-09-28: tick only when proven). This plan delivers their Wave 0 half.
- `state.advance-plan` could not parse STATE.md (it still reads Phase 60/61); progress, metric and session were recorded, the plan pointer was left for the orchestrator.
- Added a retire-row exemption to the stale-token test (and a "retired specs are gone" test) so a spec slated for deletion by 63-19 does not trip 63-18's live check.

## Known Stubs

All 18 eval cases are `test.fixme` by design; owners are named in each file header.

## Issues Encountered

None.

## Self-Check: PASSED

Files exist; commits `dc90d1c5` and `33031b2e` present; `.bundle-baseline.json` untouched; `npx tsc --noEmit` exits 0.
