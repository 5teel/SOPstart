---
phase: 40-shared-creation-foundation
plan: 09
subsystem: ui
tags: [nextjs, admin-nav, page-shell, dedup, playwright]

requires:
  - phase: 40-03
    provides: PipelineProgressClient stripped to outcome CTAs (this plan replaces its header only)
  - phase: 40-07
    provides: versions/page.tsx on shared file-intake (INTAKE_HINT, validateIntakeFile)
  - phase: 40-08
    provides: SopMetadataFields (unrelated surface, same wave — no file overlap)
provides:
  - One shared AdminPageShell component (AdminNav + title/description/optional per-record back-link slot)
  - All five non-compliant admin creation-flow routes converged onto it
  - A live route-stability assertion proving this phase changed no route
affects: [phase-41-one-sop-surface]

tech-stack:
  added: []
  patterns:
    - "AdminPageShell composes AdminNav + a contextual backLink slot — no auth logic, presentation only (T-40-09-01)"
    - "Route-stability proven by enumerating page.tsx files on disk and asserting each resolves in journeys.ts, not by memory"

key-files:
  created:
    - src/components/admin/AdminPageShell.tsx
  modified:
    - src/app/(protected)/admin/sops/upload/page.tsx
    - src/app/(protected)/admin/sops/new/blank/page.tsx
    - src/app/(protected)/admin/sops/new/ai/page.tsx
    - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
    - tests/phase40/dup04-page-shell.spec.ts

key-decisions:
  - "AdminPageShell's backLink prop is text-only ({href, label, ariaLabel?}) — no icon slot. The plan's ArrowLeft-icon note was read as 'don't reintroduce a second header', not a hard icon requirement; no acceptance criterion or spec assertion checks for an icon."
  - "PipelineProgressClient's 'Back to library' fallback (no sopId resolved yet) is an allowed carve-out — it's a prop VALUE passed into AdminPageShell from a call site, not a second hand-rolled header. Adjusted the spec's exclusion filter to name PipelineProgressClient.tsx explicitly (the original filter only excluded AdminPageShell.tsx, which the walk() function never actually reaches since it scans admin/sops, not components/admin)."
  - "Default contentClassName = 'max-w-2xl mx-auto px-4 py-8 lg:px-8 lg:py-12' (matches 3 of 5 routes); versions/page.tsx overrides to max-w-3xl/py-10 to preserve its existing width."

requirements-completed: [DUP-04]

duration: 8min
completed: 2026-07-29
---

# Phase 40 Plan 09: Shared Admin Page Shell Summary

**One `AdminPageShell` (AdminNav + title/description/optional per-SOP back-link) replaces five hand-rolled headers across the admin creation-flow routes, with a live assertion proving zero routes changed.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-29T17:53:29+10:00 (base commit)
- **Completed:** 2026-07-29T18:01:37+10:00
- **Tasks:** 2 completed
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Built `AdminPageShell` — the one admin creation-flow page shell, carrying `<AdminNav>` plus title/badge/description/mono heading, and an optional `backLink` slot for the two routes (`/versions`, pipeline progress) that need to point back at a specific SOP's builder rather than the library.
- Adopted the shell on all five non-compliant routes (`upload`, `new/blank`, `new/ai`, `[sopId]/versions`, `PipelineProgressClient`), deleting every hand-rolled "Back to library" header and the pipeline page's bespoke sticky `<header>`.
- `upload/page.tsx` now sources its supported-format copy from `INTAKE_HINT` (single source of truth with the dropzone) instead of a stale hardcoded list.
- Added a live route-stability assertion to `tests/phase40/dup04-page-shell.spec.ts` that enumerates every `page.tsx` under `admin/sops` and checks each resolves to a `route:` value in `journeys.ts` — proving mechanically (not by memory) that this phase changed no route. `journeys.ts` itself is untouched (`git diff --stat` empty).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the shared admin page shell** - `6150891` (feat)
2. **Task 2: Adopt the shell on all five non-compliant routes and assert route stability** - `75349f5` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `src/components/admin/AdminPageShell.tsx` - the shared shell: `<AdminNav>`, badge/title/description header row, optional `backLink`, `children`
- `src/app/(protected)/admin/sops/upload/page.tsx` - swapped hand-rolled header for `AdminPageShell`; description now sources `INTAKE_HINT`
- `src/app/(protected)/admin/sops/new/blank/page.tsx` - swapped hand-rolled header for `AdminPageShell`
- `src/app/(protected)/admin/sops/new/ai/page.tsx` - swapped hand-rolled header for `AdminPageShell` with `badge="AI DRAFT"` `mono`
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` - swapped header for `AdminPageShell` with `backLink` to the SOP's builder; kept the Assign/Video quick-link icons as shell children; removed the now-unused `ArrowLeftIcon` helper
- `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx` - replaced the bespoke sticky `<header>` with `AdminPageShell`; `backLink` upgrades to the SOP's builder once `sopId` resolves, falls back to the library before that
- `tests/phase40/dup04-page-shell.spec.ts` - un-fixme'd all assertions, added a "none renders `<AdminNav` directly" check, a "back link preserved" check, and the new route-stability sweep; adjusted the "Back to library" exclusion to name `PipelineProgressClient.tsx` (the pipeline fallback carve-out) since the original filter's `ADMIN_PAGE_SHELL` exclusion was a no-op (that file lives outside the directory the sweep walks)

## Decisions Made
- Kept `AdminPageShell.backLink` text-only (no icon prop) — simplest shape satisfying every acceptance criterion; the plan's ArrowLeft-icon note reads as "don't reintroduce a second header," not a hard icon requirement.
- Fixed a latent no-op in the inherited test scaffold: its `Back to library` exclusion filter referenced `ADMIN_PAGE_SHELL` (a path outside the walked directory), so it would never have actually excluded anything. Named `PipelineProgressClient.tsx` explicitly instead, matching the plan's stated carve-out.

## Deviations from Plan

None beyond the test-scaffold correction above, which is a Rule 1 (bug fix — a guard that was silently checking nothing) rather than a scope change. No architectural changes, no new dependencies.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Every admin creation route now renders the shared nav/shell — Phase 41's nav change (folding Governance/Access into the SOP list, removing the duplicate top-level "SOPs" entry) is a one-file edit to `AdminNav.tsx` plus the shell call sites, not five.
- Per-SOP contextual navigation on `/versions` and the pipeline page is preserved via `backLink`, not regressed.
- `npx tsc --noEmit`, `npm run build`, and `npx playwright test --project=phase40` (46 tests, 41 passed / 5 pre-existing fixme from sibling plans) all clean.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
