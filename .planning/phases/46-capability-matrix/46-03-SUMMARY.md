---
phase: 46-capability-matrix
plan: 03
subsystem: auth
tags: [rls, authorization, supabase, playwright, guards]

# Dependency graph
requires:
  - phase: 46-capability-matrix plan 01
    provides: phase46 Playwright project + tests/phase46/sop-edit-guard-wiring.spec.ts and sop-edit-owner-access.spec.ts (test.fixme scaffolds this plan activates)
provides:
  - requireSopEditAccess(target) object-level (per-SOP) authorization guard in src/lib/auth/guards.ts
  - 9 content-write call sites routed through the guard (sections.ts x4, sop-section-blocks.ts x4, legacy PATCH route x1)
  - migration 00063 (live) — owner-OR-role arm inside admins_can_manage_sections/_steps/_images
  - scripts/apply-phase46-migration.mjs — live applier + pg_policies clause-pinning assertions
affects: [any future phase touching sop_sections/sop_steps/sop_images RLS, or the SOP content-write call sites]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Object-level (per-SOP) authorization guard alongside a role-only guard — requireSopEditAccess resolves sopId/sectionId/junctionId to one sopId, then org-scopes from the SESSION (never the fetched row) before checking admin/safety_manager OR owner_user_id"
    - "RLS owner-OR-role arm lives INSIDE the existing org-scoped USING clause (conjoined), never as a sibling CREATE POLICY — avoids the OR-widening class that hit public.sops in 00061"
    - "Zero WITH CHECK on policies that never had one — USING is reused as the check, avoiding the WITH-CHECK-replaces-USING narrowing class from 00062"

key-files:
  created:
    - supabase/migrations/00063_sop_content_owner_edit.sql
    - scripts/apply-phase46-migration.mjs
  modified:
    - src/lib/auth/guards.ts
    - src/actions/sections.ts
    - src/actions/sop-section-blocks.ts
    - src/app/api/sops/[sopId]/sections/[sectionId]/route.ts
    - tests/phase46/sop-edit-guard-wiring.spec.ts
    - tests/phase46/sop-edit-owner-access.spec.ts

key-decisions:
  - "requireSopEditAccess returns the SESSION supabase client (not the admin client) so downstream writes stay RLS-gated as defence-in-depth; only updateSectionTitle keeps its own admin-client UPDATE for published/superseded rows"
  - "verifyBlock/unverifyBlock/acceptBlockUpdate/declineBlockUpdate stay on requireAdmin() — CAP-02 is content-edit only, not publish/verify authority (assumption A2)"
  - "Migration 00063 writes no WITH CHECK on any of the three policies — writing a partial one would replace USING and silently narrow access back to admin-only (00062 class)"

requirements-completed: [CAP-02]

# Metrics
duration: 38min
completed: 2026-08-25
---

# Phase 46 Plan 03: SOP Owner Edit Rights (CAP-02) Summary

**New `requireSopEditAccess` object-level guard plus RLS migration 00063 (applied live) let a SOP's `owner_user_id` edit that SOP's content — sections, steps, images, block junctions — through all 9 enumerated write paths, with admin/safety_manager rights unchanged and publish/verify/delete/version authority untouched.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-08-25T09:36:00Z
- **Completed:** 2026-08-25T10:14:37Z
- **Tasks:** 3 completed
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- `requireSopEditAccess(target)` in `src/lib/auth/guards.ts` — resolves a `{ sopId }` / `{ sectionId }` / `{ junctionId }` locator to one `sopId`, org-scopes from the session (never the fetched row), and allows admin/safety_manager unconditionally or the SOP's `owner_user_id`
- All 9 enumerated content-write call sites route through the guard: `createSection` (previously had zero app-level guard), `reorderSections`, `updateSectionLayout`, `updateSectionTitle` in `sections.ts`; `addBlockToSection` (user branch), `removeBlockFromSection`, `setPinMode`, `reorderSectionBlocks` in `sop-section-blocks.ts`; the legacy PATCH `/api/sops/[sopId]/sections/[sectionId]` route (previously had zero app-level guard)
- `verifyBlock`/`unverifyBlock`/`acceptBlockUpdate`/`declineBlockUpdate` provably stay `requireAdmin()`-only — CAP-02 does not widen into publish/verify authority
- Migration `00063_sop_content_owner_edit.sql` extends `admins_can_manage_sections`/`_steps`/`_images` with an owner-OR-role arm conjoined inside the existing org-scoped `USING`, applied LIVE via `scripts/apply-phase46-migration.mjs` — all 15 post-apply assertions (12 clause-presence + 3 with_check-IS-NULL, 3 policies x independent checks) PASS
- All 24 phase46 Playwright tests green (8 guard-wiring + 9 doc gate carried from 46-01/46-02 + 7 live RLS probes, 0 skipped)
- `tests/lint/rls-org-scope.spec.ts` + `tests/lint/sops-select-policies-org-scoped.spec.ts` green against the new migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add requireSopEditAccess to src/lib/auth/guards.ts** - `510912e` (feat)
2. **Task 2: Route every content-write path through the guard and activate the wiring gate** - `a3347c0` (feat)
3. **Task 3 [BLOCKING]: RLS migration 00063, live apply, and CAP-02 probe activation** - `611b677` (feat)

