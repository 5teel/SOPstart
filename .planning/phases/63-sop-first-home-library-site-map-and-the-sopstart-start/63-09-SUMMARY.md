---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 09
subsystem: ui
tags: [my-record, training, notifications, requests, panels]
requires: [63-02]
provides:
  - src/components/home/panels/NotificationsPanel.tsx (NotificationsPanel)
  - src/components/home/panels/MyRequestsPanel.tsx (MyRequestsPanel)
  - src/components/home/panels/useSectionScroll.ts (useSectionScroll)
  - src/components/home/sections/CompletionList.tsx (CompletionList)
  - src/components/home/sections/MyRecordSection.tsx (MyRecordSection)
  - src/components/home/sections/TrainingSection.tsx (TrainingSection)
affects: [63-11, 63-12, 63-14, 63-16, 63-20]
key-files:
  created:
    - src/components/home/panels/NotificationsPanel.tsx
    - src/components/home/panels/MyRequestsPanel.tsx
    - src/components/home/panels/useSectionScroll.ts
    - src/components/home/sections/MyRecordSection.tsx
    - src/components/home/sections/TrainingSection.tsx
    - tests/phase63/record-training.spec.ts
  modified:
    - src/components/shell/SiteOverview.tsx
    - src/lib/shell/overview-focus.ts
    - src/app/(protected)/activity/page.tsx
    - tests/phase60/overview-structure.spec.ts
    - tests/phase59/retirement-sweep.spec.ts
  moved:
    - src/app/(protected)/activity/WorkerActivityView.tsx -> src/components/home/sections/CompletionList.tsx
key-decisions:
  - "Each panel owns its bell scroll through useSectionScroll; takeOverviewSection takes an optional section so two panels on one page do not steal each other's request"
  - "A panel that never rendered its section (empty) drops the scroll request once loaded, so a stale request cannot fire later"
  - "MyRequestsPanel renders the reason dialog outside its empty-state return so a refetch cannot unmount an open dialog"
requirements-completed: []
duration: 25min
completed: 2026-10-08
---

# Phase 63 Plan 09: My record and Training Summary

**The overview's notifications and "my requests" are two reusable panels (the old overview now just composes them), the activity list is a component, and My record and Training exist as unmounted sections carrying the content of the pages they replace.**

## Panel props

- `NotificationsPanel({ onOpenAddress(address) })` - browser-client queries only (no `@/actions` import). Heading "NOTIFICATIONS" with no count (R5); keeps `Nothing unread.`. `open(n)` marks read (3 s timeout, undims on failure), then `isSafePlace(n.place)` and `/sops/` -> `router.push`; anything else -> `onOpenAddress(safe ? place : '/')`.
- `MyRequestsPanel({ role, about: ComposerAbout })` - `listMyRequests`, withdraw / decline-ask / stop-asking through `ReasonDialog`, the three groups, show-all, and the "Ask for a new SOP" trigger for worker and supervisor.
- `SiteOverview` composes both in the old order (objectives, notifications, requests, Office line); it keeps `placeTarget` for the old shell's `select()`.

## Moved list

`WorkerActivityView` -> `CompletionList` (`git mv`; page h1 dropped, count line and empty state kept as they were, so the empty-state words are still 63-16's). `/activity` renders the `h1` then `<CompletionList />`.

## Training section reads

`listOrgTree()` under `['training-tree']` and `listDepartments()` under `['training-departments']` only, then `AssessmentRequestsPanel` and `TrainingBridge`. Both actions keep their server guards. Mounted for admin and safety manager only by `sectionsForRole` (R2); the supervisor gets no Training screen. No CSS import exists in the training chunk (`grep "\.css'"` over competency, org-model, observations returned nothing).

## Pinned specs repointed (same commits)

- `tests/phase60/overview-structure.spec.ts` now reads SiteOverview, both panels and the scroll hook; order test asserts panel positions between the objectives and Office line; heading assertion is "no count".
- `tests/phase59/retirement-sweep.spec.ts` looks for `CompletionList.tsx` and `<CompletionList />` in the activity page.

## Verification

- `npx tsc --noEmit` clean; phase59 + phase60 + phase63 391 passed (record and training 5/5); phase15-stubs `no-dead-internal-hrefs`, `design-tokens` 12/12.
- `npm run build` postbuild gate green, "Marker self-validation OK": `/page` 837 KB (baseline 837, delta 0), `/sops/[sopId]/page` 795 KB (baseline 795, delta 0). `.bundle-baseline.json` untouched.
- HOME-04 left unticked: Sign-offs/People/Manage/My record/Training are not yet mounted (63-11, 63-12, 63-14).

## Deviations from Plan

**1. [Rule 3 - Blocking] Scroll logic extracted to `useSectionScroll`.** The plan said NotificationsPanel takes a `headingRef`; with the queries now inside the panels the parent can no longer know when a section has rendered, so each panel scrolls its own section (hook + optional `only` argument on `takeOverviewSection`). Behaviour for the old overview is the same except the "scroll the body into view when the section is absent" fallback, which is dropped (the body is the pane's top).

**2. Per-panel loading and error states.** The overview's shared skeleton and single "Try again" alert are now one per panel (a failed notifications query no longer hides the requests list).

**3. Prettier run once with its defaults** reformatted MyRequestsPanel; re-run with the project style (no semicolons, single quotes, width 140) before commit.

Capability gates unchanged.

## Known Stubs

None. The sections are intentionally unmounted until 63-11.

## Self-Check: PASSED
