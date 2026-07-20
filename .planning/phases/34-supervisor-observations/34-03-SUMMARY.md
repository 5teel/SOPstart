---
phase: 34-supervisor-observations
plan: 03
subsystem: database
tags: [supabase, rls, postgres, playwright, security]

requires:
  - phase: 34-supervisor-observations (34-02)
    provides: "migration 00052_supervisor_observations.sql (sop_observations table + RLS policies, drafted but not yet applied to live DB)"
provides:
  - "Live sop_observations table + organisations.observation_labels column on the production Supabase DB"
  - "migration 00053_sop_observations_cross_org_guard.sql — closes a real cross-tenant write hole found via live runtime probing"
  - "Live runtime proof of SC-4 (cross-org write/read isolation) and OBS-01 (append-only immutability) — no test.fixme remaining on these two specs"
affects: [34-04, 34-05, 34-06, 34-07, 34-08, 34-09]

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER cross-table FK-ownership guard in RLS WITH CHECK — when an INSERT policy's org-scope check doesn't also verify referenced FKs (sop_id, observed_worker_id) belong to that same org, a caller can write a row under their own valid organisation_id while naming another org's entities"
    - "Ephemeral throwaway org + magic-link-minted session + direct supabase-js calls (no chromium) to prove RLS-only tables at runtime — reused verbatim from tests/phase32/grants-org-isolation.spec.ts"

key-files:
  created:
    - supabase/migrations/00053_sop_observations_cross_org_guard.sql
  modified:
    - tests/phase34/observation-cross-org-isolation.spec.ts
    - tests/phase34/observation-immutability.spec.ts

key-decisions:
  - "Found (via live empirical probe, not just review) that 00052's INSERT policy allowed an org-B supervisor to insert an observation using their own valid organisation_id while referencing an org-A sop_id/observed_worker_id — added migration 00053 with a SECURITY DEFINER sop_observation_refs_in_org() helper wired into WITH CHECK"
  - "Runtime tests use direct supabase-js calls (ephemeral org + magic-link session), not chromium/browser navigation — Pattern 1 (34-RESEARCH.md) is RLS-only with no admin-client/server-action layer to reach, matching the tests/phase32/grants-org-isolation.spec.ts precedent"

requirements-completed: [OBS-01, OBS-02]

duration: 35min
completed: 2026-07-20
---

# Phase 34 Plan 03: Live DB Push + SC-4/Immutability Runtime Proofs Summary

**Pushed migration 00052 live, then an empirical runtime probe found and fixed a real cross-tenant write hole (migration 00053) before flipping both safety-critical Wave-0 test stubs to real, passing runtime tests against live Supabase.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-20
- **Completed:** 2026-07-20
- **Tasks:** 2 completed
- **Files modified:** 3 (1 new migration, 2 spec files flipped live)

## Accomplishments

- `sop_observations` table and `organisations.observation_labels` column are live on production Supabase, PostgREST schema cache reloaded and verified via raw SQL (`to_regclass`, `pg_policies` count) — bypassing the PGRST205 stale-cache window per the 2026-06-15 CLAUDE.md learning.
- Discovered and closed a real, live cross-tenant write hole: an authenticated org-B supervisor could insert a `sop_observations` row using their own valid `organisation_id` while `sop_id`/`observed_worker_id` referenced org-A entities — the original 00052 INSERT policy never verified those FKs belonged to the same org. Confirmed exploitable via a live probe script before fixing, and confirmed closed via the same probe after fixing.
- `observation-cross-org-isolation.spec.ts` (SC-4) and `observation-immutability.spec.ts` (OBS-01 append-only) flipped from `test.fixme` to real, passing runtime tests against live Supabase — 8/8 green, zero `test.fixme` remaining on either file.

## Task Commits

1. **Task 1: Push migration 00052 to live DB + reload PostgREST cache** — no file diff (live infra action only; verified via `npx supabase migration list --linked` and Management API raw SQL)
2. **Task 2: Flip SC-4/immutability runtime proofs live + close discovered write hole** - `4dcc405` (fix)

