---
phase: 28-ownership-review-lifecycle-governance-queue
plan: 01
subsystem: database
tags: [postgres, supabase, rls, migration, backfill, ownership, governance]

# Dependency graph
requires:
  - phase: 27-ai-provider-settings-formal-spec
    provides: "ai_model_settings org-scoped settings table shape (00042) copied for sop_review_cadences"
  - phase: 04-completion-and-sign-off
    provides: "sop_completions append-only RLS shape (00010) copied for sop_review_events"
provides:
  - "sops.owner_user_id / review_due_at / last_reviewed_at / last_reviewed_by columns (additive, rides existing RLS)"
  - "default_sop_owner() BEFORE INSERT trigger — every new SOP auto-owned by its creator (uploaded_by)"
  - "sop_review_cadences org-scoped settings table (no authenticated write policy)"
  - "sop_review_events append-only audit table (confirmed_current | superseded)"
  - "database.types.ts sops types extended for the 4 new columns"
  - "All 23 existing prod SOPs backfilled with owner + review_due_at"
affects: [28-02, 28-03, 28-04, governance-queue, sop-detail, admin-library]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive columns riding an existing authenticated RLS policy instead of writing new policies (sops already had admins_can_update_sops/org_members_can_view_sops)"
    - "BEFORE INSERT trigger for default-value population across every create path with zero route edits"
    - "Idempotent backfill script: conditional per-column patch, skip when patch is empty, never null-clobber"

key-files:
  created:
    - supabase/migrations/00043_ownership_review_governance.sql
    - scripts/backfill-owner-review.mjs
  modified:
    - src/types/database.types.ts

key-decisions:
  - "Trigger defaults owner_user_id from sops.uploaded_by, not created_by — sops has no created_by column; uploaded_by is the creator field set at every insert site (Rule 1 fix, plan's spec assumed a nonexistent column)"
  - "sop_review_cadences has zero cadence rows yet (Plan 28-03 owns writes) — backfill resolves every SOP to the 12-month default; that is correct per D28-03"

patterns-established:
  - "sop_review_cadences / sop_review_events accessed via (supabase as any) casts until a future full type regen — matches ai_model_settings/departments precedent"

requirements-completed: [OWN-01, REV-01, REV-04]

# Metrics
duration: 25min
completed: 2026-07-12
---

# Phase 28 Plan 01: Ownership + Review Lifecycle Data Foundation Summary

**Migration 00043 live on prod: 4 additive sops columns, an auto-owner BEFORE INSERT trigger, sop_review_cadences + sop_review_events tables, and all 23 existing SOPs backfilled with owner + review-due date.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-12T06:35:00Z
- **Completed:** 2026-07-12T07:00:00Z
- **Tasks:** 3 completed (+ 1 inline Rule-1 fix)
- **Files modified:** 3 (1 migration created, 1 script created, 1 types file extended)

## Accomplishments
- Migration 00043 pushed live to prod via `npx supabase db push` (non-interactive, `.env.local` `SUPABASE_ACCESS_TOKEN`)
- `default_sop_owner()` trigger verified live with a real begin/rollback insert — new SOPs auto-inherit `owner_user_id` from `uploaded_by`
- `sop_review_cadences` (settings, no authenticated write policy) and `sop_review_events` (append-only audit) both verified present via `to_regclass` through the Management API (bypasses PostgREST schema-cache staleness per the 2026-06-15 learning)
- `database.types.ts` `sops` Row/Insert/Update extended; `npx tsc --noEmit` green
- Backfill executed against prod: 23/23 SOPs updated on first run, 0/23 updated on re-run (idempotency proven)
- Zero published SOPs left with a NULL owner or NULL review_due_at (confirmed via live count query)

## Task Commits

1. **Task 1: Write migration 00043** - `82bb954` (feat)
2. **Task 2: Push migration + extend database.types.ts** - `b161d04` (feat)
3. **Rule 1 fix: trigger references uploaded_by not created_by** - `28fbf7a` (fix)
4. **Task 3: Backfill owner + review_due_at** - `f8e324c` (feat)

