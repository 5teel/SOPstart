---
phase: 03-worker-experience
plan: "01"
subsystem: offline
tags: [dexie, indexeddb, tanstack-query, zustand, serwist, service-worker, supabase, offline-first]

# Dependency graph
requires:
  - phase: 03-00
    provides: Playwright test stubs for offline layer
  - phase: 02-document-intake
    provides: sops/sop_sections/sop_steps/sop_images tables and types
  - phase: 01-foundation
    provides: Supabase client, auth, RLS helpers, Zustand, serwist/sw.ts

provides:
  - Dexie v4 SopAssistantDB with 5 typed EntityTables (sops, sections, steps, images, syncMeta)
  - TanStack Query IndexedDB persister via experimental_createQueryPersister + idb-keyval
  - Version-diff sync engine pulling assigned SOPs from Supabase to Dexie
  - useSopSync hook (mount + online-event + visibilitychange triggers, 30s debounce)
  - useAssignedSops hook (offlineFirst, category/search filtering from Dexie)
  - useSopDetail hook (full SOP with nested sections/steps/images from Dexie)
  - Zustand walkthrough store (step completion + safety acknowledgement, in-memory safety-critical)
  - Serwist CacheFirst strategy for Supabase Storage images (sop-images-v1, 30d/500 entries)
  - sop_assignments table with role/individual assignment types and RLS policies
  - sops.fts tsvector column with GIN index for full-text search

affects:
  - 03-02-worker-sop-list
  - 03-03-sop-walkthrough
  - 03-04-quick-reference
  - 03-05-sop-admin

# Tech tracking
tech-stack:
  added:
    - dexie@4.3.0 (IndexedDB ORM with EntityTable typed schema)
    - idb-keyval@6.2.2 (lightweight IndexedDB key-value, used by query persister)
    - yet-another-react-lightbox@3.29.2 (installed for Phase 03-03 image zoom)
    - "@tanstack/query-persist-client-core@5.95.2 (experimental_createQueryPersister)"
  patterns:
    - Offline-first: all worker reads go through Dexie, never Supabase directly
    - Version-diff sync: manifest fetch → version compare → bulk-put only stale entries
    - TanStack Query persister: persisterFn from experimental_createQueryPersister passed to useQuery persister option
    - Safety-critical reset: walkthrough store is in-memory only, resets on app restart to force re-acknowledgement per D-02
    - Zustand store uses string[] (not Set) for step completion — JSON-serializable if persistence ever added

key-files:
  created:
    - src/lib/offline/db.ts
    - src/lib/offline/query-persister.ts
    - src/lib/offline/sync-engine.ts
    - src/hooks/useAssignedSops.ts
    - src/hooks/useSopSync.ts
    - src/hooks/useSopDetail.ts
    - src/stores/walkthrough.ts
    - supabase/migrations/00006_sop_fts.sql
    - supabase/migrations/00007_sop_assignments.sql
  modified:
    - src/app/sw.ts (extended runtimeCaching with CacheFirst for supabase storage URLs)
    - package.json (added dexie, idb-keyval, yet-another-react-lightbox, query-persist-client-core)

key-decisions:
  - "experimental_createQueryPersister returns an object; pass .persisterFn to useQuery persister option (not the object itself)"
  - "syncAssignedSops accepts AnySupabaseClient (SupabaseClient<any>) to avoid Database generic type mismatch"
  - "Walkthrough store in-memory only: safety-critical requirement D-02 forces re-acknowledgement per session"
  - "String[] not Set for completedSteps: JSON-serializable if persistence ever required"

patterns-established:
  - "Offline-first: all worker data reads from Dexie — no direct Supabase queries in worker UI components"
  - "Sync trigger pattern: useSopSync (mount + online event + visibilitychange) with 30s debounce to avoid thundering herd"
  - "Version-diff pull: compare manifest versions, only fetch and bulk-put stale SOPs — minimises bandwidth on reconnect"

requirements-completed: [WORK-07, WORK-08, MGMT-01, MGMT-03]

# Metrics
duration: 7min
completed: "2026-03-25"
---

# Phase 03 Plan 01: Offline-First Data Layer Summary

**Dexie v4 IndexedDB store, version-diff Supabase sync engine, TanStack Query offline persister, walkthrough Zustand store, Serwist image caching, and sop_assignments + FTS migrations**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T12:25:56Z
- **Completed:** 2026-03-25T12:33:01Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Complete offline-first data layer: Dexie SopAssistantDB with 5 typed tables, TanStack Query IndexedDB persister, and version-diff sync engine
- Worker-facing hooks: useAssignedSops (offlineFirst with category/search), useSopDetail (full nested SOP), useSopSync (mount/online/visibility triggers)
- Service worker extended with CacheFirst strategy for all Supabase Storage URLs (30-day expiry, 500-entry limit)
- Walkthrough Zustand store with step completion, back-navigation, and safety acknowledgement (in-memory by design)
- Two database migrations: FTS tsvector column + GIN index on sops, and sop_assignments table with dual RLS policies

