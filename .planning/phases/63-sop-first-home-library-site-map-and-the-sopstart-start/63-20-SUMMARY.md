---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 20
subsystem: retirement
tags: [ret-01, adr-0005, no-rooms, bundle-gate]
requires: [63-19]
provides:
  - "the room code is gone: both shells, the frame, room bodies, plant stage, machine panels, Now card, pins, admin shell read, room tables, place module"
  - "ADR-0005 supersedes ADR-0003; tests/lint/no-rooms.spec.ts guards it (registered in phase15-stubs, mutation-proven)"
  - "repoint inventory live for 63-14 and 63-20"
affects: [63-21]
key-files:
  created:
    - docs/adr/0005-library-map-replaces-rooms.md
    - tests/lint/no-rooms.spec.ts
  deleted:
    - src/components/shell/{ShellFrame,WorkerShell,AdminShell,RoomBodies,AdminRoomBodies,SiteSummary,OfficeCard,SiteOverview}.tsx
    - src/components/sop/plant/{PlantStage,MachinePanel,NowCard,RelBadge}.tsx
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/actions/shell.ts
    - src/actions/site-worker.ts
    - src/lib/site/rooms.ts
    - src/lib/shell/place.ts
    - src/lib/sop/admin-health.ts
    - src/hooks/useWorkerSops.ts
    - tests/phase57/rooms.spec.ts
    - tests/phase54/admin-health.spec.ts
    - tests/phase52/site-worker-action.spec.ts
  modified:
    - src/lib/site/presets.ts
    - src/lib/validators/site.ts
    - src/actions/site.ts
    - src/hooks/useLibrary.ts
    - src/lib/sop/worker-signal.ts
    - src/lib/shell/office-tabs.ts
    - src/lib/shell/query-keys.ts
    - src/lib/notifications/places.ts
    - src/components/welcome/PromoReel.tsx
    - src/app/globals.css
    - docs/adr/0003-site-templates.md
    - docs/adr/README.md
    - playwright.config.ts
    - scripts/check-bundle-size.ts
    - scripts/decision-writers.json
    - CLAUDE.md
key-decisions:
  - "worker-signal.ts keeps only the WorkerSopRow type; every classifier in it (pins, Now queue, ask matching) had no importer left once the shells went. admin-health.ts had none at all, so the whole file went."
  - "libraryQueryFn moved into useLibrary.ts and useWorkerSops.ts was deleted (no importer). The `library-sops` cache key keeps one owner."
  - "PromoReel keeps its Office rectangle as a local constant of the old fractions, with a comment that the reel records the earlier app until its re-record. No visible change."
  - "Dead CSS removed with the pins: the plant-pin-bob keyframes in globals.css had no user. WIDE_TABS in office-tabs.ts had no reader but one pin line; both went."
  - "The marker 'Nothing unread.' lived in the deleted overview and now lives in NotificationsPanel (inside the lazy My record section); the group is relabelled, the literal is unchanged, self-validation still passes."
requirements-completed: [RET-01]
completed: 2026-10-08
---

# Phase 63 Plan 20: delete the rooms, record why

**The room metaphor is gone from the code and ADR-0005 (supersedes ADR-0003) is enforced by `tests/lint/no-rooms.spec.ts`, all in one commit (7c40f131, 64 files, -3534 lines). The bundle gate reads `/page` 832 KB (baseline 831, +1) and `/sops/[sopId]/page` 802 (baseline 802, +0): deleting the shells moved neither number, because they were already behind lazy seams.**

## Task 1 (commit 7c40f131)

`git show --name-status HEAD` lists `D src/lib/site/rooms.ts`, `A docs/adr/0005-library-map-replaces-rooms.md`, `M docs/adr/README.md`, `M docs/adr/0003-site-templates.md`, `A tests/lint/no-rooms.spec.ts`, `M playwright.config.ts`. `git diff HEAD~1 -- docs/adr/0003-site-templates.md` changes the Status line only (T-63-53).

### Importer proof

