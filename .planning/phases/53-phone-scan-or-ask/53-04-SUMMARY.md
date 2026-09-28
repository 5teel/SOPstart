---
phase: 53-phone-scan-or-ask
plan: 04
subsystem: ui
tags: [react-query, next-dynamic, tailwind, source-contract-tests, bundle-gate]

# Dependency graph
requires:
  - phase: 53-phone-scan-or-ask
    plan: 01
    provides: "phase53 project + stubs, jsqr, qr-decode.ts, next-redirect.ts, login ?next="
  - phase: 53-phone-scan-or-ask
    plan: 02
    provides: "useWorkerSops.ts -- the one worker per-SOP derivation, consumed here via SopsSection"
  - phase: 53-phone-scan-or-ask
    plan: 03
    provides: "site_machines.code, MachineView.tsx, /m/[code] route, inline MachinePanel pattern"
  - phase: 52-worker-home-the-plant
    provides: "worker-signal.ts (derivePlantPins/pickNowQueue/zoneColour), NowCard, PlantAskBar, listSiteForWorker, the /sops render-seam pattern PhoneHome extends"
provides:
  - "NowCard with optional onShowMe (Read link fallback) and inline layout -- reused by both the desktop plant overlay and the phone home"
  - "src/components/sop/plant/MachineListSheet.tsx -- department-grouped machine list, each row -> /m/<code>"
  - "src/components/sop/plant/PhoneHome.tsx -- the phone home composition (ask bar, Now card, floor thumbnail, machine sheet, 'Everything else')"
  - "the /sops phone seam: wantsPhone gate, shared ['site-worker'] query (enabled: wantsPlant || wantsPhone), phoneSite slot on both SopsSection call sites"
  - "code: string on WorkerSiteMachine / the worker-readable site_machines select"
  - "phone home (53 D-01) forbidden-marker group on both SB-LINE-06 gated routes"
