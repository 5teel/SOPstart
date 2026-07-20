---
phase: 34-supervisor-observations
plan: "10"
subsystem: database
tags: [supabase, rls, postgres, zod, server-actions, security]

# Dependency graph
requires:
  - phase: 34-supervisor-observations
    provides: sop_observations table + RLS (00052/00053), listWorkerSopsForPicker, setObservationLabels (34-03/34-04/34-06)
provides:
  - "Migration 00054: role-scoped sop_observations_read_org SELECT policy closing the same-org worker-reads-everything privacy leak"
  - "listWorkerSopsForPicker fixed to read sop_assignments via the admin client, org-scoped and keyed to the observed worker (not the caller)"
  - "ObservationLabelsSchema Zod validation on setObservationLabels + 80-char UI input caps"
affects: [35-competency-classifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-scoped RLS SELECT policy: org-wide branch gated by current_user_role() IN (recorder roles), self-read branch untouched — mirrors sop_completions (00010)"
    - "Admin-client read of a table whose RLS only exposes the CALLER's own rows, when the action needs to read on behalf of a DIFFERENT (observed) user — self-enforce org scope on every admin-client query"

key-files:
  created:
    - supabase/migrations/00054_observation_read_role_scope.sql
    - scripts/apply-phase34-gap-migration.mjs
    - tests/phase34/observation-read-role-scope.spec.ts
    - tests/phase34/picker-assigned-first-role-scope.spec.ts
  modified:
    - src/actions/observations.ts
    - src/lib/validators/observations.ts
    - src/components/admin/observations/ObservationLabelsCard.tsx

key-decisions:
  - "Migration 00054 wraps only the org-wide branch of sop_observations_read_org in the role check — the OBS-02 self-read branch (observed_worker_id = auth.uid()) is left exactly as-is"
  - "listWorkerSopsForPicker's two sop_assignments reads moved to the admin client, keyed to workerMember.role (the OBSERVED worker), never the caller's session role — RLS 00007 only ever exposes the caller's own assignment rows"
  - "setObservationLabels parameter changed from a typed object to rawInput: unknown + safeParse, matching the recordObservation precedent already in this file"

requirements-completed: [OBS-01, OBS-02]

# Metrics
duration: ~35min
completed: 2026-07-20
---

# Phase 34 Plan 10: Gap Closure (CR-01 read-scope leak, CR-02 dead picker) Summary

**Migration 00054 role-scopes the sop_observations org-wide SELECT policy (closing a same-org worker-reads-every-peer's-observation leak), and listWorkerSopsForPicker now reads sop_assignments via the admin client keyed to the observed worker instead of the session-RLS-starved caller.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-20
- **Tasks:** 2/2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- Closed CR-01 (BLOCKER): a plain worker could read every peer's observation in the org via PostgREST. Migration 00054 pushed live and proven at runtime both ways (worker negative, supervisor positive).
- Closed CR-02: `listWorkerSopsForPicker` always returned an empty `assignedIds` set for supervisor callers because it read `sop_assignments` through RLS scoped to the *caller*. Now reads via the admin client, org-self-scoped, keyed to the *observed* worker's id/role.
- Folded in WR-01: `setObservationLabels` now validates input with Zod before touching the DB; both label inputs capped at 80 chars in the UI.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 00054 — role-scope the observation read policy, push live, prove it at runtime** - `a4ff048` (fix)
2. **Task 2: Fix listWorkerSopsForPicker (admin-client, org-scoped, observed-worker-role) + fold WR-01 label validation** - `835ba9b` (fix)

_No plan-metadata commit yet — this SUMMARY/STATE/ROADMAP update is committed separately per the final_commit step._

## Files Created/Modified
- `supabase/migrations/00054_observation_read_role_scope.sql` - Recreates `sop_observations_read_org` with a recorder-role check on the org-wide branch
- `scripts/apply-phase34-gap-migration.mjs` - Copy-adapted from `apply-phase29-migration.mjs`; pushed 00054 live, confirmed via `pg_policies.qual`
- `tests/phase34/observation-read-role-scope.spec.ts` - Source-contract + live runtime probes (worker self-read positive+negative in one assertion, supervisor org-wide positive)
- `src/actions/observations.ts` - `listWorkerSopsForPicker` role-gated + admin-client org-scoped reads keyed to `workerMember.role`; `setObservationLabels` now `safeParse`s `rawInput: unknown`
- `src/lib/validators/observations.ts` - Added `ObservationLabelsSchema`
- `src/components/admin/observations/ObservationLabelsCard.tsx` - `maxLength={80}` on both label inputs
- `tests/phase34/picker-assigned-first-role-scope.spec.ts` - Wiring proof: role gate, admin client (not session client), org-scope on both queries, observed-worker-role keying

## Decisions Made
- Kept the `workerMember` role lookup on the session client (its RLS — `org_members_can_view_own_org` — already permits any org member to read it; it is not the defective policy).
- `sop_observations_read_org`'s self-read branch stays a bare `observed_worker_id = auth.uid()` — no widening, no `= any(...)` form, consistent with the SC-4 contract test's existing assertion.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` blocks precisely, including the exact `.eq('organisation_id', organisationId)` self-scoping pattern and the `workerMember.role` keying the plan specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Migration 00054 is live on production DB; `sop_observations` read RLS now matches the `sop_completions` role-scoped precedent.
- `listWorkerSopsForPicker`'s assigned-first ordering is now functional for supervisor callers (the phase's primary persona) — proven by wiring test, not yet by a real browser E2E (deferred; source-contract wiring test is proportionate per the plan's own fallback clause).
- Phase 35 (Competency Classifier) can now build on a proven privacy invariant for `sop_observations` reads.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (`a4ff048`, `835ba9b`) verified present in `git log --oneline --all`.
