---
phase: 60-requests-notifications-objectives
plan: 01
subsystem: testing
tags: [playwright, nyquist, wave-0, eval-fixtures, repoint-inventory]
requires: []
provides:
  - phase60 Playwright project (broad testMatch, live probe self-skips)
  - repoint inventory (RETIRED / INVENTORY / LIVE_PLANS) and retirement sweep stubs
  - 20 requirement spec stubs, one fixme per requirement and decision group
  - requests eval skeleton and fixture helpers (ensureZeroSopMachine, deleteEvalRequestRows)
  - eval-site safety manager fixture (second chain approver)
  - filled 60-VALIDATION.md (43 task rows)
affects: [60-02, 60-03, 60-04, 60-05, 60-06, 60-07, 60-08, 60-09, 60-10, 60-11, 60-12, 60-13, 60-14, 60-15, 60-16, 60-17, 60-18]
tech-stack:
  added: []
  patterns: [repoint inventory with LIVE_PLANS (Phase 59 idiom), test.fixme stubs naming the owning plan]
key-files:
  created:
    - tests/phase60/repoint-inventory.spec.ts
    - tests/phase60/retirement-sweep.spec.ts
    - tests/phase60/ (20 requirement stubs)
    - tests/evals/requests.eval.ts
    - tests/evals/lib/requests-fixture.ts
  modified:
    - playwright.config.ts
    - scripts/eval-fixtures.mjs
    - tests/evals/lib/session.ts
    - .planning/phases/60-requests-notifications-objectives/60-VALIDATION.md
key-decisions:
  - "eval-site-safety fixture reuses ensureSiteMember (eval_fixture guard, upsert), so a second run inserts nothing"
  - "requests-fixture.ts committed with the eval skeleton (Task 2) because the eval imports it; Task 3 carries the fixture script, session map and validation file"
patterns-established:
  - "Retired literals are quoted only inside tests/phase60/ and the requests eval, both excluded from the inventory walk"
requirements-completed: []
duration: ~25 min
completed: 2026-10-06
---

# Phase 60 Plan 01: Wave 0 Harness Summary

Registered the `phase60` Playwright project, wrote the repoint inventory and retirement sweep, stubbed every requirement spec and the requests eval, added the eval fixtures and filled the validation map.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 6be75aac | phase60 project, repoint inventory, retirement sweep |
| 2 | a425cadf | 20 spec stubs, requests eval skeleton, requests-fixture helper |
| 3 | 37bab11d | safety-manager fixture, session map, 60-VALIDATION.md |

## INVENTORY (file, disposition, owner)

Grep of `tests/` and `src/` (comments stripped) against every RETIRED token found hits only in the files below; Test A passes with none unlisted. "Pin" = holds behaviour, not a token.

| File | Disposition | Owner | Hit |
|------|-------------|-------|-----|
| tests/phase59/inbox-model.spec.ts | repoint | 60-05 | Write a SOP |
| tests/phase54/governance-inbox.spec.ts | repoint | 60-05 | Write a SOP |
| tests/phase59/office-pane-structure.spec.ts | repoint | 60-05 | pin (stale-department fix link) |
| tests/evals/office.eval.ts | repoint | 60-05 (idle-supervisor "no tab control" case is 60-11) | Write a SOP |
| tests/evals/one-screen.eval.ts | repoint | 60-05 | pin (Office pin equals Inbox) |
| tests/phase59/place-tab.spec.ts | repoint | 60-11 | pin (supervisor tabs) |
| tests/phase59/capability-matrix.spec.ts | repoint | 60-11 | pin (Office rows) |
| tests/phase58/edit-rail.spec.ts | repoint | 60-12 (60-14 repoints its objective-writer part after) | Assign this SOP, setSopObjective |
| tests/phase58/edit-actions.spec.ts | repoint | 60-14 | setSopObjective |
| tests/phase46/sop-edit-guard-wiring.spec.ts | repoint | 60-14 | setSopObjective |
| tests/phase58/fork-draft.spec.ts | repoint | 60-14 | pin (forkDraft objective copy) |
| tests/phase57/shell-structure.spec.ts | repoint | 60-16 (60-13 edits dept slot first) | pin (placeholder / slots) |
| tests/phase56/decision-writers-sweep.spec.ts | repoint | 60-17 (60-04/06/09 append writers first) | assignSopToRole, assignSopToUser, removeAssignment |
| tests/phase58/legacy-redirects.spec.ts | repoint | 60-17 | pin (assign address returns null today) |
| tests/e2e/sub-trade-assignment.spec.ts | repoint | 60-17 | SubTradePicker |
| tests/phase57/place.spec.ts | keep | 60-17 | pin (placeForPath of the assign address still resolves to the site) |

RETIRED tokens by owner: 60-05 `Fix assignment`, `Write a SOP`, `label: 'Machines'`; 60-12 `Assign this SOP`; 60-14 `setSopObjective`; 60-16 the old search placeholder and the worker Office placeholder sentence; 60-17 `AssignmentRow`, `SubTradePicker`, the four assign actions plus `requestRemoveAssignment`, `useNotifications`, the assign page (both spellings) and the assignments API route. `LIVE_PLANS = []`.

## `--list` output

`npx playwright test --list --project=phase60`: 118 tests in 22 files. `npx playwright test --project=phase60`: 5 passed, 113 skipped (fixme / live self-skip), 0 failed. `npx playwright test --list --project=evals requests`: 13 tests in `requests.eval.ts`. `npx tsc --noEmit`: clean.

## Zero-SOP machine check (counts only)

The eval-site org has 1 machine (EVAL Press) and 0 machines without a SOP link, so no zero-SOP machine exists today. `ensureZeroSopMachine` will create "EVAL Oven" on the eval-site layout the first time the eval runs (60-11).

## Fixture run

`node scripts/eval-fixtures.mjs` run twice: first run created `eval-site-safety@sopstart.com` (safety_manager of SOPstart Eval Site, no email sent); second run printed it as present and created nothing.

## Deviations from Plan

- `tests/evals/lib/requests-fixture.ts` was committed in Task 2 rather than Task 3 because `requests.eval.ts` imports it and tsc would fail otherwise. No behaviour change.
- The inventory's first-guess rows all held up; `tests/phase54/governance-inbox.spec.ts` and the three 60-05 pin files were kept as pins even where no token hit, per the plan.

## Known Stubs

All 113 skipped cases in `tests/phase60/` and 13 in `tests/evals/requests.eval.ts` are intentional Wave 0 stubs naming the plan that turns them live.

## Threat Flags

None. Fixture helpers refuse the real org id and write only with the eval-site org id; the safety user carries `eval_fixture: true`.

## Self-Check: PASSED

Files verified present (tests/phase60 holds 22 files, requests.eval.ts, requests-fixture.ts, 60-VALIDATION.md) and commits 6be75aac, a425cadf, 37bab11d exist.
