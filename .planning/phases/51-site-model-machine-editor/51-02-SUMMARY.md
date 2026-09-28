---
phase: 51-site-model-machine-editor
plan: 02
subsystem: database
tags: [supabase, postgres, rls, storage, playwright]

requires:
  - phase: 51-site-model-machine-editor (plan 01)
    provides: phase51 Playwright project, src/lib/validators/site.ts, src/lib/site/scene.ts (MACHINE_CODE_PATTERN, scenePath, SCENE_BUCKET, newMachineCode), stub specs for this plan
provides:
  - site_layouts, site_machines, sop_machines tables live on the remote Supabase project, RLS enabled
  - Six table policies (org-scoped SELECT + org+role-scoped ALL with byte-identical WITH CHECK) proven from the catalog and at runtime
  - Composite FKs (site_layout_id, organisation_id) and (machine_id, organisation_id) blocking cross-org references
  - site-scenes private storage bucket (15MB, jpeg/png) + 3 org-scoped storage.objects policies
  - scripts/apply-phase51-migration.mjs -- reusable live applier with clause-level catalog assertions
  - Capability matrix rows for view/edit site map, link SOPs to machines, generate scene
affects: [51-03, 51-04, 51-05, 51-06, 51-07]

tech-stack:
  added: []
  patterns:
    - "Composite FK anchoring: unique (id, organisation_id) on the parent + foreign key (child_fk, organisation_id) references (id, organisation_id) makes a cross-org reference structurally impossible, no app-code check needed"
    - "Applier scripts assert every security-relevant clause from pg_policies/pg_constraint/storage.buckets via the Management API (bypasses PostgREST schema cache) rather than trusting the migration file"

key-files:
  created:
    - supabase/migrations/00067_site_model.sql
    - scripts/apply-phase51-migration.mjs
    - tests/phase51/site-model-rls-runtime.spec.ts (replaced stub)
  modified:
    - tests/phase51/site-migration-shape.spec.ts (replaced stub)
    - .planning/codebase/CAPABILITY-MATRIX.md

key-decisions:
  - "Every write policy uses `for all` with USING and WITH CHECK set to the byte-identical predicate (org + role), avoiding the 00062-class partial-check hole by construction"
  - "organisation_id is denormalised onto all three tables so no policy needs a cross-table subquery -- eliminates 42P17 recursion risk (CLAUDE.md 2026-05-13) by design, not by review"
  - "sop_machines.sop_id and site_machines.department_id use plain FKs (not composite) per the plan's discretion note -- org match for those two is enforced in 51-03's actions, not the DB"

patterns-established:
  - "Site-model RLS runtime probe file mirrors tests/phase46/sop-edit-owner-access.spec.ts's env-loader/serviceClient/mintAccessToken/asUserClient/ephemeral-org helpers verbatim -- third project in this codebase's history to reuse this exact fixture shape"

requirements-completed: [SIT-01, SIT-04]

duration: 26min
completed: 2026-09-28
---

# Phase 51 Plan 02: Site Model Migration + Live RLS Proof Summary

**Migration 00067 (site_layouts, site_machines, sop_machines + site-scenes bucket) pushed live and proven correct by 11 runtime probes plus catalog-level applier assertions -- zero cross-tenant holes, composite FKs block foreign layout/machine references structurally.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-28T09:44:00Z
- **Completed:** 2026-09-28T10:10:00Z
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created, 3 modified/activated)

## Accomplishments

