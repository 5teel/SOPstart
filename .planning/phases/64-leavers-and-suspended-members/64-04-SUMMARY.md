---
phase: 64-leavers-and-suspended-members
plan: 04
subsystem: auth
tags: [membership-status, governance, notifications, lint-guard, active-only]

requires:
  - phase: 64-02
    provides: organisation_members.status, state-aware auth paths, TeamMember.status
  - phase: 64-03
    provides: People UI, Remove path deleted
provides:
  - activeMemberIds() and memberStatusMap() (src/lib/members/active.ts)
  - STATUS_WORDS and statusSuffix() in the pure src/lib/members/authority.ts
  - every identity, target, recipient and population read of organisation_members active-only or allowlisted
  - OrgMemberWithProfile.status; owner picker and approval-chain editor offer active people
  - "(left)" / "(suspended)" in owner labels, approval history, pending sign-offs, completion review and the decisions list
  - tests/lint/member-status.spec.ts
affects: [64-05, 64-06]

tech-stack:
  added: []
  patterns:
    - "Service-role membership reads carry .eq('status','active') inside the chain; records and labels read all statuses and add statusSuffix"
    - "A membership-read guard that scans method chains and keeps a reasoned ALLOW map, with a stale-entry test"

key-files:
  created:
    - src/lib/members/active.ts
    - tests/lint/member-status.spec.ts
  modified:
    - src/lib/members/authority.ts
    - src/actions/approvals.ts
    - src/actions/governance.ts
    - src/actions/departments.ts
    - src/actions/competency.ts
    - src/actions/grants.ts
    - src/actions/observations.ts
    - src/actions/org-model.ts
    - src/actions/people.ts
    - src/actions/assignments.ts
    - src/actions/versioning.ts
    - src/actions/office.ts
    - src/lib/requests/ask-core.ts
    - src/lib/notifications/write.ts
    - src/lib/governance/load-inbox.ts
    - src/components/admin/governance/OwnerPicker.tsx
    - src/components/office/ApprovePanel.tsx
    - src/app/(protected)/admin/settings/page.tsx
    - playwright.config.ts
    - .planning/codebase/CAPABILITY-MATRIX.md

key-decisions:
  - "setSupervision reads status inside the chain with .in('status', linked ? ['active'] : all three): linking needs two active people, unlinking accepts any row so a departed supervisor's links can be cleared"
  - "member-status guard registered in the existing tests/lint project regex in playwright.config.ts (it runs as phase15-stubs/phase25 projects, found with --list)"
  - "A chain counts as status-aware when its text mentions status; a query built across statements is a known ceiling and must put its status test inside the chain or be allowlisted"

requirements-completed: [MEMB-05, MEMB-06, MEMB-09, MEMB-11]

duration: 2h
completed: 2026-10-24
---

# Phase 64 Plan 04: Active-only membership sweep and the member-status guard

**"A row exists" no longer means "is a member": every owner, approver, seat, supervision, department, grant, ask, notification and training-lane check counts active members only, governance views name people as "(left)" or "(suspended)", and a lint guard fails on any new unfiltered membership read.**

## Accomplishments

- `src/lib/members/active.ts`: `activeMemberIds(orgId, userIds?)` (empty input returns an empty set with no query) and `memberStatusMap(orgId, userIds)`.
- Active-only identity and target checks: setApprovalChain, setSopOwner, setDepartmentOwner, assignMemberDepartments, the competency / departments / grants `callerOrgId` variants, verifySubjectInOrg (person subjects), the observed worker and observation recipients, setRoleSeat, setSupervision (linking), askToDoSopCore.
- A SOP whose owner is suspended or has left is unowned in `listGovernanceQueue`, so it shows in the Inbox; `getTrainingMatrix` drops non-active people from the lanes while `getTrainingRecordForPerson` stays all-status.
- Recipients and populations: `notify`, `membersWithRole`, new-version notices and `listAskTargetsCore` active-only; `signOffRecipients` filters supervisors through `activeMemberIds` before the admin and safety-manager fallback.
- `getOrgMembers` returns `status`; OwnerPicker and the settings page approval-chain editor offer active people.
- `statusSuffix` applied in `ownerLabelById`, approval history, `listPendingSignOffs`, `getCompletionForReview`, `listDecisions` (actors, member subjects, completion workers, request askers) and ApprovePanel (pure helper, no admin client in the client bundle). `ledgerReader` now also returns the session organisation; `LedgerRow` gains `actor_id`.
- `tests/lint/member-status.spec.ts` (5 tests): not vacuous; no membership delete and no `removeMember` / `deleteOrgMember` / `remove.ts`; every members read status-aware or allowlisted; no other quoted use of the table name; no stale allowance. Matrix row sentence added.

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 | `4cd1c053` | active.ts and every identity / target check active-only |
| 2 | `9cc3e6ae` | recipients, populations and pickers active-only |
| 3 | `83a9fa24` | statusSuffix in governance views, member-status guard, matrix sentence (pushed) |

