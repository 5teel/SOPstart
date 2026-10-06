---
phase: 60-requests-notifications-objectives
plan: 07
subsystem: notification-triggers
tags: [notifications, approvals, sign-off, versioning, verify-gate-harness]
requires: [60-04]
provides:
  - src/lib/notifications/write.ts (notifyNextApprover, signOffRecipients)
affects: [60-08, 60-16, 60-17]
key-files:
  modified:
    - src/lib/notifications/write.ts
    - src/app/api/sops/[sopId]/publish/route.ts
    - src/actions/approvals.ts
    - src/actions/completions.ts
    - src/actions/versioning.ts
    - scripts/verify-gate-check.tsx
    - tests/phase60/notification-triggers.spec.ts
key-decisions:
  - "The gate-harness stub matches lib/notifications/write (not the whole lib/notifications folder), so kinds.ts and places.ts keep loading for real"
  - "notifyNextApprover builds its own title, place and dedupe key, so the publish route imports one module and the stub covers it"
  - "Sign-off name is the worker's full name only, else 'Someone'; an email is never put in a title"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 07: Notification Triggers Summary

Three decision paths now tell the right people at the right moment, after the primary write and ledger row, fail-soft, one row per event.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 6112687c | `notifyNextApprover`; publish route + `approveStep` wiring; harness stub |
| 2 | bfc23798 | `signOffRecipients`; `submitCompletion` + `notifyAssignedWorkers` wiring |

## Wired sites and recipient rules

- **Publish route, fresh divert only** (not `alreadyPending`): step 0 approvers, after the divert update, in try/catch. The route select now also reads `title, version`.
- **`approveStep`**: after a fresh (non-23505) approval and after `recordDecision(`, when the step is not the last, step `nextIndex + 1` is notified. It runs before `performPublish`, which only happens on the final step. `sop.title` added to its select.
- **`notifyNextApprover`**: step's named user, or `membersWithRole` of its role; the actor is removed; kind `approve_next`, place the Office, dedupe `approve_next:<sop>:<version>:<step>`.
- **`submitCompletion`**: after `recordSignature(`, `signOffRecipients` (the worker's `supervisor_assignments` supervisors in the session org, else admins and safety managers; never the worker) get kind `signoff`, dedupe `signoff:<completionId>`, place the Office. The already-submitted early return means a retry never reaches it; the dedupe covers the rest.
- **`notifyAssignedWorkers`**: now writes through `notify` (kind `new_version`, place `focusHref(newSopId)`). It reads the new SOP under the SESSION org (`.eq('organisation_id', organisationId)`), no longer off the fetched row. Its `worker_notifications` insert is gone; the assignment repoint is unchanged and now always runs (a notification failure no longer returns an error ahead of it). `markNotificationRead` still uses `worker_notifications` (A-02).

## Harness

`scripts/verify-gate-check.tsx` stubs `lib/notifications/write` (`notify`, `notifyNextApprover`, `membersWithRole`, `signOffRecipients`), in the same commit as the publish-route writer. No other `scripts/*-check.*` loads these modules.

## Results

- `npx tsc --noEmit` clean; `npm run build` exit 0 (`/sops/[sopId]/page` 794 vs 792, `/page` 833 vs 834, both within tolerance).
- `npx tsx scripts/verify-gate-check.tsx` prints `VERIFY-GATE OK`; phase26 `verify-gate` passes.
- phase60 `notification-triggers`: 7 passed, no `test.fixme` left. phase60, 56, 29, 40, 58, 59 (live/probe excluded): 668 passed, 54 skipped (other plans' stubs). phase55 source-contract: 294 passed.
- No live probes; full suite not run; not pushed; STATE.md and ROADMAP.md untouched.

## Deviations from Plan

- The stub pattern is `lib/notifications/write` rather than the bare `lib/notifications` suggested in the plan, because the bare form would also swallow `kinds` and `places`. The acceptance grep still matches.
- Task 1's spec cases are source-contract (call order, try/catch, org and actor handling), matching the 60-04 spec idiom; RED runs were not committed separately.
- Plan verify command `phase55 worker-path-contract` ran as the whole phase55 project, excluding live/probe.

## Known Stubs

None.

## Threat Flags

None. T-60-31 to T-60-34 mitigated: calls sit after the write and ledger row inside try/catch; session org only; actor and worker excluded; harness stub and `verify-gate` run in this plan.

## Self-Check: PASSED

All seven files modified; commits 6112687c and bfc23798 exist.
