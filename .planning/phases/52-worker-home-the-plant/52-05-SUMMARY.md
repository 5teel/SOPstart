---
phase: 52-worker-home-the-plant
plan: 05
subsystem: testing
tags: [playwright, deployed-eval, tanstack-query, offline-sync, bundle-gate]

# Dependency graph
requires:
  - phase: 52-worker-home-the-plant
    plan: 01
    provides: phase52 harness, worker-signal.ts, listSiteForWorker(), Konva/voice bundle marker groups, eval-site-worker fixture + published assigned SOP
  - phase: 52-worker-home-the-plant
    plan: 02
    provides: PlantStage.tsx, MachinePanel.tsx, scene.ts camera helpers
  - phase: 52-worker-home-the-plant
    plan: 03
    provides: NowCard.tsx, PlantAskBar.tsx
  - phase: 52-worker-home-the-plant
    plan: 04
    provides: PlantHome.tsx, the /sops render seam, plant home bundle marker
provides:
  - tests/evals/plant-home.eval.ts (live, D-16) -- deployed proof of SC-1..6 on sopstart.com
  - scripts/run-evals.mjs --workers=1 -- serial eval runs so site-editor's org reset cannot race the plant eval
  - fix -- useSopSync now invalidates ['assigned-sops'] after every completed sync
  - 52-EVAL.md, signed-off 52-VALIDATION.md, a CLAUDE.md Learnings entry
affects: [53-phone-home-qr, 54-admin-repaint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A React Query hook whose queryFn reads a LOCAL cache a separate process writes to asynchronously needs an explicit invalidateQueries call wired to that writer's completion -- populating the local store is not the same as telling the query to re-read it"

key-files:
  created:
    - tests/evals/plant-home.eval.ts
  modified:
    - scripts/run-evals.mjs
    - src/hooks/useSopSync.ts
    - .planning/phases/52-worker-home-the-plant/52-VALIDATION.md
    - .planning/phases/52-worker-home-the-plant/52-EVAL.md
    - CLAUDE.md

key-decisions:
  - "getByRole('searchbox', { name: 'Search SOPs' }) must use { exact: true } -- Playwright's default name match is a case-insensitive substring, and PlantAskBar's aria-label 'Ask or search SOPs' contains 'search SOPs', so the loose form false-counted the ask bar as the hidden toolbar search box"
  - "The pin/Now-card/panel-badge bug found live is fixed at its root (useSopSync's sync completion), not worked around in the eval -- it is a real defect that would silently hide a brand-new worker's assigned SOPs in production, reload included, until the 5-minute staleTime happened to expire"
  - "52-VALIDATION.md's nyquist_compliant/pending grep acceptance criteria only resolve to the intended counts once the Automated Command cell and the sign-off checklist item are reworded to avoid re-quoting the literal grep target -- matched the pattern already established in 51-VALIDATION.md rather than inventing a new one"

patterns-established:
  - "A deployed eval's beforeAll that shares a production org/scene with a sibling eval's destructive beforeAll must run --workers=1 and re-ensure (upsert, never delete) every row it depends on, every run"

requirements-completed: [HOM-01, HOM-02, HOM-03, HOM-04, HOM-05, HOM-06]

# Metrics
duration: ~32min
completed: 2026-09-29
---

# Phase 52 Plan 05: Deployed Eval, Root-Cause Fix, Validation Sign-Off Summary

**Authored the live `plant-home.eval.ts` deployed eval (D-16), found and fixed a real production bug it exposed (a worker's first-ever sync could stay invisible indefinitely because `useAssignedSops()`'s persisted query cache was never invalidated after `useSopSync` finished writing to Dexie), and closed the phase with 14/14 deployed evals green on sopstart.com plus a signed-off `52-VALIDATION.md`**

## Performance

- **Duration:** ~32 min (first commit 00:33:36 → last commit 01:05:50, 2026-09-29, all times AEST/UTC+10)
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified) across 5 commits

## Accomplishments

