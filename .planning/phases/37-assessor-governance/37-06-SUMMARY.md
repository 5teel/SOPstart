---
phase: 37-assessor-governance
plan: 06
subsystem: verification
tags: [playwright, runtime-probe, rls, journeys, uat, phase-gate]

# Dependency graph
requires:
  - phase: 37-03
    provides: live migration 00056, recordObservation gate, getAssessorStatusForSop/requestAssessorReview/listAssessmentRequests
  - phase: 37-04
    provides: signOffCompletion gate + sign-off surface UI
  - phase: 37-05
    provides: observation-modal three-state UI + AssessmentRequestsPanel on /admin/team
provides:
  - Live runtime proof of ASR-01 success criteria 1+2 (tests/phase37/bootstrap-override-runtime.spec.ts, 6/6, re-runnable)
  - journeys.ts record-observation decision node (override/blocked branches) + new request-assessment journey
  - Three layman-language p37- UAT entries (blocked supervisor, admin override, assessment requests)
  - Migration 00057 restoring a cross-org RLS guard silently dropped by migration 00056
  - Full-suite phase gate: npm test, tsc, next build, spec-discovery, bundle sanity all green
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "test.describe.serial + a shared ephemeral org/SOP fixture built once in beforeAll — used when later assertions depend on evidence written by earlier ones in the same scenario (contrast with phase34's independent-fixture-per-test pattern), mirrors tests/phase36/version-currency-lineage.spec.ts's single-scenario shape"
    - "Explicit created_at timestamps on seeded evidence rows (completion, sign-off, needs_support observation) rather than relying on real-time ordering — removes a source of test flakiness when asserting D-02-style 'latest evidence wins' semantics"

key-files:
  created:
    - tests/phase37/bootstrap-override-runtime.spec.ts (flipped from test.fixme)
    - supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql
  modified:
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - tests/phase34/record-observation.spec.ts
    - .planning/phases/37-assessor-governance/37-VALIDATION.md

key-decisions:
  - "Migration 00057 (Rule 1 fix-forward): the Task 3 full-suite gate caught that migration 00056 (37-03) recreated sop_observations_insert_recorder to add the is_assessor_override conjunct but silently dropped the 00053 sop_observation_refs_in_org(...) cross-org guard — reopening the exact T-34-03-01 cross-tenant write hole 00053 closed. Fixed by re-creating the policy with BOTH conjuncts; verified live via Management API introspection and tests/phase34/observation-cross-org-isolation.spec.ts going green again."
  - "tests/phase34/record-observation.spec.ts's blanket 'never createAdminClient anywhere in this function' guard was stale against 37-03's legitimate scoped predicate-read admin-client call — narrowed the assertion to the .insert( call line itself (CLAUDE.md 2026-07-13 stale-guard-after-legitimate-extension pattern), not a blanket ban on the whole function body."
  - "bootstrap-override-runtime.spec.ts uses test.describe.serial with one shared ephemeral org/SOP built in beforeAll, since assertions 5/6 (bootstrap resolves, reset re-suspends) depend on evidence rows written by assertions 2-4 — a fresh org per assertion would be unable to prove the deadlock-then-resolution sequence."

requirements-completed: [ASR-01]

# Metrics
duration: ~55min
completed: 2026-07-28
---

# Phase 37 Plan 06: Bootstrap Runtime Proof + Living Maps + Full Phase Gate Summary

