---
phase: 10-video-version-management
plan: "04"
subsystem: admin-video
tags: [video, version-management, admin-ui, schema]
dependency_graph:
  requires: [10-02, 10-03]
  provides: [multi-version-admin-video-page]
  affects: [admin/sops/[sopId]/video, VideoGeneratePanel, VideoAdminPreview]
tech_stack:
  added: []
  patterns: [server-component-data-fetch, client-component-mutation, router.refresh-revalidation]
key_files:
  created:
    - src/components/admin/VideoVersionList.tsx
    - src/components/admin/VideoVersionRow.tsx
  modified:
    - src/components/admin/VideoGeneratePanel.tsx
    - src/app/(protected)/admin/sops/[sopId]/video/page.tsx
    - src/components/admin/VideoAdminPreview.tsx
decisions:
  - VideoVersionRow and VideoVersionList created in this worktree as Plan 03 prerequisite (parallel worktree dependency)
  - Schema push deferred to manual step — requires supabase link with SUPABASE_ACCESS_TOKEN
metrics:
  duration: "4m"
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 5
---

# Phase 10 Plan 04: Wire Version Management UI Summary

Multi-version admin video page wired: VideoGeneratePanel rewritten with format picker + VideoVersionList, video page fetches all non-archived and archived versions, VideoAdminPreview action names and copy updated to D-06 spec.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite VideoGeneratePanel and video page for multi-version | 62f19ef | VideoGeneratePanel.tsx, video/page.tsx, VideoVersionList.tsx, VideoVersionRow.tsx |
| 2 | Update VideoAdminPreview and push database schema | 37f9cb5 | VideoAdminPreview.tsx |
| 3 | Human verification of video version management | PENDING (checkpoint) | — |

## What Was Built

**VideoGeneratePanel (rewritten):** Replaced the single-job `PanelState` state machine with a clean multi-version layout. Props changed from `existingJob: VideoGenerationJob | null` to `versions: VideoGenerationJob[]` and `archivedVersions: VideoGenerationJob[]`. CTA button uses `bg-brand-orange` with "Generate new version" text (D-06). Calls `generateNewVersion` server action directly. Renders `VideoVersionList` below the format picker.

**video/page.tsx (rewritten):** Two separate Supabase queries — non-archived versions ordered by `version_number` descending, and archived versions ordered the same way. Both passed as props to `VideoGeneratePanel`.

**VideoVersionList.tsx (new):** Container with empty state ("No videos generated yet"), list of active version rows, and a collapsible "Show N archived versions" toggle section with `ChevronDown` icon.

**VideoVersionRow.tsx (new):** Single version row showing: version number badge, format badge, status badge (with `animate-pulse` for active generation), inline label editor (save on blur/Enter, cancel on Escape, `maxLength={60}`), created date, and action icons. Published rows have `border-l-2 border-l-brand-yellow` highlight. Inline confirm panels use `role="alertdialog"` matching existing VideoAdminPreview pattern. Active/generating rows render `VideoGenerationStatus` stepper inline.

**VideoAdminPreview (updated):** `deleteVideoJob` → `permanentDeleteVersion`, confirm copy updated per D-06 ("Generate a new version? The current version will be preserved." and publish exclusivity notice), button labels updated ("Generate new version", "Not now").

## Deviations from Plan

### Auto-added prerequisite components

**[Rule 3 - Blocking] Created VideoVersionList and VideoVersionRow in this worktree**
- **Found during:** Task 1
- **Issue:** Plan 04 depends on Plan 03's `VideoVersionList.tsx` and `VideoVersionRow.tsx` components, which are being created in a parallel worktree. They do not exist in this worktree's branch at execution time.
- **Fix:** Created both components in this worktree following the exact specifications from 10-03-PLAN.md. Components are functionally identical to what Plan 03 produces.
- **Files modified:** src/components/admin/VideoVersionList.tsx (created), src/components/admin/VideoVersionRow.tsx (created)
- **Commit:** 62f19ef

### Schema push deferred

**Schema migration 00018 push** could not be executed automatically — `npx supabase db push` requires `supabase link` which needs interactive auth (`SUPABASE_ACCESS_TOKEN`). This is flagged as a pending human action at the Task 3 checkpoint.

## Known Stubs

None. All UI components are wired to real server actions and real data queries.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced beyond what was specified in the plan's threat model.

## Self-Check: PASSED

- [x] src/components/admin/VideoGeneratePanel.tsx — exists, contains VideoVersionList import and generateNewVersion
- [x] src/components/admin/VideoVersionList.tsx — exists, new file
- [x] src/components/admin/VideoVersionRow.tsx — exists, new file
- [x] src/app/(protected)/admin/sops/[sopId]/video/page.tsx — exists, queries with archived=false and archived=true
- [x] src/components/admin/VideoAdminPreview.tsx — exists, uses permanentDeleteVersion
- [x] Commit 62f19ef — Task 1
- [x] Commit 37f9cb5 — Task 2
- [x] npm run build — passes
