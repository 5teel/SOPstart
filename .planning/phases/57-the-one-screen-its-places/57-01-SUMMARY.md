---
phase: 57-the-one-screen-its-places
plan: 01
subsystem: testing
tags: [playwright, nyquist, evals, rooms, place-address, repoint-inventory]
requires: []
provides:
  - phase57 Playwright project and one stub/live spec per requirement
  - repoint inventory (RETIRED / INVENTORY / LIVE_PLANS) with a completeness guard
  - src/lib/site/rooms.ts (ROOM_IDS, ROOMS, roomPolygon, roomMatches)
  - src/lib/shell/place.ts (Place, parsePlace, formatPlace, placeForPath)
  - tests/evals/one-screen.eval.ts skeleton and EVAL_USERS.siteSupervisor fixture
affects: [57-02, 57-03, 57-04, 57-05, 57-06, 57-07, 57-08, 57-09, 57-10]
tech-stack:
  added: []
  patterns: [comment-stripped inventory walk, fractional room geometry, whitelist address parser]
key-files:
  created:
    - src/lib/site/rooms.ts
    - src/lib/shell/place.ts
    - tests/evals/one-screen.eval.ts
    - tests/phase57/repoint-inventory.spec.ts
    - tests/phase57/rooms.spec.ts
    - tests/phase57/place.spec.ts
    - tests/phase57/search.spec.ts
    - tests/phase57/shell-structure.spec.ts
    - tests/phase57/stage.spec.ts
    - tests/phase57/one-query.spec.ts
    - tests/phase57/departments.spec.ts
    - tests/phase57/machine-body.spec.ts
    - tests/phase57/noticeboard.spec.ts
    - tests/phase57/pins.spec.ts
    - tests/phase57/retirement-sweep.spec.ts
  modified:
    - playwright.config.ts
    - tests/evals/lib/session.ts
    - scripts/eval-fixtures.mjs
key-decisions:
  - "Workshop room polygon moved right of the Smoko room (RESEARCH sketch fractions overlapped it); still one table to tune after reading screenshots"
  - "Five inventory rows planned as delete became repoint because they guard behaviour that survives"
requirements-completed: []
duration: ~35min
completed: 2026-10-04
---

# Phase 57 Plan 01: Wave 0 harness, rooms and place address Summary

phase57 Playwright project with a live stale-guard inventory, an 18-test deployed-eval skeleton plus eval-site supervisor fixture, and two tested pure modules: four fixed fractional rooms and the `?place=` address grammar.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1. Register phase57, inventory, stubs | 875a1bf | 5 inventory tests live and green; 8 stub specs (fixme) |
| 2. Eval skeleton and supervisor fixture | 52901d0 | 18 fixme eval tests listed under the evals project; fixture script parses |
| 3. Rooms and place modules (TDD) | d954824 | rooms 6 + place 9 + search 5 unit tests live and green |

TDD note: RED was confirmed by running the three specs before the modules existed (module not found), but no separate `test(...)` commit was made because a spec importing a missing module would leave `tsc --noEmit` red at that commit; spec and modules landed together as one commit.

## Verification

- `npx playwright test --project=phase57`: 25 passed, 30 skipped (fixme stubs).
- `npx playwright test --list --project=phase57` lists all 12 files under tests/phase57.
- `npx playwright test --list --project=evals tests/evals/one-screen.eval.ts`: 18 tests.
- `npx tsc --noEmit`: exit 0 after every task. `node --check scripts/eval-fixtures.mjs`: ok.
- Mutation check on the inventory: setting LIVE_PLANS to `['57-06']` turns the "retired tokens are gone" and "deleted specs are gone" tests red, listing the stale files; reverted.
- `grep -c "use server\|supabase"` on rooms.ts and place.ts: 0 / 0.

## Redirect-literal spelling sweep