## Task Commits

Each task was committed atomically:

1. **Task 1: Install packages, create Dexie DB, TanStack Query persister, walkthrough store, and database migrations** - `48df31d` (feat)
2. **Task 2: Create sync engine, client hooks, and extend service worker with SOP image caching** - `cbcf96f` (feat)

## Files Created/Modified

- `src/lib/offline/db.ts` - Dexie v4 SopAssistantDB with sops/sections/steps/images/syncMeta EntityTables
- `src/lib/offline/query-persister.ts` - IndexedDB persister using experimental_createQueryPersister + idb-keyval
- `src/lib/offline/sync-engine.ts` - Version-diff pull: manifest fetch, stale detection, bulk Dexie write, orphan cleanup
- `src/hooks/useAssignedSops.ts` - offlineFirst useQuery reading published SOPs from Dexie with category/search filter
- `src/hooks/useSopSync.ts` - Sync trigger on mount, online event, visibilitychange with 30s debounce
- `src/hooks/useSopDetail.ts` - Full SOP with nested sections/steps/images from Dexie
- `src/stores/walkthrough.ts` - Zustand store: markStepComplete, markStepIncomplete, acknowledgeSafety, isAcknowledged, getCompletedSteps, resetWalkthrough
- `src/app/sw.ts` - Extended with CacheFirst for supabase.co /storage/ URLs (sop-images-v1)
- `supabase/migrations/00006_sop_fts.sql` - fts GENERATED ALWAYS tsvector column + GIN index
- `supabase/migrations/00007_sop_assignments.sql` - sop_assignments with assignment_type enum, 4 indexes, 2 RLS policies
- `package.json` - Added dexie, idb-keyval, yet-another-react-lightbox, @tanstack/query-persist-client-core

## Decisions Made

- `experimental_createQueryPersister` returns `{ persisterFn, persistQuery, ... }` — must pass `.persisterFn` to `useQuery`'s `persister` option, not the whole object. TanStack Query types enforce `QueryPersister` function signature.
- `syncAssignedSops` accepts `SupabaseClient<any>` to avoid the typed Database generic conflicting at call sites — the function does not need schema type inference.
- Walkthrough store intentionally in-memory only — D-02 safety constraint requires acknowledgement per session, not persistence across app restarts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong export name from @tanstack/query-persist-client-core**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Plan specified `experimental_createPersister` but the actual export is `experimental_createQueryPersister`
- **Fix:** Updated import and usage to `experimental_createQueryPersister`, then exposed `.persisterFn` for useQuery compatibility
- **Files modified:** src/lib/offline/query-persister.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 48df31d / cbcf96f

**2. [Rule 1 - Bug] Supabase manifest cast required `unknown` double-cast**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** Supabase client returns typed result from `sop_assignments.select()` that TypeScript wouldn't directly narrow to `SopManifestEntry[]`
- **Fix:** Cast via `unknown` first (`as unknown as SopManifestEntry[] | null`)
- **Files modified:** src/lib/offline/sync-engine.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** cbcf96f

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for correctness and TypeScript compilation. No scope creep.

## Issues Encountered

- `npx tsc --noEmit src/file.ts` on isolated files produced false positives for `@/types/sop` path aliases — ran full `npx tsc --noEmit` (with tsconfig) instead, which resolved correctly.
- Serwist `CacheFirst` and `ExpirationPlugin` are exported from `serwist` package directly (not from workbox), consistent with existing sw.ts pattern.

## User Setup Required

None - no external service configuration required. Database migrations (00006, 00007) apply via `supabase db push` when ready.

## Next Phase Readiness

- All offline data infrastructure ready: Dexie DB, sync engine, hooks, service worker image caching
- Plans 03-02 through 03-05 can now read from Dexie via `useAssignedSops`, `useSopDetail`, `useWalkthroughStore`
- Migrations 00006 and 00007 need to be applied via `supabase db push` before the assignments admin UI (03-05) will work end-to-end
- iOS Safari PWA storage eviction (~7 days inactivity) remains a known concern — surface per-SOP cache readiness in 03-02

---
*Phase: 03-worker-experience*
*Completed: 2026-03-25*
