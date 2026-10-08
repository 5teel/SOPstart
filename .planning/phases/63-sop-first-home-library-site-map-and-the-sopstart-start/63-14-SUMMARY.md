---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 14
subsystem: routing
tags: [addresses, redirects, retirement, deployed-eval, journeys, capability-matrix]
requires: [63-13, 63-15]
provides:
  - no component writes an old ?place= address or a room-named from token (SignOffPanel left to 63-16)
  - /activity and /admin/training are redirects (to /?s=record, /?s=training); their pages are deleted
  - tests/evals/home-addresses.eval.ts (five deployed cases, no test.fixme)
affects: [63-16, 63-17, 63-18, 63-20, 63-21]
key-files:
  modified:
    - next.config.ts
    - src/lib/journeys/journeys.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - .planning/codebase/ARCHITECTURE.md
    - src/app/(protected)/activity/[completionId]/page.tsx
    - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
    - tests/evals/home-addresses.eval.ts
  deleted:
    - src/app/(protected)/activity/page.tsx
    - src/app/(protected)/activity/loading.tsx
    - src/app/(protected)/admin/training/page.tsx
key-decisions:
  - "journeys.ts steps for the two retired pages use route '/' and name the section in detail: the pathways coverage matcher keys on the exact route string, so a query string would be an unmatched route."
  - "revalidatePath('/activity') in signOffCompletion became revalidatePath('/') (the list now renders on the home)."
  - "The completion detail's own header link now reads 'My record' and points at /?s=record (it was 'Activity' -> /activity, which would have been a redirect hop)."
  - "Requirements HOME-04, HOME-05, EVAL-01 are NOT ticked here: the focus screen's Back to a home state is proven only by unit specs until 63-18 rewrites sop-focus.eval, and EVAL-01 closes at 63-21. 63-21 ticks."
requirements-completed: []
completed: 2026-10-08
---

# Phase 63 Plan 14: Address sweep Summary

**Every old-address literal is gone from the components, `/activity` and `/admin/training` are no longer pages (their content is My record and Training, the old addresses redirect), and every legacy way into the app is proven on https://sopstart.com: 5 of 5 cases green on the first run, every screenshot read.**

## Deployed sha tested

`80b4b3aa` (`/api/version` confirmed serving it before the run). One run of `home-addresses.eval.ts`, `--workers=1 --retries=0`: 5 passed (1.8 m). No fix round needed.

## Repoint table as applied

| Old | New | Files |
|---|---|---|
| `/?place=workshop` | `/?s=manage` | ParseJobStatus, UploadDropzone, ThisSopBlock (delete redirect) |
| `/?place=edit` | `/?s=manage&view=site` | admin/settings page, MachinesButton |
| `/?place=dept:<id>` | `/?area=<id>` | WiringPatchBay |
| `from: 'workshop'` | `from: homeFrom({ ...HOME, s: 'manage' })` | UploadDropzone (x3), PromptClient, WizardClient, AdminRoomBodies |
| `from: 'office'` | `from: homeFrom({ ...HOME, s: 'signoffs' })` | ApprovePanel, DecisionsTab, InboxRow (x2), RequestRow (x3), lib/governance/inbox.ts |
| old shell `/admin/training`, `/activity` links | `/?s=training`, `/?s=record` | AdminShell, RoomBodies (x2) |
| `revalidatePath('/activity')` | `revalidatePath('/')` | actions/completions.ts |

SignOffPanel's `from: 'office'` is 63-16's, as planned. `AdminRoomBodies.tsx` was not in the plan's file list but carried a `from: 'workshop'` and the acceptance grep covers `src`, so it was repointed (Rule 3).

## Retired pages, redirects, pathways routes, matrix

- Deleted: `activity/page.tsx`, `activity/loading.tsx`, `admin/training/page.tsx`. `activity/[completionId]/` stays; the server `away` is `/?s=record` (worker) or `/?s=signoffs` (everyone else); same session-client read, same org filter, same `worker_id` check (T-63-39).
- `next.config.ts`: `/activity` (exact source, so `/activity/<id>` is untouched) -> `/?s=record`; `/admin/training` -> `/?s=training`; fixed destinations, `permanent: false` (T-63-38).
- `journeys.ts`: seven steps with `route: '/activity'` or `'/admin/training'` now `route: '/'` with "In My record." / "In the Training section." leading the detail. No other prose touched (63-17).
- `CAPABILITY-MATRIX.md`: Activity row (list lives in My record; non-owner redirect `/?s=signoffs`, worker `/?s=record`), Training matrix row (entry point is the Training section; guard stated as `requireAdminContext()` behind `listOrgTree` / `listDepartments`), Record observation row (admins record from the Training section). No cell changes.
- `ARCHITECTURE.md` line 147 pointed at `/activity` as a page; repointed (the route-docs lint reads it).

## Entry points after the deletion (CLAUDE.md 2026-10-06)

| Opened by the deleted page | Now | Admin / safety manager | Supervisor | Worker |
|---|---|---|---|---|
| `CompletionList` (own record) | My record section | yes | yes | yes |
| `AssessmentRequestsPanel`, `TrainingBridge` (matrix, PersonPanel, Record observation modal) | Training section | yes | none (unchanged: the gap recorded in the matrix since 59-15, Phase 61) | n/a |
| Completion detail | `/activity/<id>` page kept; Back goes to My record | n/a (owner only) | n/a | yes |

No role lost an entry point.

## Specs repointed in the same commits

