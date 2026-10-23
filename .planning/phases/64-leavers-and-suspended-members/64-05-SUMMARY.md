---
phase: 64-leavers-and-suspended-members
plan: 05
subsystem: governance
tags: [handover, inbox, approvals, owner-picker, eval]

requires:
  - phase: 64-04
    provides: active-only membership reads, statusSuffix, member-status guard
provides:
  - HandoverItem and the handover chip / kind ("Needs a new owner") in the Sign-offs inbox
  - listHandover() read for admin and safety manager
  - reassignApprovalStep(sopId, userId) action (owner_change)
  - OwnerPicker assign / eligible / allowNone props
  - InboxRow handover branch with a one-click fix per kind
  - OrgChart seat picker offers active people only; guard pins the three pickers
  - deployed eval case 4 green on sopstart.com
affects: [64-06]

tech-stack:
  added: []
  patterns:
    - "One picker, three actions: OwnerPicker takes an assign callback and an eligible filter; the server action re-checks who may be picked"
    - "A handover row is a derived inbox item (no table): deriveInbox maps a typed HandoverItem list"

key-files:
  created:
    - tests/phase64/handover.spec.ts
  modified:
    - src/lib/governance/inbox.ts
    - src/lib/governance/load-inbox.ts
    - src/actions/approvals.ts
    - src/components/admin/governance/OwnerPicker.tsx
    - src/components/office/InboxRow.tsx
    - src/components/office/InboxTab.tsx
    - src/components/office/OrgChart.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase59/inbox-model.spec.ts
    - tests/phase59/people-tab.spec.ts
    - tests/phase59/office-pane-structure.spec.ts
    - tests/lint/member-status.spec.ts
    - tests/evals/people.eval.ts

key-decisions:
  - "A governance row flagged unowned that still names an owner (a suspended or departed person) takes the handover chip and the words 'Needs a new owner'; one with no owner stays 'No owner'"
  - "Chain, supervision and ask rows link to or call the existing fix; only departments and in-flight approval steps use the picker"
  - "reassignApprovalStep refuses a step held by someone still active, so it cannot be used to take over a live approval"

requirements-completed: [MEMB-09, MEMB-10, MEMB-12, MEMB-13]

duration: 3h
completed: 2026-10-24
---

# Phase 64 Plan 05: Needs a new owner

**Admins and safety managers see everything a suspended or departed person was looking after under one Sign-offs inbox chip and hand each item on with the owner picker or the usual action; a stuck in-flight approval can be handed to an active admin or safety manager, each step in the ledger.**

## Accomplishments

- `inbox.ts`: `HandoverItem` (department, approval_step, chain_step, ask, supervision), kind `handover`, chip `handover` ("Needs a new owner", right after "No owner"), `deriveInbox({ handover })`, meta lines naming the person, `handover: null` on every older constructor, counts.
- `load-inbox.ts`: `listHandover()` (admin and safety manager only, session client, returns `[]` at once when nobody is non-active) reads departments, approval chains, pending approvals (next step via `resolveNextStepIndex`), accepted asks, and workers with no active supervisor; labels carry "(left)" / "(suspended)". `loadInbox` passes it to `deriveInbox`. SOPs a departed person owns are the existing unowned rows, now chipped "Needs a new owner" with "Owned by {name} (left)."
- `approvals.ts`: `reassignApprovalStep` (requireAdmin, uuid ids, active admin / safety-manager target, pending approval only, next step must name someone no longer active, update filtered by id and pending and ended in select, then `owner_change`). The only trigger on `sops` is the insert-only `set_sop_owner_default`, so the write resets nothing.
- `OwnerPicker`: optional `assign`, `eligible`, `allowNone`; `sopId` optional; `setSopOwner` stays the default.
- `InboxRow`: handover branch: department and approval-step pickers (approval picker offers admins and safety managers only, no "No owner"), "Stop asking" for an ask, "Open approval settings" for a chain, "Open People" for a worker with no supervisor. One `office-row-action` per row.
- Docs in the same change: matrix row "Reassign what a leaver owned", journeys step `handover`, uat tryIt line and question.
- Picker gap from 64-04: the OrgChart seat picker now lists active people only (and its empty line follows); the People "supervises" picker already filtered to active workers since 64-03 (checked, no change); `tests/lint/member-status.spec.ts` gains a test pinning the owner, supervises and seat pickers to active.

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 | `d848a427` | handover model, listHandover, reassignApprovalStep, spec (RED first, see below) |
| 2 | `ed3ffa86` | OwnerPicker props, InboxRow handover branch, matrix, journeys, uat, spec repoints |
| gap | `71c23068` | seat picker active only, picker guard |
| 3 | `8071f1ec`, `0b73bf39` | eval case 4, ledger assertion by the words the list shows |
| fix | `2461c0d6` | picker no longer clipped on the last inbox row |
| eval | `7396bfe8` | scroll the option into view before the reachability check (pushed with the next push of this plan) |

