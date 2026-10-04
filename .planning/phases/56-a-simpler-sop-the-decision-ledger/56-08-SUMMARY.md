---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 08
subsystem: governance
tags: [decision-ledger, recordDecision, assignments, observations, verify, ai-fields, agent]
requires: [56-05]
provides:
  - Seven more writers hooked to the ledger (assign, unassign, observation, verify / ai_finding_cleared, verify_withdrawn, AI field write, AI proposal approve / reject)
  - agentName on AiWriteRequestSchema (z.enum(AGENT_NAMES), optional)
  - scripts/reconcile-decisions.mjs
  - tests/phase56/decision-kinds-live.spec.ts
affects: [56-10]
key-files:
  created:
    - scripts/reconcile-decisions.mjs
    - tests/phase56/decision-kinds-live.spec.ts
  modified:
    - src/actions/assignments.ts
    - src/actions/observations.ts
    - src/actions/sop-section-blocks.ts
    - src/actions/ai-fields.ts
    - src/lib/validators/ai-fields.ts
    - src/app/api/ai-fields/write/route.ts
    - tests/phase56/decision-writers-sweep.spec.ts
key-decisions:
  - "verifyBlock / unverifyBlock still take only blockId; the SOP is resolved from the updated junction's section with the RLS-scoped session client, and parse_jobs is read with the admin client filtered by the session organisation"
  - "A decision is written only when the write changed a row (removeAssignment, verifyBlock, unverifyBlock return rows)"
  - "applyAiWrite logs only an applied write; the decision's sopId is set only when the server-side sops lookup found the SOP in the session org"
requirements-completed: [DEC-01, DEC-04]
duration: 35min
completed: 2026-10-04
---

# Phase 56 Plan 08: Remaining Decision Paths and Live Kinds Proof Summary

**Assignments, observations, verify / cleared AI finding and the AI field write path (named agent) now write to the ledger; every hook entry in the writer sweep is live, a reconcile script lists gaps, and a live spec proved each of the 15 DecisionKinds is accepted by the database.**

## What was built

- `assignSopToRole` / `assignSopToUser` write `assign`; `removeAssignment` reads the row first, deletes with `.select('id')` and writes `unassign` only when a row went. `selfAddSop` / `selfRemoveSop` untouched (allowlisted).
- `recordObservation` writes `observation` about the observed worker with fixed-label summaries; verdict, version, completion, note and override go in `details`.
- `verifyBlock` returns the updated row, resolves the SOP from the junction's section, reads the latest `parse_jobs.ai_review_results` flags for that junction, and writes `ai_finding_cleared` (with the flags) or `verify`. `unverifyBlock` writes `verify_withdrawn`. Both signatures still take only `blockId`.
- `applyAiWrite` writes `ai_field_write` with `agent: parsed.data.agentName ?? DEFAULT_AGENT_NAME` after an `applied` outcome; a `pending_approval` outcome writes nothing. `acceptProposal` / `rejectProposal` write `approve` / `reject`. The write route passes `agentName` through; an unknown name fails validation (400).
- `scripts/reconcile-decisions.mjs`: read-only; lists source rows since the first live decision (or `--since`) with no matching live decision (heuristic, 120 s, same org / actor / subject or SOP). Exits 0 always.
- Sweep: every `entries` and `extraHooks` key is in `LIVE_WRITERS`; new tests assert that, that `applyAiWrite` passes `agent:`, that the validator uses `AGENT_NAMES`, and that verify / unverify take only `blockId`.

## Verification

- `npx playwright test --project=phase56`: 83 passed, 15 skipped (all skips are the `PHASE56_LIVE`-gated specs; zero wiring tests skipped).
- Live run: `PHASE56_LIVE=1 npx playwright test --project=phase56 tests/phase56/decision-kinds-live.spec.ts` 4 passed. Inserted 15 rows per passing "every kind lands" run into the eval-site org (30 rows in total, because a first run failed a later test after that test had already passed; the ledger is append-only).
- `npx tsc --noEmit` clean; `npm run build` clean, bundle gate OK (/sops and /sops/[sopId] 818 KB vs 817 KB baseline, +1 KB, inside tolerance).
- phase23-unit 31 passed; phase28 41 passed, phase34 23 passed, phase37 102 passed, phase46 30 passed (each run once).
- Reconcile output on production:

```
Ledger reconcile -- source rows since 2026-10-03 23:36:01.035455+00 with no live decision (heuristic)
Search Railway logs for "[recordDecision] FAILED" for the cause.

Unmatched source rows: 0
```

  Sanity check with `--since 2000-01-01` reported 5 unmatched (old pre-ledger rows), so the query does flag gaps.

## Deviations from Plan

**1. [Rule 1 - Spec mismatch] "Unnamed agent refused by buildDecisionRow" for `agent: undefined`**
- **Found during:** Task 3 live run.
- **Issue:** The plan asserted `buildDecisionRow` refuses an agent input whose `agent` is forced to `undefined`. In the shipped 56-05 design `agent: undefined` means "a person decided", so it builds a valid person row; it can never produce an agent row with no name.
- **Fix:** The spec asserts `agent: undefined` yields a person row, and that every set-but-unlisted value (`null`, `''`, `'  '`, an invented name) is refused. The database CHECK refusal of null and blank `actor_name` is asserted unchanged. No change to `shape.ts`.
- **Files modified:** tests/phase56/decision-kinds-live.spec.ts
- **Commit:** 88d3a48

Otherwise executed as written. The sweep surfaced no writer outside the plan.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or auth path; `/api/ai-fields/write` is cookie-authenticated and unchanged apart from the optional validated `agentName`. No guard or RLS change, so CAPABILITY-MATRIX.md and journeys.ts need no edit.

## Task commits

1. Task 1 (assignments, observations, verify): `2727dd3`
2. Task 2 (AI writes, proposals, reconcile script, sweep live): `ecf14a7`
3. Task 3 (live kinds spec): `88d3a48`

## Self-Check: PASSED

- scripts/reconcile-decisions.mjs, tests/phase56/decision-kinds-live.spec.ts: present.
- Commits 2727dd3, ecf14a7, 88d3a48 present on master; no unexpected deletions.
