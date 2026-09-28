---
phase: 53-phone-scan-or-ask
plan: 03
subsystem: ui
tags: [nextjs, supabase, rls, qrcode, print-css, react-query]

# Dependency graph
requires:
  - phase: 53-01
    provides: "src/lib/site/qr-decode.ts (normaliseMachineCode/plateUrl/extractMachineCode/isOurPlateUrl), phase53 Playwright project"
  - phase: 53-02
    provides: "src/hooks/useWorkerSops.ts, the one worker-list derivation feeding /sops and now /m/[code]"
  - phase: 51-05
    provides: "site_machines.code column, SiteWorkspace machine panel, admin gate idiom"
  - phase: 52-02..04
    provides: "MachinePanel (overlay variant), worker-signal.ts's plantRelState/machineSops, the plant render-seam gate"
provides:
  - "MachinePanel inline placement (optional onClose, no absolute positioning) shared by the desktop plant overlay and /m/[code]"
  - "src/components/sop/plant/MachineView.tsx -- syncs assignments, derives a machine's SOPs via useWorkerSops + machineSops, renders the inline MachinePanel"
  - "src/app/(protected)/m/[code]/page.tsx -- org-scoped machine-by-code lookup, identical notFound() for malformed/unknown/foreign codes"
  - "src/app/(protected)/admin/site/plate/[machineId]/page.tsx + PrintButton.tsx -- admin-gated A6 printable plate with server-rendered SVG QR"
  - "Print plate action wired into SiteWorkspace's selected-machine panel"
  - "journeys.ts routes for /m/[code] and the plate; CAPABILITY-MATRIX.md rows for both"
