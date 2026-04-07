---
phase: 10-video-version-management
plan: "02"
subsystem: server-actions
tags: [video, versioning, server-actions, api-route]
dependency_graph:
  requires: [10-01]
  provides: [generateNewVersion, publishVersionExclusive, archiveVersion, unarchiveVersion, permanentDeleteVersion, updateVersionLabel]
  affects: [admin/VideoAdminPreview, api/generate-video]
tech_stack:
  added: []
  patterns: [requireAdmin-guard, after()-pipeline, app-level-version-counter, exclusive-publish]
key_files:
  created: []
  modified:
    - src/actions/video.ts
    - src/app/api/sops/generate-video/route.ts
    - src/lib/validators/sop.ts
    - src/types/database.types.ts
    - src/components/admin/VideoAdminPreview.tsx
decisions:
  - "generateNewVersion computes version_number as MAX(version_number)+1 scoped to SOP, not a DB sequence"
  - "publishVersionExclusive does unpublish-all then publish-target in two steps (no transaction) — partial unique index provides DB-level safety net"
  - "permanentDeleteVersion keeps deleteVideoJob as alias export for migration safety"
  - "database.types.ts manually extended with version_number/label/archived — consistent with established Phase 3/6/9 pattern"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  files_modified: 5
---

# Phase 10 Plan 02: Server Actions for Video Version Management Summary

Server actions and API route updated to support multi-version video generation: 6 new/renamed actions for generate, exclusive-publish, archive, unarchive, permanent-delete, and label-edit; generate-video route removes old UNIQUE-based idempotency and always creates new versioned rows.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | New server actions for version management | 7562069 | src/actions/video.ts, src/lib/validators/sop.ts |
| 2 | Update generate-video API route for multi-version support | bc86d8b | src/app/api/sops/generate-video/route.ts, src/types/database.types.ts, src/components/admin/VideoAdminPreview.tsx |

## Verification

- `generateNewVersion` exported from src/actions/video.ts with requireAdmin guard, active-job guard, MAX(version_number)+1 counter, after() pipeline call
- `publishVersionExclusive` unpublishes all SOP versions then publishes target (D-03 single-published invariant)
- `archiveVersion` sets archived=true + published=false (D-05, prevents published+archived state)
- `unarchiveVersion` sets archived=false
- `permanentDeleteVersion` hard-deletes job + storage files; `deleteVideoJob` alias retained
- `updateVersionLabel` validates max 60 chars, trims, saves null-or-string (D-04)
- `regenerateVideo` function removed
- generate-video route: no `existingJob` idempotency block; has `activeJob` guard; inserts `version_number: nextVersion`
- `updateVersionLabelSchema` added to src/lib/validators/sop.ts
- `npm run build` passes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extend database.types.ts with version_number/label/archived**
- **Found during:** Task 2 build — TypeScript error `Property 'version_number' does not exist on type SelectQueryError`
- **Issue:** Plan 01's migration added the DB columns but database.types.ts was not yet extended in this worktree (parallel execution)
- **Fix:** Manually extended Row/Insert/Update shapes for `video_generation_jobs` with `version_number: number`, `label: string | null`, `archived: boolean` — consistent with Phase 3/6/9 manual extension pattern
- **Files modified:** src/types/database.types.ts
- **Commit:** bc86d8b

**2. [Rule 3 - Blocking] Update VideoAdminPreview.tsx to use new action names**
- **Found during:** Task 2 build — `'regenerateVideo' is not exported from '@/actions/video'`
- **Issue:** VideoAdminPreview.tsx imported `publishVideo` and `regenerateVideo` which were both replaced/removed
- **Fix:** Updated imports and call sites: `regenerateVideo` → `generateNewVersion`, `publishVideo` (publish path) → `publishVersionExclusive`, `publishVideo` (unpublish path) → `unpublishVideo`
- **Files modified:** src/components/admin/VideoAdminPreview.tsx
- **Commit:** bc86d8b

**3. [Rule 3 - Blocking] Remove Record<string, unknown> cast from insert calls**
- **Found during:** Task 2 build after database.types.ts was extended — cast now conflicts with typed Insert shape
- **Issue:** Once Insert type has required fields, `Record<string, unknown>` cast causes overload mismatch
- **Fix:** Removed cast from `generateNewVersion` insert in video.ts and route.ts; used `status: 'queued' as const` for the status literal
- **Files modified:** src/actions/video.ts, src/app/api/sops/generate-video/route.ts
- **Commit:** bc86d8b (included in Task 2 commit)

## Known Stubs

None — all server actions are fully wired. UI components for the version management panel (Plan 03) will consume these actions.

## Threat Flags

All threats in the plan's threat register are mitigated:
- T-10-03 through T-10-07: All new server actions have `requireAdmin()` guard
- T-10-08: `publishVersionExclusive` enforces unpublish-all before publish
- T-10-09: `generateNewVersion` and the route both guard against concurrent active generations

## Self-Check: PASSED

- src/actions/video.ts — FOUND (contains all 6 exports)
- src/app/api/sops/generate-video/route.ts — FOUND (contains version_number: nextVersion, no existingJob)
- src/lib/validators/sop.ts — FOUND (contains updateVersionLabelSchema)
- Commit 7562069 — FOUND
- Commit bc86d8b — FOUND
- npm run build — PASSED
