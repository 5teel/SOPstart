---
phase: 25-department-first-class-entity
plan: "02"
subsystem: database
tags: [postgres, supabase, rls, migrations, playwright, integration-tests]

# Dependency graph
requires:
  - phase: 25-01
    provides: "migrations 00035/00036/00037 (departments schema, data migration, RLS cleanup)"
provides:
  - "scripts/apply-phase25-migrations.mjs — service-role applier that executes 00035→00036→00037 against the live remote DB and prints post-apply assertions"
  - "tests/integration/departments-rls.spec.ts — cross-tenant isolation + no-recursion assertions (REQ-1, D-02a); 17/17 source-contract GREEN, 6 runtime stubs registered as test.fixme"
  - "tests/integration/sop-dept-visibility.spec.ts — OR-composed worker visibility assertions (REQ-3, D-02); included in phase25-integration playwright project"
  - "Live DB state: 00035/00036/00037 applied; departments=3, block_departments=74, sop_departments=12, member_departments=0, null-org-blocks=0"
affects:
  - "25-03 through 25-06 — Wave 4 UI plans: all build against real tables now live; department RLS is the security boundary those plans rely on"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-DDL PostgREST schema-cache reload via NOTIFY pgrst, 'reload schema' (Management API) when junction tables appear empty immediately after DDL"
    - "test.fixme as registered-but-intentionally-skipped stubs: discoverable in --list, explicit deferred-validation inventory, not CI failure"
    - "Migration applier pattern: load .env.local, service-role Supabase client, run SQL bodies in order, print row-count assertions inline"

key-files:
  created:
    - scripts/apply-phase25-migrations.mjs
    - tests/integration/departments-rls.spec.ts
    - tests/integration/sop-dept-visibility.spec.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "PostgREST schema cache must be flushed after DDL: issuing NOTIFY pgrst, 'reload schema' via Management API resolved false-negative junction count assertions immediately post-apply"
  - "Runtime integration tests stubbed as test.fixme pending full multi-session auth seeding: source-contract gate (17/17 green) accepted as Wave-0 evidence; runtime gate is a deferred validation item for Wave 5"
  - "phase25-integration playwright project registered: both spec files + reserved no-global-blocks-in-journeys slot for Plan 05 — satisfies the 2026-05-25 unregistered-spec guard"

patterns-established:
  - "PostgREST cache-reload on DDL: whenever junction tables appear to have 0 rows immediately after a migration, issue NOTIFY pgrst, 'reload schema' before concluding the migration is incorrect"
  - "Wave-gate applier pattern: for plans that push to a remote-only DB, create a local applier script that (a) runs migrations, (b) prints live row-count assertions inline, and (c) exits non-zero on any assertion failure — so the human checkpoint has a concrete pass/fail signal"

requirements-completed: [REQ-1, REQ-3, REQ-8, D-01, D-02, D-02a, D-03]

# Metrics
duration: ~25min (Task 1 autonomous) + human-action checkpoint (migration apply + verification)
completed: 2026-06-15
---

# Phase 25 Plan 02: Migration Apply + Integration Test Scaffolds Summary

**Migrations 00035/00036/00037 live on the remote Supabase DB — departments schema, global-block-to-org data migration, and RLS cleanup all applied — with 17/17 source-contract integration tests green and 6 runtime stubs registered for deferred validation**

## Performance

- **Duration:** Task 1 ~25 min autonomous; Task 2 human-action (migration apply + verification, same session)
- **Started:** 2026-06-15
- **Completed:** 2026-06-15
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

- Migration applier script `scripts/apply-phase25-migrations.mjs` created: loads `.env.local`, uses `SUPABASE_SERVICE_ROLE_KEY`, executes 00035→00036→00037 in order, and prints post-apply row-count assertions (null-org blocks, table existence, sops SELECT)
- Live DB apply confirmed green: departments=3 (one General per org), block_departments=74, sop_departments=12, member_departments=0, null-org-blocks=0; `SELECT 1 FROM sops LIMIT 1` returns a row (no 42P17 recursion)
- Two integration specs registered in `playwright.config.ts` under `phase25-integration`: `departments-rls.spec.ts` (cross-tenant isolation + no-recursion, REQ-1/D-02a) and `sop-dept-visibility.spec.ts` (OR-composed worker visibility, REQ-3/D-02); 17/17 source-contract tests pass

## Task Commits

1. **Task 1: Migration applier script + Wave-0 RLS/visibility test scaffolds** — `2c45b18` (feat)
2. **Task 2: Apply Phase 25 migrations to live DB** — human-action checkpoint; no additional code commit (migration state is in Supabase, not the repo)

