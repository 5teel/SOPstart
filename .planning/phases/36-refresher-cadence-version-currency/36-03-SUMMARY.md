---
phase: 36-refresher-cadence-version-currency
plan: 03
subsystem: database
tags: [supabase, postgrest, rls, server-actions, migrations]

# Dependency graph
requires:
  - phase: 36-refresher-cadence-version-currency (plan 02)
    provides: migration file 00055_sops_refresher_interval.sql, database.types.ts extension, refresher.ts/version-currency.ts pure functions
provides:
  - live sops.refresher_interval_months column (integer, nullable, 1..120 constrained) on the remote DB, verified via cache-bypassing Management API assertions
  - setRefresherInterval admin server action (src/actions/governance.ts)
  - refresher_interval_months carried forward through BOTH version-supersede paths (uploadNewVersion, cloneSopAsDraft)
  - scripts/apply-phase36-migration.mjs (non-interactive push + PGRST-safe assertions, reusable pattern)
affects: [36-04, 36-05, 36-06, 36-07, 36-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Management API raw SQL assertions bypass PostgREST schema cache (PGRST205 vs 42P01/42703 distinction)"
    - "Explicit-field-list inserts require the same column added at every copy-forward site by name — no spread"

key-files:
  created:
    - scripts/apply-phase36-migration.mjs
    - tests/phase36/refresher-interval-write.spec.ts
  modified:
    - src/actions/versioning.ts
    - src/actions/governance.ts

key-decisions:
  - "setRefresherInterval writes with the plain session client (admins_can_update_sops RLS is the enforcing gate), never createAdminClient — mirrors setSopOwner posture"
  - "null months clears the refresher (D-02) with no range validation branch; non-null months validated 1..120 integer with shared error wording"
  - "npx supabase db push succeeded non-interactively via SUPABASE_ACCESS_TOKEN — no Management API fallback needed"

patterns-established:
  - "Pattern: any new per-SOP column touched by uploadNewVersion/cloneSopAsDraft must be added to both select() lists and both insert() payloads by name (RESEARCH Pitfall 2)"

requirements-completed: [REF-01, REF-02]

# Metrics
duration: 4min
completed: 2026-07-27
---

# Phase 36 Plan 03: Live Migration + Refresher Write Action + Copy-Forward Summary

**Pushed migration 00055 to the live Supabase DB with cache-bypassing proof, added the admin `setRefresherInterval` write action, and closed RESEARCH Pitfall 2 by carrying the refresher interval through both version-supersede paths.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-27T22:27:24+10:00
- **Completed:** 2026-07-27T22:30:55+10:00
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `sops.refresher_interval_months` is live on the remote database — proven via three cache-bypassing Management API assertions (column type/nullability, range constraint rejection at 0 and 121, PostgREST schema-cache reload), not just `tsc`/`next build` passing (which prove nothing about the live schema since types are hand-extended)
- `setRefresherInterval(sopId, months)` admin action added, gated by `requireAdmin()` + plain session-client RLS, range-validated, zero-row-write correctly surfaced as `'SOP not found'` rather than silent success
- An interval set on v1 now survives both `uploadNewVersion` and `cloneSopAsDraft` — the two independent explicit-field-list insert sites RESEARCH flagged as Pitfall 2

## Task Commits

Each task was committed atomically:

1. **Task 1: [BLOCKING] Apply migration 00055 to the live database and prove the column exists** - `af30ba4` (feat)
2. **Task 2: Carry refresher_interval_months forward through BOTH supersede paths** - `0a8012d` (feat)
3. **Task 3: setRefresherInterval admin write action + source-contract guard** - `df5a707` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/apply-phase36-migration.mjs` - non-interactive `db push` + three cache-bypassing Management API assertions (column exists, range constraint live, PostgREST reload)
- `src/actions/versioning.ts` - added `refresher_interval_months` to both source-row selects and both insert payloads (`uploadNewVersion`, `cloneSopAsDraft`)
- `src/actions/governance.ts` - added `setRefresherInterval` admin write action + updated file-header export doc comment
- `tests/phase36/refresher-interval-write.spec.ts` - source-contract guard proving the write action's auth/validation/client posture and both copy-forward sites independently

## Decisions Made
- `npx supabase db push` succeeded non-interactively with `SUPABASE_ACCESS_TOKEN` already set in `.env.local` — the Management API raw-SQL fallback path in the script was not exercised this run (still present for future migrations where a DB password prompt blocks the CLI).
- Range-check probe runs inside a `DO $$ ... $$` block using `EXCEPTION WHEN check_violation` per case and deletes its own probe rows by a sentinel filename, so no test data is left behind and no explicit transaction wrapper was needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The database mutation was applied directly by this plan's Task 1 script.

## Next Phase Readiness

- Live column + write action + copy-forward are all in place for 36-04/36-05 to build the derived refresher-due and version-currency read logic on top of a schema that is proven live (not just type-declared).
- `refresher.ts`/`version-currency.ts` pure functions from 36-02 remain untouched by this plan — no forward dependency risk.

---
*Phase: 36-refresher-cadence-version-currency*
*Completed: 2026-07-27*
