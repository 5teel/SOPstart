---
phase: 03-worker-experience
plan: 05
subsystem: database, ui, notifications
tags: [supabase, rls, postgres, versioning, notifications, react-query, next-app-router]

# Dependency graph
requires:
  - phase: 03-01
    provides: sop_assignments table, assignment server actions
  - phase: 03-04
    provides: admin SOP library page, sop actions patterns
provides:
  - superseded_by and parent_sop_id columns on sops table (SOP lineage tracking)
  - worker_notifications table with RLS policies
  - uploadNewVersion, notifyAssignedWorkers, getVersionHistory, markNotificationRead server actions
  - Version history page at /admin/sops/[sopId]/versions
  - useNotifications hook (60s polling)
  - NotificationBadge component wired into BottomTabBar SOPs tab
  - Versions link on admin SOP library page
affects: [04-completions, any-phase-using-sop-versioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - database.types.ts manually extended for new columns and tables (no regen in this environment)
    - SOP lineage via parent_sop_id (all versions share first version's id as parent)
    - superseded_by FK links old version to new version
    - Notification badge self-contained (useNotifications fetches own data, renders nothing when 0)
    - Inline upload confirmation pattern with brand-orange warning card before destructive action

key-files:
  created:
    - supabase/migrations/00008_sop_versioning.sql
    - supabase/migrations/00009_worker_notifications.sql
    - src/actions/versioning.ts
    - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
    - src/hooks/useNotifications.ts
    - src/components/layout/NotificationBadge.tsx
  modified:
    - src/types/database.types.ts
    - src/components/layout/BottomTabBar.tsx
    - src/app/(protected)/admin/sops/page.tsx

key-decisions:
  - "database.types.ts manually extended with superseded_by, parent_sop_id on sops and worker_notifications table — type regeneration not available in this environment"
  - "notifyAssignedWorkers takes both oldSopId and newSopId as params (cleaner API than inferring from DB)"
  - "NotificationBadge is self-contained: fetches own data via useNotifications, no props needed"

patterns-established:
  - "SOP lineage: newParentId = oldSop.parent_sop_id ?? oldSop.id ensures all versions share the original SOP id as parent"
  - "BottomTabBar badge pattern: label === 'SOPs' conditional wraps Icon in relative span for absolute-positioned badge"
  - "Inline action confirmation: brand-orange/10 bg + border-brand-orange/30 card shown before irreversible upload"

requirements-completed: [MGMT-05, MGMT-06, MGMT-07]

# Metrics
duration: 12min
completed: 2026-03-26
---

# Phase 03 Plan 05: SOP Versioning and Worker Notifications Summary

**SOP versioning via superseded_by/parent_sop_id FK chain with version history admin page, and worker in-app notification badge polling every 60 seconds wired into BottomTabBar**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-25T13:02:00Z
- **Completed:** 2026-03-26T00:00:00Z
- **Tasks:** 2 of 2
- **Files modified:** 9

## Accomplishments

- SOP versioning schema: `superseded_by` and `parent_sop_id` columns on sops table enable full version lineage tracking without data loss
- Worker notifications: `worker_notifications` table with RLS allows per-user unread notification tracking triggered when admin uploads new SOP version
- NotificationBadge wired into BottomTabBar SOPs tab with 60-second polling via `useNotifications` hook

## Task Commits

Each task was committed atomically:

1. **Task 1: Versioning and notification migrations, server actions** - `d513d68` (feat)
2. **Task 2: Version history page, notification hook, badge, BottomTabBar wiring** - `66eeac4` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `supabase/migrations/00008_sop_versioning.sql` - Adds superseded_by + parent_sop_id columns, indexes, current_sop_version helper function
- `supabase/migrations/00009_worker_notifications.sql` - worker_notifications table with SELECT/UPDATE (workers) and INSERT (admins) RLS policies
- `src/actions/versioning.ts` - Four server actions: uploadNewVersion, notifyAssignedWorkers, getVersionHistory, markNotificationRead
- `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx` - Version history table with current/superseded badges, inline upload confirmation with brand-orange warning
- `src/hooks/useNotifications.ts` - TanStack Query hook polling worker_notifications every 60s, returns unreadCount + markRead
- `src/components/layout/NotificationBadge.tsx` - Self-contained badge (renders nothing when 0, red circle with count when > 0, capped at "9+")
- `src/types/database.types.ts` - Extended with superseded_by + parent_sop_id on sops Row/Insert/Update, new worker_notifications table definition
- `src/components/layout/BottomTabBar.tsx` - SOPs tab icon wrapped in relative span with NotificationBadge rendered inside
- `src/app/(protected)/admin/sops/page.tsx` - Added Versions link alongside Assign for published SOPs

## Decisions Made

- `database.types.ts` manually extended with new sops columns and `worker_notifications` table — type regeneration not available in this environment, consistent with prior Phase 03 decisions
- `notifyAssignedWorkers` accepts both `oldSopId` and `newSopId` as explicit parameters rather than inferring from a single ID, making the API clearer at the call site
- `NotificationBadge` is self-contained with no props — it internally calls `useNotifications()` so it can be dropped anywhere in the tree without passing data down

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Manually extended database.types.ts**
- **Found during:** Task 1 (TypeScript compilation of versioning.ts)
- **Issue:** TypeScript could not resolve `parent_sop_id`, `superseded_by` on the `sops` table or `worker_notifications` table — new migration columns not reflected in generated types
- **Fix:** Added new fields to `sops` Row/Insert/Update and added full `worker_notifications` table definition to database.types.ts, following Phase 03-04 established pattern
- **Files modified:** src/types/database.types.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** d513d68 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - missing database type definitions blocking compilation)
**Impact on plan:** Required fix for correctness. Consistent with all prior Phase 03 plans. No scope creep.

## Issues Encountered

None — build completed cleanly on first attempt after database type extension.

## User Setup Required

None - no external service configuration required beyond applying the migrations to the Supabase project.

## Next Phase Readiness

- Phase 04 (completions) can reference specific `sop_id` versions — completion records will link to the version-specific SOP id, maintaining audit trail even after re-uploads
- `notifyAssignedWorkers` must be called explicitly after a new version is published (after parse + review + publish flow completes), not automatically triggered here
- `worker_notifications` table is ready for Phase 04 to extend with completion-related notification types

## Self-Check: PASSED

All 7 created/modified files confirmed present. Both task commits (d513d68, 66eeac4) confirmed in git log.

---
*Phase: 03-worker-experience*
*Completed: 2026-03-26*
