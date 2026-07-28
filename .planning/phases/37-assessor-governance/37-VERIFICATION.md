---
phase: 37-assessor-governance
verified: 2026-07-28T14:30:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/12
  gaps_closed:
    - "/activity/[completionId] does not disclose another organisation's completion data (CR-01)"
    - "The Phase 37 migration applier script is safe to re-run and cannot silently reopen a closed cross-tenant write hole (CR-02)"
  gaps_remaining: []
  regressions: []
---

# Phase 37: Assessor Governance Verification Report (Re-Verification After Gap Closure)

**Phase Goal:** Recording a competence-advancing observation requires the recorder to be a signed-off assessor themselves, with an audited override path so a brand-new organisation with zero assessors isn't permanently deadlocked.
**Verified:** 2026-07-28T14:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 37-07, 37-08, plus review-fix commit `afa67ff`)

## Goal Achievement

### Observable Truths

Truths 1-10 (core ASR-01 gate, override, bootstrap, worker-facing exclusion, predicate shape, request path, migration liveness) were VERIFIED in the initial verification and are unaffected by this closure pass (no regression found in re-read — see Anti-Patterns/Regression check below). This report focuses on the two previously FAILED truths and the new must-haves from 37-07/37-08.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 11 | `/activity/[completionId]` does not disclose another organisation's completion data (CR-01) | ✓ VERIFIED | `src/app/(protected)/activity/[completionId]/page.tsx:39` destructures `organisationId`; line 75-77 `if (!organisationId || data.organisation_id !== organisationId) redirect('/activity')` runs BEFORE the `Promise.all` (line 102) that mints signed photo URLs. Confirmed by direct read, exact line positions match plan intent. |
| 12 | The assessor predicate on the completion-detail page is evaluated against the SESSION organisation, never the row's `organisation_id` (CR-01, worsening factor) | ✓ VERIFIED | Line 131: `isSignedOffAssessor(userId, data.sop_id, admin, organisationId)` — session org, not `data.organisation_id`. Only one remaining reference to `data.organisation_id` in the file (the guard itself, line 75) — the predicate call uses `organisationId`, confirmed by direct read. |
| 13 | An admin/safety_manager from organisation A cannot view organisation B's SOP video-versions page (rule-5 sibling of CR-01) | ✓ VERIFIED | `src/app/(protected)/admin/sops/[sopId]/video/page.tsx:22` destructures `organisationId`; line 35 select includes `organisation_id`; line 42 `if (!sop || !organisationId || sop.organisation_id !== organisationId || sop.status !== 'published') redirect('/admin/sops')`. |
| 14 | The Phase 37 migration applier cannot silently reopen the cross-tenant write hole it already caused once (CR-02) | ✓ VERIFIED | `scripts/apply-phase37-migration.mjs:36-39` — `MIGRATION_FILES` array (00056 THEN 00057, order literal in source); fallback catch block (line 131-135) loops both files in order via `managementSql`; assertion group 3 (line 368-383) requires `withCheck.includes('sop_observation_refs_in_org')` in addition to the two pre-existing substrings. Cross-checked against `00057_restore_sop_observations_cross_org_guard.sql:30`, which contains the literal `sop_observation_refs_in_org(sop_id, observed_worker_id, organisation_id)` conjunct — the assertion is pinned to what the migration actually creates. |
| 15 | Only supervisors/admins/safety managers can fan out assessment-request notifications (WR-02) | ✓ VERIFIED | `src/actions/observations.ts:399-401` — `RECORDER_ROLES` gate runs before `createAdminClient()` (line 404). |
| 16 | An observation row can only reference a completion belonging to the caller's org, the observed worker, AND the observed SOP (WR-05 + review-fix binding) | ✓ VERIFIED | `src/actions/observations.ts:69-79` — filters `.eq('organisation_id', organisationId).eq('worker_id', workerId).eq('sop_id', sopId)` before the append-only insert. The `sop_id` filter (review-fix `afa67ff`) closes the residual gap the code review found in the initial WR-05 fix (a completion for the wrong SOP could otherwise pass). |
| 17 | Every protected page using `createAdminClient()` compares against session `organisationId`, enforced mechanically (systemic guard) | ✓ VERIFIED | `tests/phase37/gap-org-guards.spec.ts:108-131` walks `src/app/(protected)/**/page.tsx`, filters on the actual admin-client import (not a bare substring, avoiding the `versions/diff` JSDoc false positive documented in 37-07-SUMMARY), asserts the discovered set is non-empty before asserting over it, and asserts zero unguarded files remain. |
| 18 | A completion with an approved AND a rejected sign-off row still yields assessor=true regardless of row order (WR-01) | ✓ VERIFIED | `src/lib/competency/assessor.ts:69-86` — `signOffByCompletion` Map removed; `hasSignOff = signOffs.some(s => s.decision === 'approved')` and `latestPositiveEvidenceAt` filters `.filter(s => s.decision === 'approved')` over ALL rows, order-independent. Unit test added per 37-08-SUMMARY (proven RED against pre-fix Map via temporary local revert, then GREEN). |
| 19 | Changing the selected SOP in the observation modal clears the previous SOP's blocked/override/request state before the new status arrives (WR-03) | ✓ VERIFIED | `src/components/observations/RecordObservationModal.tsx:113-127` — the `[sopId]` effect unconditionally resets `assessorStatus`, `requestSent`, `overrideOpen`, `overrideReason` at the top, before the `if (!sopId) return` guard, on every `sopId` change (not only modal-open). |
| 20 | A server-side `ASSESSOR_OVERRIDE_REQUIRED` response opens the override sheet even if client-side `isAssessor` was stale (WR-04) | ✓ VERIFIED | `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx:166-168` — inside `handleApprove`'s `else` branch, `if (result.error === 'ASSESSOR_OVERRIDE_REQUIRED' && canOverride) setOverrideSheetOpen(true)`, positioned before `setActionError`. |
| 21 | `handleSave` in `RecordObservationModal` does not permanently wedge on a thrown server action (review-fix) | ✓ VERIFIED | `src/components/observations/RecordObservationModal.tsx:156-180` — `handleSave` now wraps the `recordObservation` call in try/catch/finally; `setBusy(false)` runs in `finally`, unconditionally. Confirmed via `git show afa67ff`. |
| 22 | Two Info-level findings (IN-01 multi-recipient stale rows, IN-02 dead re-validation) remain deliberately deferred, not silently dropped | ✓ VERIFIED (documented deferral, not a gap) | 37-08-PLAN.md § "Deliberately NOT closed in this pass" names both with rationale; 37-REVIEW.md documents them as Info severity, non-blocking. Per task framing, these do not count as gaps. |