## Verification Evidence

- `npx tsc --noEmit` exit 0; `npm run build` exit 0. Bundle gates: `/sops/[sopId]/page` 802 KB (baseline 802, delta 0); `/page` 831 KB (baseline 834, delta -3, unchanged from 64-01 to 64-03, not from this plan). `.bundle-baseline.json` untouched.
- `--project=phase64 --project=phase59 --project=phase60 --project=phase56`: 440 passed, 27 skipped, 3 failed, all three the pre-existing Phase 59 failures in `deferred-items.md` (`repoint-inventory` x2, `retirement-sweep` `updateRole`). `tests/lint`: 66 passed.
- `--list tests/lint/member-status.spec.ts`: 5 tests.
- Mutation check: deleting the status filter from `src/lib/auth/sites.ts` failed test 3 naming `src/lib/auth/sites.ts#mySites`; restored, 5 of 5 pass.
- Deployed run on the deploy of `83a9fa24` (Deploy to Fly success, `/api/version` serving it): `office.eval.ts` plus `requests.eval.ts`, 33 of 33 passed, 0 retries. Screenshots read: `59-decisions.png` (Ownership chip, WHO / WHAT / ABOUT columns intact, active actors unsuffixed) and `59-approve-open.png` (approve panel with "Your turn", owner line unsuffixed). The evals use only active fixtures, so "(left)" / "(suspended)" wording is covered by the source guard and by the 64-05 handover eval, not here.

## Deviations from Plan

**1. [Rule 3 - Blocking] Guard not discovered by Playwright.** The new spec matched no project; added `member-status` to the tests/lint regex in `playwright.config.ts` (the CLAUDE.md "new lint spec must be in a project regex" rule).

**2. [Rule 1 - Bug] `LedgerRow` lacked `actor_id`** (select already asked for it); added the field so person actors in the decisions list can carry the suffix.

**3. setSupervision acceptance grep.** The plan's `grep -c "eq('status', 'active')" src/actions/people.ts` would print 0 because the status test is `.in('status', linked ? ['active'] : [...])`; behaviour is as the plan describes (active to link, any row to unlink).

## Deferred Issues

- Three Phase 59 specs already failing on HEAD (see `deferred-items.md`).
- `tests/phase63/home-shell.spec.ts` "the bundle gate watches the lazy seams" fails on HEAD independent of this plan: one of the four marker strings it expects is missing from `scripts/check-bundle-size.ts` (that file is untouched by this plan; last changed in `612bec5b`). Not in the 64-03 gate set; not investigated further.
- The People SupervisesPicker and OrgChart seat picker still list suspended people as seatable at the UI level (the server now refuses them); a UI filter belongs with 64-05 or a follow-up.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model: T-64-30 to T-64-33 by the active filters and re-checks above, T-64-34 by `statusSuffix` living in the pure authority module (ApprovePanel imports no admin client), T-64-35 by lint test 2.

## Self-Check: PASSED

- Files present: `src/lib/members/active.ts`, `tests/lint/member-status.spec.ts`, this summary.
- Commits `4cd1c053`, `9cc3e6ae`, `83a9fa24` in `git log`; pushed to origin master.