_No plan-metadata commit prior to this SUMMARY — the SUMMARY/STATE/ROADMAP commit follows separately per the execution protocol._

## Files Created/Modified
- `src/lib/auth/guards.ts` - adds `requireSopEditAccess`, `SopEditTarget`, `SopEditContext` alongside unchanged `requireAdminContext`
- `src/actions/sections.ts` - 4 call sites swapped/added; `updateSectionTitle` drops its manual `getSessionContext` + role-list + admin-client re-fetch, now subsumed by the guard
- `src/actions/sop-section-blocks.ts` - 4 user-triggered call sites swapped; comment added above `requireAdmin()` recording the CAP-02 admin-only split
- `src/app/api/sops/[sopId]/sections/[sectionId]/route.ts` - gains its first app-level guard (previously RLS-only)
- `supabase/migrations/00063_sop_content_owner_edit.sql` - owner-OR-role arm on 3 content policies, applied live
- `scripts/apply-phase46-migration.mjs` - live applier + `pg_policies` clause-pinning post-apply assertions
- `tests/phase46/sop-edit-guard-wiring.spec.ts` - `test.fixme` markers removed, 8/8 green, mutation-proofed against `reorderSections`
- `tests/phase46/sop-edit-owner-access.spec.ts` - `test.fixme` markers removed, 7/7 live probes green; stale header-comment prose referencing the removed fixme markers also cleaned up

## Decisions Made
- `requireSopEditAccess` returns the session `supabase` client (RLS still applies downstream) rather than the admin client used for resolution/lookup — matches the guard's own defence-in-depth design stated in the plan
- Kept `updateSectionTitle`'s admin-client UPDATE (needed for published/superseded rows per RESEARCH Pitfall 5) but deleted its now-dead manual org re-fetch entirely rather than leaving it alongside the guard
- Migration 00063 writes zero `WITH CHECK` — confirmed via lint + live assertion that `with_check IS NULL` on all three policies, so `USING` is reused as the check (required for `createSection`'s INSERT to work for an owner)

## Deviations from Plan

None functionally — plan executed as written. Two minor documentation-precision notes, not scope changes:

1. The Task 1 `<verify>` command `npx playwright test tests/phase46/sop-edit-guard-wiring.spec.ts --project=phase46 --grep "guard shape"` matches zero tests (no test title contains the literal string "guard shape"); the actual guard-shape assertions are titled "guards.ts exports requireSopEditAccess..." and "requireSopEditAccess self-enforces org-scope...". Verified both by running the full spec instead (8/8 green) after Task 2's wiring, and individually by title match — no functional gap, the plan's grep pattern was just imprecise.
2. Task 2's acceptance-criteria grep `grep -v '^\s*//' ... | grep -c "test.fixme"` returns 1 (and similarly 2 on the owner-access spec) because both spec files use JSDoc block-comment (`/* ... */`) prose mentioning the string "test.fixme" in narrative text, not `//`-prefixed lines — the filter doesn't strip block comments. Confirmed via direct grep that zero actual `test.fixme(` calls remain in either file (all 24 tests execute, 0 skipped-as-fixme). Cleaned up the stale prose in `sop-edit-owner-access.spec.ts`'s two header comments to stop referencing the (now-removed) markers.

## Issues Encountered
None — live migration apply, mutation-proof, and flip-proof all succeeded on the first attempt.

## User Setup Required
None - no external service configuration required. `.env.local` already carried `SUPABASE_ACCESS_TOKEN`/`SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL`, so the [BLOCKING] live migration apply ran without a credential checkpoint.

## Next Phase Readiness
- CAP-02 fully shipped: guard + RLS both live, all probes green, `.planning/codebase/CAPABILITY-MATRIX.md`'s "Edit SOP content" row cross-checked and matches exactly what shipped (no gap to report)
- Phase 46 (Capability Matrix) plans 01/02/03 all complete — CAP-01 (matrix doc) and CAP-02 (owner edit rights) both closed
- No blockers for the next phase (41 — one-sop-surface)

---
*Phase: 46-capability-matrix*
*Completed: 2026-08-25*

## Self-Check: PASSED

- FOUND: src/lib/auth/guards.ts
- FOUND: supabase/migrations/00063_sop_content_owner_edit.sql
- FOUND: scripts/apply-phase46-migration.mjs
- FOUND: .planning/phases/46-capability-matrix/46-03-SUMMARY.md
- FOUND: 510912e (feat(46-03): add requireSopEditAccess object-level edit guard)
- FOUND: a3347c0 (feat(46-03): route content-write paths through requireSopEditAccess)
- FOUND: 611b677 (feat(46-03): live migration 00063 owner-OR-role RLS + activate CAP-02 probes)
- FOUND: 2bea3f4 (docs(46-03): add plan summary)
