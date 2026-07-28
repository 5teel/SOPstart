---
phase: 37-assessor-governance
plan: 07
subsystem: auth
tags: [supabase-rls, service-role-self-enforcement, server-actions, source-contract-tests]

requires:
  - phase: 37-assessor-governance
    provides: recordObservation/isSignedOffAssessor gate (37-03), assessor-status UI (37-05), 37-VERIFICATION.md gap findings
provides:
  - Org-scope guard on /activity/[completionId] before presigned photo URLs are minted, and before the assessor predicate reads the row's org
  - Org-scope guard on /admin/sops/[sopId]/video (same class, different route)
  - Role gate (RECORDER_ROLES) on requestAssessorReview before any admin-client notification write
  - completionId existence/ownership validation on recordObservation before the append-only insert
  - tests/phase37/gap-org-guards.spec.ts — positional regression guards + a directory-wide sweep asserting every admin-client-importing protected page also references organisationId
affects: [37-08, any future phase adding a page under src/app/(protected) that reads via createAdminClient()]

tech-stack:
  added: []
  patterns:
    - "Directory-wide source-contract sweep (readdirSync recursive over src/app/(protected)/**/page.tsx) filtered on the actual admin-client IMPORT line, not a bare substring match — avoids false positives from comments/docstrings mentioning the client by name"

key-files:
  created:
    - tests/phase37/gap-org-guards.spec.ts
  modified:
    - "src/app/(protected)/activity/[completionId]/page.tsx"
    - "src/app/(protected)/admin/sops/[sopId]/video/page.tsx"
    - src/actions/observations.ts

key-decisions:
  - "Systemic sweep filters on `from '@/lib/supabase/admin'` import + createAdminClient( call, not a bare string match — a bare-match version produced a false positive on admin/sops/[sopId]/versions/diff/page.tsx, whose JSDoc comment mentions createAdminClient() as documentation for the server action it calls (getSopVersionForDiff, which already self-enforces org-scope per the 2026-06-26 CLAUDE.md learning) without the page itself importing or instantiating the client"

patterns-established:
  - "A protected page instantiating createAdminClient() must destructure organisationId from getSessionContext() and compare it against the fetched row's own org column before doing anything with the row — enforced mechanically by tests/phase37/gap-org-guards.spec.ts's systemic sweep, which fails the moment a fifth unguarded page.tsx is added"

requirements-completed: [ASR-01]

duration: 45min
completed: 2026-07-28
---

# Phase 37 Plan 07: Gap Closure — Org-Scope Guards + Write-Path Validation Summary

**Closed CR-01 (and its video-versions-page sibling) cross-org disclosure holes plus WR-02/WR-05 observation write-path gaps, backed by a directory-wide sweep that fails the next unguarded admin-client page instead of relying on per-file review.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 3 (2 pages, 1 action module)
- **Files created:** 1 (regression spec)

## Accomplishments
- `/activity/[completionId]` now redirects a cross-org completion UUID before minting any presigned photo URL, and the assessor predicate consumes the session `organisationId` instead of the attacker-influenced row field
- `/admin/sops/[sopId]/video` carries the same guard shape (rule-5 sibling, found by the same-pattern grep the plan mandated)
- `requestAssessorReview` now gates on `RECORDER_ROLES` before touching the admin client — a plain worker can no longer spam every admin's notification badge
- `recordObservation` validates a supplied `completionId` against `sop_completions` (org + worker scoped, admin client) before stamping it onto the append-only `sop_observations` row
- `tests/phase37/gap-org-guards.spec.ts` adds 8 tests: 3 per closed hole class plus a systemic sweep over every `src/app/(protected)/**/page.tsx` that imports the admin client

## Task Commits

1. **Task 1: Org-scope guards on both admin-client page fetches (CR-01 + rule-5 sibling)** - `9b5ef2f` (fix)
2. **Task 2: Role-gate requestAssessorReview (WR-02) and validate the observation completionId (WR-05)** - `f3180c4` (fix)
3. **Task 3: Regression spec — positional guards plus a directory-wide admin-client sweep** - `96c7e77` (test)

_Note: this is a worktree-isolated execution; the orchestrator applies the plan-metadata commit after merge._

## Files Created/Modified
- `src/app/(protected)/activity/[completionId]/page.tsx` — org guard before the presigned-URL `Promise.all`; `isSignedOffAssessor`'s 4th arg switched to session `organisationId`
- `src/app/(protected)/admin/sops/[sopId]/video/page.tsx` — `organisation_id` added to the `sops` select; guard added to the existing redirect condition
- `src/actions/observations.ts` — `RECORDER_ROLES` gate added to `requestAssessorReview` before `createAdminClient()`; completionId existence/ownership check added to `recordObservation` before the ASR-01 predicate read
- `tests/phase37/gap-org-guards.spec.ts` — new source-contract regression spec (discovered by the existing broad `phase37` project regex, no config edit needed)

## Decisions Made
- Systemic sweep in Task 3 filters on the admin-client's actual import statement, not a bare `createAdminClient(` substring — see key-decisions above for the false-positive it avoided (`versions/diff/page.tsx`'s JSDoc comment).

## Deviations from Plan

None beyond the sweep-precision fix documented above, which was applied inline while writing Task 3's own verification (not a separate deviation against the shipped hole-closures) — the plan's acceptance criteria for Task 3 were still met exactly as written (index-comparison assertions, non-empty-before-filtering guard, discovery via `--list`).

## Which assertion catches each fix if reverted (plan Task 3 acceptance criterion)

- **CR-01 guard removed** → "the org guard is present exactly once and runs BEFORE the signed-URL mint and the assessor predicate" fails (guard string absent)
- **CR-01 predicate arg reverted to `data.organisation_id`** → "the assessor predicate is called with the session organisationId, not the row org" fails (both the literal-call assertion and the occurrence-count assertion)
- **Video-page guard removed** → "the org guard is present and the sops select includes organisation_id" fails
- **WR-02 gate removed** → "requestAssessorReview role-gates before any admin-client work" fails (gate string absent from the sliced body)
- **WR-05 check removed** → "recordObservation validates completionId..." fails (`.eq('worker_id', workerId)` / `Completion not found.` absent)
- **A future page adds `createAdminClient()` without an `organisationId` reference** → the systemic sweep test fails, naming the offending file path in its failure message

## Issues Encountered
None — all three tasks verified clean on the first `npx tsc --noEmit && npm run build` pass; the only iteration was tightening the Task 3 sweep's filter predicate before it was committed (not a fix-after-commit).

## Verification

- `npx tsc --noEmit` — clean
- `npm run build` — clean (bundle-size gate unaffected: `/sops/[sopId]/page` unchanged from this plan's baseline)
- `npx playwright test --list --project=phase37` — discovers 7 files including `gap-org-guards.spec.ts`
- `npx playwright test --project=phase37` — 89 tests total, all green (8 new)
- `npm run test` (full suite) — 37 pre-existing failures in unrelated legacy phases (3, 11, 12.5, 15, 20, 21, 26, 29, 32, 33 stubs), zero in `tests/phase34/*` or `tests/phase37/*` — no new regressions from this plan

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- CR-01, its rule-5 sibling, WR-02 and WR-05 are closed and mechanically regression-guarded
- The systemic admin-client sweep is now a standing gate for any future phase adding a protected page — no further action needed unless a new admin-client page is added without the guard, in which case `gap-org-guards.spec.ts` will fail and name the file
- Plan 37-08 (CR-02, WR-01/WR-03/WR-04) is unaffected by this plan's file scope and can proceed independently

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*
