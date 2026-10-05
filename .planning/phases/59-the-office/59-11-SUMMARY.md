---
phase: 59-the-office
plan: 11
subsystem: office pane / people and access
tags: [office, people, roles, invite, access, wiring-lens, eval]
requires: [59-05, 59-09, 59-10]
provides:
  - "src/components/office/PeopleTab.tsx: table, invite form with role, inline role select, existing DepartmentPicker, Remove behind a focused confirm, join code"
  - "OfficePane people and access arms (AdminAccessLens unchanged inside overflow-x-auto, pinned to initialSop)"
  - "tests/phase59/people-tab.spec.ts and access-mount.spec.ts live; three 59-11 eval cases authored"
affects: [59-12, 59-14, 59-16]
key-files:
  created:
    - src/components/office/PeopleTab.tsx
  modified:
    - src/components/office/OfficePane.tsx
    - tests/phase59/people-tab.spec.ts
    - tests/phase59/access-mount.spec.ts
    - tests/evals/office.eval.ts
key-decisions:
  - "Receipts use the pane's existing RowDone shape ({receipt, logged}); the pane adds the ledger suffix only when logged is true, department changes pass logged: null"
  - "A refused role change reverts by design: the select is controlled by the server row, so an error simply leaves it on the old role and shows the server's words"
  - "Remove confirm is a small local dialog (ReasonDialog cannot omit its textarea), same scrim, aria-modal and Esc rules"
requirements-completed: []
completed: 2026-10-06
---

# Phase 59 Plan 11: People and Access tabs Summary

**The People & roles tab (invite with a role, inline role select, the unchanged department picker, Remove behind a "Keep them" confirm, join code) and the Access tab (the wiring lens mounted untouched in a horizontally scrolling container) now live in the Office pane.**

OFF-05 / OFF-06 / SHL-06 are not ticked here: the pane is mounted in 59-12 and proven by the deployed eval in 59-16.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | acca25a3 | `PeopleTab`, people and access arms in `OfficePane`, `people-tab` spec live |
| 2 | 9fcce32f | `access-mount` spec live, People / People 1024 / Access eval cases |

The Access arm landed in the task 1 commit (both arms edit the same file); task 2 holds its spec and the eval.

## AdminAccessLens proof

Phase base commit: `1c42270e` (last commit before 59-01). `git diff 1c42270e -- src/components/sop/lenses/AdminAccessLens.tsx` is empty; `access-mount.spec.ts` asserts it.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0, bundle gate OK (`/page` 832 KB, Δ +1; `/sops/[sopId]/page` 793 KB, Δ +1; baseline untouched; nothing imports `OfficePane` yet).
- phase59 + phase57 + phase15-stubs: 285 passed, 30 skipped (later-plan stubs), 0 failed. Design-token, undefined-token and admin-lens-import lints green.
- `npx playwright test --list --project=evals office`: 17 cases; the two 59-11 fixmes are replaced by three live cases. Evals authored and listed, not run.

## Deviations from Plan

**1. [Minor] Receipt callback shape.** Plan said `{ text, logged }`; the pane already defines receipts as `{ receipt, logged }` (`RowDone`) and appends the ledger suffix itself, so PeopleTab uses that.

**2. [Minor] Spec names.** The plan's verify mentions `people-actions`; it already existed (59-05) and still passes. `access-mount` skips its diff assertion if the base commit is missing from a shallow checkout.

**3. [Minor] Safety-manager remove.** `removeMember` still allows a safety manager (59-05 decision), so Remove stays enabled for them; only invite and role change are admin-only in the UI.

## Eval notes for 59-16

- People case seeds `eval-site-disposable-<run>@sopstart.invalid` (worker, `eval_fixture` metadata) in `beforeAll`; invites `eval-invite-<run>@sopstart.invalid`. `afterAll` deletes the membership (if the remove case failed) and both auth users.
- The invite uses `inviteUserByEmail`; if Supabase refuses a `.invalid` address the case fails at "Invite sent" and the fixture address will need a different non-deliverable domain.
- The Access case asserts `.bay` inside `office-pane` and the plant SOP title for the pinned address; screenshots `59-people`, `59-people-1024`, `59-people-invite`, `59-access` need reading.

## Known Stubs

None.

## Threat Flags

None beyond the register. T-59-43: UI mirrors the server's admin-only refusal and reverts on error. T-59-44: `initialSop` is passed through untouched (UUID-gated in 59-03). T-59-45: the join code renders only when the server returned it (admins). T-59-46: `.invalid` addresses, eval-site org, cleanup in `afterAll`.

## Self-Check: PASSED

- Files exist: PeopleTab.tsx, this SUMMARY; commits acca25a3 and 9fcce32f in `git log`.
- STATE.md and ROADMAP.md untouched; nothing pushed.
