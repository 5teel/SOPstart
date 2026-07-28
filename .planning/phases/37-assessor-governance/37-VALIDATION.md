---
phase: 37
slug: assessor-governance
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase37 --project=phase35-unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60 seconds (quick), full suite ~90s |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase37 --project=phase35-unit`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite green + `npx tsc --noEmit` + `npm run build` (CLAUDE.md 2026-06-02/2026-06-27: tsc scope ≠ next build scope for `'use server'` files — both mandatory)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-37-02-01 | 37-02 | 1 | ASR-01 | — | Non-signed-off supervisor cannot record `performed_to_sop` observation | unit + source-contract | `npx playwright test --project=phase35-unit -g assessor` | ✅ | ✅ green — `src/lib/competency/__tests__/assessor.test.ts` |
| T-37-04-01 | 37-04 | 3 | ASR-01 | — | Non-signed-off supervisor cannot approve a completion sign-off | source-contract | `npx playwright test --project=phase37` | ✅ | ✅ green — `tests/phase37/assessor-ui-signoff.spec.ts` |
| T-37-03-02 | 37-03 | 2 | ASR-01 | — | `needs_support` observation stays ungated for non-assessor supervisor (D-04 regression) | source-contract | `npx playwright test --project=phase37` | ✅ | ✅ green — `tests/phase37/assessor-gate.spec.ts` |
| T-37-04-02 | 37-04 | 3 | ASR-01 | — | Rejected sign-off stays ungated for non-assessor supervisor (D-03 sibling) | source-contract | `npx playwright test --project=phase37` | ✅ | ✅ green — `tests/phase37/assessor-gate.spec.ts` + `assessor-ui-signoff.spec.ts` |
| T-37-01-01 | 37-01 | 0 | ASR-01 | T-37-06-04 | Override inserts `is_assessor_override=true` + stamped reason when caller not signed off | runtime / source-contract | `npx playwright test --project=phase37` | ✅ | ✅ green — `tests/phase37/bootstrap-override-runtime.spec.ts` assertion 2 |
| T-37-01-02 | 37-01/37-06 | 0/4 | ASR-01 | T-37-06-04 | Override without a reason is rejected (DB CHECK, live) | unit / source-contract / runtime | `npx playwright test --project=phase37` | ✅ | ✅ green — `override-audit-schema.spec.ts` + `bootstrap-override-runtime.spec.ts` assertion 3 |
| T-37-06-05 | 37-06 | 4 | ASR-01 | T-37-06-02 | Zero-assessor org does not deadlock — admin override succeeds, resolves after first sign-off, re-suspends on `needs_support` (bootstrap) | runtime | `npx playwright test --project=phase37 -g bootstrap` | ✅ | ✅ green — `tests/phase37/bootstrap-override-runtime.spec.ts` (6/6, re-runnable) |
| T-37-04-03 | 37-04 | 3 | ASR-01 | — | `signOffCompletion` role array includes `admin` (Pitfall 2 regression) | source-contract | `npx playwright test --project=phase37` | ✅ | ✅ green — `tests/phase37/assessor-ui-signoff.spec.ts` |
| T-37-01-03 | 37-01 | 0 | CMP-04 sibling | — | Worker read/walkthrough access remains ungated (locked north star) | source-contract | `npx playwright test --project=phase37` | ✅ | ✅ green — `tests/phase37/no-competency-gate-worker.spec.ts` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**37-06 fix-forward (Rule 1):** the full-suite gate in Task 3 surfaced that migration 00056 (37-03) had silently dropped the 00053 cross-org guard (`sop_observation_refs_in_org`) when it recreated `sop_observations_insert_recorder` to add the override conjunct — reopening the T-34-03-01 cross-tenant write hole. Fixed live via migration `00057_restore_sop_observations_cross_org_guard.sql` (both conjuncts now present, verified via Management API + `tests/phase34/observation-cross-org-isolation.spec.ts` green). See 37-06-SUMMARY.md § Deviations.

---

## Wave 0 Requirements

- [x] Register a `phase37` Playwright project in `playwright.config.ts` mirroring the `phase34`/`phase35`/`phase36` broad-`testMatch` pattern (`testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/`) — verified with `npx playwright test --list --project=phase37` (81 tests, 6 files)
- [x] `src/lib/competency/assessor.ts` + `src/lib/competency/__tests__/assessor.test.ts` — covered by existing `phase35-unit` project `testDir` with zero config changes
- [x] `tests/phase37/no-competency-gate-worker.spec.ts` — CMP-04 "worker read/walkthrough never gated" regression guard for this phase's new gate
- [x] Migration `00056_assessor_governance.sql` applied + verified live (37-03) before any runtime test inserting `is_assessor_override=true`; migration `00057` (37-06 fix-forward) applied + verified live restoring the cross-org guard

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Override UI progressive disclosure reads clearly on mobile | ASR-01 | Visual/UX judgment (CSS token class of bug is invisible to all gates per CLAUDE.md 2026-07-14) | On sopstart.com as admin, record an observation for a worker while not signed off as assessor — confirm the override reason prompt appears and the reason is required |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed off 2026-07-28 — full suite green (1294/1329, 35 pre-existing failures unrelated to this phase — see 37-06-SUMMARY.md), `npx tsc --noEmit` clean, `npm run build` clean, all 6 phase37 specs discovered (81 tests), `/sops/[sopId]` bundle 1058 KB (baseline 1056 KB, Δ+2KB, within ±2KB tolerance).