**Score:** 12/12 new/closed truths verified (plus the 10 unaffected prior truths, re-confirmed not to have regressed during this pass) — all VERIFIED.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(protected)/activity/[completionId]/page.tsx` | org-scope guard + session-org predicate | ✓ VERIFIED | Read in full; guard at line 75-77, predicate fix at line 131, both positioned correctly relative to the photo-URL mint |
| `src/app/(protected)/admin/sops/[sopId]/video/page.tsx` | org-scope guard on admin-client SOP fetch | ✓ VERIFIED | Read in full; guard at line 42, `organisation_id` in select at line 35 |
| `src/actions/observations.ts` | role-gated `requestAssessorReview`; org+worker+SOP-validated `recordObservation` completionId | ✓ VERIFIED | Read in full; gate at line 399, completionId validation at line 69-79 including `sop_id` filter from review-fix |
| `scripts/apply-phase37-migration.mjs` | both-migration fallback apply + restored-conjunct assertion | ✓ VERIFIED | Read in full; `MIGRATION_FILES` array line 36-39, fallback loop line 131-135, assertion group 3 line 368-383 |
| `src/lib/competency/assessor.ts` | order-independent sign-off evaluation | ✓ VERIFIED | Read in full; Map removed, `.some()`/`.filter()` used throughout |
| `src/lib/competency/__tests__/assessor.test.ts` | behavioural proof rejected row can't shadow approved | ✓ VERIFIED (per SUMMARY + live gate) | 37-08-SUMMARY documents RED/GREEN proof via temporary local revert; orchestrator-confirmed `phase35-unit -g "assessor"` 9/9 passing this session |
| `src/components/observations/RecordObservationModal.tsx` | per-SOP state reset on every sopId change; hardened handleSave | ✓ VERIFIED | Read in full; effect at line 113-127, try/catch/finally at line 156-180 |
| `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` | opens override sheet on stale-isAssessor race | ✓ VERIFIED | Read in full; line 166-168 |
| `tests/phase37/gap-org-guards.spec.ts` | positional + systemic regression guards | ✓ VERIFIED | Read in full; 8 tests, non-vacuous systemic sweep (asserts non-empty set before filtering) |
| `tests/phase37/gap-migration-and-state.spec.ts` | slice-scoped regression guards for CR-02/WR-01/WR-03/WR-04 | ✓ VERIFIED (exists, orchestrator-confirmed passing) | 9 tests present; discovered and green per orchestrator gate status this session |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `activity/[completionId]/page.tsx` | `src/lib/competency/assessor.ts` | `isSignedOffAssessor(userId, data.sop_id, admin, organisationId)` after org guard | ✓ WIRED | Confirmed by direct read; session org, not row org |
| `admin/sops/[sopId]/video/page.tsx` | session context | `organisationId` compared against `sop.organisation_id` before any video-job read | ✓ WIRED | Confirmed by direct read |
| `src/actions/observations.ts` (`recordObservation`) | `sop_completions` | admin-client existence check filtered on `organisation_id` + `worker_id` + `sop_id` before insert | ✓ WIRED | Confirmed; includes the review-fix `sop_id` addition |
| `src/actions/observations.ts` (`requestAssessorReview`) | `RECORDER_ROLES` gate | gate precedes `createAdminClient()` call | ✓ WIRED | Confirmed by direct read |
| `scripts/apply-phase37-migration.mjs` | `00057_restore_sop_observations_cross_org_guard.sql` | `MIGRATION_FILES` array, fallback loop, assertion group 3 | ✓ WIRED | Confirmed; cross-checked against the migration's actual SQL body for the `sop_observation_refs_in_org` conjunct |
| `RecordObservationModal.tsx` (`handleSave`) | `recordObservation` | try/catch/finally, `setBusy(false)` in finally | ✓ WIRED | Confirmed via `git show afa67ff` |
| `CompletionDetailClient.tsx` (`handleApprove`) | `setOverrideSheetOpen` | server `ASSESSOR_OVERRIDE_REQUIRED` + `canOverride` opens sheet | ✓ WIRED | Confirmed by direct read |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ASR-01 | 37-01..08 | Only signed-off assessors can record competence-advancing observations; audited admin-override path covers new-org bootstrap deadlock | ✓ SATISFIED | Core gate (verified initial pass) plus both blocker gaps (CR-01, CR-02) and all five warnings (WR-01..WR-05) from the code review are now closed and independently re-confirmed against current source. No orphaned requirements — REQUIREMENTS.md maps only ASR-01 to Phase 37, and it appears in every plan's `requirements:` frontmatter including 37-07 and 37-08. |

### Anti-Patterns Found

None newly introduced by the closure plans. No `TBD`/`FIXME`/`XXX` unreferenced debt markers in any of the 10 files reviewed. The prior CR-01 and CR-02 blocker anti-patterns are removed (guard code now present at the exact positions required). Two Info-level findings remain, both deliberately deferred with documented rationale (not anti-patterns in the gate sense):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(protected)/activity/[completionId]/page.tsx` | 144-145 | `signOff = signOffs[0]` with no ordering when a completion has 2+ sign-off rows | ℹ️ Info (review) | Display-only; could show a stale reason/decision on the detail row. Not gate-affecting — `data.status` drives the headline badge. Not in this pass's scope. |
| `src/actions/observations.ts` / `AssessmentRequestsPanel.tsx` | — | Multi-recipient request dismissal only clears the acting admin's own row | ℹ️ Info (IN-01) | Documented deferral in 37-08-PLAN.md — explicitly out of scope, needs its own small plan |
| `src/actions/completions.ts` | ~183 | Redundant post-Zod length check on `overrideReason` (dead code) | ℹ️ Info (IN-02) | Documented deferral in 37-08-PLAN.md — harmless, out of scope |

