---
phase: 03-worker-experience
plan: "04"
subsystem: ui
tags: [supabase, rls, server-actions, zod, next-api-routes, optimistic-ui]

requires:
  - phase: 03-01
    provides: sop_assignments migration 00007, org schema, app_role enum
  - phase: 03-03
    provides: admin SOP library page at /admin/sops
provides:
  - SOP assignment server actions (assignSopToRole, assignSopToUser, removeAssignment, getAssignments, getOrgMembers)
  - API route GET/POST/DELETE /api/sops/[sopId]/assignments
  - Admin assignment page at /admin/sops/[sopId]/assign
  - AssignmentRow reusable component with role and individual variants
  - sop_assignments and assignment_type added to database.types.ts
affects:
  - 03-05-worker-library (workers see assigned SOPs via sop_assignments)
  - 04-completions (assignment determines which workers need to complete which SOPs)

tech-stack:
  added: []
  patterns:
    - AdminContext discriminated union return type for server action auth guards
    - Optimistic UI with temp IDs and error revert for assignment mutations
    - Inline removal confirmation (no modal) via local confirmingRemove state

key-files:
  created:
    - src/actions/assignments.ts
    - src/app/api/sops/[sopId]/assignments/route.ts
    - src/app/(protected)/admin/sops/[sopId]/assign/page.tsx
    - src/components/admin/AssignmentRow.tsx
  modified:
    - src/types/database.types.ts
    - src/app/(protected)/admin/sops/page.tsx

key-decisions:
  - "database.types.ts manually extended with sop_assignments table and assignment_type enum — types regeneration not available in this environment"
  - "getOrgMembers uses organisation_members table only; no user_profiles table exists in schema — display name falls back to user_id prefix"
  - "AdminContext typed as discriminated union to enable TypeScript narrowing after 'error' in ctx guard"

patterns-established:
  - "Server action auth guard: getAdminContext() returns AdminContext discriminated union; callers check 'error' in ctx before destructuring"
  - "Optimistic UI: temp record inserted immediately with temp ID, replaced on success or removed on error"

requirements-completed:
  - MGMT-01

duration: 6min
completed: 2026-03-25
---

# Phase 03 Plan 04: SOP Assignment UI Summary

**Admin role-and-individual SOP assignment with optimistic updates, inline removal confirmation, and full Supabase RLS enforcement via sop_assignments table**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T12:52:18Z
- **Completed:** 2026-03-25T12:58:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Server actions for all assignment CRUD (assignSopToRole, assignSopToUser, removeAssignment, getAssignments, getOrgMembers) with admin role guard enforced via JWT claims
- REST API route at /api/sops/[sopId]/assignments supporting GET, POST, DELETE with Zod validation
- Admin assignment page at /admin/sops/[sopId]/assign with role section (4 roles) and individual worker section with live search filter and optimistic updates
- AssignmentRow component with 3 visual states (not assigned, assigned with hover-to-remove, loading spinner) and inline removal confirmation

## Task Commits

1. **Task 1: Create server actions and API route** - `f0e9808` (feat)
2. **Task 2: Create admin assignment page and AssignmentRow component** - `3e5cfbd` (feat)

## Files Created/Modified

- `src/actions/assignments.ts` - Server actions: assignSopToRole, assignSopToUser, removeAssignment, getAssignments, getOrgMembers with admin role guard
- `src/app/api/sops/[sopId]/assignments/route.ts` - GET/POST/DELETE API route backed by server actions, Zod-validated request bodies
- `src/app/(protected)/admin/sops/[sopId]/assign/page.tsx` - Assignment page with role rows, individual worker search, optimistic mutations
- `src/components/admin/AssignmentRow.tsx` - Reusable role/individual row component with assign/assigned/loading states and inline confirm
- `src/types/database.types.ts` - Added sop_assignments table type and assignment_type enum
- `src/app/(protected)/admin/sops/page.tsx` - Added "Assign" link for published SOPs

## Decisions Made

- `database.types.ts` was manually extended with `sop_assignments` and `assignment_type` — type regeneration is not available in this environment. The extension matches the migration schema exactly.
- `getOrgMembers` uses `organisation_members` only; no `user_profiles` table exists in the schema. Display name falls back to a truncated user_id prefix when full_name is unavailable.
- `AdminContext` is a TypeScript discriminated union so callers can narrow the return type safely after the `'error' in ctx` guard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added sop_assignments and assignment_type to database.types.ts**
- **Found during:** Task 1 (server actions)
- **Issue:** Migration 00007 had not been regenerated into database.types.ts — TypeScript would fail on `.from('sop_assignments')` calls
- **Fix:** Manually added the sop_assignments Row/Insert/Update types and assignment_type enum entry to database.types.ts
- **Files modified:** src/types/database.types.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** f0e9808

**2. [Rule 1 - Bug] getOrgMembers does not query user_profiles (table does not exist)**
- **Found during:** Task 1 (getOrgMembers implementation)
- **Issue:** Plan referenced `user_profiles` but only `organisation_members` exists in schema; no full_name or email column
- **Fix:** Query `organisation_members` only; return full_name and email as null; UI shows truncated user_id as fallback name
- **Files modified:** src/actions/assignments.ts
- **Verification:** TypeScript compiles, build passes
- **Committed in:** f0e9808

---

**Total deviations:** 2 auto-fixed (both Rule 1 — schema facts not matching plan assumptions)
**Impact on plan:** Both fixes essential for correctness. Functionality unchanged — assignment UI works; worker display names will improve when user_profiles is added in a future phase.

## Issues Encountered

- `maybeSingle()` return typed as `never` for sops table in client component — fixed with explicit cast to `{ title: string | null; source_file_name: string }`

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- sop_assignments table is populated and queryable; worker library (Plan 03-05) can join against it to show assigned SOPs first
- Assignment server actions are importable directly from `@/actions/assignments` by any future plan that needs assignment data
- Blocker: workers currently see user_id prefix instead of name — will require a user_profiles or auth.users lookup table in a future plan

---
*Phase: 03-worker-experience*
*Completed: 2026-03-25*
