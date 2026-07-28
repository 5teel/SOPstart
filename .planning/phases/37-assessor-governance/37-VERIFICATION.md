---
phase: 37-assessor-governance
verified: 2026-07-28T02:38:08Z
status: gaps_found
score: 10/12 must-haves verified
overrides_applied: 0
gaps:
  - truth: "/activity/[completionId] does not disclose another organisation's completion data"
    status: failed
    reason: "CR-01 (code review, independently re-confirmed by reading the file): the page fetches the completion via createAdminClient() keyed only on completionId, and never compares data.organisation_id against the caller's session organisationId. getSessionContext() destructuring at line 39 does not even extract organisationId. Any authenticated supervisor/admin/safety_manager from ANY org who obtains a completion UUID can view the full completion detail of a foreign org — worker id, step data, 1-hour signed photo URLs, and sign-off history. This phase (a) added organisation_id to the select, (b) widened isSupervisor to admin (more roles now render the sign-off bar on a foreign completion), and (c) feeds the attacker-controlled data.organisation_id (not the session org) into isSignedOffAssessor at line 117 — worsening rather than merely inheriting the hole. This is the exact service-role self-enforcement class CLAUDE.md flags repeatedly (2026-06-15, 2026-06-26, 2026-07-20), on the very page this phase built its sign-off/override UI on."
    artifacts:
      - path: "src/app/(protected)/activity/[completionId]/page.tsx"
        issue: "No 'data.organisation_id !== organisationId' guard after the admin-client fetch; organisationId is never even destructured from getSessionContext()"
    missing:
      - "Destructure organisationId from getSessionContext() and redirect('/activity') when data.organisation_id !== organisationId, before any role/photo/predicate work"
      - "Pass the session-derived organisationId (not data.organisation_id) into isSignedOffAssessor"
  - truth: "The Phase 37 migration applier script (scripts/apply-phase37-migration.mjs) is safe to re-run and cannot silently reopen a closed cross-tenant write hole"
    status: failed
    reason: "CR-02 (code review, independently re-confirmed by reading the file): MIGRATION_FILE only points at 00056; the db-push fallback path (triggered when 'npx supabase db push' lacks a DB password, which the script's own comments say is the expected failure mode) re-applies ONLY the raw body of 00056 via the Management API. 00056's policy body lacks the sop_observation_refs_in_org(...) conjunct that 00057 restored — so running this script's fallback after 00057 is live re-drops the T-34-03-01 cross-tenant write guard on production. Assertion group 3 (line ~338-345) only checks with_check for 'current_user_role' and 'is_assessor_override' substrings — not 'sop_observation_refs_in_org' — which is the exact assertion gap that let 00056 silently drop the guard in the first place (per 00057's own header comment) and was never closed. After the fallback re-drops the guard, this script prints '=== ALL POST-APPLY ASSERTIONS PASSED ==='. A required phase artifact whose stated purpose is 'cache-bypassing assertions for ... the policy' currently cannot detect the exact regression this phase already shipped once."
    artifacts:
      - path: "scripts/apply-phase37-migration.mjs"
        issue: "MIGRATION_FILE / fallback path only applies 00056, never 00057; assertion group 3 does not check for sop_observation_refs_in_org in with_check"
    missing:
      - "Fallback path must apply both 00056 and 00057 (in order) when db push fails"
      - "Assertion group 3 must additionally require withCheck.includes('sop_observation_refs_in_org')"
---

# Phase 37: Assessor Governance Verification Report