**Proved ASR-01 success criteria 1+2 live against the database with a real zero-assessor org (reasoned override succeeds and audits, reasonless override rejected by CHECK, RLS denies a self-stamped supervisor override, the deadlock resolves after the first sign-off and re-suspends on a later needs_support), closed the phase's `journeys.ts`/`uat/tests.ts` obligations, and found + fixed a real cross-org RLS regression during the full-suite gate.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `tests/phase37/bootstrap-override-runtime.spec.ts` flipped from 2 `test.fixme` stubs to 6 live runtime assertions against an ephemeral throwaway org: zero-assessor precondition, reasoned override succeeds with a reconstructible audit row (D-07: id/observed_by/created_at/observed_worker_id/sop_id/reason all present), reasonless override rejected with CHECK `23514` naming the constraint, a plain supervisor's self-stamped override denied at the RLS layer, the bootstrap resolves after the first sign-off (D-05, `false → true`), and a later `needs_support` observation re-suspends assess capability (D-02 carried into assess capability, `true → false`). Green twice in a row, confirming teardown is re-runnable.
- `journeys.ts`'s `record-observation` journey extended with a decision node (signed off / admin-override / blocked-supervisor branches) plus a new `request-assessment` journey covering the recipient side (`/admin/team` → AssessmentRequestsPanel → Assess now → save). Both routes this phase touches (`/admin/team`, `/activity/[completionId]`) confirmed covered.
- Three `p37-*` UAT entries added under `category: 'Phase 37 — Assessor governance'` in plain click-path language (no `ASR-01`/`D-0`/`is_assessor_override`/`performed_to_sop` outside `background`), covering the blocked supervisor, the admin override, and the assessment-requests list.
- **Real regression found and fixed during the full-suite gate (Rule 1):** migration 00056 (37-03) had silently dropped the 00053 cross-org guard (`sop_observation_refs_in_org`) when it recreated `sop_observations_insert_recorder` to add the override conjunct — reopening the T-34-03-01 cross-tenant write hole. `tests/phase34/observation-cross-org-isolation.spec.ts` caught it red. Fixed live via migration `00057_restore_sop_observations_cross_org_guard.sql`, restoring both conjuncts; verified live via Management API introspection of the policy's `with_check` text and the spec going green.
- Sibling fix: `tests/phase34/record-observation.spec.ts`'s blanket "never `createAdminClient(` anywhere in the function" guard was stale against 37-03's legitimate scoped predicate-read admin-client call — narrowed to assert the `.insert(` call line specifically stays on the session client, matching CLAUDE.md's 2026-07-13 stale-guard pattern.
- Full phase gate: `npm run test` — 1294 passed / 35 pre-existing failures (unrelated older-phase stubs, enumerated below) / 208 skipped; `npx tsc --noEmit` clean; `npm run build` clean (`/sops/[sopId]` bundle 1058 KB vs 1056 KB baseline, Δ+2KB, within ±2KB tolerance); `npx playwright test --list --project=phase37` discovers all 6 spec files (81 tests).

## Task Commits

1. **Task 1: Live zero-assessor bootstrap probe** - `7f13e5a` (test)
2. **Task 2: journeys.ts gate branch + request pathway, and layman UAT items** - `fccf997` (docs)
3. **Task 3: Full phase gate (incl. fix-forward migration 00057)** - `a09d440` (fix)

## Files Created/Modified

- `tests/phase37/bootstrap-override-runtime.spec.ts` - flipped live: `test.describe.serial` with a shared ephemeral org/SOP/admin/supervisor/worker fixture; 6 assertions matching the plan's numbered order exactly
- `src/lib/journeys/journeys.ts` - `record-observation` journey gains an `assessor-check` decision node + `override`/`blocked` action steps; new `request-assessment` journey (Supervisor/Admin group)
- `src/lib/uat/tests.ts` - three `p37-*` entries: `p37-blocked-supervisor`, `p37-admin-override`, `p37-assessment-requests`
- `supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql` - re-creates `sop_observations_insert_recorder` with both the 00053 org-ref guard and the 00056 override guard; applied live via `npx supabase db push`, verified via Management API
- `tests/phase34/record-observation.spec.ts` - the write-uses-session-client assertion narrowed to the `.insert(` call site, not the whole function body
- `.planning/phases/37-assessor-governance/37-VALIDATION.md` - all 9 rows ✅ with named proving specs, `nyquist_compliant: true`, `wave_0_complete: true`, documents the 37-06 fix-forward

