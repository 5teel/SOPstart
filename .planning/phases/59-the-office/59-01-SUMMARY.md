---
phase: 59-the-office
plan: 01
subsystem: testing
tags: [playwright, nyquist, repoint-inventory, eval-fixtures, office]
requires: []
provides:
  - phase59 Playwright project (broad testMatch tests/phase59/**)
  - repoint inventory (RETIRED, INVENTORY, LIVE_PLANS) and retirement sweep
  - 15 requirement spec stubs and the Office eval skeleton
  - eval fixtures for supervisor cases (assignment, idle supervisor, unsupervised worker)
  - verified invited-person read rule (A-10 / RESEARCH A6)
  - filled 59-VALIDATION.md
affects: [59-02, 59-03, 59-04, 59-05, 59-06, 59-07, 59-08, 59-09, 59-10, 59-11, 59-12, 59-13, 59-14, 59-15, 59-16]
tech-stack:
  added: []
  patterns: ["Phase 57/58 repoint-inventory idiom (comment-stripped walk, LIVE_PLANS gate)"]
key-files:
  created:
    - tests/phase59/repoint-inventory.spec.ts
    - tests/phase59/retirement-sweep.spec.ts
    - tests/phase59/place-tab.spec.ts
    - tests/phase59/shell-wide.spec.ts
    - tests/phase59/ledger-read.spec.ts
    - tests/phase59/ledger-rls-live.spec.ts
    - tests/phase59/inbox-model.spec.ts
    - tests/phase59/people-actions.spec.ts
    - tests/phase59/signoff-actions.spec.ts
    - tests/phase59/approve-actions.spec.ts
    - tests/phase59/owner-review-meta.spec.ts
    - tests/phase59/signoff-panel.spec.ts
    - tests/phase59/office-pane-structure.spec.ts
    - tests/phase59/people-tab.spec.ts
    - tests/phase59/access-mount.spec.ts
    - tests/phase59/legacy-redirects.spec.ts
    - tests/phase59/capability-matrix.spec.ts
    - tests/evals/office.eval.ts
  modified:
    - playwright.config.ts
    - scripts/eval-fixtures.mjs
    - tests/evals/lib/session.ts
    - .planning/phases/59-the-office/59-VALIDATION.md
key-decisions:
  - "Invited person rule confirmed: org metadata matches the session org AND no membership row AND last_sign_in_at null (invited_at is also set, usable as an extra discriminator)"
  - "Inventory dispositions are first guesses; the owning plan re-greps before acting"
requirements-completed: []
duration: ~45min
completed: 2026-10-05
---

# Phase 59 Plan 01: Wave 0 harness Summary

**phase59 Playwright project with a 52-row repoint inventory, retirement sweep, 15 requirement stubs, an Office eval skeleton, three eval fixtures, and a live-verified invited-person rule.**

Requirements OFF-01..06, DEC-02 and SHL-06 are NOT ticked: this plan only lays the harness; owning plans prove them.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 2dc4f0c6 | phase59 project, repoint inventory, retirement sweep |
| 2 | 32c20e9f | 15 spec stubs, Office eval skeleton |
| 3 | ddc26211 | fixtures, session.ts, 59-VALIDATION.md |

## Verification

- `npx playwright test --list --project=phase59`: 17 spec files listed (`Total: 102 tests`); `npx playwright test --project=phase59`: 5 passed (inventory), 97 skipped (fixme / live self-skip), 0 failed.
- `npx playwright test --list --project=evals office`: 16 tests in `office.eval.ts`, all fixme.
- `npx tsc --noEmit`: clean.

## Repoint INVENTORY (46 file rows; first-guess dispositions)

| File | Disposition | Owner |
|------|-------------|-------|
| tests/phase56/decision-kinds-live.spec.ts | repoint | 59-02 |
| tests/phase57/shell-structure.spec.ts | repoint | 59-03 |
| tests/phase54/governance-inbox.spec.ts | repoint | 59-04 |
| tests/phase30/governance-fold.spec.ts | repoint | 59-04 |
| tests/phase56/decision-writers-sweep.spec.ts | repoint | 59-05 |
| tests/phase28/governance-actions.spec.ts | repoint | 59-07 |
| tests/phase57/machine-body.spec.ts | repoint | 59-12 |
| tests/evals/one-screen.eval.ts | repoint | 59-12 |
| tests/phase57/place.spec.ts | repoint | 59-13 |
| tests/phase54/deletion-sweep.spec.ts | repoint | 59-13 |
| tests/phase57/retirement-sweep.spec.ts | repoint | 59-14 |
| tests/lint/no-static-admin-lens-import.spec.ts | repoint | 59-14 |
| tests/evals/governance.eval.ts | delete | 59-14 |
| tests/phase28/governance-queue.spec.ts | delete | 59-14 |
| tests/phase28/library-and-worker.spec.ts | repoint | 59-14 |
| tests/phase29/phase-gate.spec.ts | repoint | 59-14 |
| tests/phase29/queue-approve-action.spec.ts | repoint | 59-14 |
| tests/phase29/approval-chain-editor.spec.ts | repoint | 59-14 |
| tests/phase30/admin-nav.spec.ts | repoint | 59-14 |
| tests/phase32/org-chart-build.spec.ts | delete | 59-14 |
| tests/phase32/banner-slot-stability.spec.ts | repoint | 59-14 |
| tests/phase32/library-filter-deeplink.spec.ts | repoint | 59-14 |
| tests/phase32/wire-up-mode.spec.ts | repoint | 59-14 |
| tests/phase32/wiring-at-scale.spec.ts | repoint | 59-14 |
| tests/phase33/sop-drilldown.spec.ts | repoint | 59-14 |
| tests/phase33/teams-ladder.spec.ts | repoint | 59-14 |
| tests/phase43/dead-controls.spec.ts | repoint | 59-14 |
| tests/phase43/route-truth.spec.ts | repoint | 59-14 |
| tests/phase54/inbox-reuses-governance-gating.spec.ts | delete | 59-14 |
| tests/phase57/one-query.spec.ts | repoint | 59-14 |
| tests/phase57/departments.spec.ts | repoint | 59-14 |
| tests/e2e/sub-trade-assignment.spec.ts | repoint | 59-14 |
| tests/lint/design-tokens.spec.ts | repoint | 59-14 |
| tests/evals/dead-surface.eval.ts | repoint | 59-14 |
| tests/evals/sop-focus.eval.ts | repoint | 59-14 |
| tests/phase37/assessor-ui-signoff.spec.ts | repoint | 59-15 |
| tests/phase37/assessor-ui-observation.spec.ts | repoint | 59-15 |
| tests/phase37/gap-migration-and-state.spec.ts | repoint | 59-15 |
| tests/phase37/gap-org-guards.spec.ts | repoint | 59-15 |
| tests/phase34/record-observation.spec.ts | repoint | 59-15 |
| tests/phase34/sop-version-stamp.spec.ts | repoint | 59-15 |
| tests/phase34/worker-observation-visibility.spec.ts | repoint | 59-15 |
| tests/phase35/training-record.spec.ts | repoint | 59-15 |
| tests/phase55/worker-path-contract.spec.ts | repoint | 59-15 |
| tests/evals/sop-ledger.eval.ts | repoint | 59-15 |
| tests/evals/cut-features.eval.ts | repoint | 59-15 |

Notes for owners:
- Test A (inventory complete) is green: every token hit in `tests/` and `src/**/*.test.ts` is listed. Rows with no token hit (phase56 kinds-live, shell-structure, governance-actions, place, deletion-sweep, phase34/35/37/55 and the two evals' sign-off cases) are pin files named by the research / plan.
- `sop-focus.eval.ts` was not in the research list; it holds one governance-inbox test id (found by the grep).
- `useSupervisorCompletions` (defined in `src/hooks/useCompletions.ts`) has `SupervisorActivityView` as its only consumer, so it stays a 59-15 token. `ViewToggle` exists only in `src/components/admin/org-model/`.
- `tests/phase46/capability-matrix-doc.spec.ts` carries no token; it pins matrix row labels ("Governance queue", "Approval chains", "Manage team", "Sign off completion"): edit cells, do not rename rows.
- Tokens flagged in more than the owning plan's files: the three `/governance` proxy-destination hits in `phase28/library-and-worker`, `phase30/admin-nav`, `phase43/route-truth` are changed first by 59-13, checked once 59-14 is live.

## Fixtures

First run of `node scripts/eval-fixtures.mjs` created:
```
created eval-site-supervisor-idle@sopstart.com
eval-site-supervisor-idle@sopstart.com → supervisor of SOPstart Eval Site (d2cea24e-...) present
created eval-site-worker2@sopstart.com
eval-site-worker2@sopstart.com → worker of SOPstart Eval Site (a06bc3ec-...) present
created supervisor_assignments: eval-site supervisor → eval-site worker
```
Second run (idempotency): zero `created` lines; the same three fixtures print as present:
```
eval-site-supervisor-idle@sopstart.com → supervisor of SOPstart Eval Site (d2cea24e-...) present
eval-site-worker2@sopstart.com → worker of SOPstart Eval Site (a06bc3ec-...) present
supervisor_assignments: eval-site supervisor → eval-site worker present
```
The script also throws if the idle supervisor or the second worker ever appears in `supervisor_assignments`.

## Invited-person check (A-10 / RESEARCH A6)

Rule used by 59-05: **invited = `user_metadata.organisation_id` equals the session org AND no membership row AND `last_sign_in_at` is null. CONFIRMED.**

1. Read-only scan of live auth users (counts only, no emails): 57 users; `invited_at` set: 0; users with `organisation_id` metadata: 0; members with `last_sign_in_at` null: 48 (all seeded / fixture accounts, none with `invited_at`); invited users with a membership: 0. So production currently has no pending invite and the scan alone could not confirm anything.
2. Because of that, one throwaway probe user was created and deleted (see Deviations): `generateLink({ type: 'invite' })` with the same metadata `inviteWorker` sets. Result: `invited_at` set = true, `last_sign_in_at` null = true, metadata org matches = true, membership rows = 0, appears in `listUsers` = true, `email_confirmed_at` null. The probe user was deleted.
3. Consequence for 59-05: `last_sign_in_at` null alone is NOT a safe test (48 real members have it null), so the "no membership row" and org-metadata conjuncts are load-bearing. `invited_at` is set on genuine invites and absent on fixture accounts, so it is a cheap extra conjunct. Metadata keys are `organisation_id` and `invited_role` (read from `src/actions/auth.ts`).

## Deviations from Plan

**1. [Rule 3 - Blocking] Invited-person check needed one write**
- **Found during:** Task 3 step 4
- **Issue:** the plan's read-only scan found zero invited users, so the rule could not be confirmed against live data.
- **Fix:** created and deleted one throwaway auth user (`phase59-invite-probe@example.invalid`, no email sent: `generateLink` never mails) with the invite metadata, in the eval-site org id, inside try/finally. Deleted successfully. Script lives in the scratchpad, not the repo. Threat T-59-04 still holds (counts / booleans only, no real email or id printed).
- **Files modified:** none in the repo.

**2. [Rule 1 - Scope] Inventory was extended beyond the plan's list**
- Added rows found by the token grep (`phase28/library-and-worker`, `phase30/admin-nav`, `phase43/route-truth`, `phase33/sop-drilldown`, `phase57/departments`, `e2e/sub-trade-assignment`, `phase54/inbox-reuses-governance-gating`, `phase32/org-chart-build`, `phase28/governance-queue`, `phase29/*`, `evals/sop-focus`, `evals/dead-surface`) and by literal sweep for pin files (`phase32/*`, `phase33/teams-ladder`, `phase34/*`, `phase37/gap-*`, `phase35`, `phase55`).

Otherwise: plan executed as written. No auth gates. STATE.md and ROADMAP.md untouched (orchestrator-owned); git push left to the orchestrator.

## Known Stubs

All `test.fixme` cases in `tests/phase59/*.spec.ts` and `tests/evals/office.eval.ts` are intentional Wave 0 stubs, each naming the plan that flips it live. `ledger-rls-live` self-skips unless `PHASE59_LIVE=1`.

## Threat Flags

None. Fixtures write only to the eval-site org with `eval_fixture: true` users.

## Self-Check: PASSED

- Files: all 17 `tests/phase59/*.spec.ts`, `tests/evals/office.eval.ts`, `59-VALIDATION.md` exist.
- Commits found in `git log`: 2dc4f0c6, 32c20e9f, ddc26211.