- Wrote the live deployed eval `tests/evals/plant-home.eval.ts`: a `beforeAll` that re-ensures the eval-site org's scene/machine/`sop_machines` link on every run (upsert only, hard-asserted never the real SOPstart org id), then two tests covering every D-16 assertion -- scene render, ≥1 polygon, pin on EVAL Press, Now card + Walk href, panel open/badge/Walk href, close → fit, department-chip camera fit, ask-bar highlight (match/no-match/re-match), voice dialog open/close, Show me, no scope column, no console errors -- plus the no-site-worker fallback test with a self-skip if the real org has since grown a drawn site.
- Added `--workers=1` to `scripts/run-evals.mjs` so `site-editor.eval.ts`'s destructive org reset (deletes the eval-site org's whole layout, cascading machines and links) cannot race the plant eval reading the same org.
- **Found and root-cause-fixed a real production bug via the deployed eval**, not worked around: `useAssignedSops()` reads Dexie through a React Query hook (`staleTime` 5 min, persisted). On a worker's very first page load that query resolves against an empty Dexie an instant before `useSopSync`'s own first sync finishes writing the newly-assigned SOP -- the resulting `[]` then stays "fresh" for 5 minutes with nothing to invalidate it, and a reload rehydrates the same stale persisted snapshot rather than refetching. Symptom on the deployed page: the Now card said "Nothing due", the machine panel listed the fixture SOP row with no rel badge, and the pin stayed `0` for 45+ seconds even though Dexie, the `sop_machines` link and RLS were all independently confirmed correct by direct probing (service-role DB checks, an as-the-user RLS probe, and an in-page `indexedDB.open` dump). Fixed by having `useSopSync.triggerSync()` call `queryClient.invalidateQueries({ queryKey: ['assigned-sops'] })` after every completed sync, mirroring the existing invalidation already done in `handleAdd`/`handleRemove` on the same page.
- Fixed a second, smaller bug in the eval itself (not the product): `getByRole('searchbox', { name: 'Search SOPs' })` without `exact: true` is a case-insensitive substring match, so it also matched PlantAskBar's `aria-label="Ask or search SOPs"` -- gave a false failure on the very first deployed run before the real bug was even reached.
- Ran every gate in order once each: `tsc --noEmit` clean; `phase52`/`phase26`/`phase41`/`phase30` projects 334/334 passed; `tests/lint` 30/30 passed; full suite once (23 failures, all ⊆ the 16 `51-BASELINE-FAILURES.md` stubs plus 7 `phase46 sop-edit-owner-access.spec.ts` failures sharing the identical `verifyOtp failed: Request rate limit reached` OTP-budget class the baseline file explicitly names as expected and non-regressive); `npm run build` green with both `/sops/page` (Δ -2 KB) and `/sops/[sopId]/page` (Δ -2 KB) inside the ±2 KB gate, `.bundle-baseline.json` unchanged since `736f44a`, `.plant-pin-bob` present in compiled CSS.
- Pushed three times (eval authoring, the two fixes), ran `node scripts/eval-fixtures.mjs`, and ran `npm run eval -- --phase 52` three times total (first run: 13/14, "Search SOPs" false failure found; second run after that fix: 13/14, the real pin bug found and root-caused; third run after the `useSopSync` fix: **14/14 passed**). Opened and read every `plant-home*.png` screenshot plus the sibling `worker-sops.png`/`site-editor.png` for regression -- all visually correct (amber pin with legible "1", red NEVER DONE badge, dark Walk it button, panel with department colour + badge + Walk ›, zone-chip camera fit, blue ask-bar highlight, the voice dialog, the no-site worker's classic Miller-frame fallback).
- Signed off `52-VALIDATION.md` (all 14 task rows ✅ green, Wave 0 and sign-off checklists ticked, frontmatter `status: complete` / `nyquist_compliant: true` / `wave_0_complete: true`) and logged the `useSopSync` finding as a dated CLAUDE.md Learnings entry. Ran `graphify update .` (also auto-ran via the repo's post-commit hook on every commit in this plan).

## Task Commits

Each task was committed atomically (Task 2 required two extra fix commits after the deployed eval surfaced real issues):

1. **Task 1: Author the deployed plant-home eval and serialise the eval run** - `1439c4d` (test)
2. **Task 2 fix: exact-match the Search SOPs role query** - `26b306f` (fix)
2. **Task 2 fix: invalidate assigned-sops after every offline sync (root cause)** - `cb9b8c3` (fix)
2. **Task 2: commit the deployed eval report (14/14 passed)** - `9b25b3f` (docs)
3. **Task 3: validation sign-off** - `ab8301b` (docs)

## Files Created/Modified

- `tests/evals/plant-home.eval.ts` - the live deployed eval (D-16), replacing the 52-01 skeleton's two `test.fixme` entries
- `scripts/run-evals.mjs` - `--workers=1` so the plant eval and site-editor's destructive reset never race
- `src/hooks/useSopSync.ts` - invalidates `['assigned-sops']` after every completed sync (root-cause fix)
- `.planning/phases/52-worker-home-the-plant/52-EVAL.md` - the committed 14/14-passed deployed eval report
- `.planning/phases/52-worker-home-the-plant/52-VALIDATION.md` - signed off, all rows green
- `CLAUDE.md` - new dated Learnings entry for the persisted-query-cache bug class

## Decisions Made

- Fixed the discovered `useAssignedSops`/`useSopSync` bug at its root (the sync hook) rather than papering over it with a longer eval timeout or a forced reload in the test -- the bug is real and worker-facing in production, not an eval artifact; a longer wait would have hidden it, not fixed it.
- Kept the eval's `beforeAll` upsert-only (never delete) against the eval-site org, consistent with the plan's T-52-05-A/T-52-05-B threat dispositions, and re-derived the layout/machine each run rather than caching ids across invocations, since `site-editor.eval.ts`'s reset can rotate them at any time.
- Reworded two lines in `52-VALIDATION.md` (the 52-05-03 table cell and the sign-off checklist item) to avoid re-quoting the literal grep target text, matching the precedent already set in `51-VALIDATION.md`, so the plan's own `grep -c "nyquist_compliant: true"` acceptance criterion resolves to exactly 1 rather than 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `useAssignedSops()`'s persisted query cache could permanently hide a worker's first sync**
- **Found during:** Task 2, first deployed eval run against production
- **Issue:** A worker's very first page load resolves the `['assigned-sops']` query against an empty Dexie before `useSopSync`'s first sync finishes writing; the resulting `[]` is cached fresh for 5 minutes with no invalidation trigger, and a reload rehydrates the same stale persisted snapshot. The plant home's pins, Now card and panel badges all silently showed nothing to do for a newly-assigned worker even though the DB link, Dexie contents and RLS were all independently confirmed correct.
- **Fix:** `useSopSync.triggerSync()` now calls `queryClient.invalidateQueries({ queryKey: ['assigned-sops'] })` after every completed sync.
- **Files modified:** `src/hooks/useSopSync.ts`
- **Verification:** Re-ran the deployed eval end-to-end (fresh browser context, fresh Dexie) -- pin appeared within the eval's poll window, panel badge and Now card both correct; full suite + build re-run clean; no regression in the other 12 deployed evals' screenshots.
- **Committed in:** `cb9b8c3`

**2. [Rule 1 - Bug] Eval's own "no toolbar search box" assertion false-matched the ask bar**
- **Found during:** Task 2, first deployed eval run
- **Issue:** `getByRole('searchbox', { name: 'Search SOPs' })` without `exact: true` is a substring match; PlantAskBar's `aria-label="Ask or search SOPs"` contains "search SOPs" and was counted, giving a false failure (the product's toolbar search box does correctly hide when the plant renders).
- **Fix:** Added `{ exact: true }` to both `getByRole('searchbox', ...)` calls in the eval.
- **Files modified:** `tests/evals/plant-home.eval.ts`
- **Verification:** Re-ran the deployed eval; assertion passed and correctly distinguished the two inputs going forward.
- **Committed in:** `26b306f`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 product bug, 1 Rule 1 test-authoring bug)
**Impact on plan:** The product fix is a genuine correctness fix that a worker would otherwise have hit in production; no scope creep beyond the one hook it touches. The eval fix was necessary for the eval to test what it claims to test.