## D-01..D-09 Decision Audit

| Decision | Implementing artifact | Proving test |
|---|---|---|
| D-01 — Derived assessorship, no designation table | `src/lib/competency/assessor.ts::isSignedOffAssessor` calls `classifyCompetency` | `src/lib/competency/__tests__/assessor.test.ts` (phase35-unit) + bootstrap probe assertions 1/5/6 |
| D-02 — Org-wide, no department fencing | `isSignedOffAssessor` scopes by `orgId` only, no department filter anywhere in the query chain | `src/lib/competency/__tests__/assessor.test.ts` |
| D-03 — Gate BOTH `performed_to_sop` observations AND sign-offs | `recordObservation` (37-03) + `signOffCompletion` (37-04) both call the predicate, branch-before-gate | `tests/phase37/assessor-gate.spec.ts` + `tests/phase37/assessor-ui-signoff.spec.ts` |
| D-04 — `needs_support` stays ungated | `if (verdict === 'performed_to_sop')` branch wraps the gate; predicate never called otherwise | `tests/phase37/assessor-gate.spec.ts` (branch-before-gate position assertion) |
| D-05 — Override always available, always audited, never re-deadlocks | Zod → server action → CHECK constraint (3 layers); bootstrap resolves after sign-off | `tests/phase37/bootstrap-override-runtime.spec.ts` assertions 2/3/5 (live, this plan) |
| D-06 — Override roles = admin + safety_manager only | Role branch in `recordObservation`/`signOffCompletion`; RLS `with_check` conjunct | `tests/phase37/bootstrap-override-runtime.spec.ts` assertion 4 (live RLS denial, this plan) |
| D-07 — Append-only audit via stamped columns, reconstructible | Migration 00056 columns + CHECK constraints on `sop_observations`/`completion_sign_offs` | `tests/phase37/override-audit-schema.spec.ts` + bootstrap probe assertion 2 (id/observed_by/created_at/worker/sop/reason all read back) |
| D-08 — Request path via `worker_notifications` | `requestAssessorReview`/`listAssessmentRequests`/`AssessmentRequestsPanel` (37-03/37-05); `request-assessment` journey (this plan) | `tests/phase37/assessor-ui-observation.spec.ts` + `src/lib/journeys/journeys.ts` route-coverage check |
| D-09 — `needs_support` fully enabled in the same modal | `VerdictButtons.blockedVerdict` disables at most one verdict, never the coaching one | `tests/phase37/assessor-ui-observation.spec.ts` |

**Accepted dispositions recorded, not silently closed:**
- **T-37-01-04** (Elevation of Privilege, accept) — the full assessor predicate (lineage widening + `needs_support` reset) is not re-implemented in SQL; a non-assessor supervisor recording a non-override advancing observation via raw PostgREST is not blocked at the RLS layer. Blast radius bounded: same-org, same-role, about a worker the caller could already observe.
- **T-37-01-05** (Information Disclosure, accept) — the observed worker can read an admin's `override_reason` about them, consistent with Phase 34's OBS-02 full-transparency contract; 37-05's copy tells the override author the reason is permanent-record.

## Pre-existing Test Failures (not regressions — unrelated to this phase)

35 failures remain in `npm run test` after this plan's fixes, all in files this phase never touches, matching the same baseline carried through Phases 23/34/35/36:
- `phase3-stubs` / `phase15-stubs` — `desktop-walkthrough-layout.spec.ts`, `sb-ux-walkthrough.test.ts`, `sub-trade-assignment.spec.ts`, `voice-grounding-scope.spec.ts`
- `phase11-stubs` — `sb-layout-editor.test.ts` (8), `sb-section-schema.test.ts`
- `phase12.5-stubs` — `sb-ux-blocks.test.ts` (4), `sb-ux-blueprint.test.ts` (4), `sb-ux-voice.test.ts` (2), `sb-ux-walkthrough.test.ts` (2)
- `phase20-parsers` / `phase21-unit` — `parser-creates-junctions.test.ts` (2), `block-content-extended.test.ts`
- `phase29` — `queue-classifier.spec.ts`, `version-history-approvals.spec.ts`
- `phase26` — `reorder.spec.ts`
- `phase33` — `sop-grant-schema.spec.ts` (materializeSopAccessForOrg assertion)