Before deleting I grepped every export of every file across `src/`, `tests/`, `scripts/`, `next.config.ts`. Every importer in `src/` was itself in the delete list, or a comment (reworded). The acceptance grep (`PRESET_ROOMS|roomsFor|ROOM_IDS|ShellFrame|WorkerShell|AdminShell|RoomBodies|SiteSummary|OfficeCard|SiteOverview|PlantStage|NowCard|getAdminShell|@/lib/shell/place'`) returns nothing in `src`. `SITE_PRESETS` still holds the template table.

| Deleted | Importers found | Resolution |
|---|---|---|
| the 8 shell files, 4 plant files, AdminMachinePanel | each other only | deleted together |
| `actions/shell.ts` | none left after 63-19 (InboxTab / RequestsTab were cut loose there) | deleted |
| `actions/site-worker.ts` | none (`listSiteForWorker` had no caller) | deleted with its phase52 spec |
| `lib/site/rooms.ts`, `lib/shell/place.ts` | presets.ts, validators/site.ts, places.ts, office-tabs.ts | each edited to drop the import |
| `lib/sop/admin-health.ts` | the deleted shell and panel only | deleted whole, with its phase54 spec |
| `hooks/useWorkerSops.ts` | `useLibrary` (its query function only) | function moved, hook deleted |

Kept on purpose: `AccountControl`, `NotificationBell`, `ObjectiveLine`, `ObjectiveSlot`, `WorkerObjective`, and the scene picture, machine polygons and site editor (admin data under Manage > Site & departments; `scene.ts` still serves the editor).

### Per-role entry points (T-63-52, Pitfall 6)

Every feature a deleted view opened still has an entry point per role: Read has Edit, Make a request and Ask; Manage has drafts, Site & departments and objectives; Training and My record are home sections; People keeps its pin. The machine-coverage "needs a SOP" prompt is gone by decision (ADR-0005 rule 5), not by orphaning.

### ADR-0005

Decision: (1) no rooms, plain sections by role; (2) the home map is drawn in code from the library (area by the R8 rule, one object per SOP, automatic layout, `--area-*` colours); (3) site templates give a picture, departments and machines and place nothing else, `site_layouts.preset` stays as data; (4) scene, outlines and site editor are admin data not read by the home; (5) no machine-coverage producer, and the "machine without a SOP" row of ADR-0002's table no longer applies (ADR-0002's decision unchanged). ADR-0003: Status line only. README: 0003 marked superseded (its guard named as retired), 0005 row added.

### Guard rules (`tests/lint/no-rooms.spec.ts`, comments stripped, its own words built from parts)

(a) the deleted modules, shells, `OneScreen`, `PlantStage`, `NowCard` and `machine-requests.ts` do not exist; (b) no room table, resolver or machine-coverage producer identifier in `src`; (c) no capitalised room word in any `src` `.ts` / `.tsx`; (d) no old place address in `src` except `home-state.ts` (the legacy reader); (e) ADR-0005 supersedes ADR-0003, index agrees. A self-test feeds the matchers an inline fixture and asserts they catch a room sentence, a room table and an old address, and ignore comments.

Mutation proof: a planted `src/lib/_probe.ts` with a room sentence turned the src case red; a planted `src/lib/site/rooms.ts` turned the existence case red; both removed. `npx playwright test --list --project=phase15-stubs | grep no-rooms` lists all four cases.

## Task 2

- Markers: `npm run build` exit 0, "Marker self-validation OK". Only one literal lived in a deleted module: `'Nothing unread.'` (the old overview). It now sits in `NotificationsPanel` inside the lazy My record chunk, so the group stays and is relabelled. The "from both shells" comment was reworded. No group was dropped.
- Bundle numbers: `/sops/[sopId]/page` **802 KB** (baseline 802, +0); `/page` **832 KB** (baseline 831, +1; tolerance +-2). Both within tolerance. `git diff --stat -- .bundle-baseline.json` is empty. **No baseline move is proposed.**
- `no-walk-words.spec.ts`: the three allowlist entries for the deleted folders are removed (the surviving `src/components/shell/` files are now scanned and clean); the assertion that named the removal plan now asserts the two remaining reasoned entries.
- Inventory: the `rooms.spec.ts` row and the `admin-health.spec.ts` row are gone (files deleted); `LIVE_PLANS` is 63-11, 63-13, 63-14, 63-15, 63-16, 63-18, 63-19, 63-20. `tests/phase60/notification-places.spec.ts` (the legacy-address reader test, which feeds old addresses to the reader by nature) joins the walk's data exclusions.
- CLAUDE.md "Current:" ADR line: ADR-0003 marked superseded by ADR-0005, ADR-0004 and ADR-0005 listed.
- `playwright.config.ts` comments naming deleted specs reworded; `SHELL_KEY` deleted with the old shells.

