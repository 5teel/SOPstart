---
phase: 36-refresher-cadence-version-currency
plan: 02
subsystem: database
tags: [supabase, postgres, migrations, competency, pure-functions]

requires:
  - phase: 28-ownership-review-governance
    provides: computeReviewDueDate (UTC end-of-month-clamped due-date math) in src/lib/governance/cadences.ts
  - phase: 35-competency-classifier-training-matrix
    provides: phase35-unit Playwright project (testDir src/lib/competency/__tests__), classify.ts pure-module convention
provides:
  - sops.refresher_interval_months (nullable, 1..120, no new RLS)
  - isOutdatedVersion pure comparator (CMP-03/D-06)
  - refresherDueDate / isRefresherOverdue pure helpers (REF-01/REF-02/D-01/D-02/D-03)
  - unit test coverage for both modules including the end-of-month clamp case
affects: [36-03, 36-04, matrix.ts, competency actions, sops list page]

tech-stack:
  added: []
  patterns:
    - "Per-SOP worker-refresher clock kept structurally separate from the document review-cadence table — no shared column, no shared resolver"
    - "Null-semantics as correctness contract: unset interval/version/completion never triggers a fallback default, only ever returns false/null"

key-files:
  created:
    - supabase/migrations/00055_sops_refresher_interval.sql
    - src/lib/competency/version-currency.ts
    - src/lib/competency/refresher.ts
    - src/lib/competency/__tests__/version-currency.test.ts
    - src/lib/competency/__tests__/refresher.test.ts
  modified:
    - src/types/database.types.ts

key-decisions:
  - "refresher_interval_months has NO org/category default fallback ladder (D-02) — resolveCadenceMonths is intentionally never imported into refresher.ts, enforced by a grep-based acceptance criterion"
  - "No new RLS policy for the new column — admins_can_update_sops / org_members_can_view_sops (migration 00003) already cover any additive sops column, same precedent as migration 00043"
  - "isRefresherOverdue does lexicographic ISO-8601 string comparison (nowIso > dueIso), matching the existing latestOf/latestTimestamp idiom in competency.ts/matrix.ts — equal timestamps are not overdue"

patterns-established:
  - "Pure derivation modules in src/lib/competency/ take all inputs explicitly (never Date.now()/new Date() internally) so they stay deterministic and unit-testable"

requirements-completed: [CMP-03, REF-02]

duration: 2min
completed: 2026-07-27
---

# Phase 36 Plan 02: Refresher Storage Shape + Pure Derivation Helpers Summary

**Additive `sops.refresher_interval_months` column (nullable, 1..120, no new RLS) plus two pure modules — `isOutdatedVersion` and `refresherDueDate`/`isRefresherOverdue` — that the whole phase's matrix/CSV/chip UI recombines from.**

## Performance

- **Duration:** ~2 min (task commits 22:20:37–22:22:22 local)
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- Migration 00055 adds `refresher_interval_months integer` to `public.sops`, range-checked 1..120, with no new RLS policy (rides the existing 00003 admin-write/org-read policies, same precedent as migration 00043)
- `database.types.ts` extended in the sops Row/Insert/Update blocks
- `isOutdatedVersion(latestCompletionVersion, currentVersion)` — false on any null input, strictly-less-than comparison on the monotonic version integer (never sop UUIDs)
- `refresherDueDate(lastCompletionIso, intervalMonths)` — null on any null input (D-02, no fallback ladder), otherwise delegates to `computeReviewDueDate` from Phase 28
- `isRefresherOverdue(dueIso, nowIso)` — false when unset, lexicographic ISO string compare otherwise
- 9 new unit tests (32/32 green across the whole `phase35-unit` project), including the exact end-of-month clamp assertion (`2026-01-31` + 1mo → `2026-02-28`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 00055 — additive refresher_interval_months column on sops** - `49bc5e0` (feat)
2. **Task 2: Pure modules — version-currency.ts and refresher.ts** - `110901a` (feat)
3. **Task 3: Unit tests for both pure modules** - `a0354e1` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `supabase/migrations/00055_sops_refresher_interval.sql` - additive nullable range-checked column, no new RLS
- `src/types/database.types.ts` - refresher_interval_months added to sops Row/Insert/Update
- `src/lib/competency/version-currency.ts` - `isOutdatedVersion` pure comparator
- `src/lib/competency/refresher.ts` - `refresherDueDate` / `isRefresherOverdue` pure helpers, imports `computeReviewDueDate`
- `src/lib/competency/__tests__/version-currency.test.ts` - 4 tests
- `src/lib/competency/__tests__/refresher.test.ts` - 7 tests

## Decisions Made
- No org/category fallback ladder for the refresher interval — `resolveCadenceMonths` deliberately never imported into `refresher.ts` (D-02), verified by a zero-count grep acceptance check
- No new RLS policy needed for the new column — existing `admins_can_update_sops` / `org_members_can_view_sops` already gate every column on `sops`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` clean after each task; `npx playwright test --project=phase35-unit` green 32/32 including the pre-existing classify/csv/matrix suites.

## User Setup Required

None - no external service configuration required. Note: migration 00055 is NOT pushed to Supabase in this plan (per plan instruction) — the push is the blocking task in plan 36-03.

## Next Phase Readiness
- `sops.refresher_interval_months` and the two pure helpers are ready for plan 36-03 (migration push + the admin write action) and downstream matrix/CSV/chip consumers
- No blockers

---
*Phase: 36-refresher-cadence-version-currency*
*Completed: 2026-07-27*

## Self-Check: PASSED

All created files and task commits verified present on disk / in git log.