Confirmed via a full `git stash`-free comparison: the pre-fix run showed 37 failures; this plan's two Rule-1 fixes (cross-org guard, stale record-observation guard) closed exactly 2 of them, leaving the same 35 that were failing before this phase started.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration 00056 silently dropped the 00053 cross-org RLS guard on `sop_observations`**
- **Found during:** Task 3, full-suite gate (`tests/phase34/observation-cross-org-isolation.spec.ts` went red)
- **Issue:** Migration 00056's `create policy sop_observations_insert_recorder` re-created the policy from scratch to add the `is_assessor_override` conjunct but omitted the `sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)` conjunct migration 00053 had added — an org-B supervisor could once again insert an observation naming an org-A sop/worker while using their own valid `organisation_id`.
- **Fix:** New migration `00057_restore_sop_observations_cross_org_guard.sql` re-creates the policy with both conjuncts present.
- **Files modified:** `supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql`
- **Commit:** `a09d440`

**2. [Rule 1 - Bug] Stale source-contract guard in `tests/phase34/record-observation.spec.ts`**
- **Found during:** Task 3, full-suite gate
- **Issue:** The test asserted `createAdminClient(` appears nowhere in `recordObservation`'s body — but 37-03 legitimately added a scoped admin-client predicate READ (not a write) for `isSignedOffAssessor`, per the 2026-07-20 inverted-false-deny learning. The blanket assertion was stale, not the code.
- **Fix:** Narrowed the assertion to the `sop_observations` `.insert(` call line specifically — it still fails if the WRITE ever moves off the session client, but no longer fails on the legitimate read.
- **Files modified:** `tests/phase34/record-observation.spec.ts`
- **Commit:** `a09d440`

## Issues Encountered

- Bootstrap probe's `mintAccessToken` hit a transient Supabase auth "Request rate limit reached" once during a rapid succession of `npm run test` full-suite re-runs in this session (magic-link generation rate limit, not a code issue). Re-ran `npx playwright test --project=phase37 -g bootstrap` standalone immediately after and got 6/6 green — confirmed environmental, not a regression.

## User Setup Required

None — migration 00057 applied live directly via `npx supabase db push` using credentials already present in `.env.local`; no new external service configuration.

## Next Phase Readiness

- ASR-01 is fully proven end-to-end: schema (migration 00056+00057) → predicate (`isSignedOffAssessor`) → both gated write paths (`recordObservation`, `signOffCompletion`) → both UI surfaces (observation modal, sign-off bar) → request/inbox loop (`AssessmentRequestsPanel`) → living maps (`journeys.ts`, `uat/tests.ts`) → live runtime proof of the bootstrap scenario, with a real cross-tenant regression caught and fixed by this plan's own gate rather than shipping silently.
- Phase 37 is complete. `37-VALIDATION.md` is fully green with `nyquist_compliant: true`.
- No blockers.

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: tests/phase37/bootstrap-override-runtime.spec.ts
- FOUND: src/lib/journeys/journeys.ts
- FOUND: src/lib/uat/tests.ts
- FOUND: supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql
- FOUND: tests/phase34/record-observation.spec.ts
- FOUND: .planning/phases/37-assessor-governance/37-VALIDATION.md
- FOUND commit: 7f13e5a (Task 1)
- FOUND commit: fccf997 (Task 2)
- FOUND commit: a09d440 (Task 3)