**Plan metadata:** (this summary + STATE/ROADMAP update, committed separately)

## Files Created/Modified

- `supabase/migrations/00053_sop_observations_cross_org_guard.sql` - adds `sop_observation_refs_in_org()` SECURITY DEFINER helper and rewrites the `sop_observations_insert_recorder` policy to call it, closing the cross-org write hole
- `tests/phase34/observation-cross-org-isolation.spec.ts` - flipped live: real ephemeral-org insert + read isolation tests (no chromium needed)
- `tests/phase34/observation-immutability.spec.ts` - flipped live: real authenticated UPDATE/DELETE denial tests

## Decisions Made

- Used the `tests/phase32/grants-org-isolation.spec.ts` pattern (ephemeral orgs + `auth.admin.generateLink` magic-link + `verifyOtp` to mint a real session token, then a plain `supabase-js` client with that bearer token) instead of chromium/Playwright page navigation — Pattern 1 for `sop_observations` is RLS-only with no admin-client or server-action layer to reach, so a browser isn't needed to exercise the actual security boundary.
- Fixed the cross-org write hole via a new migration (00053) rather than editing the already-applied 00052 file, since `supabase db push` tracks applied migrations by checksum.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Security bug / missing critical functionality] Cross-org write hole in sop_observations INSERT policy**
- **Found during:** Task 2, while writing the SC-4 runtime test — an empirical probe (`node` script using service-role client to seed fixtures + a real magic-link session) against the live DB showed an org-B supervisor's insert with their own `organisation_id` but org-A `sop_id`/`observed_worker_id` succeeded, contradicting the plan's stated expectation that this insert would be RLS-denied.
- **Issue:** `sop_observations_insert_recorder`'s `WITH CHECK` validated `organisation_id = current_organisation_id()` and role/`observed_by`, but never verified `sop_id`/`observed_worker_id` actually belonged to that organisation — the exact write-hole class flagged repeatedly in CLAUDE.md Learnings (2026-06-15, 2026-06-26 x2, 2026-07-05).
- **Fix:** Added migration `00053_sop_observations_cross_org_guard.sql` with a `SECURITY DEFINER` helper `sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)` that confirms both FKs resolve inside the target org (bypasses RLS on `sops`/`organisation_members` so the check doesn't depend on caller visibility), wired into the INSERT policy's `WITH CHECK`.
- **Files modified:** `supabase/migrations/00053_sop_observations_cross_org_guard.sql`
- **Verification:** Live probe re-run after the fix — both the "own org_id, cross-org refs" attempt and the "impersonate org_id" attempt now return RLS denial errors, zero rows written. Confirmed again inside the flipped-live Playwright spec (8/8 green).
- **Committed in:** `4dcc405` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1/2 — security)
**Impact on plan:** Necessary correctness/security fix directly within this plan's threat-model scope (T-34-03-01, disposition "mitigate"); the plan's own acceptance criteria required this exact insert to be denied, so closing the gap was required to make Task 2 pass honestly rather than adjusting the test to match a broken policy. No scope creep beyond the plan's stated SC-4 guarantee.

## Issues Encountered

None beyond the deviation above. `curl` from the Bash tool is sandbox-blocked on this machine (per CLAUDE.md Learnings) — used PowerShell `Invoke-WebRequest` via `.ps1` scratchpad scripts for the two Supabase Management API calls (schema reload + raw-SQL verification) instead.

## User Setup Required

None - no external service configuration required. Migration pushes used the existing `SUPABASE_ACCESS_TOKEN` already present in `.env.local`.

## Next Phase Readiness

- `sop_observations` table, RLS policies, and the cross-org guard are live and proven at runtime — Plan 34-04 (server action `recordObservation`/`listObservationsForWorker`) and later plans (34-05..09) can now build against a real, hardened table.
- `npx tsc --noEmit` clean. `npx playwright test --project=phase34` green (8 passed, 11 correctly skipped — owned by later plans in the phase).
- No blockers for 34-04.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*
