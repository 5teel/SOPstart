---
phase: 64-leavers-and-suspended-members
plan: 03
subsystem: ui
tags: [people, office, membership-status, suspend, former-staff, eval]

requires:
  - phase: 64-02
    provides: suspendMember, markMemberLeft, reinstateMember, TeamMember.status
provides:
  - People tab Suspend, Has left and Reinstate with confirmation dialog
  - "Suspended" tag in the chart, Departments board, grid and person sheet; "Has left" tag on a departed person's sheet
  - collapsed "Former staff" group
  - Remove path deleted (removeMember, deleteOrgMember, remove.ts)
  - people.eval.ts deployed proof of cut-off, paused page, reinstate, has left, re-invite, self guard
affects: [64-04, 64-05, 64-06]

tech-stack:
  added: []
  patterns:
    - "UI partitions TeamMember once: present (active + suspended) feed every view, left feed Former staff, the sheet looks up in all"
    - "Eval proves the cut-off with the person's own pre-suspend bearer token against PostgREST, then refreshSession with the old refresh token"

key-files:
  created:
    - tests/phase64/people-states.spec.ts
    - tests/evals/people.eval.ts
  modified:
    - src/components/office/PeopleTab.tsx
    - src/components/office/OrgChart.tsx
    - src/components/office/DecisionsTab.tsx
    - src/actions/auth.ts
    - src/actions/governance.ts
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - tests/phase59/people-tab.spec.ts
    - tests/phase59/people-actions.spec.ts
    - tests/phase59/capability-matrix.spec.ts
    - tests/evals/office.eval.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
  deleted:
    - src/lib/members/remove.ts

key-decisions:
  - "Departed people are passed out of every view; PeopleTab keeps `everyone` only for the sheet lookup and the Former staff list"
  - "State buttons are ink, not red (ADR-0007); the dialog's confirm is ink"
  - "Chart seat counts come from people present in byUser, so a departed person's seat reads as empty"

patterns-established:
  - "Phone-width clipping check in an eval: assert the tag's right edge is inside its card and the card inside 390 px, then read the screenshot"

requirements-completed: [MEMB-05, MEMB-06]

duration: 3h
completed: 2026-10-23
---

# Phase 64 Plan 03: People UI and the end of Remove Summary

**An admin or safety manager can Suspend, mark as left and Reinstate people from the person sheet; suspended people stay visible with a tag, departed people sit in a folded Former staff group, Remove is gone from the code, and sopstart.com proves the cut-off, the paused page, reinstate and re-invite.**

## Accomplishments

- `MemberStateDialog` (`people-state-dialog` with `data-to`, `-confirm`, `-cancel`) replaces `RemoveDialog`, with the agreed copy; `confirmState()` and `reinstate()` wrap the three actions in try / catch / finally (`setStatePending(false)`, `setReinstating(null)`), send a receipt with "Signed out everywhere" and refetch People plus the Office inbox.
- Person sheet: `people-suspend`, `people-left`, `people-reinstate`; hidden for yourself and, for a safety manager, on an admin's sheet; role select disabled with "Reinstate them to change their role." for a non-active person; supervises picker lists active workers only.
- `people-status-tag` "Suspended" in the board card, grid row (`data-status` is the real state), chart pill (own line, so it never clips) and sheet; "Has left" on a departed sheet.
- `people-former` native `<details>` (closed by default, chevron) with `people-former-row` rows (name, role, "Left 23 Oct 2026").
- OrgChart counts seats from the people actually present.
- The Remove path is deleted: `removeMember`, the `deleteOrgMember` import and `src/lib/members/remove.ts`; the decision-writers data, the sweep list, people-actions and capability-matrix specs, the matrix Manage team row, journeys (`former` step) and uat (`phase64-leavers`) follow in the same change.
- `invite` of a departed person now says "Reinstated" in the receipt (the server already returned it).

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 | `c7a52260` | People UI, chart tag and seats, source contract, people-tab spec repointed |
| 2 | `0610c6f0` | Remove path deleted, registries, specs, matrix, journeys, uat |
| fix | `8ccdecca` | invite receipt says Reinstated |
| 3 | `8cb974aa` | people.eval.ts, office.eval.ts Remove leg removed (pushed) |
| fix | `150c4445` | Tag clipping fixes, Former staff chevron, Decisions What column, eval clipping assertion (pushed) |

## Verification Evidence

- `npx tsc --noEmit` exit 0; `npm run build` exit 0 (run twice). Bundle gates both times: `/sops/[sopId]/page` 802 KB (baseline 802, delta 0); `/page` 831 KB (baseline 834, delta -3, same as 64-01 and 64-02, not from this plan). `.bundle-baseline.json` untouched.
- `--project=phase64 --project=phase59 --project=phase56`: 275 passed, 17 skipped, 3 failed. The 3 are the pre-existing Phase 59 failures in `deferred-items.md` (`repoint-inventory` x2, `retirement-sweep` `updateRole`). `tests/lint`: 61 passed.
- Deployed run on the deploy of `150c4445` (Deploy to Fly success, `/api/version` serving it): `people.eval.ts` plus `office.eval.ts`, 27 of 27 passed, 0 retries. An earlier run on `8cb974aa` passed 5 of 5 for `people.eval.ts`; reading its screenshots found clipping, fixed in `150c4445` (fix round 1 of 2).
- Proof points in the eval: before the suspend A's token reads at least one members row and one sops row; after, the same token reads 0 and 0; `refreshSession` with the old refresh token errors with no session; A's browser at `/` ends on `[data-testid="pending"][data-status="paused"]` with "Your access to SOPstart Eval Site has been paused. Talk to your supervisor."; the sop-videos probes confirm the admin can sign a link inside the organisation folder and not outside it, and the suspended person cannot at all; after Reinstate a fresh sign-in reads sops again; B moves to Former staff and inviting the address returns one row with B's original membership id, status active, receipt "Reinstated"; the People ledger chip shows "Suspended someone", "Reinstated someone", "Marked someone as left"; the admin's own sheet has no state buttons.

