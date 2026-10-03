---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 05
subsystem: governance
tags: [decision-ledger, recordDecision, publish, approvals, signatures]
requires: [56-04]
provides:
  - src/lib/decisions/shape.ts (DECISION_KINDS, AGENT_NAMES, DEFAULT_AGENT_NAME, DecisionInput, buildDecisionRow)
  - src/lib/decisions/record.ts (recordDecision, server-only, service role, fail-soft)
  - Eight writers hooked to the ledger
affects: [56-08]
key-files:
  created:
    - src/lib/decisions/shape.ts
    - src/lib/decisions/record.ts
    - tests/phase56/decision-shape.spec.ts
  modified:
    - src/actions/approvals.ts
    - src/lib/governance/publish-core.ts
    - src/actions/governance.ts
    - src/actions/completions.ts
    - tests/phase56/decision-writers-sweep.spec.ts
key-decisions:
  - "recordDecision reads organisation, user id and email from getSessionContext() only; DecisionInput has no organisation or actor field"
  - "The publish decision is written inside performPublish after the draft-to-published flip, so the publish route and approveStep's final step both log it; assertPublishGates is untouched"
  - "The chain-divert path in the publish route is a submission, not a decision, and writes nothing"
requirements-completed: [DEC-01, DEC-04]
duration: 20min
completed: 2026-10-04
---

# Phase 56 Plan 05: Ledger Writer and First Eight Decision Paths Summary

**One server-only `recordDecision()` writes to the append-only `decisions` table with organisation and actor taken from the session, an unnamed agent is refused by type, builder and database CHECK, and approve, send back, publish, owner change, review, cadence change, sign-off/reject and both signatures each write one row after their primary write.**

## What was built

- `shape.ts`: pure `buildDecisionRow(session, input)`. Refuses a missing organisation, a person decision without a session user, an agent outside `AGENT_NAMES`, an unknown kind, and a summary outside 1 to 200 characters. Agent rows get `actor_id` null and `details.invoked_by` set to the session user.
- `record.ts`: `import 'server-only'`, service-role insert, `.select('id').single()`. Build failure, insert error and thrown exception all log `[recordDecision] FAILED` and return `{ ok: false }`; it never throws.
- Hooks (each awaited right after the primary write succeeded, result ignored): `approveStep` (only when no insert error, so a 23505 double-click logs nothing; placed before the `performPublish(` call), `requestChanges`, `performPublish`, `setSopOwner`, `confirmSopCurrent`, `setReviewCadence`, `signOffCompletion`, `recordSignature`. Summaries are code literals and enums; comments and reasons live in `details`.
- Sweep: the eight `file#function` keys are in `LIVE_WRITERS` and `PUBLISH_GUARD_LIVE` is true.

## Verification

- `npx playwright test --project=phase56`: 60 passed, 14 skipped (the 56-08 writers and the live-gated schema specs). Includes the publish-gate hash pin, green with no repoint (the import line sits above the pinned body, and the body itself is unchanged).
- decision-shape.spec: 7 passed, including DECISION_KINDS equal to the 00070 CHECK list read from the SQL text.
- phase28 / phase29 / phase40: 200 passed, 4 skipped.
- `npx tsc --noEmit`: clean. `npm run build`: clean, bundle gate OK (/sops and /sops/[sopId] 818 KB vs baseline 817 KB, within the +/-2 KB tolerance; no client file touched).
- Counts: `await recordDecision(` is 2 in approvals.ts, 1 in publish-core.ts, 3 in governance.ts, 2 in completions.ts.

## Deviations from Plan

None. The plan was executed as written; `recordSignature` leaves `sop_id` null as directed, with the completion id in `subject`.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or auth path; the writer is server-only and the table's insert grant is unchanged from 56-03/56-04.

## Task commits

1. Task 1 (shape, record, unit spec): `f1f6b1e`
2. Task 2 (eight hooks, sweep flipped live): `5191bdb`

## Self-Check: PASSED

- src/lib/decisions/shape.ts, src/lib/decisions/record.ts, tests/phase56/decision-shape.spec.ts: present.
- Commits f1f6b1e and 5191bdb present on master; no unexpected file deletions.