TDD: `tests/phase64/handover.spec.ts` failed before the implementation (function `reassignApprovalStep` not found, type errors on `HandoverItem`) and passed after (27 passed with inbox-model, ledger-every-action and member-status).

## Verification Evidence

- `npx tsc --noEmit` exit 0. `npm run build` exit 0 (run twice). Bundle gates both times: `/sops/[sopId]/page` 802 KB (baseline 802, delta 0); `/page` 831 KB (baseline 834, delta -3, unchanged since 64-01). `.bundle-baseline.json` untouched.
- `--project=phase64 --project=phase59 --project=phase28 --project=phase56`: all pass except the three Phase 59 failures already in `deferred-items.md` (`repoint-inventory` x2, `retirement-sweep` `updateRole`). `--project=phase63` adds the known `home-shell` bundle-seams failure (independent of this plan, noted in 64-04). `tests/lint`: 67 passed.
- Deployed run on the deploy of `2461c0d6` (Deploy to Fly success, `/api/version` serving it): `people.eval.ts` 6 of 6 passed, 0 retries (cases 1 to 6). The final run also passed with the reachability assertion fixed (eval-only change, app code identical).
- Screenshots read (`.planning/evals/latest/`):

| File | What it shows |
|---|---|
| `64-member-handover.png` | 1440 px, chip "Needs a new owner 3" selected; three rows (owner SOP, department, approval), each tagged "Needs a new owner", the left person's address followed by "(left)", button "Reassign" |
| `64-member-handover-phone.png` | 390 px, same three rows, wrapped text, buttons inside the viewport, bottom tab bar; no horizontal overflow |
| `64-member-handover-picker.png` | approval row's picker open: only the site admin, the safety manager and the other safety-manager fixture; no workers, no "No owner", the left person absent; fully visible on the last row |
| `64-member-handover-done.png` | receipt "Approval handed on · logged in the decision ledger"; the same SOP now an Approve row owned by the site admin |
| `64-member-handover-ledger.png` | Ownership chip: "Changed owner" rows for the approval SOP and the owner SOP, plus "Handed an approval step to someone else" and "Changed the SOP owner" |

## Deviations from Plan

**1. [Rule 1 - Bug] Owner picker clipped on the last inbox row**
- **Found during:** reading the first deployed `64-member-handover-picker.png`. The shared `.list` is `overflow: hidden`, so with one row left the open picker was cut off (pre-existing for a lone No owner row; far more likely now that handing over empties the list).
- **Fix:** the inbox list is `overflow-visible` with `rounded-t-lg` / `rounded-b-lg` on its first and last rows; the eval asserts the option is reachable (hit test).
- **Files:** `src/components/office/InboxTab.tsx`, `tests/evals/people.eval.ts`. **Commit:** `2461c0d6`.

**2. [Rule 3 - Blocking] Existing specs pinned the old shapes.** `phase28/governance-queue` wants the literal `setSopOwner(sopId, userId)` in the picker (kept via a default-only call); `phase59/people-tab` WR-03 names the awaited calls (added `assign(`); `phase59/office-pane-structure` counts one button per branch in the chain (chain now starts after the handover branch, with its own test for the four handover buttons); `phase59/inbox-model` chip order gains `handover`.

**3. Eval assertion adjusted.** The ledger shows "Changed owner" and the SOP title in separate columns (the summary words are in details), so the eval reads those. Fix rounds used: 2 of 2 (ledger words; reachability check).

**4. Plan wording.** The plan said the supervises picker still lists suspended people; it already filtered to active workers (64-03). Only the seat picker needed the filter.

## Deferred Issues

- Three Phase 59 specs and the `home-shell` bundle-seams spec fail on HEAD independent of this plan (see `deferred-items.md`, 64-04).
- An admin cannot untick an already-linked suspended worker in the People supervises picker (it lists active workers only); the server accepts unlinking any row. A small follow-up if it matters.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model: T-64-40 (requireAdmin, uuid ids, active admin / safety-manager target), T-64-41 (only the next step, only when its holder is not active, filtered by id and pending, select-checked), T-64-42 (role guard, session client), T-64-43 (owner_change on every reassignment), T-64-44 (picker only chooses; actions re-check).

## Self-Check: PASSED

- Files present: `tests/phase64/handover.spec.ts`, this summary.
- Commits `d848a427`, `ed3ffa86`, `71c23068`, `8071f1ec`, `0b73bf39`, `2461c0d6`, `7396bfe8` in `git log`.