Command (Grep, tests/, `*.spec.ts|*.test.ts|*.eval.ts`):
`redirect[^\n]{0,20}\\?/(dashboard|sops)\W`, plus a multiline form `redirect\(\s*\n\s*['"`]/(dashboard|sops)`.

Real-call hits (all single-quoted, none in other spellings; multiline sweep found nothing):

- dashboard literal: `tests/sb-builder-infrastructure.test.ts:13`, `tests/sb-auth-builder.test.ts:22`, `tests/phase32/org-chart-build.spec.ts:132`, `tests/phase26.5/agent-dashboard.spec.ts:25`, `tests/phase30/role-homes.spec.ts:63` (negative assertion), `tests/phase30/governance-fold.spec.ts:74`, `tests/phase28/governance-queue.spec.ts:69`
- list literal: `tests/sb-builder-infrastructure.test.ts:14`

Prose hits with no opening parenthesis (not tokens): comment lines in `phase28/governance-queue`, `phase32/library-filter-deeplink`, and test titles in `phase41/merged-surface`, `phase41/reference-sweep`, `phase41/nav-and-shim`, `phase28/governance-queue`. Every real-call file is an INVENTORY row; the RegExp tokens match single, double, backtick and regex-escaped-class spellings and do not match `/sops/...` or `/sops?...` (test "the redirect tokens catch every spelling").

## Final INVENTORY (owner plan; disposition)

- 57-02 repoint (informational): phase52/plant-stage
- 57-03 repoint (informational): phase54/governance-inbox
- 57-04 repoint (informational): phase52/plant-now-card
- 57-05 repoint: phase54/admin-machine-panel
- 57-06 repoint: phase30/role-homes, sb-auth-builder.test, phase53/login-next-redirect, phase26.5/agent-dashboard, phase32/org-chart-build, **phase30/admin-nav (was delete)**
- 57-07 repoint: phase51/site-workspace-wiring, phase32/wire-up-mode, phase51/builder-machines-row, lint/no-global-blocks-in-journeys; delete: e2e/admin-departments
- 57-08 repoint: phase30/dead-weight, phase30/create-entry, sb-builder-infrastructure.test, phase43/route-truth, phase23/version-indicator, phase36/no-refresher-gate, phase37/no-competency-gate-worker, phase41/admin-sop-list-action, phase41/bundle-gate, phase52/plant-panel, phase55/worker-path-contract; delete: phase41/merged-surface, phase52/plant-ask-bar, phase36/worker-library-chip
- 57-09 repoint: lint/no-static-admin-lens-import, phase41/nav-and-shim, phase41/reference-sweep, phase28/governance-queue, phase30/governance-fold, phase28/library-and-worker, phase33/sop-drilldown, phase32/banner-slot-stability, phase32/wiring-at-scale, phase33/teams-ladder, phase54/deletion-sweep, **phase52/plant-render-seam, phase54/library-table, phase32/library-filter-deeplink, phase30/list-rows (all four were delete, owner 08)**; delete: phase54/library-table-checks
- 57-10 delete: evals/plant-home, evals/sop-surface; repoint: evals/dead-surface, evals/governance, evals/site-editor, evals/cut-features

## Deviations from Plan

**1. [Rule 1 - Data] Workshop polygon overlapped the Smoko room.** The RESEARCH Pattern 3 fractions put Smoko vertex (0.192, 0.780) inside the Workshop polygon, which the plan's own "no vertex inside another room" behaviour rejects. Moved the Workshop right (x 0.215 to 0.355) and below the tallest machine box (y above 0.82), so it also no longer clips IS Machine 1. Files: `src/lib/site/rooms.ts`. Commit d954824. Still unverified against real screenshots; 57-02 / 57-10 must look at the real-org and eval-site scenes and tune this one table.

**2. [Plan instruction - disposition] Five delete rows became repoint** after reading each file: `phase30/admin-nav` (settings guard and journeys mapping tests survive), `phase52/plant-render-seam` (static-import and no-persister guards survive), `phase54/library-table` ("surviving affordances": BuilderCategoryButton, WorkerScope), `phase32/library-filter-deeplink` (server-side filter and WiringPatchBay deep-link), `phase30/list-rows` (builder action menu, category and department guards). Owners moved to 09 where the file also references 09 tokens. Commit 875a1bf.

**3. TDD commit shape**: single spec-plus-module commit for Task 3 (see TDD note above).

Auth gates: none. The fixture script was not run (57-10 runs it).

## Known Stubs

All `test.fixme` entries in tests/phase57 and tests/evals/one-screen.eval.ts are intentional Wave 0 stubs, each tagged with the plan that fills it.

## Threat Flags

None. T-57-01 (parsePlace whitelist, never echoes the token), T-57-02 (supervisor fixture refuses non-fixture accounts, eval-site org only) and T-57-03 (inventory completeness test) are implemented as planned.

## Self-Check: PASSED

- Files exist: rooms.ts, place.ts, one-screen.eval.ts, all 12 tests/phase57 specs.
- Commits found: 875a1bf, 52901d0, d954824.