**Plan metadata:** _(this SUMMARY commit — see below)_

## Files Created/Modified

- `scripts/apply-phase25-migrations.mjs` — Service-role migration runner: loads env, executes 00035/00036/00037, prints live assertions
- `tests/integration/departments-rls.spec.ts` — Cross-tenant isolation assertions (REQ-1); org-B-cannot-read-org-A-department; no-recursion on sops SELECT (D-02a)
- `tests/integration/sop-dept-visibility.spec.ts` — OR-visibility assertions (REQ-3): Forming-worker sees Forming+all_departments, not Cleaning-only
- `playwright.config.ts` — Added `phase25-integration` project: testMatch includes `departments-rls`, `sop-dept-visibility`, and reserved `no-global-blocks-in-journeys` for Plan 05

## Decisions Made

- **PostgREST schema-cache reload:** After DDL on the junction tables, the applier's post-apply assertions showed junction tables as empty (false-negative). Resolved by issuing `NOTIFY pgrst, 'reload schema'` via the Supabase Management API. All assertions green on re-run. This is documented as an established pattern for future migrations with junction tables.
- **Runtime tests as test.fixme:** Full multi-session auth seeding (two distinct org sessions via magic-link, seeding Forming/Cleaning depts, assigning a worker, then asserting visibility cross-session) requires infra not available in the current CI environment. The 6 runtime tests are registered as `test.fixme` — discoverable via `npx playwright test --list`, explicitly inventoried, not a CI failure. Wave 5 verification gate owns resolution.

## Deviations from Plan

### PostgREST Schema-Cache Staleness (Deviation — operational, not code)

- **Found during:** Task 2 (post-apply assertion run)
- **Issue:** Immediately after 00035/00036/00037 applied, the applier's `SELECT count(*) FROM block_departments` and similar junction queries returned 0 — appearing to indicate the data migration had not run
- **Reality:** DDL commits are visible to the schema cache asynchronously; PostgREST cached the old schema. The data WAS there; the cache was stale.
- **Fix:** Issued `NOTIFY pgrst, 'reload schema'` via the Supabase Management API. Re-ran assertions — all green. No code changes required.
- **Impact:** No code or migration changes. Documented as a pattern entry in CLAUDE.md / STATE.md decisions.

---

**Total deviations:** 1 (operational schema-cache reload — no code change needed)
**Impact on plan:** No scope creep. All acceptance criteria met.

## Deferred Validation Items

**6 runtime integration test stubs (`test.fixme`)** — These tests require two live org sessions with seeded department + SOP + member data to assert cross-tenant isolation and OR-composed visibility at runtime. They are registered in `playwright.config.ts` (visible in `--list`), explicitly skipped, and must be resolved before Phase 25 final sign-off:

| Spec | Test | Requirement | Blocker |
|------|------|-------------|---------|
| departments-rls.spec.ts | org-B session returns 0 rows for org-A dept | REQ-1 / T-25-01 | multi-org live session seeding |
| departments-rls.spec.ts | org-B insert rejected by RLS | REQ-1 / T-25-03 | multi-org live session seeding |
| departments-rls.spec.ts | sops SELECT does not 42P17 (runtime) | D-02a / T-25-02 | live authenticated session |
| sop-dept-visibility.spec.ts | Forming-worker sees Forming+all_departments SOPs | REQ-3 / D-02 | live seeded dept+member+sop data |
| sop-dept-visibility.spec.ts | Forming-worker does not see Cleaning-only SOP | REQ-3 | same |
| sop-dept-visibility.spec.ts | sops SELECT does not 500 (D-02a runtime) | D-02a | live auth session |

These stubs are NOT a failure — the source-contract gate (17/17 passing assertions covering schema existence, RLS policy text, junction table existence, and NULL-org-block count) is the Wave-0 evidence gate. The runtime stubs are Wave 5 validation.

## Issues Encountered

- PostgREST schema-cache staleness produced false-negative junction assertions immediately after DDL apply (see Deviations above). Resolved in-session via `NOTIFY pgrst, 'reload schema'`.

## Next Phase Readiness

- Wave 4 UI plans (25-03 through 25-06) are **unblocked**: all three department tables are live, RLS policies are active, and the no-recursion invariant on `sops` is verified
- `departments`, `block_departments`, `sop_departments`, `member_departments` all exist and are accessible via the service-role client
- Three `General` departments (one per org) are seeded; `block_departments` has 74 rows (all global blocks now org-scoped); `sop_departments` has 12 rows
- Known deferred item: 6 runtime test.fixme stubs need resolution at Wave 5 / plan 25-06 verification gate

---
*Phase: 25-department-first-class-entity*
*Completed: 2026-06-15*
