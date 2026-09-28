---
phase: 52-worker-home-the-plant
plan: 04
subsystem: ui
tags: [playwright, source-contract, next-dynamic, bundle-gate, journeys, uat, tanstack-query]

# Dependency graph
requires:
  - phase: 52-worker-home-the-plant
    plan: 01
    provides: phase52 harness, worker-signal.ts (derivePlantPins/machineSops/pickNowQueue/askMatches/narrowForAsk/plantRelState), RelBadge.tsx, listSiteForWorker(), WorkerSiteData, Konva/voice bundle marker groups
  - phase: 52-worker-home-the-plant
    plan: 02
    provides: PlantStage.tsx (fit/flyTo/fitMachines handle), MachinePanel.tsx, scene.ts camera constants + zoneColour
  - phase: 52-worker-home-the-plant
    plan: 03
    provides: NowCard.tsx, PlantAskBar.tsx (second sanctioned WalkthroughVoiceModal dynamic site)
provides:
  - src/components/sop/plant/PlantHome.tsx -- PlantHome, the dynamic worker-home entry composing stage/chips/ask bar/Now card/panel
  - src/app/(protected)/sops/page.tsx render seam -- useViewport() + ['site-worker'] query gate a desktop non-admin worker with a drawn site into PlantHome, through a third next/dynamic({ ssr:false }) module
  - "plant home (52 D-01)" bundle-isolation marker group on both /sops/page and /sops/[sopId]/page
  - journeys.ts find-follow-sop plant branch + relabelled log-in worker-home step
  - uat/tests.ts plant-home-worker review item
