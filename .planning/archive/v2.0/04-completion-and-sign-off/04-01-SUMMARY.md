---
phase: 04-completion-and-sign-off
plan: 01
subsystem: completion-data-layer
tags: [database, offline, sync, server-actions, photo-upload, rls, dexie]
dependency_graph:
  requires: [03-05]
  provides: [completion-schema, dexie-v2, completion-store, photo-compress, sync-engine-v2, server-actions-completions]
  affects: [04-02, 04-03]
tech_stack:
  added: [completion_status enum, completion-photos storage bucket]
  patterns: [append-only RLS, client UUID idempotency key, Canvas API quality binary search, Dexie v2 migration, server-side timestamp DEFAULT now()]
key_files:
  created:
    - supabase/migrations/00010_completion_schema.sql
    - src/stores/completionStore.ts
    - src/lib/offline/photo-compress.ts
    - src/actions/completions.ts
  modified:
    - src/lib/offline/db.ts
    - src/lib/offline/sync-engine.ts
    - src/types/sop.ts
    - src/types/database.types.ts
    - src/components/admin/StatusBadge.tsx
decisions:
  - "Append-only RLS on sop_completions and completion_sign_offs: NO UPDATE or DELETE policies for authenticated role (COMP-07, D-15)"
  - "Client UUID as sop_completions PK: idempotent retry — 23505 conflict treated as success"
  - "submitted_at omitted from INSERT: DB DEFAULT now() provides authoritative server-side timestamp (COMP-01)"
  - "Second immutable record pattern for sign-offs: completion_sign_offs table + status update via admin client (D-17)"
  - "photo_required column on sop_steps: NOT NULL DEFAULT false, admins can UPDATE, workers can SELECT"
  - "completionStore separate from walkthroughStore: walkthrough remains memory-only per Phase 3 safety decision D-02"
  - "Canvas API binary search: 6 iterations between quality 0.1-0.9, targets 200KB JPEG"
  - "flushPhotoQueue uses Dexie boolean=0 integer query pattern for uploaded:false records"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-26"
  tasks_completed: 2
  files_created: 4
  files_modified: 5
---

# Phase 4 Plan 1: Completion Data Layer Summary

**One-liner:** Append-only completion schema with Dexie v2 offline persistence, Canvas JPEG compression, and three server actions using client-UUID idempotency keys and server-side timestamps.

## What Was Built

### Task 1: Database migration and type extensions

**supabase/migrations/00010_completion_schema.sql** establishes the completion data model:
- `completion_status` enum: `pending_sign_off | signed_off | rejected`
- `photo_required boolean NOT NULL DEFAULT false` column on `sop_steps`
- `sop_completions`: append-only, client UUID PK (idempotency key), RLS with SELECT/INSERT only — no UPDATE or DELETE policies
- `completion_photos`: append-only, four SELECT policies mirroring completion visibility rules
- `completion_sign_offs`: second immutable record (D-17), same visibility rules
- `completion-photos` storage bucket (private) with org-scoped read policies

Type extensions:
- `src/types/sop.ts`: `CompletionStatus` type added; `SopStep.photo_required?: boolean`
- `src/types/database.types.ts`: `sop_completions`, `completion_photos`, `completion_sign_offs` table types; `completion_status` enum; `photo_required` on sop_steps Row/Insert/Update
- `src/components/admin/StatusBadge.tsx`: Completion statuses with Clock/Check/X icons (size 10) from lucide-react

### Task 2: Offline layer, store, photo utility, and server actions

**src/lib/offline/db.ts** (Dexie v2):
- `LocalCompletion` interface: localId, sopId, sopVersion, contentHash, stepCompletions, status, startedAt
- `QueuedPhoto` interface: blob NOT indexed (anti-pattern), uploaded as boolean
- `db.version(2)` adds `completions` and `photoQueue` tables to existing v1 schema

**src/stores/completionStore.ts** (Zustand, Dexie-backed):
- `startCompletion`: creates LocalCompletion with `crypto.randomUUID()`, writes to Dexie
- `markStepCompleted`: records `Date.now()` per step, writes updated record to Dexie
- `restoreFromDexie`: queries Dexie for `status === 'in_progress'` records on page load
- `clearCompletion`: deletes from both Zustand and Dexie after successful submission

**src/lib/offline/photo-compress.ts** (`compressPhoto`):
- Loads via `URL.createObjectURL`, scales to maxDimension=1200
- 6-iteration binary search between quality 0.1-0.9 via `canvas.toBlob`
- Targets 200KB (`targetBytes = 200_000`)

**src/lib/offline/sync-engine.ts** (extended):
- `flushPhotoQueue`: reads `uploaded=0` entries, PUTs to presigned URLs, marks uploaded
- `flushCompletions`: reads `status='submitted'` entries, calls submitCompletion, deletes on success

**src/actions/completions.ts** (three server actions):
- `submitCompletion`: Zod-validated, JWT auth, admin client INSERT with client UUID as PK, handles 23505 conflict, inserts completion_photos
- `signOffCompletion`: supervisor/safety_manager auth, validates rejection reason (min 10 chars), supervisor assignment check, inserts sign-off record, updates status via admin, inserts completion_rejected notification
- `getPhotoUploadUrl`: derives orgId from JWT if not passed, constructs `{orgId}/completions/{completionLocalId}/{localId}.ext` path, returns presigned URL

## Verification

- `npx tsc --noEmit`: PASS (zero errors)
- `npm run build`: PASS (all routes compiled successfully)
- Migration 00010: contains `CREATE TABLE public.sop_completions` — confirmed
- No UPDATE or DELETE RLS policies on sop_completions — confirmed (grep returns 0)
- Dexie version 2 with completions + photoQueue tables — confirmed
- submitCompletion omits submitted_at — confirmed (uses DB DEFAULT now())
- signOffCompletion inserts completion_sign_offs separately before updating status — confirmed

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- `flushPhotoQueue` passes `orgId: ''` from the offline client; `getPhotoUploadUrl` falls back to JWT claim extraction server-side — this is correct since the client may not have the orgId in scope
- The `_supabase` parameter on `flushCompletions` and `flushPhotoQueue` is accepted but not used (completions go via server actions, not direct Supabase client calls)

## Self-Check

Files created:
- [x] supabase/migrations/00010_completion_schema.sql
- [x] src/stores/completionStore.ts
- [x] src/lib/offline/photo-compress.ts
- [x] src/actions/completions.ts

Files modified:
- [x] src/lib/offline/db.ts (version 2)
- [x] src/lib/offline/sync-engine.ts (flushCompletions, flushPhotoQueue)
- [x] src/types/sop.ts (CompletionStatus, photo_required)
- [x] src/types/database.types.ts (3 new tables, completion_status enum)
- [x] src/components/admin/StatusBadge.tsx (completion statuses with icons)

Commits:
- 74715b9: Task 1 — database migration and type extensions
- e3a5627: Task 2 — offline layer, store, photo compress, server actions

## Self-Check: PASSED
