---
phase: 60-requests-notifications-objectives
plan: 06
subsystem: asks-server
tags: [requests, assignments, server-actions, decision-ledger, capability-matrix]
requires: [60-04]
provides:
  - src/lib/requests/ask-core.ts (askToDoSopCore, declineAskCore, stopAskingCore, listAskTargetsCore)
  - src/actions/asks.ts (askToDoSop, declineAsk, stopAsking, listAskTargets)
affects: [60-12, 60-17]
key-files:
  created:
    - src/lib/requests/ask-core.ts
    - src/actions/asks.ts
  modified:
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase60/ask-do-sop.spec.ts
    - tests/phase60/capability-matrix.spec.ts
key-decisions:
  - "Assignment row first, request second; a failed request insert deletes an inserted row or restores the previous assigned_by, so neither half ever exists alone"
  - "Decline and stop remove only assignment rows still held by the asker (assigned_by filter), so a worker's own self-added row or a later re-asker's row is never deleted"
  - "If removing the assignment fails after a decline or stop claim, the claim is reverted to accepted and the action reports the ask as not closed"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 06: Asks Server Summary

A supervisor, admin or safety manager can ask a role or a named person to do a published SOP: one accepted request, one `sop_assignments` row, one `request_accepted` ledger row, and the people asked are told. The unchanged due logic then makes it due. The person asked can decline; the asker can stop it.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 96b1fe2b | ask core, four ask actions, ask-do-sop spec (12 cases) |
| 2 | 9f1d4c91 | writer registry, sweep entries, four matrix rows, matrix spec |

## Exports

- **ask-core.ts** (server-only, service role, session org on every query): `askToDoSopCore(ctx, { sopId, target, note })` returns `{ requestId, recipients, sopTitle }` or `{ error }`; on 23505 it re-attributes the existing row to the asker (F-21); `declineAskCore` claims only an accepted `do_sop` row whose `target_user_id` is the caller; `stopAskingCore` claims an accepted `do_sop` row, filtered on `raised_by_user` unless `canStopAny`; `listAskTargetsCore` returns role counts and people (id, label, role, `hasIt`). Lineage ids come from `lineageRoot` with the org filter (F-20).
- **asks.ts** (`'use server'`, strict schemas, no service-role import): `askToDoSop` returns `{ logged, told, targetLabel }`, `declineAsk` and `stopAsking` return `{ logged }`, `listAskTargets` returns `{ roles, people }`. Notifications: `asked` to each recipient, `request_answered` ("{Name} can't do {SOP}.") to the asker on decline; stopping notifies nobody.

## Registry diff

- `extraHooks` += `askToDoSop` (anchor `askToDoSopCore(`), `declineAsk` (`declineAskCore(`), `stopAsking` (`stopAskingCore(`)
- `allow` += `askToDoSopCore` (`sop_assignments`, `requests`), `dropAskedAssignments` (`sop_assignments`), `declineAskCore` and `stopAskingCore` (`requests`)
- `LIVE_WRITERS` += the three action keys

## Matrix rows added

Ask someone to do a SOP (supervisor / admin / safety manager), Decline a SOP you were asked to do (every role, person-targeted asks only), Stop asking (own asks for a supervisor, any ask for admin / safety manager), List people and roles to ask.

## Results

- `npx tsc --noEmit` clean; `npm run build` exit 0 (`/sops/[sopId]` 794 against 792, `/page` 833 against 834, both within tolerance).
- phase60: 80 passed, 68 skipped (later plans); phase56: 107 passed (sweep green); phase52: 72 passed; phase46 source-contract (live/probe excluded): 15 passed; phase46 matrix-doc passed.
- `git diff f1b2ff93 -- src/lib/sop/worker-signal.ts src/hooks/useWorkerSops.ts` is empty (pinned in the spec).
- No live probes; the full suite was not run.

## Deviations from Plan

- **Spec is source-contract only.** The ask order, undo branch, claim filters and ledger-once rules are pinned by reading comment-stripped source; no live DB run of the core was made (no live probes allowed this run). A deployed eval for the ask path belongs to 60-18.
- **Decline / stop revert on assignment-delete failure.** Not in the plan; added so a claimed ask never reads closed while the SOP stays due.
- **TDD order:** specs and modules were committed together per task; RED was not captured separately.
- **Not pushed:** per instruction. STATE.md and ROADMAP.md untouched.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: T-60-24 to T-60-29 mitigated as specified; T-60-30 accepted (`listAskTargets` returns id, name or email, role, own organisation only).

## Self-Check: PASSED

`src/lib/requests/ask-core.ts`, `src/actions/asks.ts` and this summary exist; commits 96b1fe2b and 9f1d4c91 exist.