affects: [53-04, 53-05, 53-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One component, two placements: MachinePanel takes optional inline/onClose props instead of forking into a second worker-panel component (RESEARCH Pitfall 2)"
    - "Server-rendered SVG QR via qrcode.toString -- second production use of the qr/page.tsx pattern, no QR encoder ever reaches a client bundle"

key-files:
  created:
    - src/components/sop/plant/MachineView.tsx
    - src/app/(protected)/m/[code]/page.tsx
    - src/app/(protected)/admin/site/plate/[machineId]/page.tsx
    - src/app/(protected)/admin/site/plate/[machineId]/PrintButton.tsx
  modified:
    - src/components/sop/plant/MachinePanel.tsx
    - src/components/admin/site/SiteWorkspace.tsx
    - src/lib/journeys/journeys.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase52/plant-render-seam.spec.ts
    - tests/phase53/m-code-page.spec.ts
    - tests/phase53/m-code-org-scope.spec.ts
    - tests/phase53/plate-page.spec.ts

key-decisions:
  - "MachinePanel's overlay class string stays a separate constant (OVERLAY_CLASS_BASE) from the new INLINE_CLASS rather than one conditional template literal, so the source-contract guard can assert the inline branch contains no 'absolute' independent of the overlay branch."
  - "The plate page's org read uses the same ctx.supabase as unknown as SupabaseClient cast src/actions/site.ts and site-worker.ts already use for the untyped site_machines/departments tables -- no new typing escape hatch introduced."
  - "plant-render-seam.spec.ts's bundle-isolation guard gained one exemption (src/app/(protected)/m/) rather than a second guard file -- /m/[code] is its own route/chunk, not a leak into the /sops bundle the guard protects."

patterns-established:
  - "A shared worker component gains an inline placement via optional props (inline?, onClose?) rather than a forked sibling component -- MachinePanel is now the second example after NowCard's showMeAction (Phase 53 Pitfall 1) of this shape."

requirements-completed: [PHN-02]

# Metrics
duration: ~7min (task commit span: e4e5c19 02:22:46 -> c36288f 02:26:30, excludes upfront PLAN/CONTEXT/RESEARCH/PATTERNS/source reading)
completed: 2026-09-29
---

# Phase 53 Plan 03: Machine Page and Printable Plate Summary

**`/m/[code]` (org-scoped machine lookup, shared MachinePanel in an inline placement) and an admin-gated A6 printable plate with a server-rendered SVG QR encoding the absolute `/m/<code>` URL**

## Performance

- **Duration:** ~7 min (commit-to-commit span)
- **Started:** 2026-09-29T02:22:46+10:00 (Task 1 commit)
- **Completed:** 2026-09-29T02:26:30+10:00 (Task 3 commit)
- **Tasks:** 3
- **Files modified:** 13 (7 created, 6 modified)

## Accomplishments
- `MachinePanel.tsx` now renders in two placements from one component: the existing desktop overlay (unchanged class string, `w-95`, close button) and a new in-page card (`inline` prop, no absolute positioning, `onClose` now optional so the close button only renders where there's something to close back to)
- `MachineView.tsx` syncs assignments (`useSopSync`), derives the caller's worker list via the shared `useWorkerSops` hook (53-02), and orders the machine's own SOPs via the shared `machineSops` classifier (52) -- no local sort, no local classification, no second derivation
- `/m/[code]/page.tsx`: validates the code against `MACHINE_CODE_PATTERN` before any query, resolves `getSessionContext()`, and filters every one of its four table reads (`site_machines`, `departments`, `sop_machines`, `sops`) by `.eq('organisation_id', organisationId)` using the session org -- a malformed, unknown or foreign-org code all `notFound()` identically (T-53-01)
- Live cross-org probe (Task 2) against real Supabase: same-org worker resolves the page's exact query shape; a foreign-org worker gets nothing both with RLS alone (no filter) and with the page's own belt-and-braces filter applied to their own org -- 3/3 passed, ephemeral org/user rows verified gone afterward
- `/admin/site/plate/[machineId]/page.tsx`: `requireAdminContext()` first, UUID-validated `machineId`, session-org-filtered machine/department lookup, server-rendered SVG QR (`qrcode.toString`, no `color` option so the file carries no hex literal) encoding the absolute plate URL (`NEXT_PUBLIC_SITE_URL` or the request origin via `headers()` -- no hardcoded host anywhere in the file), `@page { size: A6 portrait; margin: 8mm }`, machine name / department / large mono code as the camera-fallback
- "Print plate" wired into `SiteWorkspace`'s selected-machine panel, opening the plate in a new tab
- `journeys.ts`: `find-follow-sop` gains a "Scanned the QR plate on a machine" branch and a `machine` step; `map-the-site` gains a `plate` step. `governance-fold.spec.ts`'s "0 not-mapped" pathways-coverage test picked up both new routes automatically. `CAPABILITY-MATRIX.md` gains the Phase 53 note on the "View site map" row and a new "Print a machine plate (QR)" row

## Task Commits

Each task was committed atomically:

1. **Task 1: /m/[code] -- org-scoped lookup, MachineView, inline MachinePanel, route mapped** - `e4e5c19` (feat)
2. **Task 2: prove the code lookup is org-scoped against live Supabase (once)** - `3ba5889` (test)
3. **Task 3: the A6 plate page, the Print plate action, route mapped** - `c36288f` (feat)

**Plan metadata:** commit pending (this SUMMARY -- STATE/ROADMAP owned by orchestrator)

## Files Created/Modified
- `src/components/sop/plant/MachinePanel.tsx` - gained `inline?`/optional `onClose?` so the desktop overlay and the `/m/[code]` in-page card share one component
- `src/components/sop/plant/MachineView.tsx` - client half of `/m/[code]`: sync, derive, render the inline panel
- `src/app/(protected)/m/[code]/page.tsx` - server lookup by code, session-org filtered, identical 404s
- `src/app/(protected)/admin/site/plate/[machineId]/page.tsx` - admin-gated A6 plate, server-rendered SVG QR
- `src/app/(protected)/admin/site/plate/[machineId]/PrintButton.tsx` - `window.print()` trigger
- `src/components/admin/site/SiteWorkspace.tsx` - "Print plate" link in the selected machine panel
- `src/lib/journeys/journeys.ts` - `/m/[code]` and plate routes mapped in `find-follow-sop`/`map-the-site`
- `.planning/codebase/CAPABILITY-MATRIX.md` - "View site map" row extended, new "Print a machine plate (QR)" row
- `tests/phase52/plant-render-seam.spec.ts` - bundle-isolation guard exempts `/m/[code]`'s own chunk
- `tests/phase53/m-code-page.spec.ts` - flipped live (12 tests)
- `tests/phase53/m-code-org-scope.spec.ts` - flipped live (3 live probes)
- `tests/phase53/plate-page.spec.ts` - flipped live (9 tests)

## Verification output

```
npx playwright test --project=phase53 tests/phase53/m-code-page.spec.ts   -> 12 passed
npx playwright test --project=phase53 tests/phase53/m-code-org-scope.spec.ts -> 3 passed (live, ephemeral orgs, ran once)
npx playwright test --project=phase53 tests/phase53/plate-page.spec.ts    -> 9 passed
npx playwright test --project=phase52                                     -> 102 passed
npx playwright test --project=phase51 tests/phase51/site-workspace-wiring.spec.ts -> 7 passed
npx playwright test tests/phase30/governance-fold.spec.ts tests/phase46/capability-matrix-doc.spec.ts \
  tests/lint/design-tokens.spec.ts tests/lint/no-undefined-css-tokens.spec.ts -> 25 passed
  (governance-fold's "0 not-mapped" pathways coverage passed with both new routes present)
npx tsc --noEmit  -> clean (0 output), run after every task
npx eslint <all files this plan touched> -> clean
npm run lint (repo-wide) -> 65 errors (identical pre-existing baseline noted in 53-01's SUMMARY,
  all in transcripts/format-transcript.cjs and unrelated test files -- none in files this plan touched)
```

## `NEXT_PUBLIC_SITE_URL` on Railway

Locally (`.env.local`) it is set to `http://localhost:4200` for dev. It is not set in `railway.json` (expected -- Railway env vars live in the dashboard, not the repo). It cannot be confirmed from this repo whether Railway's production value is `https://sopstart.com`; the existing `/admin/sops/[sopId]/qr` page has depended on the same variable in production since Phase 12/13 with no reported issue, so it is very likely already configured correctly. If unset in production, the plate page falls back to the request origin (`x-forwarded-proto`/`x-forwarded-host`/`host`), never a hardcoded string -- the deployed eval in 53-06 asserts `data-plate-url` equals the real deployed origin, which will surface a misconfiguration if one exists.

## Decisions Made
- `MachinePanel`'s overlay class stayed a separate `OVERLAY_CLASS_BASE` constant rather than folding into one ternary template literal, so the source-contract test can assert the inline branch alone carries no `absolute` independent of the overlay branch.
- The plate page's `ctx.supabase as unknown as SupabaseClient` cast follows the existing `src/actions/site.ts`/`site-worker.ts` precedent for these not-yet-typed tables -- no new typing pattern introduced.
- Task 2's live probe implements exactly the three probes named in the plan's `<action>` (same-org success, RLS-alone cross-org denial, belt-and-braces cross-org denial) rather than the four titles in the 53-01 stub file -- the plan's `<action>`/`<acceptance_criteria>` text is authoritative over the earlier stub titles, and "malformed code" is already covered by Task 1's `m-code-page.spec.ts` source-contract assertion that `normaliseMachineCode()` runs before any query.

## Deviations from Plan

None - plan executed exactly as written. The only judgment call was the Task 2 probe-count reconciliation noted above (not a deviation from PLAN.md's own `<action>`/`<acceptance_criteria>` text, just a note that it differs from the earlier 53-01 stub-file titles).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (See the `NEXT_PUBLIC_SITE_URL` note above for the one thing worth a Railway dashboard glance before 53-06's deployed eval, not a blocking setup step.)

## Next Phase Readiness
- `/m/[code]` and the plate are both live and pathways-mapped; 53-04 (phone home, `MachineListSheet`, `code` on `WorkerSiteMachine`) can link to `/m/${code}` rows directly
- 53-05's scan sheet can `router.push` a decoded `/m/${code}` with no further route work needed
- 53-06's deployed eval can drive both routes for the eval-site fixture machine and assert `data-plate-url` against the real deployed origin

---
*Phase: 53-phone-scan-or-ask*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 8 created/modified artifact files (`src/components/sop/plant/MachinePanel.tsx`, `src/components/sop/plant/MachineView.tsx`, `src/app/(protected)/m/[code]/page.tsx`, `src/app/(protected)/admin/site/plate/[machineId]/page.tsx`, `src/app/(protected)/admin/site/plate/[machineId]/PrintButton.tsx`, `src/components/admin/site/SiteWorkspace.tsx`, `src/lib/journeys/journeys.ts`, `.planning/codebase/CAPABILITY-MATRIX.md`) and all 3 task commit hashes (`e4e5c19`, `3ba5889`, `c36288f`) verified present.
