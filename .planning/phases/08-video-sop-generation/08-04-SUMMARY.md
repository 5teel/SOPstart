---
phase: 08-video-sop-generation
plan: "04"
subsystem: worker-video-experience
tags: [video, worker, tabs, service-worker, completion-tracking, chapters]
dependency_graph:
  requires: [08-02, 08-03]
  provides: [worker-video-tab, video-completion-tracking, sw-video-exclusion]
  affects: [sop-detail-page, service-worker]
tech_stack:
  added: []
  patterns: [tanstack-query-online-only, useRef-fire-once, timeupdate-chapter-tracking]
key_files:
  created:
    - src/hooks/useVideoGeneration.ts
    - src/components/sop/VideoTabPanel.tsx
  modified:
    - src/components/sop/SopSectionTabs.tsx
    - src/app/(protected)/sops/[sopId]/page.tsx
    - src/app/sw.ts
decisions:
  - useNetworkStore directly instead of useOnlineStatus — useOnlineStatus only registers listeners without returning the boolean; useNetworkStore(s => s.isOnline) returns the current value
  - No persister on useVideoGeneration — video URLs must not leak into Dexie/IndexedDB per Pitfall 7
  - completed_at used for outdated comparison — per Pitfall 5, not created_at
metrics:
  duration: "~10m"
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_changed: 5
---

# Phase 08 Plan 04: Worker Video Experience Summary

Worker video viewing pipeline: Video tab in SOP detail, VideoTabPanel with chapter navigation and speed control, 80% threshold completion tracking, and service worker exclusion of generated video URLs.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | VideoTabPanel, Video tab, useVideoGeneration hook, SOP detail page | e8e3701 | Done |
| 2 | Service worker video URL exclusion (INFRA-03) | e33d481 | Done |
| 3 | Human verify: full end-to-end video flow | — | Checkpoint |

## What Was Built

### useVideoGeneration hook (`src/hooks/useVideoGeneration.ts`)
- TanStack Query hook fetching `video_generation_jobs` where `published=true` and `status='ready'`
- Online-only: `enabled: !!sopId && isOnline` — uses `useNetworkStore` directly (not `useOnlineStatus` which doesn't return a value)
- No persister — prevents video URLs from leaking into Dexie/IndexedDB (Pitfall 7)
- `staleTime: 5 minutes` — video availability is stable once published

### VideoTabPanel (`src/components/sop/VideoTabPanel.tsx`)
- `<video>` with `controls`, `playsInline`, `preload="metadata"`, `aria-label="SOP procedure video"`
- VideoOutdatedBanner (`variant="worker"`) renders above player when `isOutdated=true`
- Speed selector: 0.5x / 1x / 1.5x / 2x with `aria-pressed`, active style `bg-brand-yellow text-steel-900`
- Chapter list: `role="list"`, chapter buttons `min-h-[44px]` with timestamp, section name, ChevronRight
- Active chapter: `border-l-2 border-brand-yellow bg-steel-800` — computed from `timeupdate` events
- Completion tracking: `useRef<boolean>(false)` fires `recordVideoView` once at 80% (both `timeupdate` and `ended`)
- `formatTimestamp`: M:SS for under 10 min, MM:SS for 10+ min

### SopSectionTabs (`src/components/sop/SopSectionTabs.tsx`)
- Added `hasVideo?: boolean` and `videoOutdated?: boolean` props
- Video tab renders after sections loop when `hasVideo=true`, with `Play` icon from lucide-react
- Amber dot `w-2 h-2 rounded-full bg-brand-orange` with `aria-label="Video is outdated"` when `videoOutdated=true`

### SOP detail page (`src/app/(protected)/sops/[sopId]/page.tsx`)
- Calls `useVideoGeneration(sopId)` and `useNetworkStore` for online status
- `hasVideo = isOnline && !!videoJob?.video_url && videoJob.published`
- `videoOutdated`: compares `sop.updated_at > videoJob.completed_at` (Pitfall 5 — completed_at not created_at)
- Passes `hasVideo` and `videoOutdated` to `SopSectionTabs`
- Renders `VideoTabPanel` when `activeTab === 'video'` and job+chapters exist
- `isStepsTab` gate hides "Start Walkthrough" bar — video tab shows no bottom bar

### Service worker (`src/app/sw.ts`)
- CacheFirst matcher updated: added `!url.pathname.includes('/sop-generated-videos/')`
- SOP images continue caching via `sop-images-v1` CacheFirst handler
- Generated videos (50-100 MB) stream from Supabase Storage without device caching (INFRA-03)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useOnlineStatus does not return a boolean**
- **Found during:** Task 1 implementation
- **Issue:** The plan specified `use useOnlineStatus()` to check online status. Reading the hook revealed it only registers event listeners and calls `setOnline` — it has no return value.
- **Fix:** Used `useNetworkStore((s) => s.isOnline)` directly in both `useVideoGeneration` hook and the SOP detail page, which reads the already-initialized Zustand store value.
- **Files modified:** `src/hooks/useVideoGeneration.ts`, `src/app/(protected)/sops/[sopId]/page.tsx`
- **Commit:** e8e3701

## Known Stubs

None — all video data is wired from live Supabase queries via useVideoGeneration. Chapter markers, video URLs, and completion tracking are fully functional.

## Self-Check: PASSED

Files created/modified:
- FOUND: src/hooks/useVideoGeneration.ts
- FOUND: src/components/sop/VideoTabPanel.tsx
- FOUND: src/components/sop/SopSectionTabs.tsx
- FOUND: src/app/(protected)/sops/[sopId]/page.tsx
- FOUND: src/app/sw.ts

Commits:
- FOUND: e8e3701 (Task 1)
- FOUND: e33d481 (Task 2)

Build: PASSED (npm run build succeeded)