_No plan-metadata-only commit yet — this SUMMARY + STATE/ROADMAP updates land in the final commit._

## Files Created/Modified
- `supabase/migrations/00043_ownership_review_governance.sql` - 4 sops columns, default_sop_owner trigger, sop_review_cadences, sop_review_events, RLS
- `scripts/backfill-owner-review.mjs` - idempotent owner + review_due_at backfill, executed against prod
- `src/types/database.types.ts` - sops Row/Insert/Update extended with the 4 new columns

## Decisions Made
- Owner-default trigger uses `uploaded_by` (the real creator column) instead of the plan's assumed `created_by` — see Deviations.
- Cadence resolution in the backfill script follows category → org 'default' row → 12-month hardcoded fallback; since Plan 28-03 (not yet run) owns writing cadence rows, every SOP today resolves to 12 months, which is correct per D28-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `default_sop_owner()` trigger referenced a column that doesn't exist on `sops`**
- **Found during:** Task 3 prep (verifying the trigger before writing the backfill script that depends on the same owner-resolution logic)
- **Issue:** The plan's action text specified `new.owner_user_id := new.created_by;`, but `public.sops` has no `created_by` column — only `uploaded_by` (confirmed via grep across `src/actions/sops.ts`, `versioning.ts`, `ai-prompt`/`youtube` routes, all of which set `uploaded_by: user.id` at insert). Because PL/pgSQL function bodies aren't validated against table shape at `CREATE FUNCTION` time, the migration pushed clean in Task 2 but the very first real SOP insert would have thrown `record "new" has no field "created_by"` at runtime — a total block on SOP creation.
- **Fix:** Rewrote the trigger to use `new.uploaded_by`; pushed the corrected function directly to prod via the Supabase Management API (`create or replace function`, idempotent) since the migration file was already marked applied in Supabase's tracking table and editing the file alone would not re-run it. Verified live with a `begin; insert ...; rollback;` round-trip showing `owner_user_id = uploaded_by` on the returned row.
- **Files modified:** `supabase/migrations/00043_ownership_review_governance.sql` (fixed the source of truth for future fresh environments)
- **Verification:** Live begin/rollback insert test returned matching `owner_user_id`/`uploaded_by`; `pg_proc.prosrc` confirmed the corrected body is live.
- **Committed in:** `28fbf7a`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in trigger column reference)
**Impact on plan:** Caught before any real SOP was ever inserted since the migration went live seconds earlier in this same session — zero user-facing impact. No scope creep; fix was the minimum change (one column name) plus a live-DB proof.

## Issues Encountered
- `curl` to the Supabase Management API failed with exit code 35 (TLS handshake) on the first attempt — same local-CA class of issue as the CLAUDE.md 2026-07-06 Python `VERIFY_X509_STRICT` learning. Fixed with `--ssl-no-revoke`, consistent with that learning's schannel-revocation workaround.

## User Setup Required
None - no external service configuration required. `SUPABASE_ACCESS_TOKEN` was already present in `.env.local` from prior phases (13/25/27 precedent).

## Next Phase Readiness
- Schema foundation is fully live and backfilled; Plan 28-02/03/04 (server actions, owner reassignment UI, review cadence settings write, governance queue) can now build directly on `sops.owner_user_id`/`review_due_at`/`last_reviewed_at`/`last_reviewed_by`, `sop_review_cadences`, and `sop_review_events` without any further schema work.
- `sop_review_cadences` currently has zero rows in any org — the first plan that writes cadence settings should confirm the 12-month fallback path still resolves correctly once real category rows exist.
- No blockers.

---
*Phase: 28-ownership-review-lifecycle-governance-queue*
*Completed: 2026-07-12*

## Self-Check: PASSED

All created files verified present; all task/fix commit hashes (`82bb954`, `b161d04`, `28fbf7a`, `f8e324c`, `84fe6b9`) verified in git log.
