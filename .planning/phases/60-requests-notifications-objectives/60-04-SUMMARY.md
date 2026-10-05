---
phase: 60-requests-notifications-objectives
plan: 04
subsystem: requests-server
tags: [requests, notifications, server-actions, decision-ledger, capability-matrix]
requires: [60-02, 60-03]
provides:
  - src/lib/notifications/write.ts (notify, membersWithRole)
  - src/lib/requests/core.ts (subjectInOrg, aboutTitles, insertRequest, claimOpenRequest, withdrawOwnRequest, listMyRequestRows)
  - src/lib/requests/agent.ts (raiseRequestAsAgent)
  - src/actions/requests.ts (raiseRequest, withdrawRequest, answerRequest, listMyRequests)
affects: [60-05, 60-06, 60-07, 60-08, 60-11, 60-12]
key-files:
  created:
    - src/lib/notifications/write.ts
    - src/lib/requests/core.ts
    - src/lib/requests/agent.ts
    - src/actions/requests.ts
  modified:
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase60/{agent-requests,request-actions,answer-actions,capability-matrix}.spec.ts
key-decisions:
  - "claimOpenRequest limits to the three raisable kinds, so a do_sop row can never be answered through answerRequest; asks decline through their own path (60-06)"
  - "raiseRequestAsAgent allows machine subjects only (the first producer is machines without SOPs); other subjects return skipped: not-found"
  - "Ledger details carry ids, titles and notes; the decision's asker is asker_user_id or asker_agent, never an email"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 04: Requests Server Summary

The notification writer, the service-role request core, the agent helper and four thin session-scoped actions now exist; one answer is one claim, one ledger row and one notification.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | ffd1561d | notify, request core, agent helper, agent-requests spec |
| 2 | 6d2e5a0c | request actions, request-actions and answer-actions specs |
| 3 | 60fc1440 | writer registry, sweep entry, matrix rows, matrix spec |

## Exports

- **write.ts**: `notify(orgId, rows)` returns a count and never throws (drops unsafe places, keeps only members of the org, upsert on `user_id,dedupe_key` ignoring duplicates); `membersWithRole(orgId, role)`.
- **core.ts**: `subjectInOrg`, `aboutTitles` (`type:id` to title), `insertRequest`, `claimOpenRequest` (id + org + `state = 'open'` + raisable kinds; null when nothing matched), `withdrawOwnRequest`, `listMyRequestRows` (session client, RLS, newest 50).
- **agent.ts**: `raiseRequestAsAgent({ organisationId, agent, subject, note })` returning `{ raised }` or `{ skipped: 'open' | 'recent' | 'not-found' }`; checks `AGENT_NAMES`, the machine in the org, a 30-day answered window, and treats 23505 as skipped.
- **actions/requests.ts**: `raiseRequest`, `withdrawRequest`, `answerRequest` (returns `{ logged, kind, subject }` or `{ error: 'Someone already answered this.' }`), `listMyRequests` (returns `{ me, rows: MyRequest[] }`). All schemas `.strict()`; the file imports neither the service role nor the agent module.

## Registry diff (scripts/decision-writers.json)

- `tables` += `requests`
- `extraHooks` += `src/actions/requests.ts#answerRequest` (anchor `claimOpenRequest(`, kind `request_accepted/request_declined`)
- `allow` += `insertRequest`, `claimOpenRequest`, `withdrawOwnRequest`, `raiseRequestAsAgent` (each with a reason)
- `LIVE_WRITERS` += `src/actions/requests.ts#answerRequest`

## Matrix rows added

Raise a request (every role), Withdraw your own open request (every role), Answer a request (worker no; supervisor, admin, safety manager yes), Agent raises a request (no client path). No existing label renamed.

## Results

- `npx tsc --noEmit` clean; `npm run build` exit 0 (bundle gate within tolerance, `/page` 833 against 834, `/sops/[sopId]` 794 against 792).
- phase60: 61 passed, 80 skipped (later plans' stubs); phase56: 104 passed (sweep green with the four new `requests` write sites registered); phase46 source-contract with live/probe excluded: 15 passed.
- No live probes were run, and the full suite was not run.

## Deviations from Plan

- **agent-requests spec**: the Wave 0 stub case "the ledger row carries the agent name" belongs to 60-08 (the helper writes no ledger row by design), so it stays fixme under a "60-08 producer" block; two stub cases were replaced by seven live helper cases.
- **request-actions spec**: the stub "raiseRequest writes the request then notifies" was replaced by "raising never writes the ledger or fans out notifications", matching D-01 and T-60-20 (no fan-out on raise).
- **answer-actions spec**: "a supervisor change_sop link is browse, not edit" is UI (60-11) and stays fixme; the receipt-wording case is asserted at the action level as `logged: result.ok`.
- **TDD order**: specs and modules were committed together per task; RED runs were not captured separately.
- **Not pushed**: per the orchestrator instruction, no `git push`. STATE.md and ROADMAP.md untouched.

## Known Stubs

None in source. `aboutTitles` falls back to plain words ("Something that has been removed", "a SOP") when a subject row is gone; this is deliberate.

## Threat Flags

None beyond the plan's register: T-60-13 to T-60-19 are mitigated as specified; T-60-20 accepted.

## Self-Check: PASSED

Four source modules, SUMMARY and specs present; commits ffd1561d, 6d2e5a0c and 60fc1440 exist.
