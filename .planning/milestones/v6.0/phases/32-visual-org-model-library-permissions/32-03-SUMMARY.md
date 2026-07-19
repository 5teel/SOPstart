---
phase: 32-visual-org-model-library-permissions
plan: 03
subsystem: database
tags: [postgres, supabase, rls, migration, security-definer]

# Dependency graph
requires:
  - phase: 32-02
    provides: "00046_org_model_schema.sql + 00047_org_model_data.sql migration files (unpushed)"
provides:
  - "Migrations 00046 + 00047 live on the production Supabase database"
  - "scripts/assert-phase32-day-one-equivalence.ts — reusable capture/verify day-one equivalence + cache-bypassing existence assertion tool"
  - "Proof: sop_departments byte-identical pre/post migration (D-03), all 7 new org-model tables + departments.area_id exist, sop_in_user_person_grants()/sops_visible_by_person_grant (D-13) present in the live catalog"
affects: [32-04, 32-05, org-model, grants, library-permissions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Management API raw-SQL assertion idiom (to_regclass/to_regprocedure/pg_policies + NOTIFY pgrst reload retry-once) reused verbatim from apply-phase29-migration.mjs, ported to a reusable capture/verify tsx script"
    - "tsx transforms .ts scripts as CJS in this project (no package.json type:module) — top-level await fails under esbuild's CJS output; wrap async logic in a main() function and call it"

key-files:
  created:
    - scripts/assert-phase32-day-one-equivalence.ts
  modified:
    - supabase/migrations/00047_org_model_data.sql

key-decisions:
  - "Snapshot file written to os.tmpdir() (not repo-relative) — capture/verify are a paired manual sequence around a single db push, not a persisted artifact"
  - "Retry-once-after-NOTIFY pattern applied uniformly to every existence probe (tables, column, function, policy) — any of the 8 could theoretically hit the same PGRST205 cache-staleness window"

requirements-completed: [SC-2, SC-6]

# Metrics
duration: 12min
completed: 2026-07-18
---

# Phase 32 Plan 03: Live Schema Push + Day-One Equivalence Proof Summary

**Migrations 00046 (7 new org-model tables + D-13 RLS arm) and 00047 (day-one data seed) are live on the production Supabase DB; a capture/verify assertion script proves sop_departments was untouched by the cutover and every new schema object exists via cache-bypassing Management API SQL.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-18T17:20:00+10:00 (approx)
- **Completed:** 2026-07-18T17:32:00+10:00
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 fixed)

## Accomplishments
- `scripts/assert-phase32-day-one-equivalence.ts` — `--capture` snapshots `sop_departments` ordered rows to a temp JSON file; `--verify` re-reads and byte-compares, then asserts all 7 new tables (`areas`, `roles`, `collections`, `role_members`, `sop_collections`, `access_grants`, `sop_access_people`), `departments.area_id`, `sop_in_user_person_grants()`, and the `sops_visible_by_person_grant` policy via `to_regclass`/`to_regprocedure`/`pg_policies` Management API raw SQL — never the PostgREST REST client — with a retry-once-after-`NOTIFY pgrst, 'reload schema'` fallback per probe
- `npx supabase db push` applied both migrations to the live DB (00046 clean on first attempt; 00047 required one fix — see Deviations)
- `--verify` run against the live DB: 11/11 checks PASS — `sop_departments` unchanged at 13 rows, all 7 tables + `area_id` present, D-13 function + policy present, no RLS recursion regression on `sops`

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the day-one equivalence + table-existence assertion script** - `b0fa699` (feat)
2. **[Rule 1 fix] Wrap mode dispatch in async main()** - `4213574` (fix)
3. **[Rule 1 fix] Cast null to uuid in 00047 access_grants seed insert** - `1b94c70` (fix)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `scripts/assert-phase32-day-one-equivalence.ts` - capture/verify day-one equivalence + existence assertion tool
- `supabase/migrations/00047_org_model_data.sql` - fixed `null` → `null::uuid` cast in the `access_grants` seed `SELECT DISTINCT`

