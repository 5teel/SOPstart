---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 19
subsystem: retirement
tags: [r1, ret-01, repoint-inventory, spec-retirement, adr-0004]
requires: [63-17, 63-18]
provides:
  - "the machine-coverage request producer is gone; nothing raises 'this machine has no SOPs yet'"
  - "listOpenRequests no longer offers agent-raised machine requests (rows stay as data)"
  - "15 room-only specs deleted, 22 specs repointed to the home, so 63-20's deletion leaves every project green"
  - "repoint inventory live for 63-11, 63-15 and 63-19; the only 63-20 row left is ADR-0003's guard (rooms.spec.ts)"
affects: [63-20, 63-21]
key-files:
  created:
    - tests/phase63/home-structure.spec.ts
    - tests/phase52/scene-camera.spec.ts
  deleted:
    - src/lib/requests/machine-requests.ts
    - tests/phase52/plant-now-card.spec.ts
    - tests/phase52/plant-panel.spec.ts
    - tests/phase52/plant-pins-no-storage.spec.ts
    - tests/phase52/plant-pins.spec.ts
    - tests/phase52/plant-stage.spec.ts
    - tests/phase54/admin-machine-panel.spec.ts
    - tests/phase57/machine-body.spec.ts
    - tests/phase57/noticeboard.spec.ts
    - tests/phase57/one-query.spec.ts
    - tests/phase57/pins.spec.ts
    - tests/phase57/place.spec.ts
    - tests/phase57/search.spec.ts
    - tests/phase57/shell-structure.spec.ts
    - tests/phase57/stage.spec.ts
    - tests/phase59/shell-wide.spec.ts
  modified:
    - src/actions/office.ts
    - src/actions/site.ts
    - src/actions/shell.ts
    - src/lib/governance/load-inbox.ts
    - src/lib/sop/admin-health.ts
    - src/lib/requests/agent.ts
    - src/components/office/InboxTab.tsx
    - src/components/office/RequestsTab.tsx
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "The supervisor-only due-review call in getOfficeInbox is removed too: the home load (src/app/page.tsx) writes due reviews for every signed-in member since 63-13, so the call was a second writer. shell.ts keeps its own call until 63-20 deletes the file."
  - "InboxTab and RequestsTab no longer write the 'shell-admin' query cache. Only the unmounted admin shell read it, and both tabs imported its type from actions/shell.ts, which 63-20 deletes; leaving them would have broken 63-20's build. Removing a write to a cache nobody observes changes no behaviour."
  - "tests/phase60/overview-structure.spec.ts stays (its notification and request panel cases pin code in home/panels that survives); only its overview-composition cases went. It leaves the inventory because it no longer holds a retired token."
  - "The phase57/58/59/60 repoint inventories lost their rows for deleted specs, as 63-18 did for the one-screen eval."
  - "LIVE_PLANS is 63-11, 63-13, 63-15, 63-16, 63-18, 63-19. 63-14 stays out: tests/phase60/notification-places.spec.ts feeds the old addresses to the legacy-address reader, which is its job."
requirements-completed: []
completed: 2026-10-08
---

# Phase 63 Plan 19: remove the machine-coverage producer, retire the room specs

**The app no longer asks for a SOP because a machine has none, and the test suite no longer depends on the room code: 15 specs deleted, 22 repointed to the home, 2 new homes for the cases that outlive the rooms. Every project is green with the room code still present; the bundle gate reads `/page` 832 KB (baseline 831, +1) and the detail route 802 (baseline 802).**

## Task 1: R1 (commit c9f4a80b)

Callers found by grep, not by the plan's list alone (CLAUDE.md rule 5): `getOfficeInbox` (office.ts), `getAdminShell` (shell.ts), `upsertSiteMachine` and `setSopMachines` (site.ts). The rest of `src/` is clean: `grep -rn "reconcileMachineRequests\|machine-requests\|machinesWithoutSops" src` returns nothing.

