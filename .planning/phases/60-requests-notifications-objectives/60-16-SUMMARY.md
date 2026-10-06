---
phase: 60-requests-notifications-objectives
plan: 16
subsystem: shell
tags: [bell, overview, notifications, bundle-gate, evals, journeys]
requires: [60-07, 60-14, 60-15]
provides:
  - NotificationBell (browser-client unread count) and the ShellFrame renderBell slot
  - SiteOverview mounted under SiteSummary in both shells (lazy)
  - worker Office card "Go to my requests"
  - deployed eval cases (a)-(f) incl. all five NTF-02 triggers
affects: [60-17, 60-18]
key-files:
  created: [src/components/shell/NotificationBell.tsx, tests/evals/lib/walk.ts]
  modified:
    - src/components/shell/{ShellFrame,WorkerShell,AdminShell,RoomBodies,SiteOverview}.tsx
    - scripts/check-bundle-size.ts
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - tests/evals/{requests,sop-focus}.eval.ts
    - tests/phase60/{bell-structure,overview-structure,repoint-inventory}.spec.ts
    - tests/phase59/office-pane-structure.spec.ts
completed: 2026-10-06
status: BLOCKED on one bundle gate (see below)
---

# Phase 60 Plan 16: Bell, overview mount and trigger evals Summary

The list header has a bell beside search (ink badge, hidden at 0, "99+" cap, browser-client read, no polling) that selects the overview and requests the Notifications section; both shells show the counts card with the lazy overview under it; the worker Office card points at My requests; the deployed eval covers the loop, the ask, and every NTF-02 trigger.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | ab3bff6c | NotificationBell, `renderBell` slot, placeholder "Search…", bell-structure cases |
| 2 | 786f4a53 | overview + bell mounted, Office card copy, `/page` marker, journeys, UAT, repointed pins |
| 3 | 8e1f381f | walk helper to `lib/walk.ts`, eval cases (a)-(f) |
| 2 (fix) | 3aa481d4 | bell behind `next/dynamic` (bundle fallback ii) |

## Bundle gate: ONE ROUTE STILL RED (rounding edge) -- orchestrator decision needed

Final build (run twice, identical):

| Route | Baseline | Now | Δ | Gate |
|-------|---------:|----:|--:|------|
| `/page` | 834 | 836 | +2 | ok |
| `/sops/[sopId]/page` | 792 | **795** | **+3** | **red (tolerance 2)** |

Marker self-validation OK (checked with the tolerance temporarily widened in a throwaway copy of the script; the real script stops at the first red route). `.bundle-baseline.json` untouched.

What was done, in the plan's order:
- **Summed-file diff first.** Building with the shell edits reverted vs applied, the counted chunks for `/sops/[sopId]` differ only in the webpack runtime chunk (5382 to 5477 bytes: one more entry per new lazy chunk). The gate sums raw bytes, so the real change is about +95 bytes, which carries the rounded figure from 794.44 to 794.53 KB: 794 became 795. (The gate also skips the `/sops/[sopId]` page chunk because its manifest path is URL-encoded; known blind spot from 2026-09-29, not changed here.)
- **Fallback (i)** (lazy `ObjectiveLine` in `BrowseDocument`): no effect on the gate, because it only moves code out of the uncounted page chunk. Reverted.
- **Fallback (ii)** (lazy bell): needed for `/page` (static bell: 838, +4; lazy: 836, +2). Kept. It adds one more runtime entry, so `/sops/[sopId]` stays at 795.
- **One chunk saved:** `SiteOverview` now imports `ObjectiveSlot` plainly (it is already the lazy seam for the editor), removing a 401-byte chunk and 23 bytes of runtime; `overview-structure.spec.ts` repointed.
- With every lever the plan allows used, the remaining overshoot is under 0.2 KB of real bytes on the SOP route. Not recaptured, not edited. Options for the orchestrator: (1) find 0.2 KB elsewhere in the counted shared chunks, (2) merge two lazy chunks (e.g. `ObjectiveLine` is a shared async chunk between `WorkerObjective` and `SiteOverview`), (3) a signed-off baseline decision by the owner. `npm run build` currently exits non-zero at postbuild; do not push until resolved.

## Eval cases (authored and `--list`ed only, never run)

`requests.eval.ts` lists 12 cases. New (60-16): (a) loop twice (accept, then decline with a reason; bell count, bell click focus, open to My requests, mark-read), (b) ask then new version v2 then decline through the lineage, (c) review-due sweep with dedupe, (d) two-step chain: divert and non-final approval, with the chain row deleted first in a `finally`, (e) a sent walk notifies the supervisor, (f) overview order, empty states, 44x44 bell, real-org read-only. The cron helper is the 60-11 `postCron` (wrong bearer 401, then the fail-fast CRON_SECRET message). Every notification is found by its title. Only the 60-17 case remains `fixme`.

Cases written from the plan text without a live run: element ids `plant-panel-row`, `plant-now-card`, `office-row`, `ask-mode-person`, the "Find a person…" input and a person button matched by `/worker/i`, the focused element after a bell click containing "Notifications", and the publish route accepting an empty POST (as the dialog sends). Expect small selector fixes at 60-18.

## Other changes

- Search placeholder is now "Search…" (repoint inventory live for `60-16`; no spec or eval used the old text).
- `OfficeWorkerBody({ onMyRequests })` gives "Your requests are on the site overview." plus "Go to my requests".
- Journeys: one-screen journey gains overview, bell, open-a-notification and My requests steps. UAT: `p60-site-overview`.
- Repointed pins: `tests/phase59/office-pane-structure.spec.ts` (OfficeWorkerBody now takes a prop), `tests/phase60/overview-structure.spec.ts` (ObjectiveSlot import).

## Verification

`npx tsc --noEmit` clean; `npm run build` compiles, postbuild red as above; phase57, phase59, phase60, phase52, phase15-stubs: 548 passed, 25 skipped (later plans); `--list --project=evals requests` lists 12.

## Deviations

1. **[Rule 3] Bell lazy** (fallback ii) rather than static, for the `/` gate.
2. **[Rule 1] Pins repointed** that the plan did not list (phase59 office-pane, phase60 overview-structure).
3. **Gate not green** for `/sops/[sopId]`, see above.

## Known Stubs

None. STATE.md and ROADMAP.md untouched. Not pushed.

## Self-Check: PASSED

NotificationBell.tsx, lib/walk.ts and this summary exist; commits ab3bff6c, 786f4a53, 8e1f381f, 3aa481d4 exist.