## Deviations from Plan

**1. [Rule 3 - blocking] Specs outside the plan's file list pinned the deleted code.** Repointed or trimmed in the same commit so every project stays green: `no-static-admin-lens-import`, `no-refresher-gate` (phase36), `no-competency-gate-worker` (phase37), `library-table` (phase54), `worker-path-contract` (phase55), `retirement-sweep` (phase57), `lineage-consumers` (phase58), `inbox-model`, `signoff-actions` (phase59), `ask-do-sop`, `notification-places`, `office-requests`, `review-due` (phase60), `sop-list` (phase63). Three specs for deleted modules went (`site-worker-action`, `admin-health`, `rooms`).

**2. [Rule 1 - Bug] `decision-writers-sweep` was red since before 63-10 (deferred-items: "63-19 ... list `restoreAccepted`").** 63-19 removed the other half (`reconcileMachineRequests`) but did not list `restoreAccepted`. Added an allow entry to `scripts/decision-writers.json`: the revert behind declineAsk / stopAsking makes no decision. phase56 is now fully green.

**3. [Rule 1 - Bug] The first draft of the no-rooms comment stripper missed `//` lines in CRLF files** (the dot does not match the carriage return), so two comments naming "the Office" tripped (c). Fixed by normalising line endings first. (`no-walk-words` uses the same stripper and has the same latent weakness; it passes today and was left alone, out of scope.)

**4. Task split.** `scripts/check-bundle-size.ts`, `CLAUDE.md`, the inventory and `no-walk-words` edits are in the Task 1 commit rather than a second one: the orchestrator asked for markers re-derived in the same commit as the deletion, and the inventory / allowlist assertions would have been red between two commits.

## Verification

- `npx tsc --noEmit` clean. `npm run build` exit 0; gate and markers as above.
- Projects: phase11-stubs, 15-stubs, 23-stubs, 26, 28, 30, 32, 33, 36, 37, 41, 43, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 63: 1589 passed, 60 skipped (self-skipping live probes), 0 failed after deviation 2 and the inbox-model fix (re-run of 56 + 59: 242 passed). Also phase21-stubs, 23-unit, 27-stubs, 28-unit, 29, 32-unit, 35-unit, 40: 254 passed. Final re-run of 15-stubs, 57, 60, 63 after the CLAUDE.md edit: 364 passed.
- Pushed to origin master (56cd3b45..7c40f131). `/api/version` served 7c40f131 within the first poll window.
- Deployed smoke (not the full eval; that is 63-21): a throwaway eval signed in as the eval worker and the eval admin and loaded `/` at 1440x900. Both returned 200, no page errors, and both screenshots were read. Worker: sidebar My SOPs and My record, list grouped by area (Engineering, Forming, General), isometric map with three labelled areas. Admin: the same home plus Training, Sign-offs, People and Manage SOPs. No room words, no counts on the sections. The throwaway file was deleted, not committed.

## Known Stubs

None.

## Handoff to 63-21

- The full deployed eval run (`npm run eval -- --phase 63`) and screenshot read-through are 63-21's. This plan ran only the two-role smoke above, to spare the shared OTP budget.
- `tests/phase26/konva-worker-isolation.spec.ts` keeps a case that self-skips because `src/components/sop/plant/` no longer exists; it can be deleted when convenient.
- GATE-01 and DOCS-01 stay open for 63-21 (sign-off, Learnings); RET-01 is ticked.

## Self-Check: PASSED

- `docs/adr/0005-library-map-replaces-rooms.md`, `tests/lint/no-rooms.spec.ts` present; `src/lib/site/rooms.ts`, `src/lib/shell/place.ts`, `src/hooks/useWorkerSops.ts`, `src/lib/sop/admin-health.ts` absent.
- Commit 7c40f131 exists and is on origin/master.