### Behavioral Spot-Checks

Per task framing, the orchestrator ran the following this session and reported results, which this verifier accepts as current gate status (re-running the full suite independently would duplicate work already done in-process this session):

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-checks clean | `npx tsc --noEmit` | clean | ✓ PASS |
| Production build clean | `npm run build` | clean | ✓ PASS |
| Phase 37 regression suite (incl. both new gap-closure specs) | `npx playwright test --project=phase37` | 97/97 passed | ✓ PASS |
| Assessor predicate unit tests (incl. new WR-01 case) | `npx playwright test --project=phase35-unit -g "assessor"` | 9/9 passed | ✓ PASS |
| Full suite — no new regressions | `npm run test` | only 37 pre-existing legacy-stub failures, unchanged, none in phase34/phase37/touched files | ✓ PASS |
| Schema drift check | (orchestrator) | no drift | ✓ PASS |

Independently re-confirmed by this verifier via direct source read (not merely trusting the above): all code changes described in 37-07-SUMMARY.md and 37-08-SUMMARY.md are present in the current working tree exactly as claimed, at the file/line positions the plans specified, plus the review-fix commit `afa67ff` (sop_id binding + handleSave hardening) is present and correct.

### Probe Execution

No shell-probe convention (`scripts/*/tests/probe-*.sh`) used by this phase. Runtime proof is via Playwright specs, covered above.

