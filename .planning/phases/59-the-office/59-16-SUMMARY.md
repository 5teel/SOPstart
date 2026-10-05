---
phase: 59-the-office
plan: 16
subsystem: verification
tags: [deployed-eval, sign-off, requirements, learnings]
requires: [59-15]
provides:
  - "59-EVAL.md: 74/74 deployed eval with a reading note per 59-* screenshot"
  - "59-VALIDATION.md signed off (nyquist_compliant: true, status: complete)"
  - "OFF-01..06, DEC-02, SHL-06 ticked in REQUIREMENTS.md"
  - "four CLAUDE.md Learnings entries"
affects: []
requirements-completed: [OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, DEC-02, SHL-06]
key-files:
  modified:
    - tests/evals/office.eval.ts
    - src/components/office/OfficePane.tsx
    - .planning/phases/59-the-office/59-VALIDATION.md
    - .planning/phases/59-the-office/deferred-items.md
    - .planning/REQUIREMENTS.md
    - CLAUDE.md
  created:
    - .planning/phases/59-the-office/59-EVAL.md
decisions:
  - "Eval invite uses eval-invite-<run>@sopstart.com: Supabase refuses .invalid, and its built-in SMTP allows about one invite an hour, so full eval runs are spaced"
  - "Office tab bar padding px-3 to px-2 so four tabs fit 400 px with a two-digit Inbox count"
  - "Eval-only fixes were run with --no-wait against the live app of identical code, then the final full run was made at the deployed HEAD"
metrics:
  completed: 2026-10-06
  tasks: 2
---

# Phase 59 Plan 16: Prove the Office on the deployed site Summary

**The deployed Office passed its eval 74/74 at `cd59bfb`, every one of the 25 `59-*` screenshots was read and noted in `59-EVAL.md`, the build and the full suite were run once with only rate-limit reds (re-run green), and the eight requirements are ticked.**

## Result

| Gate | Result |
|---|---|
| `npm run eval -- --phase 59` at `cd59bfb` (served by Railway) | 74 passed / 0 failed / 0 skipped |
| Real-org case alone at `2d1ba6c` (after the tab-bar fix deployed) | passed, screenshot re-read |
| `npm run build` (bundle gate) | exit 0; `/page` 833 KB (baseline 834), `/sops/[sopId]/page` 794 KB (792); on Railway `/page` read 832 and 834 |
| `npm run test` (once) | 2046 passed, 223 skipped, 6 failed -- all `phase46/sop-edit-owner-access` live probes with `verifyOtp failed: Request rate limit reached` (environment; the evals had just spent the OTP budget). Re-run of that spec once after the window: 14/14 passed. No non-live failure; `phase40/dat01` is green. |
| `npx tsc --noEmit`, `--project=phase59` + `phase15-stubs` | clean; 184 passed, 9 skipped |
| Compiled CSS | all eight classes (`lg:min-w-140`, `lg:w-[58%]`, `bg-accent-signoff`, `bg-accent-decision/10`, `bg-ai/10`, `h-18`, `max-h-80`, `max-w-md`) compile to a rule |
| `/pathways` | `/admin/training` is mapped; no journey names `/governance`, `/admin/team` or `/admin/access` as a route; Office journeys describe Inbox, Decisions, People & roles and Access |

All five roadmap criteria were proven on the deployed site: the inbox drains one button at a time to "Nothing needs you. That's the goal."; a supervisor and an admin sign off or reject with photos, and an approver approves or sends back; owner and review date show on the machine panel, Noticeboard, Workshop and This SOP and the owner marks reviewed; the Decisions tab reads newest first and narrows by kind while the widened pane keeps the map live; an admin invites, changes a role both ways, removes a person with confirmation, sees departments and opens the unchanged access wiring.

## Commits

| Commit | What |
|---|---|
| cd59bfb9 | `test(59-16)`: office eval fixes (machine-carrying Write a SOP link, photo-count filter, sent-back count from the database, `@sopstart.com` invite, bridge Back click) |
| 2d1ba6c2 | `fix(59-16)`: Office tab bar fits at 400 px with a two-digit Inbox count |
| (docs commit) | SUMMARY, `59-EVAL.md`, `59-VALIDATION.md` signed off, requirements ticked, Learnings, deferred items |

## Deviations from Plan

**1. [Rule 1 - Eval bugs] Five eval faults** found by running the deployed site: the Write a SOP assertion pinned a bare address, the photo-count regex ended in `\b` against text that runs into the button, the worker card was read before its query landed, the invite used a domain Supabase refuses, and the bridge Back click hit the wrapper. None hid a product defect; each is in `tests/evals/office.eval.ts` (`cd59bfb9`).

**2. [Rule 1 - Product bug] Tab bar clipped.** With the real org's 16-row inbox the fourth tab ("Access") was cut off at 400 px (visible only in `59-real-org-office`). `px-3` to `px-2`, tap height unchanged (`2d1ba6c2`).

**3. [Process] Railway deploy of `df9999e` failed with no logs** after a green build (image push done, no health check). `railway redeploy` did nothing; `serviceInstanceDeployV2(commitSha)` through the GraphQL API queued about 20 minutes, then built and deployed the same commit. The eval was then run at HEAD.

**4. [Process] Evals run with `--no-wait` while fixing.** The eval-only fixes do not change the app, so the live `df9999e` was a valid target; the report of record is the final full run at `cd59bfb` after its deploy, and the tab-bar fix was proven by a one-case run at `2d1ba6c`.

## Screenshot findings (all minor, none block a requirement)

Listed in `59-EVAL.md` and `deferred-items.md`: the 400 px Inbox meta line wraps "· 1 / photo"; the lightbox shows arrows with one photo; the red NO OWNER badge (Phase 54) and the amber No owner chip (59-07) say the same thing; the override field sits below the fold of `59-signoff-override` (it is visible in `59-reject-dialog`); `59-legacy-redirects` is taken before the shell queries land (pins 0, map blank for a moment).

## Learnings logged (CLAUDE.md)

Four entries dated 2026-10-06: `organisation_members` had no delete policy (zero-row writes and the second best-effort server call); first lazy module that imports CSS costs mini-css runtime in the shared chunk and Railway's gate differs from a local build by 1-2 KB; deleting a view can orphan a feature for another role; deployed-eval traps that each burned a run (seven items, including the real-org-only tab clip and the hourly invite limit).

## Requirements

OFF-01..OFF-06, DEC-02 and SHL-06 are ticked and Complete in the traceability table. SHL-06 is proven for the three tabs that widen (Decisions, People & roles, Access); the training matrix is a bridge page (decision A-05) and re-homes in Phase 61.

## Known Stubs

None.

## Issues

None open for Phase 59. Carried forward: "Record observation" has no supervisor entry point until Phase 61; `materializeOrgAccess()` has no caller (`deferred-items.md`).

## Self-Check: PASSED

- `.planning/phases/59-the-office/59-EVAL.md` exists with the 74/74 table and a reading note for each of the 25 `59-*` shots
- `grep -c "test.fixme" tests/evals/office.eval.ts` prints 0; `grep -n "nyquist_compliant: true"` and `grep -n "delete policy" CLAUDE.md` both return a line; eight `[x]` requirement lines
- commits `cd59bfb9` and `2d1ba6c2` exist on master and are pushed; STATE.md and ROADMAP.md untouched