- `src/lib/requests/machine-requests.ts` deleted; `machinesWithoutSops` removed from `admin-health.ts` (its only consumer was the producer).
- `setSopMachines` no longer reads the prior links (the read existed only to find machines that might now be bare).
- `listOpenRequests` adds `.or('raised_by_agent.is.null,subject_type.neq.machine')`: stored agent machine requests stay in the table and are not offered for answer. It is the only reader that lists requests for answering (`core.ts`, `ask-core.ts` read by id or by asker); session client and org filter unchanged.
- `raiseRequestAsAgent` stays (the agent can still raise a request); its header comment now says it has no caller today.
- CAPABILITY-MATRIX.md: the agent-request row, the "Link SOPs to machines" row (which also described the producer) and the notification row (which named the supervisor branch as a due-review writer) are corrected. No cell changed.
- Specs: `agent-requests` asserts the module is absent and nothing imports `requests/machine-requests` (by path), and the read's filter; `capability-matrix` anchors the new wording; `admin-health` drops its `machinesWithoutSops` cases; `review-due` points its caller check at `src/app/page.tsx`; `retirement-sweep` (phase60) spells the retired name from parts.

## Task 2: specs retired and repointed (commit 0789bf9b)

### Deleted (each with what now covers it)

| Spec | What it pinned | Covered now by |
|---|---|---|
| phase52 `plant-now-card` | the Now card | ADR-0004 rule 2 (nothing shows what is due); list row status in phase63 `sop-list` / `library` |
| phase52 `plant-panel` | machine body rows | Read (phase63 `read-view`); ADR-0004 rule 4 |
| phase52 `plant-pins` | worker-signal classifier for pins | ADR-0004 rule 2; `rowStatus` in phase63 `library` |
| phase52 `plant-pins-no-storage` | pins are never stored | ADR-0004 rule 2; the 63-20 no-rooms guard |
| phase52 `plant-stage` | PlantStage source + camera maths | camera half kept as `tests/phase52/scene-camera.spec.ts` (scene.ts still serves the site editor); stage half is room code |
| phase54 `admin-machine-panel` | admin machine panel | Manage > Site & departments (phase63 `manage-section`, site-editor eval) |
| phase57 `machine-body`, `noticeboard`, `pins`, `stage`, `search` | room bodies, pins, stage, room search | home MAP / HOME-02 evals and phase63 `site-map`, `sop-list` |
| phase57 `shell-structure` | frame + root page + layout + pathways | frame half is room code; the rest moved to `tests/phase63/home-structure.spec.ts` |
| phase57 `one-query` | admin shell read, shells | the `loadInbox` cases moved to `home-structure`; the shell cases are room code |
| phase57 `place` | the place module | phase63 `home-state` |
| phase59 `shell-wide` | wide shell pane | the home layout is CSS (phase63 `home-shell`) |

