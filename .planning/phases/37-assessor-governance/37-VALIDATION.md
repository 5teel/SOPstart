---
phase: 37
slug: assessor-governance
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Estimated runtime** | ~60 seconds (quick), full suite longer |

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
| TBD | — | — | ASR-01 | — | Non-signed-off supervisor cannot record `performed_to_sop` observation | unit + source-contract | `npx playwright test --project=phase35-unit -g assessor` | ❌ W0 | ⬜ pending |
| TBD | — | — | ASR-01 | — | Non-signed-off supervisor cannot approve a completion sign-off | source-contract | `npx playwright test --project=phase37` | ❌ W0 | ⬜ pending |
| TBD | — | — | ASR-01 | — | `needs_support` observation stays ungated for non-assessor supervisor (D-04 regression) | source-contract | `npx playwright test --project=phase37` | ❌ W0 | ⬜ pending |
| TBD | — | — | ASR-01 | — | Rejected sign-off stays ungated for non-assessor supervisor (D-03 sibling) | source-contract | `npx playwright test --project=phase37` | ❌ W0 | ⬜ pending |
| TBD | — | — | ASR-01 | — | Override inserts `is_assessor_override=true` + stamped reason when caller not signed off | runtime / source-contract | `npx playwright test --project=phase37` | ❌ W0 | ⬜ pending |
| TBD | — | — | ASR-01 | — | Override without a reason is rejected | unit / source-contract | `npx playwright test --project=phase35-unit` | ❌ W0 | ⬜ pending |
| TBD | — | — | ASR-01 | — | Zero-assessor org does not deadlock — admin override succeeds (bootstrap) | runtime | `npx playwright test --project=phase37` | ❌ W0 | ⬜ pending |
| TBD | — | — | ASR-01 | — | `signOffCompletion` role array includes `admin` (Pitfall 2 regression) | source-contract | `npx playwright test --project=phase37` | ❌ W0 | ⬜ pending |
| TBD | — | — | CMP-04 sibling | — | Worker read/walkthrough access remains ungated (locked north star) | source-contract | `npx playwright test --project=phase37` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Register a `phase37` Playwright project in `playwright.config.ts` mirroring the `phase34`/`phase35`/`phase36` broad-`testMatch` pattern (`testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/`) — verify with `npx playwright test --list --project=phase37`
- [ ] `src/lib/competency/assessor.ts` + `src/lib/competency/__tests__/assessor.test.ts` — covered by existing `phase35-unit` project `testDir` with zero config changes
- [ ] `tests/phase37/no-competency-gate-worker.spec.ts` — CMP-04 "worker read/walkthrough never gated" regression guard for this phase's new gate
- [ ] Migration `00056_assessor_governance.sql` applied + verified live before any runtime test inserting `is_assessor_override=true`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Override UI progressive disclosure reads clearly on mobile | ASR-01 | Visual/UX judgment (CSS token class of bug is invisible to all gates per CLAUDE.md 2026-07-14) | On sopstart.com as admin, record an observation for a worker while not signed off as assessor — confirm the override reason prompt appears and the reason is required |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
