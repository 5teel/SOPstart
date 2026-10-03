---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 01
subsystem: testing
tags: [playwright, source-sweep, decision-ledger, eval-fixture, publish-gate]
requires: []
provides:
  - phase56 Playwright project (broad testMatch for tests/phase56/)
  - scripts/decision-writers.json (data-keyed decision writer list)
  - discovery sweep (live) plus per-writer recordDecision wiring checks (fixme)
  - sha256 pin of assertPublishGates
  - "Eval convert fixture SOP" known-answer SOP in the eval-site org
  - sop-ledger.eval.ts skeleton (six fixme stubs)
affects: [56-02, 56-05, 56-08, 56-10]
tech-stack:
  added: []
  patterns:
    - "Write-site discovery by paren-balanced method-chain parsing of comment-stripped source"
    - "Body hash pin for a safety gate"
key-files:
  created:
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - tests/phase56/publish-gate-pin.spec.ts
    - tests/evals/sop-ledger.eval.ts
  modified:
    - playwright.config.ts
    - scripts/eval-fixtures.mjs
    - tests/evals/lib/session.ts
    - .planning/phases/56-a-simpler-sop-the-decision-ledger/56-VALIDATION.md
key-decisions:
  - "Chain parsing (balanced parens, skipping trailing line comments) instead of a ';' or 400-char window, because the codebase writes no semicolons and a window would pair a select with a later insert"
  - "Column-token sites count only when the function also WRITES that column's table; useVerifyChecklist.fetchBlocks maps verified_by_admin_id on a read and was a false positive"
  - "Arrow-function writers are named by their const (approval.ts defaultAdminInsert, not gateWrite)"
requirements-completed: [DEC-01, SOP-01]
duration: 25min
completed: 2026-10-04
---

# Phase 56 Plan 01: Wave 0 harness Summary

**A source sweep that discovers every write to the decision tables and fails on any not listed in decision-writers.json, a sha256 pin on assertPublishGates, and a known-answer convert fixture SOP in the eval-site org.**

## Task commits

1. Task 1 (phase56 project, writer list, sweep, gate pin): `7a617db`
2. Task 2 (convert fixture, eval skeleton, VALIDATION): `a44786f`

## Results

- `npx playwright test --project=phase56`: 4 passed, 18 skipped (wiring and publish-guard fixme until 56-05/56-08).
- Mutation check: removing the `recordObservation` entry from the JSON turns the discovery test red, restored afterward.
- `npx tsc --noEmit` clean; `--list --project=evals` shows 6 sop-ledger tests; no file under `src/` changed.
- `node scripts/eval-fixtures.mjs` ran twice: second run created nothing (3 sections, 2 steps, 0 assignments, 0 machine links confirmed).

## Writer list

16 hook entries, 1 extra hook (`applyAiWrite`, anchor `gateWrite(`), 5 allow entries (selfAddSop, selfRemoveSop, versioning.notifyAssignedWorkers, sops.deleteSop, approval.defaultAdminInsert). Discovery found exactly the sites the plan named; **no writer was added beyond the plan's list**, so 56-05 and 56-08 needed no edit. Every hook entry's file is in the frontmatter of 56-05 or 56-08 (acceptance check passes).

## Fixture

- Convert fixture SOP id (eval-site org): `92f826fe-c4a1-4dbf-9394-9c25c2457084`
- Known answer: hazard 4 (2 cards + Warning + Caution), ppe 1 holding both items, step 2 (one asks for a photo), check 1.
- `PUBLISH_GATE_SHA256 = 43cd12ec266ec2508c710c8e7faac869b3ae7a128a947940fce29ce5a0935849`

## Deviations from Plan

**1. [Rule 1 - Bug] Discovery rule for column tokens tightened.** The plan said a function "also contains `.from(table)`"; that flagged `useVerifyChecklist.fetchBlocks`, which only reads the column. The sweep now requires a write chain on the table. Commit `7a617db`.

**2. Chain detection method.** The plan said "up to the next `;` or 400 characters"; replaced with method-chain parsing for the reason above. Same commit.

Otherwise: plan executed as written.

## Known Stubs

`tests/evals/sop-ledger.eval.ts` A to F are intentional `test.fixme` stubs, completed in 56-10. The wiring tests in the sweep flip live as 56-05 and 56-08 append to `LIVE_WRITERS`.

## Issues Encountered

None blocking. The shared repo has no `.gitattributes`, so commits warn about LF to CRLF; specs normalise CRLF before hashing or slicing.

## Next

Ready for 56-02 (converter and read-only dry run).

## Self-Check: PASSED