## Issues Encountered

Diagnosing the pin bug required three separate live probes before the root cause was clear (a service-role check confirming the `sop_machines` link existed, an as-the-user RLS probe confirming `listSiteForWorker`'s query returns the link correctly, and an in-page `indexedDB.open` dump confirming Dexie already had the synced SOP) -- each ruled out one layer (DB, RLS, offline cache) before the actual culprit (the React Query layer sitting on top of Dexie) was identified. All probe scripts were temporary and removed before the final commits; none are left in the tree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six Phase 52 ROADMAP success criteria are proven on https://sopstart.com with `52-EVAL.md` as the committed UAT artefact: scene + pins + Now card + panel + camera + ask bar + voice dialog all work for a desktop worker with a drawn site; the no-site fallback holds for the real org.
- The `useSopSync` invalidation fix benefits every worker-facing surface that reads `useAssignedSops()`, not just the plant home -- no further action needed, it is now correct by default.
- Phase 53 (phone home + QR) and Phase 54 (admin repaint) can build on `PlantHome.tsx`, `worker-signal.ts` and `listSiteForWorker()` as-is; no blockers.

## Self-Check: PASSED

- FOUND: tests/evals/plant-home.eval.ts
- FOUND: scripts/run-evals.mjs (`--workers=1`)
- FOUND: src/hooks/useSopSync.ts (`invalidateQueries` present)
- FOUND: .planning/phases/52-worker-home-the-plant/52-EVAL.md
- FOUND: .planning/phases/52-worker-home-the-plant/52-VALIDATION.md (`nyquist_compliant: true`)
- FOUND commit 1439c4d (git log --oneline)
- FOUND commit 26b306f
- FOUND commit cb9b8c3
- FOUND commit 9b25b3f
- FOUND commit ab8301b
- CONFIRMED: `git log origin/master -1 --format=%H` equals `git rev-parse HEAD`

---
*Phase: 52-worker-home-the-plant*
*Completed: 2026-09-29*
