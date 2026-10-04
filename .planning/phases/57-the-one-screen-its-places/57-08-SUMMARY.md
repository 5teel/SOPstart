---
phase: 57-the-one-screen-its-places
plan: 08
subsystem: shell-retirement
tags: [proxy-redirect, bundle-gate, retirement, one-screen, guards]
requires: [57-07]
provides:
  - server-side redirects for every legacy list address (proxy)
  - worker list page, plant home, ask bar, worker list, bottom sheet, library card and overlay machine panel deleted
  - bundle gate on /sops/[sopId] and / only
affects: [57-09, 57-10]
tech-stack:
  added: []
  patterns: [proxy redirect with cookie copy and UUID-gated carry, baseline moved down by hand]
key-files:
  created: []
  modified:
    - src/lib/supabase/middleware.ts
    - src/components/sop/plant/MachinePanel.tsx
    - src/components/shell/OneScreen.tsx
    - scripts/check-bundle-size.ts
    - scripts/capture-bundle-baseline.ts
    - .bundle-baseline.json
    - src/lib/journeys/journeys.ts
    - src/lib/journeys/roles.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase57/retirement-sweep.spec.ts
    - tests/phase57/repoint-inventory.spec.ts
  deleted:
    - src/app/(protected)/sops/page.tsx
    - src/app/(protected)/sops/loading.tsx
    - src/components/sop/plant/PlantHome.tsx
    - src/components/sop/plant/PlantAskBar.tsx
    - src/components/sop/WorkerSimpleList.tsx
    - src/components/sop/CategoryBottomSheet.tsx
    - src/components/sop/SopLibraryCard.tsx
decisions:
  - "WorkerShell is a static import again (orchestrator decision 2026-10-05): bundle-neutral for /sops/[sopId] (795), and the / baseline is 831 KB, the first measurement of the worker's real first download"
  - "Whole-subject specs deleted only where every assertion was about a deleted subject; library-table, library-filter-deeplink and list-rows keep their surviving halves for 57-09 (inventory rows unchanged)"
requirements-completed: []
metrics:
  tasks: 3
  commits: 3
  completed: 2026-10-05
---

# Phase 57 Plan 08: Retire the worker list page and plant home Summary

Every old list address now redirects on the server, every link points at the one screen, and the list page, plant home and their worker surfaces are gone, with the bundle gate, pathways map, roles map and capability matrix updated in the deletion commit.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 104f4cb | Proxy block for `/sops` and `/governance?view=library`; link repoints; guards on the old rule and literals |
| 2 | eb46968 | Guards on surviving behaviour moved onto the worker shell / plant files |
| 3 | c40b8fa | Deletions, gate swap, journeys + roles + matrix, whole-subject spec deletions, UAT link hrefs |

## What was built

- **Proxy redirects** (`src/lib/supabase/middleware.ts`, where the old attention rule sat): `/sops?view=attention` -> `/governance`; `?view=access` -> `/admin/access` (carrying `?sop=` only when it matches the UUID regex); any other `/sops` -> `/`; `/governance?view=library` -> `/`. Fixed destination strings, refreshed cookies copied onto the redirect, no client effect (T-57-32/33/34). `next.config.ts` still maps `/admin/sops` -> `/sops`, so legacy admin bookmarks reach this block.
- **Links repointed**: WorkerActivityView -> `/` ("Back to the site"); builder back link -> `/`, delete exit -> `/?place=workshop`; builder page redirect -> `/`; SOP detail page back links -> `/` ("Back to the site"); ParseJobStatus and UploadDropzone "see drafts" -> `/?place=workshop`; ai-fields `revalidatePath('/')` x2.
- **Deleted**: list page + its loading boundary, PlantHome, PlantAskBar, WorkerSimpleList, CategoryBottomSheet, SopLibraryCard; the overlay `MachinePanel` export and its class constant (the file keeps `MachineBody` and `SopRows`).
- **Gate**: `/sops/page` removed from `GATED_ROUTES` (and from `capture-bundle-baseline.ts`, which now lists `/page`); the library-table marker group is gone; the plant marker on `/sops/[sopId]/page` is relabelled "one screen machine body".
- **Maps**: `journeys.ts` has no step routed at the list page (role home, find-and-open, admin home, assign, filter prose repointed to `/` and the Noticeboard / machines / Workshop); `roles.ts` surface row is the one screen at `/`; CAPABILITY-MATRIX Self-add row and the Phase 41/54/57 route note rewritten (`/` mounts WorkerShell or the lazy AdminShell by `useIsAdmin()` -- a mount decision, never the gate; `getAdminShell`, `listSiteForWorker`, `listAdminAccessData` are the gates).

## Build and bundle gate (final numbers, build run 3)