- Wrote and pushed `supabase/migrations/00067_site_model.sql` to the live Supabase project: three org-scoped tables, six table RLS policies (every arm conjoins `current_organisation_id()`; every WITH CHECK byte-identical to its USING per CLAUDE.md 2026-08-04), the private `site-scenes` bucket (15MB, jpeg/png), and three storage.objects policies
- Built `scripts/apply-phase51-migration.mjs`, which asserts every security-relevant clause (RLS enabled, policy count, qual/with_check text, FK `confdeltype` + column count, bucket row, storage policy text) directly from `pg_policies`/`pg_constraint`/`storage.buckets` via the Management API -- all 23 assertions passed on the live project
- Activated `tests/phase51/site-migration-shape.spec.ts` (8 source-contract tests) and `tests/phase51/site-model-rls-runtime.spec.ts` (11 live probes covering worker-read, cross-org read/write denial, composite-FK blocks, column constraints, D-13 cascades, and storage scoping) -- all pass live with zero skips
- Added four capability-matrix rows (view/edit site map, link SOPs to machines, generate scene) naming the new gates

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 00067, activate migration-shape spec, add capability-matrix rows** - `7280d97` (feat)
2. **Task 2: [BLOCKING] Apply migration 00067 live and assert it clause by clause** - `ed2d4ea` (feat)
3. **Task 3: Live RLS/FK/storage probe spec** - `7e6ca4e` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `supabase/migrations/00067_site_model.sql` - three tables, six policies, storage bucket + 3 storage policies
- `scripts/apply-phase51-migration.mjs` - live applier with catalog-level clause assertions
- `tests/phase51/site-migration-shape.spec.ts` - 8 source-contract tests (tables exist, RLS x3, org-scope, WITH CHECK=USING, FK cascades, bucket shape, code pattern, no elevated-privilege function)
- `tests/phase51/site-model-rls-runtime.spec.ts` - 11 live probes (worker-read, cross-org read/write, composite FK x2, org-reassignment block, constraints x3-in-1, cascades x3-in-1, storage x6-in-1)
- `.planning/codebase/CAPABILITY-MATRIX.md` - added View/Edit site map, Link SOPs to machines, Generate site scene rows; bumped Last updated

## Decisions Made

- Followed the plan's exact column/constraint/policy shapes; no departures from D-01/D-02/D-03/D-05/D-13
- `supabase db push` succeeded directly (no Management-API fallback needed) -- recorded here since the plan asked which path applied it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration header comment tripped the literal `security definer` grep gate**
- **Found during:** Task 1 acceptance check
- **Issue:** The header comment explaining "no SECURITY DEFINER function is added" contained the literal phrase "security definer" (case-insensitive), which the task's own acceptance criterion (`grep -ci "security definer" ... is 0`) and the shape spec's "no elevated-privilege function" test both exist to catch -- the comment was correct in intent but defeated its own guard.
- **Fix:** Reworded the comment to describe the same constraint ("no elevated-privilege function... a function that runs as its owner and trusts a caller-supplied org id is a PostgREST-exposed cross-tenant hole") without using the literal token pair.
- **Files modified:** `supabase/migrations/00067_site_model.sql`
- **Verification:** `grep -ci "security definer" supabase/migrations/00067_site_model.sql` returns 0; migration-shape spec passes.
- **Committed in:** `7280d97` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cosmetic-only fix to a comment; no functional change. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration is live on the existing Supabase project using credentials already present in `.env.local`.

## Next Phase Readiness

- Schema is live and proven: 51-03 can build `src/actions/site.ts` and the generate route directly against `site_layouts`/`site_machines`/`sop_machines` with confidence the RLS/FK backstop holds
- `src/lib/validators/site.ts` row types (from 51-01) match the live column set exactly
- No blockers for 51-03/51-04

---
*Phase: 51-site-model-machine-editor*
*Completed: 2026-09-28*

## Self-Check: PASSED

- `supabase/migrations/00067_site_model.sql` — FOUND
- `scripts/apply-phase51-migration.mjs` — FOUND
- `tests/phase51/site-model-rls-runtime.spec.ts` — FOUND
- `tests/phase51/site-migration-shape.spec.ts` — FOUND
- `.planning/codebase/CAPABILITY-MATRIX.md` — FOUND
- Commit `7280d97` — FOUND in `git log --oneline`
- Commit `ed2d4ea` — FOUND in `git log --oneline`
- Commit `7e6ca4e` — FOUND in `git log --oneline`
- `node scripts/apply-phase51-migration.mjs` exits 0, prints `ALL POST-APPLY ASSERTIONS PASSED` — CONFIRMED
- `npx playwright test --project=phase51 tests/phase51/site-migration-shape.spec.ts tests/phase51/site-model-rls-runtime.spec.ts` — 19/19 passed — CONFIRMED
- `npx playwright test --project=phase15-stubs tests/lint/rls-org-scope.spec.ts` — 3/3 passed, file unchanged (`git diff --quiet` exits 0) — CONFIRMED
- `npx tsc --noEmit` exits 0 — CONFIRMED
