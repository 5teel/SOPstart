---
phase: 59-the-office
plan: 04
subsystem: inbox-data
tags: [inbox, governance, sign-off, labels, office]
requires: [59-01]
provides:
  - "'signoff' and 'review' inbox kinds; PendingSignOff, OwnedReview; deriveInbox optional signOffs / ownedReviews / now"
  - "InboxItem.action = { label: 'Try again' | 'Open' | 'Write a SOP', href, retry } (one action per row)"
  - "listPendingSignOffs(), listMyReviewRows() in load-inbox.ts; loadInbox passes both"
  - "src/actions/office.ts getOfficeInbox() (parameterless, per role)"
  - "src/lib/members/labels.ts userLabels, memberLabel; getOrgMembers returns email and full_name"
  - "src/lib/office/format.ts relativeWhen, nzDay, nzDateTime, reviewSegment (Pacific/Auckland)"
  - "MillerSop.parseRetry; Workshop drafts ownerLabel / reviewDueAt"
affects: [59-09, 59-10, 59-11, 59-12]
key-files:
  created:
    - src/lib/office/format.ts
    - src/lib/members/labels.ts
    - src/actions/office.ts
  modified:
    - src/lib/governance/inbox.ts
    - src/lib/governance/load-inbox.ts
    - src/lib/sop-list/admin-rows.ts
    - src/actions/admin-sop-list.ts
    - src/actions/shell.ts
    - src/actions/assignments.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase59/inbox-model.spec.ts
    - tests/phase59/capability-matrix.spec.ts
    - tests/phase54/governance-inbox.spec.ts
    - tests/phase30/governance-fold.spec.ts
    - tests/phase57/one-query.spec.ts
key-decisions:
  - "A stuck row with no parse job (parseRetry null) reads Open, not Try again: nothing to re-queue"
  - "Owned-review rows are skipped when a governance item already holds that SOP id, so an unowned-or-overdue SOP is one row"
  - "Overdue uses the same due < now rule as classify.ts; 'review due today' only for a later time the same NZ day"
requirements-completed: []
completed: 2026-10-05
---

# Phase 59 Plan 04: Inbox data layer Summary

**Sign-offs and the caller's own due reviews join the one inbox derivation, every row has one defined action, people read as emails, and `getOfficeInbox` gives each role its list from one parameterless read.**

Requirements OFF-01, OFF-02, OFF-04 are not ticked: the pane (59-09) and the Mark reviewed owner path (59-07) land later.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 342de05b | format.ts, inbox kinds and actions, `parseRetry`, labels module, 54 / 30 repoints |
| 2 | a977aa3a | session-client `listPendingSignOffs` / `listMyReviewRows` in `loadInbox`, `getOrgMembers` labels, drafts meta, 57 one-query repoint |
| 3 | b6307f15 | `getOfficeInbox`, matrix row, capability-matrix and source-contract cases |

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0 (bundle gate: `/page` 832 KB, `/sops/[sopId]/page` 793 KB, both +1 KB, baseline untouched).
- phase59 34 passed / 75 fixme; phase54 72; phase57 118; phase41 39; phase30 31; phase46 30 passed.

## Deviations from Plan

**1. [Rule 3 - Blocking] `parseRetry` wiring in `admin-sop-list.ts` done in Task 1, not Task 2.** `MillerSop.parseRetry` is a required field, so Task 1 would not compile without the producer. Same code, earlier commit.

**2. [Rule 3 - Blocking] `tests/phase57/one-query.spec.ts` pinned "completions awaiting sign-off are not inside the inbox count".** That is exactly what D-05 reverses. Repointed in the Task 2 commit: it now asserts `loadInbox` reads `listPendingSignOffs()` and that `shell.ts` itself reads no completion table. Not in the plan's file list.

**3. [Minor] The `memberLabel` / session-client source-contract cases** were written in Task 1's spec but moved to the Task 2 commit so each commit stayed green.

**4. [Note] The phase46 project ran its live-DB probes** (30 passed) even though the live flag was not set by me; this spent some of the shared OTP budget (CLAUDE.md 2026-09-28).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-59-13..16b mitigations are in place: session-client reads, `neq('worker_id', userId)`, session org filter, role from session in `getOfficeInbox`, `userLabels` in a plain module called with ids the caller already read.

## Self-Check: PASSED

- Files exist: format.ts, labels.ts, office.ts, 59-04-SUMMARY.md.
- Commits in git log: 342de05b, a977aa3a, b6307f15.