## Decisions Made
- Snapshot temp file lives in `os.tmpdir()`, not the repo — this is a paired capture/verify sequence around one push, not a durable artifact.
- Applied the retry-once-after-`NOTIFY` pattern to every existence probe uniformly rather than only the table checks, since the column/function/policy checks are equally exposed to PGRST205-style staleness.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsx top-level await fails under CJS transform**
- **Found during:** Task 2, first `--capture` run
- **Issue:** `npx tsx scripts/assert-phase32-day-one-equivalence.ts --capture` failed immediately: `Top-level await is currently not supported with the "cjs" output format`. `package.json` has no `"type": "module"`, so esbuild transforms `.ts` files as CJS by default; the script's original top-level `if (mode === '--capture') await capture()` dispatch is invalid under CJS.
- **Fix:** Wrapped the dispatch logic in an `async function main()` and called `main()` (not awaited at top level) — matches the pattern already used implicitly by every other repo script that avoids top-level await.
- **Files modified:** scripts/assert-phase32-day-one-equivalence.ts
- **Verification:** `npx tsc --noEmit` clean; `--capture` ran successfully afterward (13 rows captured)
- **Committed in:** `4213574`

**2. [Rule 1 - Bug] 00047 access_grants seed insert: untyped null literal**
- **Found during:** Task 2, `npx supabase db push`
- **Issue:** `INSERT INTO access_grants (...) SELECT DISTINCT ..., null` failed live with `42804 column "granted_by" is of type uuid but expression is of type text` — Postgres could not infer a type for the bare `null` literal in a mixed-type `SELECT DISTINCT` list. This exact SQL was reviewed and marked correct in 32-02's SUMMARY (the RESEARCH.md cast bug was avoided, but this separate untyped-null issue was not caught by either plan or review).
- **Fix:** Changed `null` to `null::uuid` for the `granted_by` column. 00046 had already committed successfully before the failure; 00047's own `begin`/`commit` wrapper meant the failed transaction rolled back atomically (`supabase migration list` confirmed 00046 applied, 00047 not, before the fix — zero partial writes). Re-ran `db push`, which applied cleanly.
- **Files modified:** supabase/migrations/00047_org_model_data.sql
- **Verification:** `db push` succeeded with the `RAISE NOTICE` completion message; `--verify` confirmed `sop_departments` unchanged and all objects present
- **Committed in:** `1b94c70`

---

**Total deviations:** 2 auto-fixed (1 blocking script bug, 1 migration bug)
**Impact on plan:** Both fixes necessary to complete the plan's blocking task at all — no scope creep. The migration's own transactional wrapper prevented any partial-write risk from the failed first push attempt.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — `SUPABASE_ACCESS_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` were already present in `.env.local` from prior phase pushes (13/25/26/29).

## Next Phase Readiness

- Schema is live: all 7 new org-model tables, `departments.area_id`, the D-13 person-grant RLS arm, and the day-one data seed (collections from `sops.category`, `sop_collections`, dept-level `access_grants`) are on the production DB.
- `sop_departments` proven byte-identical across the cutover — no worker-visible regression from this migration.
- `database.types.ts` was NOT regenerated in this plan (out of scope — types-from-config was the exact false-positive risk this plan closed by pushing to the live DB); Plan 32-04+ server-action/UI work should regenerate types or continue the `as any`-cast pattern already established for other new-table work (Phase 25/26.5 precedent) until types are regenerated.
- Dependent plans (32-04+) can now verify server actions/UI truthfully against the real schema instead of config-derived types.

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: scripts/assert-phase32-day-one-equivalence.ts
- FOUND: supabase/migrations/00047_org_model_data.sql
- FOUND: .planning/phases/32-visual-org-model-library-permissions/32-03-SUMMARY.md
- FOUND: b0fa699 (Task 1 commit)
- FOUND: 4213574 (fix commit)
- FOUND: 1b94c70 (fix commit)