affects: [53-05, 53-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A shared worker component gains a second placement via an optional prop pair (onShowMe?, inline?) rather than a forked sibling -- NowCard is now the third example of this shape after MachinePanel's inline/onClose? (Phase 53 plan 03)"
    - "A phone-width render seam is a fourth next/dynamic({ ssr: false }) module on /sops/page, gated on useViewport() === 'mobile', sharing the desktop plant's site query rather than issuing a second fetch"

key-files:
  created:
    - src/components/sop/plant/MachineListSheet.tsx
    - src/components/sop/plant/PhoneHome.tsx
  modified:
    - src/components/sop/plant/NowCard.tsx
    - src/actions/site-worker.ts
    - src/lib/validators/site.ts
    - src/app/(protected)/sops/page.tsx
    - scripts/check-bundle-size.ts
    - tests/phase41/merged-surface.spec.ts
    - tests/phase53/phone-home.spec.ts
    - tests/phase53/machine-list-sheet.spec.ts
    - tests/phase53/phone-home-fallback.spec.ts

key-decisions:
  - "The ['site-worker'] query's enabled clause is wantsPlant || wantsPhone (not the RESEARCH Q1 wording '!isAdmin' alone) -- '!isAdmin' would never fetch the site for a phone admin, contradicting the same decision's second sentence ('an admin on a phone is a worker'). Recorded as a deviation in PLAN.md itself, not newly introduced here."
  - "plantSite and phoneSite both derive from one shared `site` constant (layout + >=1 machine resolved) rather than two independent siteResult checks, so the two render seams can never disagree about whether the org has a usable site."
  - "MachineListSheet pin badge classes follow the plan's literal spec (px-1.5, min-w-6.5, no border) rather than copying PlantStage's pin chip classes (border-2 border-white, fixed w-6.5) verbatim -- the sheet is a static list row, not a floating map pin, so the border-less badge reads correctly inline."

patterns-established:
  - "A phone-width worker/admin render seam shares its desktop sibling's data query via one enabled clause with an OR, rather than duplicating the fetch -- reusable for any future phone-specific view over the same worker/site data."

requirements-completed: [PHN-01]

# Metrics
duration: ~55min (commit-to-commit span across all 3 tasks, including bundle-gate bisection)
completed: 2026-09-29
---

# Phase 53 Plan 04: The Phone Home Summary

**PhoneHome (ask bar, Now card without Show me, floor thumbnail, department-grouped machine sheet, "Everything else") on /sops below 1024px, gated on a shared site-worker query with the desktop plant, wired through NowCard's new optional-onShowMe/inline shape and a fourth next/dynamic bundle boundary**

## Performance

- **Duration:** ~55 min (commit-to-commit span; the majority spent bisecting a pre-existing bundle-gate regression inherited from Plan 53-03 — see Deviations)
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments
- `NowCard` now takes `{ items, onShowMe?, inline? }`: the button slot renders "Show me" when `onShowMe` is passed (desktop plant, unchanged call site) or a "Read" link to the SOP when it isn't (phone home); `inline` swaps the absolute-positioned overlay for a normal in-flow card. `WorkerSiteMachine` and `listSiteForWorker`'s `site_machines` select now carry the machine's non-secret, org-scoped `code`.
- `MachineListSheet.tsx`: a bottom sheet (chrome copied from `DepartmentBottomSheet`'s mobile branch) listing the site's machines grouped by department (plus a "No department" catch-all), each row a `Link` to `/m/<code>` with an amber to-do count shown only when it's above zero.
- `PhoneHome.tsx`: pure composition over `derivePlantPins`/`pickNowQueue`/`zoneColour` — ask bar, an inline `NowCard` (no Show me), a 150px floor thumbnail that opens the sheet, then "Everything else". No pan/zoom/camera/scene-renderer code anywhere in the file (source-contract-asserted).
- `/sops/page.tsx`: `PhoneHome` becomes the fourth `next/dynamic({ ssr: false })` module, gated on `wantsPhone = viewport === 'mobile'` (an admin on a phone is a worker — not gated on `isAdmin`). The `['site-worker']` query's `enabled` becomes `wantsPlant || wantsPhone`, sharing one fetch; `plantSite`/`phoneSite` both derive from a single `site` constant. Both `SopsSection` call sites (worker branch and the admin render-prop branch) pass `phone={phoneSite}`; the slot is additive — it renders above the existing list, never replacing it.
- `scripts/check-bundle-size.ts` gained a `phone home (53 D-01)` forbidden-marker group on both gated routes; `tests/phase41/merged-surface.spec.ts` SUR-02 now expects 4 `dynamic()`/`{ ssr: false }` bindings.

## Task Commits

Each task was committed atomically:

1. **Task 1: NowCard optional Show me / inline; machine code to the worker** - `3b1df88` (feat)
2. **Task 2: MachineListSheet and PhoneHome** - `62811fe` (feat)
3. **Task 3: the /sops phone seam, phone-home bundle marker, the build gate** - `6a08f1c` (feat)

**Plan metadata:** commit pending (this SUMMARY — STATE/ROADMAP owned by orchestrator)

## Files Created/Modified
- `src/components/sop/plant/NowCard.tsx` - `onShowMe`/`inline` both optional; Read-link fallback branch; inline class variant with no absolute positioning
- `src/actions/site-worker.ts` - `site_machines` select and mapped machine object carry `code`
- `src/lib/validators/site.ts` - `WorkerSiteMachine.code: string`
- `src/components/sop/plant/MachineListSheet.tsx` - department-grouped machine sheet, rows link to `/m/<code>`
- `src/components/sop/plant/PhoneHome.tsx` - the phone home composition
- `src/app/(protected)/sops/page.tsx` - fourth `dynamic()` module, `wantsPhone` gate, shared site query, `phoneSite` slot on both `SopsSection` call sites
- `scripts/check-bundle-size.ts` - `phone home (53 D-01)` marker group on both gated routes
- `tests/phase41/merged-surface.spec.ts` - SUR-02 dynamic-binding count 3 -> 4
- `tests/phase53/phone-home.spec.ts` - flipped live: NowCard/code (Task 1), PhoneHome (Task 2)
- `tests/phase53/machine-list-sheet.spec.ts` - flipped live
- `tests/phase53/phone-home-fallback.spec.ts` - flipped live: seam wiring + D-02 negative case
- `.planning/phases/53-phone-scan-or-ask/deferred-items.md` - new: documents the pre-existing bundle-gate regression (see Deviations)

## Decisions Made
- See `key-decisions` in frontmatter. No decisions departed from PLAN.md's own text.

## Deviations from Plan

### Documented, unfixed (out of scope per SCOPE BOUNDARY)

**1. `npm run build`'s postbuild bundle-delta gate fails `/sops/[sopId]/page` by +8 KB — pre-existing, bisected to Plan 53-03, not caused by this plan**
- **Found during:** Task 3 verification (`npm run build`)
- **Issue:** `check-bundle-size.ts` reports `/sops/[sopId]/page = 1056 KB (baseline 1048 KB, Δ +8 KB, tolerance ±2 KB)` and exits 1, before it ever reaches `/sops/page`'s own delta check or either route's marker self-validation.
- **Root cause, proven by git bisection (not assumed):** built at `375a642` (53-02 tip, last commit the bundle gate actually ran) — PASS, matching 53-02-SUMMARY.md's recorded Δ-1/Δ-2 KB exactly. Built at `e4e5c19` (53-03 Task 1 — `/m/[code]` route + `MachinePanel.tsx` gaining a second entry point via `MachineView.tsx`) — FAIL, same +8 KB as at `837f4d5` (53-03 tip) and identical to the failure with all of this plan's own work applied on top. Built with only this plan's `page.tsx` changes re-applied on top of the 53-03-tip state: still FAIL, same +8 KB, while this plan's own contribution to `/sops/page`'s own chunk measures 318 bytes (14960 -> 15278 bytes) — negligible on its own. Mechanism: `MachinePanel.tsx` went from one consumer (`PlantHome`, lazy) to two (`PlantHome` + the new `/m/[code]` route's `MachineView.tsx`, static), which changed webpack's automatic `splitChunks` shared-module graph — a single 98 KB chunk became four smaller chunks totalling ~117 KB, several of which are now also counted against `/sops/[sopId]/page`. Every forbidden-marker check still passes cleanly; this is chunk-graph churn, not a bundle-isolation leak.
- **Why not fixed here:** the root cause lives entirely in files outside this plan's `files_modified` scope (`MachinePanel.tsx`, `MachineView.tsx`, `/m/[code]/page.tsx` — all Plan 53-03 artifacts). 53-03's own verification never ran `npm run build`, so the regression landed silently and was only surfaced now. Restructuring the shared-module boundary is a cross-plan architectural change (webpack `cacheGroups`, or splitting a worker-only panel variant), not a same-task Rule 1-3 auto-fix, and CLAUDE.md's 2026-09-13 learning explicitly forbids treating `.bundle-baseline.json` as a tuning knob to paper over it.
- **Files:** none changed to fix this (documented only). `.planning/phases/53-phone-scan-or-ask/deferred-items.md` created with full bisection evidence and remediation options for a follow-up plan.
- **Verification:** `tsc --noEmit` and Next's own compile/typecheck both pass cleanly; the ONLY failure is the postbuild bundle-delta step. `.bundle-baseline.json` confirmed untouched (`git diff --quiet` against it, no `capture-bundle-baseline.ts` run).
- **Impact on this plan:** every other Task 3 acceptance criterion is met (source-contract tests, tsc, the full phase41/phase52/phase36/phase37/lint regression suite, the `h-37.5` compiled-CSS check). Only the literal `npm run build exits 0` clause of the plan's `<success_criteria>` is not met, for reasons proven unrelated to this plan's code.

---

**Total deviations:** 1 documented-and-deferred (pre-existing, out of scope; not an auto-fix)
**Impact on plan:** No scope creep — the deferred item is explicitly a Plan 53-03 regression, not introduced here. All of 53-04's own functional and bundle-isolation acceptance criteria are met.

## Issues Encountered
- The bundle-gate bisection required building the repo at three separate git states (via targeted `git checkout <commit> -- <path>` on specific files, never a blanket reset, restored to HEAD afterward) plus one throwaway `git worktree` (removed after use) to confirm the regression's origin before ruling it out of scope. No destructive git operations were used; the working tree was restored to committed HEAD content before each of this plan's own edits was reapplied.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The phone home is live and additive; 53-05 can insert the Scan button between the floor thumbnail and "Everything else" with no further seam work
- 53-06's deployed eval can drive `/sops` at 390×844 and assert the ask bar, Now card, thumbnail, and machine-sheet rows exist
- The `/sops/[sopId]/page` bundle-gate failure documented in `deferred-items.md` should be triaged (fixed or deliberately baseline-recaptured with sign-off) before or during 54, so the gate is trustworthy again for future phases

---
*Phase: 53-phone-scan-or-ask*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 13 created/modified artifact files and all 3 task commit hashes (`3b1df88`, `62811fe`, `6a08f1c`) verified present.
