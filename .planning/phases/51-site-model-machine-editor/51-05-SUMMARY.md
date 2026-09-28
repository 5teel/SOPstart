---
phase: 51-site-model-machine-editor
plan: 05
subsystem: ui
tags: [react, next-app-router, konva, server-actions, journeys, admin-nav]

requires:
  - phase: 51-site-model-machine-editor (plan 02)
    provides: site_layouts/site_machines/sop_machines tables live on Supabase, RLS
  - phase: 51-site-model-machine-editor (plan 03)
    provides: src/actions/site.ts (listSiteForOrg, upsertSiteMachine, deleteSiteMachine, setSopMachines), SiteEmptyState.tsx
  - phase: 51-site-model-machine-editor (plan 04)
    provides: SiteEditor.tsx (Konva canvas) + SiteEditorLoader.tsx (ssr:false gate), SceneEditorProps contract
provides:
  - src/components/admin/site/SiteWorkspace.tsx — toolbar (Draw/Delete/Saved-status), canvas via SiteEditorLoader, right-hand machine panel (rename debounced 600ms, department select, SOP link/unlink)
  - src/app/(protected)/admin/site/page.tsx — admin-gated /admin/site route (requireAdminContext() before any data call)
  - TopHeader.tsx ADMIN_LINKS Site entry (Team · Site · Settings)
  - journeys.ts map-the-site journey + enter-admin-tools Site branch (0 not-mapped)
  - tests/phase51/site-workspace-wiring.spec.ts fully live (0 test.fixme)
affects: [51-06, 51-07]

tech-stack:
  added: []
  patterns:
    - "Two independent selection states on the machine panel: selectedId (canvas selection, drives the rename/department inputs) and openSopsFor (per-row SOP-linking disclosure) — a row can show its SOPs without being the canvas-selected machine"
    - "Debounced-save-with-ref pattern: rename typing updates local state via the setState functional-updater form immediately, but the 600ms-later save reads a machinesRef mirror (synced via a plain useEffect) instead of the keystroke-time closure, so a department/polygon change made mid-debounce is never clobbered by a stale save"
    - "deleteSelected wrapped in useCallback([selectedId, machines, links]) specifically so the window keydown effect's dependency array is exhaustive-deps-clean without needing extra selectedId/drawing refs — every other handler (create/rename/department/link/unlink) stays a plain per-render closure, which is fine since they're invoked synchronously from JSX, not from a delayed effect callback"

key-files:
  created:
    - src/components/admin/site/SiteWorkspace.tsx
    - src/app/(protected)/admin/site/page.tsx
  modified:
    - src/components/layout/TopHeader.tsx
    - src/lib/journeys/journeys.ts
    - tests/phase51/site-workspace-wiring.spec.ts
    - tests/phase51/site-editor-canvas.spec.ts

key-decisions:
  - "openSopsFor (not selectedId) scopes the Show-SOPs panel and its link/unlink calls — the plan's D-10 wording ('this machine') refers to whichever row has SOPs open, matching the panel's own two independent affordances (select vs. show-SOPs) rather than conflating them"
  - "Only deleteSelected is memoized (useCallback) — it's the one handler referenced from a useEffect (the keydown listener); every other handler stays an unmemoized per-render closure since it's called synchronously from JSX, avoiding unnecessary ref-mirroring machinery"
  - "requireAdminContext()'s error branch maps 'Not authenticated' to /login and anything else (including 'Admin access required') to /sops, matching the pattern already used by other admin-gated routes in this codebase"

patterns-established:
  - "Source-contract spec for a client component's event handlers extracts each named handler's brace-matched body (functionSpan, ported from site-editor-canvas.spec.ts) and asserts the real action call lives inside that specific handler — not just present somewhere in the file (2026-06-05 wiring-not-token-presence discipline)"

requirements-completed: [SIT-02, SIT-03, SIT-04]

duration: 35min
completed: 2026-09-28
---

# Phase 51 Plan 05: Site Admin Workspace, Route & Pathways Summary