**Phase Goal:** Recording a competence-advancing observation requires the recorder to be a signed-off assessor themselves, with an audited override path so a brand-new organisation with zero assessors isn't permanently deadlocked.
**Verified:** 2026-07-28T02:38:08Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Only a signed-off assessor can record a `performed_to_sop` observation (D-03/D-04, branch-before-gate) | ✓ VERIFIED | `src/actions/observations.ts:64-87` — gate only inside `verdict === 'performed_to_sop'`; call to `isSignedOffAssessor` positioned after the branch. `tests/phase37/assessor-gate.spec.ts` green (ran live, 75/75 non-DB phase37 assertions pass). |
| 2 | Only a signed-off assessor can approve a completion sign-off (D-03 — the ladder's top rung is guarded too) | ✓ VERIFIED | `src/actions/completions.ts:172-191` — gate inside `decision === 'approved'` branch, positioned after the org-scope guard (163-165). `tests/phase37/assessor-ui-signoff.spec.ts` green. |
| 3 | `needs_support` observations and completion rejections stay fully ungated | ✓ VERIFIED | Both gates are wrapped in an early verdict/decision branch; predicate is never reached otherwise — confirmed by direct read and by positional (index-comparison) source-contract assertions in `assessor-gate.spec.ts` / `assessor-ui-signoff.spec.ts`, both passing live. |
| 4 | Admin/safety_manager override requires a reason and stamps `is_assessor_override` + `override_reason` on the audit row, enforced 3 layers deep (Zod → action → DB CHECK) | ✓ VERIFIED | Zod floor confirmed in `src/lib/validators/observations.ts` / `completions.ts`; action-layer check confirmed in both action files; DB CHECK constraints confirmed live per 37-06-SUMMARY's runtime probe (assertion 3, `23514` rejection) and `override-audit-schema.spec.ts` (live, passing). |
| 5 | A new org with zero signed-off assessors is not deadlocked — an admin override bootstraps the first sign-off and the deadlock resolves | ✓ VERIFIED (documented, not independently re-run) | `tests/phase37/bootstrap-override-runtime.spec.ts` is a live runtime probe (no `test.fixme` remaining — confirmed by direct read); 37-06-SUMMARY.md documents 6/6 assertions green, re-run twice for re-runnability. Not re-executed by this verifier (would mutate the live production Supabase project without a scoped safe-to-run confirmation) — accepted on migration-file + git-commit + source evidence. |
| 6 | The gate never reaches a worker-facing surface (CMP-04 north star) | ✓ VERIFIED | `tests/phase37/no-competency-gate-worker.spec.ts` ran live — 32/32 assertions green across `ReadTab.tsx`, `sops/[sopId]/page.tsx`, `sops/page.tsx`, `SopLibraryCard.tsx`, `CompetencySection.tsx`, `classify.ts`. |
| 7 | `isSignedOffAssessor` is a single derived predicate composed from `classifyCompetency` + `resolveLineage`, org-wide, reset-aware, lineage-aware | ✓ VERIFIED | `src/lib/competency/assessor.ts` read in full — one `classifyCompetency` comparison, no forked ladder, no department filter. All 8 behavioural unit tests in `src/lib/competency/__tests__/assessor.test.ts` ran live and pass (D-01, D-02 both directions, lineage widening, cross-org, null org). |
| 8 | A blocked supervisor has a working "Request assessment" path, and admin/safety_manager can see and act on it | ✓ VERIFIED | `requestAssessorReview` / `listAssessmentRequests` / `AssessmentRequestsPanel` exist and are wired (`tests/phase37/assessor-ui-observation.spec.ts` green, live); `AssessmentRequestsPanel` mounted once on `/admin/team`. |
| 9 | Migrations 00056 + 00057 are live on the production DB with the combined RLS conjuncts (org-ref guard + override-role guard) | ✓ VERIFIED (documented) | Both migration files exist and read correctly; 37-06-SUMMARY.md + commit `a09d440` document the live apply and a passing re-run of `tests/phase34/observation-cross-org-isolation.spec.ts`. Not independently re-probed against the live DB by this verifier. |
| 10 | Requirement ASR-01 is satisfied end-to-end | ✓ VERIFIED (core gate) | See truths 1-9. |
| 11 | The completion-detail page this phase extended does not disclose another org's data | ✗ FAILED | See gaps — CR-01, confirmed by direct code read. |
| 12 | The phase's own migration-apply tooling cannot silently reopen a cross-tenant write hole it already caused once | ✗ FAILED | See gaps — CR-02, confirmed by direct code read. |

**Score:** 10/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00056_assessor_governance.sql` | override audit columns + CHECK constraints + insert-policy override clause | ✓ VERIFIED | Exists, confirmed via `override-audit-schema.spec.ts` (live pass) |
| `supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql` | fix-forward restoring the 00053 org-ref guard | ✓ VERIFIED | Exists, read in full — both conjuncts present in the re-created policy |
| `src/lib/competency/assessor.ts` (`isSignedOffAssessor`) | single derived predicate | ✓ VERIFIED | Read in full; 8/8 unit tests pass |
| `src/actions/observations.ts` (`recordObservation`, `getAssessorStatusForSop`, `requestAssessorReview`, `listAssessmentRequests`) | gated write + read/request/list actions | ⚠️ VERIFIED w/ warning | Gate correct; `requestAssessorReview` has no role gate (WR-02, any authenticated user can call it) |
| `src/actions/completions.ts` (`signOffCompletion`) | gated sign-off, widened role array | ✓ VERIFIED | Read in full — role array includes `admin`, gate correctly branch-before-gate, org guard runs first |
| `src/components/observations/AssessmentRequestsPanel.tsx` | admin/safety_manager request list | ✓ VERIFIED | Wired per `assessor-ui-observation.spec.ts` (live pass) |
| `src/components/observations/RecordObservationModal.tsx` + `VerdictButtons.tsx` | 3-state modal (blocked/override/coaching) | ✓ VERIFIED w/ warning | Wired per tests; WR-03 (stale assessorStatus on SOP re-selection) is a real but non-gate-defeating UI bug |
| `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` + `page.tsx` | blocked/override sign-off UI | ⚠️ VERIFIED w/ gaps | Sign-off gate itself correct; page.tsx has the CR-01 org-disclosure hole; WR-04 (stale-isAssessor race leaves override sheet unreachable) is a real edge-case bug |
| `scripts/apply-phase37-migration.mjs` | non-interactive db push + cache-bypassing assertions for all 5 columns/2 constraints/policy | ✗ FAILED | CR-02 — fallback path only re-applies 00056, and assertion group 3 doesn't check for the restored `sop_observation_refs_in_org` conjunct |
| `tests/phase37/*.spec.ts` (6 files) | phase37 Nyquist harness | ✓ VERIFIED | `npx playwright test --list --project=phase37` discovers all 6 files / 81 tests; 75/75 non-DB assertions pass live; `bootstrap-override-runtime.spec.ts` has zero real `test.fixme` remaining |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/actions/observations.ts` | `src/lib/competency/assessor.ts` | `isSignedOffAssessor` called once, inside `verdict === 'performed_to_sop'` | ✓ WIRED | Confirmed by direct read and positional source-contract test |
| `src/actions/completions.ts` | `src/lib/competency/assessor.ts` | `isSignedOffAssessor` called once, inside `decision === 'approved'`, after org guard | ✓ WIRED | Confirmed by direct read |
| `src/actions/observations.ts` | `worker_notifications` | admin-client insert, `type: 'assessment_requested'`, `subject_user_id` | ✓ WIRED | Confirmed; but reachable by any authenticated user (WR-02) |
| `src/app/(protected)/activity/[completionId]/page.tsx` | `CompletionDetailClient.tsx` | server-computed `isAssessor`/`canOverride` props | ✓ WIRED | Confirmed; but `isAssessor` is computed from an admin-client read with **no org guard upstream** (CR-01) |
| `RecordObservationModal.tsx` | `src/actions/observations.ts` | `getAssessorStatusForSop` on SOP selection, `requestAssessorReview` from blocked CTA | ✓ WIRED | Confirmed live via `assessor-ui-observation.spec.ts` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ASR-01 | 37-01..06 | Only signed-off assessors can record competence-advancing observations; audited admin-override path covers new-org bootstrap deadlock | ✓ SATISFIED (core gate), with 2 unresolved Critical findings on adjacent surfaces the phase itself touched/shipped | Gate logic, predicate, override stamping, and bootstrap all verified. CR-01 and CR-02 are real, currently-live gaps on files this phase directly modified/created (not speculative) — see gaps above. |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps only ASR-01 to Phase 37, and it appears in every plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(protected)/activity/[completionId]/page.tsx` | 39, 46-62 | Admin-client read with no organisation-scope guard (service-role self-enforcement gap) | 🛑 Blocker (CR-01) | Cross-org completion/photo/PII disclosure |
| `scripts/apply-phase37-migration.mjs` | 29, 114-135, ~338-345 | Fallback path re-applies stale migration only; assertion doesn't cover the restored conjunct | 🛑 Blocker (CR-02) | Re-running this script can silently reopen a cross-tenant write hole while reporting ALL PASS |
| `src/actions/observations.ts` | 367-384 | `requestAssessorReview` has no role/recorder gate | ⚠️ Warning (WR-02) | Any authenticated user (including a worker) can spam every admin/safety_manager with assessment-request notifications |
| `src/lib/competency/assessor.ts` | 69, 72, 77 | `Map(signOffs.map(s => [s.completion_id, s]))` keeps only the last unordered row when a completion has 2+ sign-off rows | ⚠️ Warning (WR-01) | Can falsely deny (or mistime) assessor status if a completion is ever multiply signed-off |
| `src/components/observations/RecordObservationModal.tsx` | ~104-117 | `assessorStatus`/`requestSent`/`overrideOpen` not reset when `sopId` changes (only on modal open) | ⚠️ Warning (WR-03) | Blocked/override state can flash for the wrong SOP after a "Change SOP" tap; contradicts the file's own in-code comment |
| `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` | 156-160 | `ASSESSOR_OVERRIDE_REQUIRED` from the server has no client-side handler to open the override sheet | ⚠️ Warning (WR-04) | Confirmed by direct read: `else` branch only calls `setActionError`, never `setOverrideSheetOpen(true)` — dead end in the race window the code's own comment names |
| `src/actions/observations.ts` | 89-100 | `completionId` on an observation is never verified against org/worker before insert | ⚠️ Warning (WR-05) | A permanent audit row can reference a foreign or unrelated completion UUID |
| `src/actions/completions.ts` | 183 | Redundant post-Zod length check on `overrideReason` (dead code) | ℹ️ Info (IN-02) | Harmless; short reasons fail at Zod parse instead of surfacing the mapped error copy |
| `src/actions/observations.ts` / `AssessmentRequestsPanel.tsx` | 395-414 / 30-33 | Multi-recipient request dismissal only clears the acting admin's own row | ℹ️ Info (IN-01) | Peer admins keep stale entries; re-request stays suppressed until every recipient dismisses |

No `TBD`/`FIXME`/`XXX` unreferenced debt markers found in phase-modified files. The three residual `test.fixme` string matches are prose/comments, not live stubs (confirmed by direct read — zero actual `test.fixme(...)` calls remain in any of the 6 phase37 specs).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `phase37` project discovers all 6 specs | `npx playwright test --list --project=phase37` | "Total: 81 tests in 6 files" | ✓ PASS |
| Non-DB phase37 source-contract/UI-wiring specs pass live | `npx playwright test --project=phase37 -g "no-competency-gate-worker\|override-audit-schema\|assessor-gate\|assessor-ui-observation\|assessor-ui-signoff"` | 75 passed | ✓ PASS |
| Predicate unit tests pass live | `npx playwright test --project=phase35-unit -g "assessor"` | 8 passed | ✓ PASS |
| Type-checks clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Live DB bootstrap probe (`bootstrap-override-runtime.spec.ts`) | not executed by this verifier | — | ? SKIP — would mutate the live production Supabase project; accepted on documented evidence (SUMMARY + git commit `7f13e5a`) instead |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention used by this phase; the phase's runtime proof is `tests/phase37/bootstrap-override-runtime.spec.ts` (a Playwright spec, covered under Behavioral Spot-Checks above, not the shell-probe convention).

### Human Verification Required

None beyond the phase's own documented manual-only item (37-VALIDATION.md § Manual-Only Verifications: override UI progressive disclosure on mobile — a CSS/visual check, not gating this verification's automated status).

### Gaps Summary

The core assessor gate — the phase's actual goal — is solidly implemented and independently re-verified: `recordObservation` and `signOffCompletion` both branch-before-gate correctly, the override path is enforced three layers deep with a live DB CHECK, the zero-assessor bootstrap is proven by a real runtime probe (documented, not silently claimed), the worker-facing north star (CMP-04) is live and passing, and 83 tests across the phase's own project plus the predicate's unit suite all pass on direct re-run by this verifier.

However, the phase's own code review (37-REVIEW.md) surfaced two Critical findings that this verifier independently re-confirmed by reading the current source, not by trusting the review or the SUMMARY:

1. **CR-01** — `/activity/[completionId]`, the exact page this phase extended with the sign-off/override UI, has no organisation guard on its admin-client completion fetch. Any authenticated user from any org who obtains a completion UUID can view another org's worker id, step data, and signed photo URLs. The phase's own edits (org id now selected but never checked; `isSupervisor` widened to `admin`; the org-controlled `data.organisation_id` fed into the predicate instead of the session org) make this worse, not merely inherited debt.
2. **CR-02** — `scripts/apply-phase37-migration.mjs`, a required Phase 37 artifact, has a fallback path that re-applies only migration 00056 (dropping the 00057 cross-org guard fix-forward) and an assertion that would report ALL PASS after doing so. This is the identical assertion-coverage gap that let 00056 silently drop the guard the first time — now baked into the tool meant to prevent exactly that class of regression.

Both are real, current, and reachable — not speculative or already-fixed. Per the adversarial verification stance and given that both sit on artifacts this phase directly authored or extended (not generic pre-existing debt untouched by this phase), they are classified as BLOCKER gaps. The five Warning-level findings (WR-01 through WR-05) are real but narrower — spam/DoS, edge-case races, and audit-precision issues — and do not block the phase goal on their own; they are recorded for the same closure plan to pick up alongside the two blockers.

**This looks like fix-forward work, not a redesign.** Both CR fixes are the small diffs already specified in 37-REVIEW.md (an org-guard `if` in page.tsx; a two-file loop + one string check in the migration script). Recommend a small closure plan (or `/gsd-plan-phase --gaps`) covering CR-01, CR-02, and the WR-02/WR-04 near-miss items rather than reopening any of the six existing plans.

---

*Verified: 2026-07-28T02:38:08Z*
*Verifier: Claude (gsd-verifier)*