affects: [52-05-eval, 53-phone-home-qr, 54-admin-repaint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A third page-level next/dynamic({ ssr:false }) module follows the same seam as the first two (SopWorkerBrowser, AdminSopSurface) -- page.tsx only ever grows a gate + a slot, never the module's own state/markup"
    - "A single useMemo derives every plant view-model value (pins, highlighted set, zone colours, stage machines, Now queue, selection, panel list, voice target) from one input set (site, sops, query, selectedId, zoneId) -- no second derivation anywhere in the component"
    - "Camera state changes only through the PlantStage imperative handle (open->flyTo, close->fit, pickZone->fitMachines/fit) -- PlantHome never touches transform maths directly"

key-files:
  created:
    - src/components/sop/plant/PlantHome.tsx
  modified:
    - src/app/(protected)/sops/page.tsx
    - tests/phase52/plant-render-seam.spec.ts
    - tests/phase41/merged-surface.spec.ts
    - scripts/check-bundle-size.ts
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts

key-decisions:
  - "The early-return slot sits inside SopsSection immediately after `const loading = isLoading || libraryLoading` -- after every hook in the component -- and hands PlantHome the exact `workerSops` list the Miller frame would have shown (D-01/D-05), never a second derivation"
  - "PlantHome's header comment and body avoid the literal words 'router'/'konva' entirely (case-insensitive for the latter) so its own wiring spec's negative-content assertions can check for them without the comment tripping itself (2026-09-28 self-tripped-guard class, now a third instance avoided pre-emptively)"
  - "tests/phase41/merged-surface.spec.ts SUR-02's dynamic-binding count updated 2 -> 3 -- PlantHome is a legitimate third lazy module on page.tsx, not a regression"

patterns-established:
  - "Adding a fourth next/dynamic bundle-isolation marker group to an existing GATED_ROUTES entry (rather than a new gate/script) is the sanctioned way to prove a new lazy module never leaks into a page's own chunk"

requirements-completed: [HOM-01, HOM-02, HOM-03, HOM-04, HOM-05, HOM-06]

# Metrics
duration: ~55min
completed: 2026-09-29
---

# Phase 52 Plan 04: PlantHome + Render Seam Summary

**`PlantHome` composes the Phase 52 worker desktop home (stage, department chips, ask bar, Now card, machine panel) entirely off `worker-signal.ts` + `scene.ts`, and `/sops` renders it through a third `next/dynamic({ ssr:false })` slot -- gated on `!isAdmin && viewport === 'desktop'` plus a session-scoped `listSiteForWorker()` query -- with the build gate proving both `/sops/page` and `/sops/[sopId]/page` land at Δ -2 KB against the untouched baseline**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Built `PlantHome.tsx`: one `useMemo` derives `sopsById`, machine pins (`derivePlantPins`), the ask-bar highlight set (`askMatches`), per-department zone colours (`zoneColour`), the composed `PlantStageMachine[]`, the Now queue (`pickNowQueue`), the selected machine + its narrowed SOP list (`machineSops`/`narrowForAsk`), and the voice-mic target SOP (first to-do `machineSops` entry via `plantRelState`, else the Now queue's head) -- from `site`, `sops`, `query`, `selectedId`, `zoneId` alone. Three named handlers (`open`/`close`/`pickZone`) are the ONLY way the camera moves, each going through `PlantStage`'s imperative ref (`flyTo`/`fit`/`fitMachines`). Renders `PlantStage`, a HUD of zone chips + `PlantAskBar`, `NowCard` (hidden while `loading`), `MachinePanel`, and a drag/zoom/click hint shown only when nothing is selected.
- Wired `/sops/page.tsx`: `useViewport()` + a non-persisted `['site-worker']` query (`enabled: wantsPlant`, 30 min staleTime, well under the scene URL's 1hr TTL) resolve `plantSite`; `SopsSection` gains `plant`/`onQueryChange` props and an early return `if (plant && onQueryChange) return <PlantHome .../>` placed after every hook, handing PlantHome the exact `workerSops` list already built. The toolbar search input hides (`!takeover && !plantSite`) since the plant's own ask bar takes over. Admin branch (`isAdmin ? <AdminSopSurface>`) is byte-identical.
- Flipped `tests/phase52/plant-render-seam.spec.ts` from 10 `test.fixme` stubs to 18 live tests across two describes (`render seam` on page.tsx, `PlantHome wiring` on the component) -- wiring assertions (handler bodies, prop bindings, hook-order position, no-persister scope), not mere string presence.
- Added the `"plant home (52 D-01)"` forbidden-marker group (`'No procedures for this machine yet.'`, MachinePanel's empty-state literal, verified unique to that file) to both `GATED_ROUTES` entries in `check-bundle-size.ts`. Extended `find-follow-sop` in `journeys.ts` with the desktop/map decision branch (`where -> plant -> pick -> panel`) ahead of the existing library path, and relabelled `log-in`'s `worker-home` step. Added the `plant-home-worker` plain-language review item to `uat/tests.ts`.
- `npm run build` green: `/sops/[sopId]/page` = 1046 KB (baseline 1048 KB, Δ **-2 KB**), `/sops/page` = 938 KB (baseline 940 KB, Δ **-2 KB**) -- both within ±2 KB tolerance; marker self-validation OK; `.bundle-baseline.json` unchanged since `736f44a` (confirmed via `git diff --quiet`). Compiled CSS carries `.plant-pin-bob` and `.w-95` (both from 52-02, still live).

## Task Commits

Each task was committed atomically:

1. **Task 1: PlantHome — compose stage, chips, ask bar, Now card and panel** - `3872666` (feat)
2. **Task 2: The /sops render seam — viewport gate, site query, PlantHome slot, toolbar input hand-off** - `7bf5f1e` (feat)
3. **Task 3: Plant bundle marker, journeys.ts + uat/tests.ts, build gate** - `cce0172` (docs)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified
- `src/components/sop/plant/PlantHome.tsx` - the dynamic worker-home entry, pure composition
- `src/app/(protected)/sops/page.tsx` - viewport gate, `['site-worker']` query, PlantHome render slot, toolbar hand-off
- `tests/phase52/plant-render-seam.spec.ts` - flipped fixme -> live (18 tests, 0 fixme remaining in `tests/phase52/`)
- `tests/phase41/merged-surface.spec.ts` - SUR-02's dynamic-binding count updated 2 -> 3
- `scripts/check-bundle-size.ts` - "plant home (52 D-01)" marker group on both gated routes
- `src/lib/journeys/journeys.ts` - `find-follow-sop` plant branch, `log-in` worker-home relabel
- `src/lib/uat/tests.ts` - `plant-home-worker` review item

## Decisions Made
- Combined both spec describes (`render seam`, `PlantHome wiring`) into a single rewrite of `plant-render-seam.spec.ts` for efficiency; commit boundaries still follow the plan's task split (Task 1 commit carries `PlantHome.tsx` + the whole spec file since the `PlantHome wiring` describe needed the component to exist first; Task 2 commit carries only `page.tsx`). No functional deviation — every test the plan asked for exists and passes.
- `voiceSopId` resolution: when a machine is open, the first of its `machineSops` whose `plantRelState` is due/never/new, else its first SOP; otherwise the Now queue's head SOP; else `null` — matches D-13 scope exactly (mic disabled when nothing to ask about).
- Zone-colour lookups use `colourByDept.get(m.department_id ?? '')` rather than a conditional branch, since a `null` department_id can never collide with a real UUID key — keeps the derivation flat.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SUR-02's dynamic-binding count assertion was stale against the intended change**
- **Found during:** Task 2 verification (`npx playwright test --project=phase41`)
- **Issue:** `tests/phase41/merged-surface.spec.ts` asserted `page.tsx` has exactly 2 `next/dynamic({ ssr: false })` bindings (`SopWorkerBrowser` + `AdminSopSurface`) — a Phase 41 guard written before Phase 52 existed. Adding the plan-mandated third binding (`PlantHome`) correctly failed that count.
- **Fix:** Updated the assertion to expect 3 bindings and reworded its title to name all three modules.
- **Files modified:** `tests/phase41/merged-surface.spec.ts`
- **Verification:** `npx playwright test --project=phase41` — 128/128 passed.
- **Committed in:** `7bf5f1e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — updating a count assertion to match an intentional, plan-mandated third dynamic module)
**Impact on plan:** No scope creep — the fix is the minimum edit to keep a legitimate pre-existing guard accurate after the plan's own change.

## Issues Encountered
None beyond the one auto-fixed count assertion above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- SC-1..5 (Phase 52) are wired end to end on `/sops` for a desktop worker with a drawn site; SC-3's fallback (today's list) holds for admin, phone width, no layout, zero machines, and any loading/error state.
- SC-6's build half is green; 52-05 owns the deployed-eval half (`tests/evals/plant-home.eval.ts`, already scaffolded in 52-01) plus the VALIDATION sign-off.
- Real production org (SOPstart) still has no drawn site — Simon will see the fallback list until a site is drawn at `/admin/site`; the eval-site org (Phase 51 fixture) is what 52-05's eval exercises against a real scene.
- No blockers.

## Self-Check: PASSED

- FOUND: src/components/sop/plant/PlantHome.tsx
- FOUND: src/app/(protected)/sops/page.tsx (PlantHome dynamic import + render slot present)
- FOUND: tests/phase52/plant-render-seam.spec.ts (0 test.fixme)
- FOUND: scripts/check-bundle-size.ts ("plant home (52 D-01)" x2)
- FOUND: src/lib/journeys/journeys.ts ("Plant home" present)
- FOUND: src/lib/uat/tests.ts ("plant-home-worker" present)
- FOUND commit 3872666 (git log --oneline)
- FOUND commit 7bf5f1e
- FOUND commit cce0172

---
*Phase: 52-worker-home-the-plant*
*Completed: 2026-09-29*