Task 1: phase57 `machine-body`; phase59 `approve-actions`, `ledger-read`, `office-pane-structure`, `retirement-sweep`; phase60 `office-requests`, `retirement-sweep`.
After the push: phase54 `deletion-sweep` (the one permitted attention comparison now lives in home-state.ts; clears the 63-02 deferred item).
Task 2: phase30 `admin-nav`; phase37 `assessor-ui-observation` (now reads TrainingSection); phase41 `nav-and-shim`, `reference-sweep`; phase43 `dead-controls` (this also clears the 63-11 deferred item "dead state removed from the creation surfaces": the page now passes `initialTitle`); phase59 `capability-matrix`, `legacy-redirects`, `retirement-sweep`; phase63 `record-training` (now asserts the pages are gone and the two redirects exist).

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0; gate `/sops/[sopId]/page` 802 KB (baseline 802, +0), `/page` 832 KB (baseline 831, +1; tolerance 2). `.bundle-baseline.json` untouched |
| phase52/57/58/59/60/63 + phase15-stubs + phase43/37/41/30/55/28 (`--grep-invert "live\|probe"`) | 1309 passed, 3 skipped, 0 failed |
| `grep place= src` (excl. home-state, place.ts, SignOffPanel, ShellFrame, comments) | only `src/lib/journeys/journeys.ts` prose and `src/lib/uat/tests.ts` links/prose remain: 63-17 owns both (the links still resolve through the legacy readers) |
| `route: '/activity'` / `'/admin/training'` in journeys.ts | none (`src/lib/journeys/roles.ts` line 182 still names `/activity`; 63-17) |

## Eval results (deployed `80b4b3aa`, last and only run)

| # | Case | Result | Screenshots read (one-line reading) |
|---|---|---|---|
| 1 | legacy `?place=` addresses land on their section (admin) | pass | `63-addr-place-office`: URL `?s=signoffs`, Sign-offs, Inbox tab selected, No owner + three Stuck rows. `-office-requests`: Requests tab selected, EVAL Oven agent request with Accept / Decline. `-office-people`: People section, People & roles tab, member table. `-smoko`: My record, "0 completed procedures". `-workshop`: Manage SOPs with New SOP, Site & departments, drafts. `-noticeboard`: home My SOPs, list + isometric site map, nothing selected. `-edit`: Site & departments editor with Done, departments, machines. `-dept`: "In Forming" chip, one SOP, map zoomed to the Forming plate |
| 2 | `/activity`, `/admin/training`, `/admin/team`, `/governance`, `/admin/site` redirect (admin), plus worker typing the same | pass | `63-addr-redirect-activity`: My record. `-training`: Training section with department filter and matrix ("No people with required SOPs in this cut" for the pre-selected EVAL Area Lab, same default as the old page). `-team`: People. `-governance`: Sign-offs inbox. `-site`: Site & departments editor. `-worker-activity`: worker menu has only My SOPs and My record, My record open; a worker's `/admin/training` lands on the home (asserted, My SOPs current) |
| 3 | stored `/?place=office` notification opens Sign-offs from My record | pass | `63-addr-note-before`: notification row "63 eval stored office place" in My record. `-note-after`: Sign-offs open, Inbox tab, rows still loading as grey skeleton bars (frame taken mid-load; the tab and address are asserted) |
| 4 | Back from a bridged page (worker completion, admin non-owner, settings) | pass | `63-addr-completion-worker`: completion detail "Eval walk fixture SOP", Approved, five steps; layout bar "Back" and header link "My record", both to `/?s=record`, which the click then reached. `-completion-admin-away`: the admin opening that completion lands on Sign-offs. Settings Back asserted to `/?s=manage` and clicked |
| 5 | signed-out `/` still shows the promo reel | pass | `63-addr-signed-out`: `/welcome`, reel scene 1 "Your SOPs live in a Word doc.", Sign in button |

## Deviations from Plan

1. **[Rule 3 - blocking] Specs outside the plan's file list repointed** (listed above); each read a literal this plan changed or a file it deleted, and three of them failed to load at all once the pages were gone.
2. **[Rule 3] `AdminRoomBodies.tsx` repointed** (see above) because the Task 1 acceptance grep covers all of `src`.
3. **Plan asked journeys.ts to keep a query on `route` if the matcher accepts one**: it does not (exact-string coverage key), so `'/'` plus detail text.
4. The plan's Task 1 acceptance grep for `place=` also finds `journeys.ts` / `uat/tests.ts` prose and links; those are 63-17's and were left.

## Observations for the owning plans (not fixed here)

| Finding | Owner |
|---|---|
| `CompletionList`'s empty state on the home shows a black "Back to the site" button that links to `/`, i.e. back to the page the person is on (visible in the My record screenshots) | 63-16 (its plan already rewrites this empty state) |
| The completion detail shows two back controls: the layout "Back" bar and the header "My record" link, both to `/?s=record` | 63-18 / later polish, if wanted |
| `roles.ts` surface row still names `/activity` | 63-17 |
| The Sign-offs `63-addr-note-after` frame is a loading skeleton | cosmetic; asserted by testid |

## Known stubs

None.

## Commits

- `bae32e4b` sweep old place addresses and room-named from tokens out of the components
- `0c2cc57b` retire /activity and /admin/training into My record and Training
- `80b4b3aa` the home address eval, five deployed cases

## Self-Check: PASSED

`activity/page.tsx`, `activity/loading.tsx`, `admin/training/page.tsx` absent; `activity/[completionId]/` present; `s=training` and `s=record` in `next.config.ts`; `home-addresses.eval.ts` has no `test.fixme`; all three commits on origin/master; `.bundle-baseline.json` unmodified.