```
check-bundle-size: /sops/[sopId]/page = 795 KB (baseline 795 KB, delta 0 KB, tolerance +-2 KB)
check-bundle-size: /page = 831 KB (baseline 831 KB, delta 0 KB, tolerance +-2 KB)   [after 97644f2; was 565 in run 3]
check-bundle-size: Bundle isolation OK / pdfjs + mammoth / konva isolation OK
check-bundle-size: Marker self-validation OK
```

`npm run build` exit 0, `npx tsc --noEmit` clean.

### Baseline changes (all DOWN, by hand, history entries written)

| Route | Before | After | Note |
|-------|--------|-------|------|
| `/sops/page` | 817 | removed | moved to history, "Phase 57-08: route deleted" |
| `/sops/[sopId]/page` | 817 | 795 | list page route chunks left the build |
| `/page` | 792 | 565, then 831 | 565 measured with the worker shell behind `next/dynamic`; 831 is the real first download after the static import was restored (orchestrator decision, up move signed off) |

### WorkerShell static import -- decided (phase-57 orchestrator, 2026-10-05)

Decision: restore the STATIC `WorkerShell` import in `OneScreen` (the 57-04 plan's original design; the `next/dynamic` split only existed to dodge the now-deleted `/sops` list route). `AdminShell` stays the `next/dynamic({ ssr:false })` seam. Commit `97644f2`.

Final numbers (`npm run build` + postbuild gate, exit 0):

```
check-bundle-size: /sops/[sopId]/page = 795 KB (baseline 795 KB, delta 0 KB, tolerance +-2 KB)
check-bundle-size: /page = 831 KB (baseline 831 KB, delta 0 KB, tolerance +-2 KB)
```

`/page` baseline set to the measured 831 KB (tolerance unchanged, `/sops/[sopId]` baseline untouched). The history note in `.bundle-baseline.json` says: the earlier 792/565 values were measured with the worker shell in a lazy chunk the gate could not see; 831 is the first measurement of the worker's actual first download on `/`; like-for-like the retired `/sops` list page measured 795 KB after the 57-04 gate fix and 57-06 header deletion, so the one screen costs +36 KB (stage, rooms, frame, Now card). A new phase57 assertion in `one-query.spec.ts` pins the static WorkerShell import next to the existing lazy-AdminShell seam assertion; no phase41 spec pinned the old dynamic import.

Gates after the change: `npx tsc --noEmit` clean; `npx playwright test --project=phase57 --project=phase41 --project=phase15-stubs` 234 passed, 6 skipped, 0 failed (run once).

## Guard sweep (Task 1) -- hits and repoints

| File | Hit | Repoint |
|------|-----|---------|
| tests/sb-builder-infrastructure.test.ts:14 | builder page list redirect | now expects the redirect to `/` |
| tests/phase28/library-and-worker.spec.ts:147 | attention-rule condition literal | asserts the new block (`path === '/sops'`, `view === 'attention'`, `destination = '/governance'`); list-page `not.toContain` line dropped |
| tests/phase43/route-truth.spec.ts:106 | attention-rule literal | same three assertions |
| tests/phase41/merged-surface.spec.ts:209 | attention-rule literal | same (file deleted in Task 3, proxy assertions live in phase57) |
| tests/phase33/wayfinder-header.spec.ts:71 | regex form `href="/sops"` on the builder back link -- **missed by the Task 1 sweep**, found by the Task 2 project run | now `href="/"` on `wayfinder-back`; committed in Task 2 (Task 1 commit was therefore red on phase33 alone) |
| tests/phase54/deletion-sweep.spec.ts | permits one `=== 'attention'` in middleware | still exactly one (`view === 'attention'`), count unchanged |
| tests/phase57/retirement-sweep.spec.ts | `retire list` proxy half | filled: `/sops` block, three destinations, UUID check, cookie copy, `/governance` library rule, no client copy, `next.config` `/admin/sops` map, fixed destinations |

## Moved assertions (Task 2 / Task 3)

- `no-static-admin-lens-import`: worker-surface contract now reads OneScreen, ShellFrame, WorkerShell, RoomBodies, SiteSummary, OfficeCard, AccountControl; plus OneScreen reaches AdminShell only through `dynamic(`.
- `version-indicator`: Updated signal = `hasNewerVersion` -> `plantRelState` `new` -> `RelBadge`, informational only.
- `no-refresher-gate`, `no-competency-gate-worker`: targets are the worker shell files, MachinePanel (body), NowCard, RelBadge.
- `worker-path-contract`: WorkerShell uses `useWorkerSops`, has no sync / offline labels, renders `sops-load-error` on `libraryError`.
- `plant-panel`: MachineBody / SopRows only; overlay width and inert tests removed.
- `dead-weight`, `create-entry`: department-filter and list-page halves dropped; "no Create SOP" now asserted on the worker shell.
- `nav-and-shim`: worker shell has no builder link.
- From deleted `plant-render-seam` into phase57 `retirement-sweep`: plant imported only by plant dir and shell; `['site-worker']` query has no persister.
- From deleted `merged-surface` into phase57 `retirement-sweep`: worker list derived in exactly one place (`useWorkerSops`), shell holds no copy; legacy admin redirect map.
- `bundle-gate.spec`: exactly two gated routes, no library-table marker group, list route only in history.
- Deleted outright: merged-surface, plant-render-seam, plant-ask-bar, worker-library-chip.

## Deviations from Plan

**1. [Rule 1/3 - inventory conflict] Three "delete" specs kept with survivors.** Task 3 says delete library-table, library-filter-deeplink and list-rows; the 57-01 inventory marks them `repoint, 57-09, kept (survivors)`, and they guard things that still exist (BuilderCategoryButton, builder action menu, WiringPatchBay, resolveLibraryNav). Per the plan's own rule ("never delete a guard on something that still exists") I removed only their list-page/worker-list halves from library-table (WorkerSimpleList and page-seam describes) and left the other two untouched (their hits were comments only). 57-09 removes their AdminLibraryTable halves with the table. `plant-render-seam` was deleted and its inventory row changed to `delete, 57-08`.

**2. [Rule 3 - blocking] `src/lib/uat/tests.ts` link hrefs and ARCHITECTURE.md.** Task 3's own verify runs `no-dead-internal-hrefs`, which fails on 22+ UAT `href: '/sops'` / `/sops?view=access` entries and on the route docs. I repointed only the hrefs (`/` and `/admin/access`) and one ARCHITECTURE.md sentence. The prose that names the SOP list, SopLibraryCard and PlantHome in `uat/tests.ts` is still 57-09's (retirement-sweep excludes that file from its names check until then).

**3. [Rule 3 - blocking] Extra spec edits outside `files_modified`.** `tests/phase57/machine-body.spec.ts` and `tests/phase52/plant-now-card.spec.ts` read PlantHome.tsx; `tests/phase54/deletion-sweep.spec.ts` asserted the library-table gate label; `scripts/capture-bundle-baseline.ts` still listed `/sops/page`. All repointed in the deletion commit.

**4. WorkerShell kept dynamic, then made static** -- first held back to avoid a baseline up-move; the orchestrator then signed off the move (see the decision section above, commit `97644f2`).

## Residue (documented, not fixed)

- `src/lib/sop-list/admin-rows.ts:197` -- `libraryNavToUrl` still builds `/sops?...` (57-09 deletes it with AdminLibraryTable).
- Historical comments naming the deleted admin page or `/sops` in `admin-access-view.ts`, `admin-sop-list.ts`, `BuilderCategoryButton.tsx`, `WiringPatchBayShell.tsx`, `flag-display.ts`, `admin-rows.ts`, `AdminLibraryTable.tsx` -- prose only, not links.
- `src/lib/uat/tests.ts` prose naming SopLibraryCard / PlantHome (57-09). `tests/evals/plant-home.eval.ts`, `sop-surface.eval.ts` still name the deleted components (57-10 deletes them).
- `/pathways`: `journeys.ts` has no `route: '/sops'` anywhere; the phase57 shell-structure "pathways map covers every page route" spec passes.

## Verification

| Gate | Result |
|------|--------|
| `npm run build` + postbuild gate | green (numbers above) |
| `npx tsc --noEmit` | clean |
| phase57, 55, 41, 52, 54, 43, 23-stubs, 28, 30, 36, 37, 15-stubs | green |
| phase11-stubs | 8 known pre-existing failures (Puck era / wizard), unchanged |
| phase46, phase32, phase33, phase36, phase37 live probes | passed earlier in the plan (phase46 at Task 1 and Task 3, 33/36/37 at Task 2); in the final combined run 7 + phase46's 11 live-RLS probes failed only with `verifyOtp failed: Request rate limit reached` -- the shared Supabase OTP budget, environment not regression (CLAUDE.md 2026-09-28). Not looped. |

## Known Stubs

None added.

## Threat Flags

None. `/sops` redirects use fixed destinations; `sop` is appended only when it is a UUID; cookies are copied; no client redirect.

## Notes for the orchestrator

- REQUIREMENTS.md not touched (SHL-01 / PLC-03 tick at plan close is yours); STATE.md and ROADMAP.md not touched; nothing pushed.
- Resolved: `/` baseline is 831 KB with WorkerShell inline (decision above); no open decisions.

## Self-Check: PASSED

- Commits 104f4cb, eb46968, c40b8fa exist on master.
- `src/app/(protected)/sops/page.tsx` absent; `src/app/(protected)/sops/[sopId]/` present.
- `.bundle-baseline.json` diff: `/sops/page` to history, `/sops/[sopId]/page` 817 -> 795, `/page` 792 -> 565 (then 565 -> 831 by orchestrator decision in `97644f2`, measured, with history note).