**`/admin/site` is now a reachable, admin-gated page: a toolbar (Draw machine / Delete / "Saved ✓") drives the Konva canvas via SiteEditorLoader, a 380px right panel lists every machine with its department and linked-SOP count, and every mutation — create, drag, rename, re-department, delete, link, unlink — flows through the existing `src/actions/site.ts` server actions with no data of its own held anywhere else.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-28T20:20:00+10:00
- **Completed:** 2026-09-28T20:55:00+10:00
- **Tasks:** 2 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `SiteWorkspace.tsx`: toolbar (Draw machine / Delete machine / save-status pill / scene size in mono), canvas via `SiteEditorLoader` (never `SiteEditor` directly), and a right panel listing every machine (mono name, department dot + name, linked-SOP count, Show/Hide SOPs)
- Machine lifecycle fully wired to `src/actions/site.ts`: `onCreate` saves + selects + focuses the name field; `onPolygonChange` saves on drag-end; rename debounces 600ms per machine (reading a fresh `machinesRef` snapshot at save time so a concurrent department change is never lost); the department `<select>` saves immediately; delete removes the machine (confirming first when SOPs are linked), wired to both the Delete button and a `window` keydown listener (Delete/Backspace, ignored while typing in an input/textarea/select/contenteditable; Escape cancels drawing or clears the selection)
- SOP linking: each row's "Show SOPs" disclosure lists its linked SOPs with Unlink, plus a case-insensitive search (top 8 matches, already-linked SOPs excluded) that links via the same `setSopMachines` the builder will use in 51-06
- `src/app/(protected)/admin/site/page.tsx`: `requireAdminContext()` runs and is checked BEFORE `listSiteForOrg()` — a worker/supervisor is redirected to `/sops` (or `/login` if unauthenticated) before any site data is ever queried; renders `SiteEmptyState` or `SiteWorkspace` off the single discriminated-union result, no admin-client import
- `TopHeader.tsx`: `Site` added to `ADMIN_LINKS` between Team and Settings
- `journeys.ts`: `enter-admin-tools`'s menu decision and header-summary text gained a Site branch/step; new `map-the-site` journey (Library & team group) walks empty-state → Generate/Upload decision → editor → draw → link → the 51-06 builder-side picker
- Activated all 4 `workspace` tests and all 3 `route` tests in `site-workspace-wiring.spec.ts` (0 `test.fixme` remaining); repointed the 51-04-deferred delete-test comment in `site-editor-canvas.spec.ts` to point at this plan's coverage

## Task Commits

Each task was committed atomically:

