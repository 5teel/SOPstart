---
phase: 60
slug: requests-notifications-objectives
status: partial (60-18: NTF-02 legs d and e, SHL-03 overview case and the 60-17 case not yet green on the deployed site; Railway schedules pending)
nyquist_compliant: false
wave_0_complete: true
created: 2026-10-06
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.58.2 (source-contract and pure-module specs; deployed evals) |
| **Config file** | `playwright.config.ts` (project `phase60`, broad testMatch `tests/phase60/**`) |
| **Quick run command** | `npx playwright test --project=phase60` |
| **Registration check** | `npx playwright test --list --project=phase60` (22 files) |
| **Full phase gate** | `npx tsc --noEmit`, `npm run build` (bundle gate), then `npx playwright test --project=phase60 --project=phase59 --project=phase58 --project=phase57 --project=phase56 --project=phase55 --project=phase54 --project=phase46 --project=phase41 --project=phase33 --project=phase30 --project=phase28 --project=phase26 --project=phase26.5 --project=phase23-stubs --project=phase15-stubs --grep-invert "live\|probe"` |
| **Live probe** | `PHASE60_LIVE=1 npx playwright test --project=phase60 requests-notifications-objectives-rls-live` — once only (shared OTP budget) |
| **Deployed eval** | `npm run eval -- --phase 60` (once, after push; read every `60-*` screenshot) |
| **Estimated runtime** | seconds per task; the eval is the only slow step |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase60` (plus `npx tsc --noEmit` for any `src/` change)
- **After a plan touching the shell, a lazy seam or `src/` routes:** `npm run build` (bundle gate; baselines are never edited)
- **After every plan wave:** phase60 + phase59 + phase58 + phase57 + phase56 + phase54 + `phase15-stubs` + `phase26` (gate harness) + `phase23-stubs`
- **Before `/gsd-verify-work`:** full phase gate green once, live probe once, eval once
- **Max feedback latency:** 60 seconds (excluding the eval)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Task | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|------|-----------|-------------------|-------------|--------|
| 60-01-1 | 01 | 1 | RQS-01 RQS-02 RQS-03 RQS-04 NTF-01 NTF-02 OBJ-01 OBJ-02 OBJ-03 SHL-03 | T-60-01..03 | Task 1: Register the phase60 project; write the repoint inventory and the retirement sweep | auto | `npx playwright test --list --project=phase60 && npx playwright test --project=phase60 repoint-inventory retirement-sweep && npx tsc --noEmit` | ✅ | ✅ green |
| 60-01-2 | 01 | 1 | RQS-01 RQS-02 RQS-03 RQS-04 NTF-01 NTF-02 OBJ-01 OBJ-02 OBJ-03 SHL-03 | T-60-01..03 | Task 2: Requirement spec stubs and the requests eval skeleton | auto | `npx playwright test --list --project=phase60 && npx playwright test --project=phase60 && npx playwright test --list --project=evals requests && npx tsc --noEmit` | ✅ | ✅ green |
| 60-01-3 | 01 | 1 | RQS-01 RQS-02 RQS-03 RQS-04 NTF-01 NTF-02 OBJ-01 OBJ-02 OBJ-03 SHL-03 | T-60-01..03 | Task 3: Eval fixtures and cleanup helper; validation map | auto | `` command, File Exists = ✅ for Wave 0 files); Wave 0 Requirements = the files of this plan; Manual-Only = "Railway cron schedules (60-18 human action, A-08); everything else: the deployed eval and its screenshots repl...` | ✅ | ✅ green |
| 60-02-1 | 02 | 2 | RQS-01 RQS-02 NTF-01 OBJ-01 | — | Task 1: Write migration 00074 and its applier | auto | `node --check scripts/apply-phase60-migration.mjs && npx playwright test --project=phase15-stubs rls-org-scope` | ❌ W0 stubs | ⬜ pending |
| 60-02-2 | 02 | 2 | RQS-01 RQS-02 NTF-01 OBJ-01 | — | Task 2: Kinds, groups, words, types, live samples; matrix rows for the three reads | auto | `npx tsc --noEmit && npx playwright test --project=phase60 ledger-kinds capability-matrix && npx playwright test --project=phase59 ledger-read && npx playwright test --project=phase46 capability-matrix-doc` | ❌ W0 stubs | ⬜ pending |
| 60-02-3 | 02 | 2 | RQS-01 RQS-02 NTF-01 OBJ-01 | — | Task 3: [BLOCKING] Apply 00074 live, verify through the Management API, run the live probe | auto | `node scripts/apply-phase60-migration.mjs --assert-only && PHASE56_LIVE=1 npx playwright test --project=phase56 decision-kinds-live && PHASE60_LIVE=1 npx playwright test --project=phase60 requests-notifications-objecti...` | ❌ W0 stubs | ⬜ pending |
| 60-03-1 | 03 | 2 | RQS-01 RQS-02 RQS-03 NTF-01 NTF-02 OBJ-02 | — | Task 1: The requests model | auto | `npx playwright test --project=phase60 request-model && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-03-2 | 03 | 2 | RQS-01 RQS-02 RQS-03 NTF-01 NTF-02 OBJ-02 | — | Task 2: Notification kinds, titles, dedupe keys and places; the objectives model; query ke | auto | `npx playwright test --project=phase60 notification-places objective-model && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-04-1 | 04 | 3 | RQS-01 RQS-02 RQS-04 | — | Task 1: The notification writer, the request core and the agent helper | auto | `npx playwright test --project=phase60 agent-requests && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-04-2 | 04 | 3 | RQS-01 RQS-02 RQS-04 | — | Task 2: The request actions -- raise, withdraw, answer, list | auto | `npx playwright test --project=phase60 request-actions answer-actions && npx tsc --noEmit && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-04-3 | 04 | 3 | RQS-01 RQS-02 RQS-04 | — | Task 3: Writer registry, sweep, capability matrix | auto | `npx playwright test --project=phase56 decision-writers-sweep && npx playwright test --project=phase60 capability-matrix && npx playwright test --project=phase46 capability-matrix-doc` | ❌ W0 stubs | ⬜ pending |
| 60-05-1 | 05 | 4 | RQS-02 RQS-04 | — | Task 1: Retire the Machines inbox kind; the stale-department row opens the SOP | auto | `npx tsc --noEmit && npx playwright test --project=phase59 inbox-model office-pane-structure && npx playwright test --project=phase54 governance-inbox && npx playwright test --project=phase60 retirement-sweep` | ❌ W0 stubs | ⬜ pending |
| 60-05-2 | 05 | 4 | RQS-02 RQS-04 | — | Task 2: Open requests as the Office read's second list; one pin helper everywhere | auto | `npx playwright test --project=phase60 office-requests && npx playwright test --project=phase59 && npx tsc --noEmit && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-05-3 | 05 | 4 | RQS-02 RQS-04 | — | Task 3: Repoint the pin and Machines eval cases; inventory live | auto | `npx playwright test --list --project=evals && npx playwright test --project=phase60 repoint-inventory && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-06-1 | 06 | 4 | RQS-03 | — | Task 1: The ask core and the four ask actions | auto | `npx playwright test --project=phase60 ask-do-sop && npx tsc --noEmit && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-06-2 | 06 | 4 | RQS-03 | — | Task 2: Writer registry, sweep, capability matrix | auto | `npx playwright test --project=phase56 decision-writers-sweep && npx playwright test --project=phase60 capability-matrix && npx playwright test --project=phase46 capability-matrix-doc` | ❌ W0 stubs | ⬜ pending |
| 60-07-1 | 07 | 4 | NTF-02 | — | Task 1: Next-approver notifications from the publish divert and approveStep; the harness s | auto | `npx playwright test --project=phase60 notification-triggers && npx playwright test --project=phase26 verify-gate && npx playwright test --project=phase59 approve-actions && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-07-2 | 07 | 4 | NTF-02 | — | Task 2: Sign-off-waiting and new-version notifications | auto | `npx playwright test --project=phase60 notification-triggers && npx playwright test --project=phase59 signoff-actions && npx playwright test --project=phase55 worker-path-contract && npx tsc --noEmit && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-08-1 | 08 | 4 | NTF-02 RQS-04 | — | Task 1: Cron auth, the review-due selection and route, and the proxy exemption | auto | `npx playwright test --project=phase60 review-due cron-route && npx playwright test --project=phase26.5 synthesis-sweep-auth && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-08-2 | 08 | 4 | NTF-02 RQS-04 | — | Task 2: The machines-without-SOPs sweep and route (the agent's producer) | auto | `npx playwright test --project=phase60 cron-route agent-requests && npx tsc --noEmit && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-09-1 | 09 | 5 | OBJ-01 OBJ-03 | — | Task 1: The objectives core and the four objective actions | auto | `npx playwright test --project=phase60 objective-actions && npx tsc --noEmit && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-09-2 | 09 | 5 | OBJ-01 OBJ-03 | — | Task 2: deleteSop clean-up; writer registry, sweep and matrix | auto | `npx playwright test --project=phase33 delete-sop-org-scope && npx playwright test --project=phase56 decision-writers-sweep && npx playwright test --project=phase60 capability-matrix && npx playwright test --project=ph...` | ❌ W0 stubs | ⬜ pending |
| 60-10-1 | 10 | 6 | OBJ-03 | — | Task 1: Widen the field context; register the objective descriptors | auto | `npx playwright test --project=phase60 ai-objective-fields && npx playwright test --project=phase23-stubs && npx playwright test --project=phase55 sop-pack && npx tsc --noEmit && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-10-2 | 10 | 6 | OBJ-03 | — | Task 2: The objective line in the agent layer's signals | auto | `npx playwright test --project=phase60 ai-objective-fields && npx playwright test --project=phase26.5 && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-11-1 | 11 | 6 | RQS-02 RQS-04 | — | Task 1: The Requests tab, its row and the receipt link slot | auto | `npx tsc --noEmit && npx playwright test --project=phase60 office-requests && npx playwright test --project=phase59 && npx playwright test --project=phase15-stubs design-tokens && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-11-2 | 11 | 6 | RQS-02 RQS-04 | — | Task 2: Decisions about-line; Office matrix and journeys; eval cases | auto | `npx tsc --noEmit && npx playwright test --project=phase59 capability-matrix && npx playwright test --project=phase60 capability-matrix && npx playwright test --project=phase46 capability-matrix-doc && npx playwright t...` | ❌ W0 stubs | ⬜ pending |
| 60-12-1 | 12 | 7 | RQS-01 RQS-03 | — | Task 1: Dialog shell, request composer and ask picker (lazy, no CSS) | auto | `npx tsc --noEmit && npx playwright test --project=phase60 request-surfaces && npx playwright test --project=phase59 signoff-panel approve-actions && npx playwright test --project=phase15-stubs design-tokens no-undefin...` | ❌ W0 stubs | ⬜ pending |
| 60-12-2 | 12 | 7 | RQS-01 RQS-03 | — | Task 2: Wire the triggers on both machine panels and This SOP; markers; journey; eval | auto | `npx tsc --noEmit && npm run build && npx playwright test --project=phase60 request-surfaces repoint-inventory && npx playwright test --project=phase58 edit-rail && npx playwright test --project=phase57 && npx playwrig...` | ❌ W0 stubs | ⬜ pending |
| 60-13-1 | 13 | 8 | OBJ-01 OBJ-02 OBJ-03 | — | Task 1: The objective line (static) and the objective editor (lazy) | auto | `npx tsc --noEmit && npx playwright test --project=phase60 objective-meta && npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens` | ❌ W0 stubs | ⬜ pending |
| 60-13-2 | 13 | 8 | OBJ-01 OBJ-02 OBJ-03 | — | Task 2: Place the line on both machine panels, the department panel and the People row; ma | auto | `npx tsc --noEmit && npm run build && npx playwright test --project=phase60 objective-meta && npx playwright test --project=phase57 && npx playwright test --project=phase59 people-tab && npx playwright test --list --pr...` | ❌ W0 stubs | ⬜ pending |
| 60-14-1 | 14 | 9 | OBJ-01 OBJ-02 RQS-01 | — | Task 1: Read the SOP objective from objectives; browse line and browse "Make a request" | auto | `npx tsc --noEmit && npx playwright test --project=phase60 objective-meta && npx playwright test --project=phase58 && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-14-2 | 14 | 9 | OBJ-01 OBJ-02 RQS-01 | — | Task 2: This SOP objective row; delete the column writer and the fork copy; repoint the pi | auto | `npx tsc --noEmit && npm run build && npx playwright test --project=phase58 && npx playwright test --project=phase46 sop-edit-guard-wiring && npx playwright test --project=phase60 objective-meta retirement-sweep repoin...` | ❌ W0 stubs | ⬜ pending |
| 60-15-1 | 15 | 9 | SHL-03 NTF-01 RQS-01 RQS-03 | — | Task 1: Overview focus helper; the overview body with Objectives and Notifications | auto | `npx tsc --noEmit && npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens` | ❌ W0 stubs | ⬜ pending |
| 60-15-2 | 15 | 9 | SHL-03 NTF-01 RQS-01 RQS-03 | — | Task 2: My requests section and the Office line; structure spec | auto | `npx tsc --noEmit && npx playwright test --project=phase60 overview-structure && npx playwright test --project=phase15-stubs design-tokens && npm run build` | ❌ W0 stubs | ⬜ pending |
| 60-16-1 | 16 | 10 | NTF-01 SHL-03 NTF-02 RQS-01 RQS-02 RQS-03 | — | Task 1: The bell and the ShellFrame slot | auto | `npx tsc --noEmit && npx playwright test --project=phase60 bell-structure && npx playwright test --project=phase57 shell-structure && npx playwright test --project=phase15-stubs design-tokens` | ❌ W0 stubs | ⬜ pending |
| 60-16-2 | 16 | 10 | NTF-01 SHL-03 NTF-02 RQS-01 RQS-02 RQS-03 | — | Task 2: Mount the overview and the bell in both shells; worker Office card; marker; bundle | auto | `npx tsc --noEmit && npm run build && npx playwright test --project=phase57 && npx playwright test --project=phase59 && npx playwright test --project=phase60 overview-structure bell-structure && npx playwright test --p...` | ❌ W0 stubs | ⬜ pending |
| 60-16-3 | 16 | 10 | NTF-01 SHL-03 NTF-02 RQS-01 RQS-02 RQS-03 | — | Task 3: Inventory, and the deployed eval cases for the loop and for every notification tri | auto | `npx tsc --noEmit && npx playwright test --project=phase60 repoint-inventory && npx playwright test --list --project=evals && npx playwright test --project=phase15-stubs no-dead-internal-hrefs` | ❌ W0 stubs | ⬜ pending |
| 60-17-1 | 17 | 11 | RQS-03 | — | Task 1: Delete the assign screen and the retired writers by consumer graph; the server red | auto | `npx tsc --noEmit && npm run build && npx playwright test --project=phase56 decision-writers-sweep` | ❌ W0 stubs | ⬜ pending |
| 60-17-2 | 17 | 11 | RQS-03 | — | Task 2: Repoint the guards that read the deleted screen | auto | `npx playwright test --project=phase58 legacy-redirects && npx playwright test tests/e2e/sub-trade-assignment.spec.ts --list && npx playwright test --project=phase57 && npx playwright test --project=phase59 && npx play...` | ❌ W0 stubs | ⬜ pending |
| 60-17-3 | 17 | 11 | RQS-03 | — | Task 3: Lock it in -- dropped list, sweeps, inventory, matrix, eval case | auto | `npx playwright test --project=phase55 deletion-sweep && npx playwright test --project=phase60 && npx playwright test --project=phase46 capability-matrix-doc && npx tsc --noEmit` | ❌ W0 stubs | ⬜ pending |
| 60-18-1 | 18 | 12 | RQS-01 RQS-02 RQS-03 RQS-04 NTF-01 NTF-02 OBJ-01 OBJ-02 OBJ-03 SHL-03 | — | Task 1: The deployed eval, every screenshot read | auto | `npm run eval -- --phase 60` | ❌ W0 stubs | ⬜ pending |
| 60-18-2 | 18 | 12 | RQS-01 RQS-02 RQS-03 RQS-04 NTF-01 NTF-02 OBJ-01 OBJ-02 OBJ-03 SHL-03 | — | Task 2: Schedule the two daily cron routes on Railway (A-08) | manual | `railway status` | ❌ W0 stubs | ⬜ pending |
| 60-18-3 | 18 | 12 | RQS-01 RQS-02 RQS-03 RQS-04 NTF-01 NTF-02 OBJ-01 OBJ-02 OBJ-03 SHL-03 | — | Task 3: Build and full suite once; validation sign-off; requirements; Learnings | auto | `npm run build && npm run test` | ❌ W0 stubs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. "❌ W0 stubs" = the spec file exists as a Wave 0 stub from 60-01 and the owning plan turns it live.*

---

## Wave 0 Requirements

- [x] `playwright.config.ts` — `phase60` project
- [x] `tests/phase60/repoint-inventory.spec.ts` — RETIRED tokens, INVENTORY, LIVE_PLANS
- [x] `tests/phase60/retirement-sweep.spec.ts` — one fixme block per retirement (60-05, 60-14, 60-17)
- [x] 20 requirement stubs: ledger-kinds, requests-notifications-objectives-rls-live, request-model, notification-places, objective-model, request-actions, answer-actions, agent-requests, ask-do-sop, notification-triggers, review-due, cron-route, objective-actions, ai-objective-fields, office-requests, request-surfaces, objective-meta, overview-structure, bell-structure, capability-matrix
- [x] `tests/evals/requests.eval.ts` — eval skeleton, one fixme case per owning plan
- [x] `tests/evals/lib/requests-fixture.ts` — `ensureZeroSopMachine`, `deleteEvalRequestRows`
- [x] `scripts/eval-fixtures.mjs` and `tests/evals/lib/session.ts` — `eval-site-safety@sopstart.com` (safety manager, eval-site org)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway cron schedules for the two sweep routes (PENDING; only the SOPstart service exists, no synthesis-sweep cron exists either) | RQS-04, NTF-02 | A-08: the schedule lives in the Railway dashboard (60-18 human action) | Add the two schedules with the bearer secret; the eval then proves the routes |

Everything else: the deployed eval and its screenshots replace click-path checks (CLAUDE.md § Deployed-site evals).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (60-18)

**Approval:** NOT signed off. Deployed eval: 8 of 12 requests cases green at a4225ad (60-11, 60-11 agent, 60-12, 60-13, 60-14, 60-16 a, b, c). Open: 60-16 d (next approver at the divert: notification absent after 30 s), 60-16 e, 60-16 f (overview structure, real org), 60-17 (assign address). Full suite: 2228 passed, 6 failed (phase46 live probes, verifyOtp rate limit, environmental). Cron schedules: not yet done (60-18 Task 2).
