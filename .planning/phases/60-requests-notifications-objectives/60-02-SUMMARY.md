---
phase: 60-requests-notifications-objectives
plan: 02
subsystem: database
tags: [supabase, rls, migration, decisions-ledger, requests, notifications, objectives]
requires: [60-01]
provides:
  - requests, notifications, objectives tables live (migration 00074)
  - five new ledger kinds (23 total) mirrored in DECISION_KINDS, groups, words, types
  - applier scripts/apply-phase60-migration.mjs with Management-API assertions
  - live RLS probe per role
affects: [60-03, 60-04, 60-05, 60-06, 60-07, 60-08, 60-09, 60-10, 60-11]
tech-stack:
  added: []
  patterns: [SELECT-only service-written tables, column-level UPDATE grant, plain-uuid person columns]
key-files:
  created:
    - supabase/migrations/00074_requests_notifications_objectives.sql
    - scripts/apply-phase60-migration.mjs
  modified:
    - src/lib/decisions/shape.ts
    - src/lib/decisions/read.ts
    - src/types/database.types.ts
    - tests/phase56/decision-kinds-live.spec.ts
    - tests/phase56/decision-shape.spec.ts
    - tests/phase59/ledger-read.spec.ts
    - tests/phase60/ledger-kinds.spec.ts
    - tests/phase60/capability-matrix.spec.ts
    - tests/phase60/requests-notifications-objectives-rls-live.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "Person columns (raised_by_user, target_user_id, answered_by, set_by_user, confirmed_by) are plain uuids with no FK, so deleting a user never violates requests_one_raiser / objectives_one_setter"
  - "requests_read compares target_role to current_user_role()::text (role is an enum, target_role is text)"
  - "No backfill of sop_assignments into requests: the ledger already holds their assign rows, requests start from now"
patterns-established:
  - "Column-level grant (revoke update, grant update (read_at)) is how a table lets a session change exactly one field"
requirements-completed: []
duration: ~40 min
completed: 2026-10-06
---

# Phase 60 Plan 02: Migration 00074 Summary

Three org-scoped tables (requests, notifications, objectives) are live with SELECT-only policies, the ledger accepts five new kinds, and each SOP's old objective text now sits in `objectives` on its lineage root.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 16db38ff | migration 00074 and applier |
| 2 | 044d2121 | kinds, Requests group, words, table types, matrix rows |
| 3 | 868327bb | live RLS probe, kind-list spec repointed to 00074 |

## Remote history (before apply)

`npx supabase migration list`: 00001 through 00073 matched local and remote; 00074 local only. No repair needed. Applied via `supabase db push`.

## Applier output (all PASS, no FAIL)

- decisions_kind_check accepts all 23 kinds
- decisions still has exactly one policy (admins_can_read_decisions) and both append-only triggers
- requests: one policy, requests_read SELECT (org, auth.uid, role pinned)
- objectives: one policy, objectives_read_org SELECT
- notifications: notifications_read_own SELECT and notifications_mark_own_read UPDATE (qual and with_check own row + org)
- no INSERT / DELETE / ALL policy on any of the three, no UPDATE policy on requests / objectives
- row security on all three
- column grant: authenticated may update read_at only (title, place, user_id, kind false; table-level false; anon false)
- place check, unique (user_id, dedupe_key), requests_one_open_agent_new_sop, objectives unique (nulls not distinct) exist
- no FK from the three tables to sops; none on the person columns
- **migrated objective count: 2** (lineage roots 2), no orphans
- worker_notifications still exists untouched; notifications starts with 0 rows
- NOTIFY pgrst reload schema issued

## Live probes (each run once)

- `PHASE56_LIVE=1 decision-kinds-live`: 4 passed (every one of 23 kinds lands, including the five new ones; unnamed agent and actor-less person refused)
- `PHASE60_LIVE=1 requests-notifications-objectives-rls-live`: 9 passed. Worker, supervisor, admin and a real-org admin (foreign reader) each read exactly the expected requests rows; authenticated insert refused and update / delete change nothing (service re-read); notifications readable only by owner, `read_at` update works, title / place update refused, another person's row untouched, insert refused; objectives readable by every eval-site member, zero for the foreign org, no authenticated write; worker and supervisor still read zero decisions.

## Verification

`npx tsc --noEmit` clean; projects phase60 (11 passed, 107 stubs skipped), phase59 (146 passed), phase56 (all passed after repoint), phase46 (30 passed); `rls-org-scope` lint green.

## Deviations from Plan

**1. [Rule 3 - Blocking] Repointed `tests/phase56/decision-shape.spec.ts`**
- **Found during:** final phase56 run
- **Issue:** its "DECISION_KINDS equals the live CHECK" case read 00073, which now lists 18 kinds
- **Fix:** read 00074 instead (same regex)
- **Commit:** 868327bb

**2. The probe does not insert the five new kinds itself.** The ledger is append-only, and `decision-kinds-live` (run once, 23 kinds land) plus the applier's check-definition assertion already prove them, so the probe skips a duplicate insert that would leave five more permanent rows in the eval-site ledger.

**3. `requests_read` casts the role: `current_user_role()::text`.** The research skeleton compared the text column to the enum directly, which Postgres rejects; the cast is the only change to the read rule.

**4. Added a `requests_subject_shape` check** (site has no subject id, sop and machine must) as the plan specified in prose; the research skeleton lacked it.

## Known Stubs

None in this plan. The remaining `test.fixme` cases in `tests/phase60/` belong to later plans.

## Threat Flags

None. No new network surface; the only authenticated write is own-row `read_at`.

## Notes

- `database.types.ts` was spliced (three table blocks after `decisions`), not regenerated.
- Subject rows are not cleaned up here; per research Pitfall 9, `deleteSop` clearing them is plan 60-09.

## Self-Check: PASSED

Files present: migration 00074, applier, this summary; commits 16db38ff, 044d2121, 868327bb exist.
