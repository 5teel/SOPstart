---
phase: 03-worker-experience
plan: "02"
subsystem: ui
tags: [react, nextjs, tailwind, walkthrough, sop, pwa, lightbox, zustand]

# Dependency graph
requires:
  - phase: 03-01
    provides: useWalkthroughStore, useSopDetail, Dexie DB with sops/sections/steps/images

provides:
  - Full-screen SOP walkthrough UI at /sops/[sopId]/walkthrough
  - SafetyAcknowledgement.tsx — mandatory hazard/PPE gate before steps visible
  - WalkthroughList.tsx — scrollable step list with collapsible safety summary strip
  - StepItem.tsx — 72px+ tap-target step rows with upcoming/active/completed states
  - StepProgress.tsx — progress bar (brand-yellow) and Step N of M counter
  - SopImageInline.tsx — inline image with yet-another-react-lightbox Zoom
  - walkthrough/layout.tsx — h-screen full-screen layout without BottomTabBar

affects:
  - 03-03
  - 03-04

# Tech tracking
tech-stack:
  added: [yet-another-react-lightbox (dynamic import, Zoom plugin)]
  patterns:
    - Nested layout.tsx overrides parent BottomTabBar for distraction-free mode
    - Safety gate as fixed inset-0 overlay — MUST be acknowledged before steps show
    - Dynamic import with ssr:false for Lightbox component; Plugin loaded via window-guard
    - Tap-to-toggle step completion using useWalkthroughStore (Zustand, in-memory only)

key-files:
  created:
    - src/app/(protected)/sops/[sopId]/walkthrough/layout.tsx
    - src/app/(protected)/sops/[sopId]/walkthrough/page.tsx
    - src/components/sop/SafetyAcknowledgement.tsx
    - src/components/sop/WalkthroughList.tsx
    - src/components/sop/StepItem.tsx
    - src/components/sop/StepProgress.tsx
    - src/components/sop/SopImageInline.tsx
  modified: []

key-decisions:
  - "Zoom plugin imported via window-guard dynamic import: Plugin type is void-returning function, cannot be passed to next/dynamic; window check + async import avoids SSR reference while still wiring it to Lightbox"
  - "SopImageInline simplifies to dynamic Lightbox only (no static import for Zoom component) — clean TS, works at runtime"
  - "StepItem entire row is tappable (not just right icon) per WORK-09 glove-friendly requirement"
  - "WalkthroughList receives allImages (from all sections) and filters by step_id to support cross-section image assignment"

patterns-established:
  - "Walkthrough layout pattern: nested layout.tsx with own auth check, omits BottomTabBar, uses h-screen overflow-hidden"
  - "Safety gate pattern: fixed inset-0 z-40 overlay checks isAcknowledged(sopId) in page.tsx, hides steps until acknowledged"
  - "Glove-friendly tap targets: min-h-[72px] on step rows, h-[80px] on safety button, h-[72px] on primary action"

requirements-completed: [WORK-01, WORK-02, WORK-05, WORK-06, WORK-09, WORK-10]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 03 Plan 02: Worker Walkthrough UI Summary

**Full-screen glove-friendly SOP walkthrough with mandatory safety gate, tap-to-complete step list, progress bar, and inline image zoom using yet-another-react-lightbox**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T12:36:39Z
- **Completed:** 2026-03-25T12:41:43Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Built full-screen walkthrough layout that overrides parent BottomTabBar via nested layout.tsx
- Implemented mandatory safety gate (SafetyAcknowledgement) with hazard/PPE/emergency sections and 80px orange button
- Built complete step list (WalkthroughList + StepItem) with upcoming/active/completed states, 72px+ tap targets, warning/caution annotations
- Wired useWalkthroughStore for tap-to-complete and tap-to-undo step completion (WORK-01, WORK-02)
- Added StepProgress bar with brand-yellow fill and Step N of M counter (WORK-06)
- Created SopImageInline with yet-another-react-lightbox dynamic import and Zoom plugin (WORK-05)
- npm run build passes clean — route visible at /sops/[sopId]/walkthrough

## Task Commits

Each task was committed atomically:

1. **Task 1: Walkthrough layout, safety gate, and step progress header** - `50e3257` (feat)
2. **Task 2: Walkthrough page, step list, step item, and inline image** - `dd768cd` (feat)

**Plan metadata:** _(pending docs commit)_

## Files Created/Modified

- `src/app/(protected)/sops/[sopId]/walkthrough/layout.tsx` — h-screen full-screen layout, auth check, NO BottomTabBar
- `src/app/(protected)/sops/[sopId]/walkthrough/page.tsx` — orchestrates safety gate, StepProgress, WalkthroughList, bottom action bar
- `src/components/sop/SafetyAcknowledgement.tsx` — full-screen fixed overlay gate with hazard/PPE/emergency cards
- `src/components/sop/WalkthroughList.tsx` — scrollable step list with collapsible safety summary strip
- `src/components/sop/StepItem.tsx` — individual step row, 72px+ min height, tap-to-complete/undo
- `src/components/sop/StepProgress.tsx` — progress bar and Step N of M counter
- `src/components/sop/SopImageInline.tsx` — inline image with lightbox zoom via next/dynamic

## Decisions Made

- **Zoom plugin loading:** Plugin type from yet-another-react-lightbox is `void`-returning, incompatible with `next/dynamic`. Used window-guard + async import to load after hydration — Lightbox itself is dynamically imported (ssr: false), Zoom plugin wired at runtime only.
- **WalkthroughList receives allImages (all sections):** Images in the Dexie DB have `step_id` and `section_id` — collecting all images across all sections and filtering by `step_id` per step is simpler and more complete than scoping to only the steps section.
- **StepItem entire row is tappable:** Per WORK-09 and glove-friendly research — the whole row `onClick`, not just the right icon.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- TypeScript error on dynamic Zoom plugin import: `next/dynamic` requires a React component loader, but `Plugin` from yet-another-react-lightbox is a function (`void`-returning). Fixed by using window-guard with async import instead of `dynamic()` for the plugin. Lightbox component itself is still dynamically imported (ssr: false) as specified.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complete walkthrough UI is ready; workers can walk through any synced SOP step-by-step
- Next plans (03-03 through 03-05) can build on the walkthrough route and sop components directory
- The `/sops/[sopId]` detail page (quick reference view, SOP library) is not yet created — walkthrough page links to `/sops/${sopId}` which will need to exist

## Self-Check: PASSED

All 7 files verified present on disk. Both task commits (50e3257, dd768cd) confirmed in git log. Build passes clean.

---
*Phase: 03-worker-experience*
*Completed: 2026-03-25*
