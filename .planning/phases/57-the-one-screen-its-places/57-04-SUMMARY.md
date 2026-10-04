---
phase: 57-the-one-screen-its-places
plan: 04
subsystem: ui
tags: [shell, worker, supervisor, noticeboard, bundle-gate, pathways]
requires:
  - phase: 57-02
    provides: ShellFrame, AccountControl, room layer
  - phase: 57-03
    provides: loadInbox, getAdminShell
provides:
  - "/ branches on the session on the server: landing, /pending, or the one screen"
  - WorkerShell (worker + supervisor), OneScreen with the lazy AdminShell seam, ProtectedProviders
  - MachineBody / SopRows, in-flow NowCard, RoomBodies, SiteSummary, OfficeCard
  - "/page" bundle gate entry, baseline 805 KB recorded by hand, one-screen journey
affects: [57-05, 57-06, 57-08]
status: BLOCKED on one decision - npm run build is red (see Open Decision)
key-files:
  created:
    - src/components/shell/WorkerShell.tsx
    - src/components/shell/OneScreen.tsx
    - src/components/shell/AdminShell.tsx
    - src/components/shell/SiteSummary.tsx
    - src/components/shell/OfficeCard.tsx
    - src/components/shell/RoomBodies.tsx
    - src/components/providers/ProtectedProviders.tsx
  modified:
    - src/app/page.tsx
    - src/components/sop/plant/MachinePanel.tsx
    - src/components/sop/plant/NowCard.tsx
    - src/components/sop/plant/PlantHome.tsx
    - src/components/shell/ShellFrame.tsx
    - src/hooks/useWorkerSops.ts
    - src/hooks/useCompletions.ts
    - src/lib/sop/worker-signal.ts
    - scripts/check-bundle-size.ts
    - .bundle-baseline.json
    - src/lib/journeys/journeys.ts
requirements-completed: []
completed: 2026-10-05
---

# Phase 57 Plan 04: Worker shell, root page and the `/` gate Summary

Workers and supervisors now land on the one screen at `/` (list, isometric site with rooms, detail pane); `/` is bundle-gated and mapped in the pathways. Admins reach the lazy `AdminShell` seam, which renders the worker view until 57-05. **`npm run build` is red** because the existing `/sops` and `/sops/[sopId]` gates read +4 KB (tolerance +2); see Open Decision.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1. Machine body, in-flow Now card, room bodies, summary, Office card | 66c106d | machine-body spec live; phase52 93, phase55, token lints green |
| 2. WorkerShell, OneScreen + AdminShell seam, ProtectedProviders, session-branching page | 82fd2cc | phase57, phase52, phase55, lints green; tsc clean |
| 2b. Worker shell split into its own chunk; stage empty while loading | dc7f0ff | see Open Decision |
| 3. `/page` gate, baseline, journey, pathways coverage | 3417aa5 | phase57 + phase41 green (139 passed, 13 skipped fixme for later plans) |

## Open Decision (build is red)

`npm run build` fails in the postbuild gate:

```
check-bundle-size: /sops/[sopId]/page = 821 KB (baseline 817 KB, delta +4 KB, tolerance +-2 KB)
check-bundle-size: Bundle bloat: /sops/[sopId]/page grew by 4 KB
```

`/sops/page` measures the same 821 KB (the two routes share one chunk set, as before). Baselines for these two were NOT touched.

**Cause (measured, not guessed).** Every route's client-reference manifest lists the client modules the root page pulls in (`OneScreen.tsx` and `next/link` appear in the manifests of `/activity`, `/governance` and `/login` too), and `check-bundle-size.ts` sums all chunks those modules need. Same family as the 2026-09-29 learning and the known `/sops/page`-counted-against-detail blind spot.
- Worker shell imported statically from OneScreen: 854 KB (+37 KB). The page chunk, ShellFrame/PlantStage chunk and hooks all became part of the list.
- Worker shell behind `next/dynamic` (server-rendered, so it is preloaded with the page): 821 KB (+4 KB). What remains is the root page's own chunk (2.7 KB: OneScreen, plus duplicate copies of QueryProvider and RoleProvider that the layout already carries) and rounding. Moving the providers into the lazy chunk would save about 1 KB, still +3.