1. **Task 1: SiteWorkspace — toolbar, save status, machine panel, SOP link/unlink** - `3da31d3` (feat)
2. **Task 2: /admin/site route, header Site link, pathways journey** - `b7c1402` (feat)
3. **Deferred-test comment repoint (site-editor-canvas.spec.ts)** - `3f6f80b` (docs)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/components/admin/site/SiteWorkspace.tsx` (400 lines) - the stateful workspace: toolbar, canvas wiring, machine panel, SOP link/unlink
- `src/app/(protected)/admin/site/page.tsx` - admin-gated route, empty-state/workspace branch
- `src/components/layout/TopHeader.tsx` - `ADMIN_LINKS` gains `{ label: 'Site', href: '/admin/site' }`
- `src/lib/journeys/journeys.ts` - `map-the-site` journey + `enter-admin-tools` Site branch/step
- `tests/phase51/site-workspace-wiring.spec.ts` - both describes (`workspace`, `route`) fully activated
- `tests/phase51/site-editor-canvas.spec.ts` - deferred delete-test comment repointed to this plan's coverage

## Decisions Made

- `openSopsFor` (independent of `selectedId`) scopes the SOP-linking panel and its `setSopMachines` calls — a row's SOPs can be shown without that row being the canvas-selected machine, matching the plan's two-affordance panel design
- Only `deleteSelected` is `useCallback`-memoized (it's the one handler a `useEffect` closes over for the keydown listener); every other handler is a plain per-render closure, called synchronously from JSX where staleness can't occur
- The debounced rename save reads a `machinesRef` mirror rather than the keystroke-time closure, so a department change made while a rename debounce is pending is never overwritten by the delayed rename save

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `eslint-plugin-react-hooks` flagged the keydown effect's `deleteSelected` dependency**
- **Found during:** Task 1 eslint sweep (orchestrator gate, not the plan's own per-task verify command)
- **Issue:** `deleteSelected` was a plain per-render function referenced by the keydown `useEffect`; `react-hooks/exhaustive-deps` warned it changes every render, so the effect's own dependency tracking was unreliable.
- **Fix:** Wrapped `deleteSelected` in `useCallback([selectedId, machines, links])` — the effect now depends on a stable-until-real-change reference.
- **Files modified:** `src/components/admin/site/SiteWorkspace.tsx`
- **Verification:** `npx eslint src/components/admin/site/SiteWorkspace.tsx` — 0 errors, 0 warnings; all workspace tests + tsc still pass.
- **Committed in:** `3da31d3` (Task 1 commit)

**2. [Rule 1 - Bug] Own "never say block" lint assertion false-positived on the Tailwind `block` display utility**
- **Found during:** Task 1 first verification run
- **Issue:** A self-authored spec assertion banning the substring "block" (CLAUDE.md plain-words rule) matched `className="block truncate font-mono …"` — the CSS display utility, not the forbidden UI jargon term.
- **Fix:** Removed the over-broad assertion; the plan's actual required checks (data-testids, "Show SOPs" copy, empty-panel copy) don't need it, and the codebase's real jargon guard is elsewhere.
- **Files modified:** `tests/phase51/site-workspace-wiring.spec.ts`
- **Verification:** Re-ran the `workspace` describe — 4/4 pass.
- **Committed in:** `3da31d3` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs, both in the test/lint layer — no product-code behaviour changed)
**Impact on plan:** No scope creep; both fixes are mechanical (a memoization + a self-authored assertion correction).

### Scope Adjustment (documented, not auto-fixed)

**`site-workspace-wiring.spec.ts`'s `route` describe was written and committed in Task 1, one commit earlier than strict per-task atomicity implies**
- **Found during:** Staging Task 2's commit
- **Issue:** The spec file was authored in a single `Write` call covering both the `workspace` and `route` describes (the file already existed as a stub with both describes present); Task 1's commit therefore included the `route` describe's test bodies before Task 2 built the code they assert against, so those 3 tests failed until Task 2 landed later in the same session.
- **Resolution:** No functional impact — both tasks landed in the same execution session moments apart, and Task 2's commit made the file fully green. Documented here rather than re-splitting the file after the fact.
- **Files affected:** `tests/phase51/site-workspace-wiring.spec.ts`
- **Committed in:** `3da31d3` (Task 1), completed by `b7c1402` (Task 2)

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 51-06 (builder-side Machines picker) can import `listSopMachines`/`setSopMachines` from `src/actions/site.ts` exactly as `SiteWorkspace` does — the two surfaces write through the identical action (D-12)
- 51-07 (deployed eval) has a live `/admin/site` route, header entry, and journeys.ts mapping to script against; `data-testid`s (`site-draw-machine`, `site-delete-machine`, `site-save-status`, `site-machine-row`, `site-machine-name`, `site-machine-department`, `site-machine-sops-toggle`, `site-link-sop-input`, plus 51-03's `site-generate-button`/`site-upload-input`) are stable selectors for the eval script
- No blockers for 51-06/51-07

---
*Phase: 51-site-model-machine-editor*
*Completed: 2026-09-28*

## Self-Check: PASSED

- `src/components/admin/site/SiteWorkspace.tsx` — FOUND
- `src/app/(protected)/admin/site/page.tsx` — FOUND
- Commit `3da31d3` — FOUND in `git log --oneline`
- Commit `b7c1402` — FOUND in `git log --oneline`
- Commit `3f6f80b` — FOUND in `git log --oneline`
- `grep -c "from './SiteEditor'" src/components/admin/site/SiteWorkspace.tsx` = 0 — CONFIRMED
- `grep -c "from './SiteEditorLoader'" src/components/admin/site/SiteWorkspace.tsx` = 1 — CONFIRMED
- `grep -c "setSopMachines(" src/components/admin/site/SiteWorkspace.tsx` = 2 (>= 2) — CONFIRMED
- `grep -c "label: 'Site', href: '/admin/site'" src/components/layout/TopHeader.tsx` = 1 — CONFIRMED
- `grep -c "route: '/admin/site'" src/lib/journeys/journeys.ts` = 3 (>= 2) — CONFIRMED
- `wc -l src/components/admin/site/SiteWorkspace.tsx` = 400 (>= 200 min_lines) — CONFIRMED
- `npx playwright test --project=phase51 tests/phase51/site-workspace-wiring.spec.ts` — 7/7 passed — CONFIRMED
- `npx playwright test --project=phase51` (full project) — 73 passed, 6 skipped (fixme reserved for 51-06/51-07), 0 failed — CONFIRMED
- `npx playwright test --project=phase26 --project=phase30 --project=phase41` — 231 passed, 0 failed — CONFIRMED
- `npx playwright test --project=phase30 tests/phase30/governance-fold.spec.ts` — 7/7 passed (pathways coverage: 0 not-mapped) — CONFIRMED
- `npx playwright test --project=phase15-stubs tests/lint/design-tokens.spec.ts tests/lint/no-undefined-css-tokens.spec.ts` — 9/9 passed — CONFIRMED
- `npx tsc --noEmit` exits 0 — CONFIRMED
- `npx eslint` on all new/modified source files — 0 errors, 0 warnings — CONFIRMED
- `npm run build` — succeeds, `/admin/site` registered as a dynamic route, bundle-size/Konva-isolation postbuild gate passes — CONFIRMED