`tests/phase57/rooms.spec.ts` (ADR-0003's guard) stays; its inventory row now belongs to 63-20.

### Repointed (22)

`no-static-admin-lens-import` (home files, no shell files); `version-indicator` (now `rowStatus` + `useLibrary`); `create-entry`, `dead-weight`, `sb-auth-builder` (Manage's `manage-new` link is the one create entry); `no-refresher-gate`, `no-competency-gate-worker` (home list, row, Read); `nav-and-shim`, `reference-sweep` (Manage's draft rows link the editor); `site-workspace-wiring` (SiteEditSurface); `worker-path-contract` (HomeShell + `useLibrary`); phase57 `retirement-sweep`, phase59 `retirement-sweep`, `owner-review-meta`, `signoff-panel`, `office-pane-structure`; phase58 `frame-structure`, `focus-path`; phase59 `place-tab` (office tabs only); phase60 `bell-structure`, `objective-meta`, `office-requests`, `request-surfaces`, `overview-structure` (panels only), `retirement-sweep`; plus `phase33/sop-drilldown` (see deviation 3).

## Deviations from Plan

**1. [Rule 3 - blocking] InboxTab and RequestsTab imported `AdminShellData` from `actions/shell.ts` and wrote the `shell-admin` cache.** 63-20 deletes that file and its file list did not name the tabs. Removed the dead cache writes and the type import now (commit 0789bf9b); the phase59/60 specs that pinned the write were repointed to assert its absence.

**2. [Rule 1 - scope] More than the plan's file list needed R1.** The "Link SOPs to machines" and notification matrix rows also described the producer / a supervisor-branch review-due call; both corrected.

**3. [Rule 1 - Bug] `tests/phase33/sop-drilldown.spec.ts` was red.** It read the pin-keeping rule from `src/lib/shell/place.ts`, which 63-13 moved to `home-state.ts` (`uuid(x.pin)`); phase33 is not in the plan's project list so nobody saw it. Repointed in commit 0789bf9b. Found by running phase11, 28, 32, 33 and 43 as well.

**4. Plan said to move 63-20's rows to point only at `rooms.spec.ts`.** `place.spec` (deleted), `focus-path`, `place-tab` (cleaned of place-module cases) and `legacy-redirects` (no token) are done now, so 63-20's single row is `rooms.spec.ts`. `focus-path` and `place-tab` keep their surviving cases (`focusHref` / `backHref`, `tabsForRole`).

## Verification

- `npx tsc --noEmit` clean. ESLint: no finding in a touched file (pre-existing findings in other files only).
- `npm run build` exit 0; bundle gate: `/sops/[sopId]/page` 802 (baseline 802, +0), `/page` 832 (baseline 831, +1), all isolation and marker checks pass. `.bundle-baseline.json` untouched.
- phase15-stubs, 23-stubs, 30, 36, 37, 41, 51, 52, 54, 55, 57, 58, 59, 60, 63: 1350 passed, 28 skipped (self-skipping live probes), 0 failed. phase11-stubs, 28, 32, 33, 43: 143 + 44 passed, 0 failed after deviation 3.
- Acceptance greps: `grep -rln "ShellFrame|WorkerShell|AdminShell|PlantStage|NowCard|ROOM_IDS" tests --include=*.ts | grep -v "phase57/rooms.spec.ts|repoint-inventory|tests/lint/"` returns nothing; `reconcileMachineRequests|machine-requests|machinesWithoutSops` in `src` returns nothing; `raiseRequestAsAgent` export intact; `raised_by_agent` exclusion present in `listOpenRequests`.
- No deployed eval run (this plan changes tests and a removed behaviour; nothing user-visible appears). No change to `src/lib/journeys/journeys.ts` (no route changed).

## Handoffs

- 63-20: `tests/lint/no-walk-words.spec.ts` still names `MachinePanel` / `AdminMachinePanel` in its allowlist (exempt from the inventory by design); `phase57/retirement-sweep` keeps a path exemption for `src/lib/shell/place.ts` (harmless once deleted); `playwright.config.ts` comments name the deleted specs. `retirement-sweep` "the worker list is derived in exactly one place" now asserts a single owner of `['worker-last-completions']` and reads that owner, so moving `libraryQueryFn` into `useLibrary` keeps it meaningful. Append `'63-14'` and `'63-20'` to LIVE_PLANS and drop the `rooms.spec.ts` row. `SHELL_KEY` in `src/lib/shell/query-keys.ts` is now read only by the old shells; delete it with them.

## Known Stubs

None.

## Self-Check: PASSED

- `src/lib/requests/machine-requests.ts` absent; `tests/phase63/home-structure.spec.ts`, `tests/phase52/scene-camera.spec.ts` present; the 15 deleted specs absent; `tests/phase57/rooms.spec.ts` present.
- Commits c9f4a80b and 0789bf9b exist.