## Screenshots read (`.planning/evals/latest/`)

| File | What it shows |
|---|---|
| `64-member-suspend-dialog.png` | Dialog "Suspend eval-site-suspend-...?" with the agreed body, Keep them / Suspend (ink), sheet behind with Suspend and Has left |
| `64-member-suspended-grid.png` | Grid, receipt "Suspended · logged in the decision ledger. Signed out everywhere", "Suspended" tag under the name |
| `64-member-suspended-chart.png` | After fix: tag on its own line under the name inside the pill, nothing clipped (before fix it read "Suspen") |
| `64-member-suspended-phone.png` | 390 px Departments view; after fix the tag sits beside the shortened email, card inside the viewport, "8 people" count visible (before fix the card ran off the right edge) |
| `64-member-paused.png` | "Access paused" page with the exact sentence and the sign out button |
| `64-member-sheet-suspended.png` | Sheet with Suspended tag, role select disabled with the note, footer Has left + Reinstate |
| `64-member-reinstated.png` | A's home (site map and list) after a fresh sign-in |
| `64-member-former.png` | Folded group opened: chevron, "Former staff 1", row with name, role, "Left 23 Oct 2026" |
| `64-member-former-phone.png` | 390 px Former staff fold open, row readable and unclipped |
| `64-member-sheet-left-phone.png` | Departed person's sheet at 390 px: "Has left" tag, note, only Reinstate |
| `64-member-ledger.png` | People chip with the three new words; after the Decisions What column widened "Marked someone as left" no longer truncates |
| `64-member-self.png` | The admin's own sheet: no buttons |
| `64-people-board.png`, `64-people-grid.png` (office eval) | Board and grid unchanged for active people; no Remove anywhere |

## Deviations from Plan

**1. [Rule 1 - Bug] Invite of a departed person showed "Invite sent"**
- **Found during:** Task 3 while writing the eval (the server returns `success: 'Reinstated'`, the receipt only knew "Added to the site").
- **Fix:** receipt uses the server word for "Added to the site" and "Reinstated".
- **Files:** `src/components/office/PeopleTab.tsx`

**2. [Rule 1 - Bug] "Suspended" tag clipped in the chart pill and overflowing the card at 390 px**
- **Found during:** reading the first deployed screenshots.
- **Fix:** chart tag on its own line; the department board section gets `min-w-0` so long emails truncate; eval asserts the tag sits inside its card at 390.
- **Commit:** `150c4445`

**3. [Rule 1 - Bug] "Marked someone as left" truncated in the Decisions What column**
- **Fix:** column `w-36` to `w-44` in `DecisionsTab.tsx`. **Commit:** `150c4445`

**4. [Rule 2 - Usability] Former staff fold had no visible sign it opens**
- **Fix:** chevron that rotates when open. **Commit:** `150c4445`

**5. [Rule 3 - Blocking] Python rewrote `src/actions/governance.ts` with CRLF**, which broke two `owner-review-meta` specs that match LF source. Converted back to LF; specs pass. No other effect.

**6. Commit ordering:** a stray `git rm` staged the `remove.ts` deletion into the first commit; I reset the local (unpushed) commit and re-committed so the deletion sits with Task 2.

**7. Spec detail:** `people-states.spec.ts` also asserts that no file in `src/` mentions `removeMember` or `deleteOrgMember` and that `remove.ts` is gone (plan only required the PeopleTab and OrgChart checks).

## Deferred Issues

- Three Phase 59 specs already failing on HEAD (see `deferred-items.md` from 64-01).
- New, in `deferred-items.md`: at 390 px, scrolled, the grid's sticky first column paints over the tab group (visible at the top of `64-member-former-phone.png`). The sticky column predates this phase.
- The People SupervisesPicker and the OrgChart seat picker (`members`) still list suspended people as seatable; plan 64-04 owns the active-only pickers.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-64-20 (state buttons are display; the server rules decide) is covered by the member-actions spec and the self-guard eval case; T-64-21 and T-64-23 by the disposable `.invalid` members, run-address assertions and in-memory tokens; T-64-22 by the deletion plus the source contract; T-64-24 by the one-row, original-id assertion.

## Self-Check: PASSED

- Files present: people-states.spec.ts, people.eval.ts, this summary; `src/lib/members/remove.ts` absent.
- Commits `c7a52260`, `0610c6f0`, `8ccdecca`, `8cb974aa`, `150c4445` in `git log`; pushed to origin master.