### Human Verification Required

None. All prior human-verification items (mobile override-UI progressive disclosure, documented in 37-VALIDATION.md) are visual/manual-only and were not re-flagged as blocking by the code review or gap-closure plans.

### Gaps Summary

Both BLOCKER gaps from the initial verification (CR-01: cross-org completion-detail disclosure; CR-02: migration applier could silently re-drop the cross-org write guard) are closed and independently re-confirmed by direct source read against the current codebase — not by trusting SUMMARY.md or 37-REVIEW.md claims. All five Warning-level findings from the code review (WR-01 through WR-05) are also closed. The post-closure code review (37-REVIEW.md) found two NEW warnings (stale-completionId/SOP binding gap, and an unguarded `handleSave` in the observation modal); both were fixed same-day in review-fix commit `afa67ff`, which this verifier independently confirmed via `git show`.

Two Info-level findings (IN-01: multi-recipient request rows stale after one admin acts; IN-02: dead re-validation of `overrideReason`) remain deliberately open, explicitly documented as scoped-out deferrals in 37-08-PLAN.md with stated rationale (each needs its own small plan, not a co-located fix). Per the task framing for this verification, these do not count as gaps blocking phase completion.

No regressions were found in the 10 prior-phase truths (1-10) during this re-verification — the closure plans' file scope did not touch the core gate logic (`recordObservation`'s branch-before-gate, `signOffCompletion`'s gate, the override CHECK constraints), and the assessor predicate's core classification logic (`classifyCompetency` call, `hasCompletion`/`latestNeedsSupportAt`) was left byte-identical per the plans' own constraints — confirmed by direct read of `assessor.ts`.

**Phase goal achieved. Ready to proceed.**

---

*Verified: 2026-07-28T14:30:00Z*
*Verifier: Claude (gsd-verifier)*