**Options for the owner (a baseline change needs a signed-off decision per CLAUDE.md 2026-09-13):**
1. Raise `/sops/[sopId]/page` and `/sops/page` baselines 817 to 821 as a recorded decision (the 4 KB is real first-load cost of the new root page that the instrument charges to every route; no user of those routes downloads it).
2. Fix the instrument so a route is not charged for the root page's chunks (the existing blind spot, same class); baselines then stay at 817. Needs the same sign-off because it changes what every number means.
3. Keep chasing bytes (providers into the lazy shell, prop-based role fork); likely lands at +3, so not enough alone.

Recommendation: option 2, then re-measure. Nothing else in the plan depends on this choice.

Also note: with the shell split off, the recorded `/page` figure (805 KB) measures the root page without the lazy worker-shell chunk. `/page` still guards the admin seam (the `Draw machine`, konva, pdfjs, mammoth markers fail the build if AdminShell or the editor is imported statically), but it does not size the worker shell. If option 2 is chosen, the shell can go back inline and `/page` should be re-measured once before anything else relies on it (it was recorded once, by hand, before this decision existed).

## Verification

- `npx tsc --noEmit`: clean.
- `npx playwright test --project=phase57`: all live tests pass (fixme stubs for 57-05..10 remain skipped). phase41 pass. phase52 93 passed. phase55 213 passed. phase15-stubs (design-tokens, no-undefined-css-tokens, no-dead-internal-hrefs and the rest) 80 passed.
- `npm run build`: compiles, then fails at the gate above. Verified the `/page` branch of the gate separately by running `check-bundle-size.ts` against a temporarily raised baseline: `/page = 805 KB (baseline 805, delta 0)`, forbidden markers absent from `/page`, marker self-validation OK (baseline file restored byte-for-byte afterwards).
- Not run: deployed eval (nothing is pushed; 57-10 owns the eval).

## Deviations from Plan

**1. [Rule 3 - Blocking] Worker shell split behind next/dynamic.** The plan has OneScreen render WorkerShell directly. That made the existing gates read +37 KB, so OneScreen loads WorkerShell through `next/dynamic` (server-rendered). OneScreen still mounts AdminShell only through `dynamic(ssr: false)` gated on `useIsAdmin()`. Result is +4 KB, not zero; see Open Decision.

**2. [Rule 1 - Bug] ShellFrame showed "The site has not been drawn yet." while the site query was still loading.** Added an empty `shell-stage-loading` div for the loading case. (`ShellFrame.tsx`, commit dc7f0ff.)

**3. [Plan wording] `OfficeWorkerBody({ role, pending })`.** The supervisor count is passed in from WorkerShell so there is exactly one `pending` value feeding the Office card, the Office pin and the Office body.

**4. [Rule 3] Two more phase52 guards repointed** (`plant-render-seam.spec.ts` matched `!loading && <NowCard`; the PlantHome wrapper div now sits between). Plan only named `plant-now-card.spec.ts`.

**5. journeys.ts landed one commit after the route** (3417aa5 after 82fd2cc) because the gate work was Task 3; both are unpushed and in the same plan.

**6. `src/lib/journeys/routes.ts` was not changed.** It walks sub-directories only, so `/` is not listed on the "All screens" panel at all; the pathways coverage spec adds `/` itself. Closing that gap is a small follow-up if wanted.

## Known Stubs

None in new code. Workshop and Office say requests arrive in a later update (the plan's wording, D-12). `AdminShell` renders the worker view until 57-05, by design.

## Threat Flags

None new. T-57-14 (server `getSessionContext()` decides landing / `/pending` / screen), T-57-15 (no new read path; `listSiteForWorker`, RLS reads), T-57-16 (`/page` markers; WorkerShell and RoomBodies import nothing from `@/actions/governance` or `components/admin`, spec-pinned), T-57-18 (organisation name read with the session client, id from the session, rendered as text) are covered by source-contract specs.

## Self-Check: PASSED (with the build caveat above)

- Files exist: WorkerShell, OneScreen, AdminShell, SiteSummary, OfficeCard, RoomBodies, ProtectedProviders, this SUMMARY.
- Commits found: 66c106d, 82fd2cc, dc7f0ff, 3417aa5.
- STATE.md and ROADMAP.md not modified. Nothing pushed.
