---
phase: 59-the-office
plan: 05
subsystem: people-server
tags: [auth, organisation_members, ledger, capability-matrix, rls]
requires: [59-02, 59-04]
provides:
  - admin-only inviteWorker({ email, role }) that also adds an existing account
  - updateMemberRoleSafe: admin-only, org-scoped, zero-row update reports failure, last admin protected
  - removeMember through deleteOrgMember (src/lib/members/remove.ts, service-role delete scoped to the session org)
  - member_invited / role_change / member_removed ledger writers, each returning `logged`
  - getTeamMembersWithEmails returns invited (pending invites) and inviteCode (admins only)
affects: [59-11, 59-14, 59-16]
tech-stack:
  added: []
  patterns: ["plain-module service-role write behind a guarded action (CLAUDE.md 2026-06-15)", "zero-row write reports failure"]
key-files:
  created:
    - src/lib/members/remove.ts
  modified:
    - src/actions/auth.ts
    - src/lib/validators/auth.ts
    - src/components/admin/RoleAssignmentTable.tsx
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - tests/phase59/people-actions.spec.ts
    - tests/phase59/capability-matrix.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "Invite is admin-only (A-10 literal); safety managers keep remove-but-not-admin, lose nothing they could really do (their role changes never worked under RLS 00062)"
  - "Last-admin guard applies to any admin demotion, not only self-demotion"
  - "Invited rule: org metadata equals session org AND no membership row AND last_sign_in_at null AND invited_at set (59-01)"
  - "removeMember refuses removing an admin unless the caller is admin"
requirements-completed: []
duration: ~35min
completed: 2026-10-05
---

# Phase 59 Plan 05: People actions Summary

**Admin-only role-carrying invite, role changes and removals that report the truth, a service-role delete in a plain module, and all three written to the ledger and registered in the writer sweep.**

OFF-05 is NOT ticked here: the People tab (59-11) owns the requirement.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | fd4e7d5b | actions, remove.ts, validator role enum, RoleAssignmentTable repoint, people-actions spec |
| 2 | 615a4b1c | writer registry + sweep LIVE_WRITERS, Manage team matrix row and spec |

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0 (bundle gate OK, `/page` +1 KB within tolerance).
- phase59 project: 43 passed, 67 skipped (fixme / live self-skip), 0 failed; phase56 `decision-writers-sweep` 31 passed; phase46 `capability-matrix-doc` 9 passed; phase55 `org-single` 5 passed.
- No live probes run (OTP budget). `removeMember` and `inviteWorker` behaviour against the real project is covered by source contracts only; the deployed eval for the People tab (59-11/59-16) exercises them.

## Findings

- **`organisation_members` has no DELETE policy** (00002 / 00062 define select, insert, update). The old `removeMember` used the session client, so the delete matched zero rows, returned no error and reported success: removal never worked. Fix: `deleteOrgMember` in `src/lib/members/remove.ts` deletes with the service role, `.eq('organisation_id', session org)` and `.select('id')`, returning the row count; the action errors on 0. For CLAUDE.md Learnings in 59-16.
- Role changes by a safety manager previously said "Role updated" while RLS (admin-only `WITH CHECK`) filtered the row: the action now refuses non-admins up front and treats a zero-row update as failure.
- Existing-account invite uses one `listUsers({ perPage: 1000 })` lookup (same ceiling as `getTeamMembersWithEmails`, marked with a `ponytail:` comment).

## Deviations from Plan

**1. [Rule 3 - Blocking] `inviteWorker` role variable**
- The plan's behaviour text says `invited_role: role`; the session role already holds `role`, so the schema role is `newRole` and the metadata line is `invited_role: newRole`. Spec pins that.

**2. [Rule 2 - Missing critical] Last-admin guard widened**
- Old guard covered only self-demotion. Now any admin demotion needs a second admin ("There has to be at least one admin."); removal of the last admin uses the same message.

**3. [Rule 2 - Missing critical] `removeMember` target read org-scoped**
- Target read now carries `.eq('organisation_id', organisationId)` and the id is UUID-validated.

No auth gates. STATE.md and ROADMAP.md untouched; nothing pushed.

## Known Stubs

None.

## Threat Flags

None. Mitigations T-59-17..21 are in place: admin-only guards first, session-org scoped delete in a non-endpoint module, ledger rows after every write, literal summaries, details carry roles only (spec asserts no email in details).

## Self-Check: PASSED

- Files: `src/lib/members/remove.ts`, this SUMMARY exist; `grep addMemberByEmail src` returns nothing.
- Commits fd4e7d5b and 615a4b1c in `git log`.
