---
phase: 4
slug: completion-and-sign-off
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (installed in Phase 1) |
| **Config file** | playwright.config.ts (exists) |
| **Quick run command** | `npx playwright test --reporter=line` |
| **Full suite command** | `npx playwright test --reporter=html` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --reporter=line`
- **After every plan wave:** Run `npx playwright test --reporter=html`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | COMP-01 | integration | `npx playwright test tests/completions.test.ts` | Phase 1 infra | pending |
| 04-01-02 | 01 | 1 | COMP-04 | integration | `npx playwright test tests/completions.test.ts` | Phase 1 infra | pending |
| 04-01-03 | 01 | 1 | COMP-07 | integration | `npx playwright test tests/completions.test.ts` | Phase 1 infra | pending |
| 04-02-01 | 02 | 2 | COMP-02 | e2e | `npx playwright test tests/photo-capture.test.ts` | Phase 1 infra | pending |
| 04-02-02 | 02 | 2 | COMP-03 | e2e | `npx playwright test tests/photo-capture.test.ts` | Phase 1 infra | pending |
| 04-03-01 | 03 | 2 | COMP-05 | e2e | `npx playwright test tests/supervisor-signoff.test.ts` | Phase 1 infra | pending |
| 04-03-02 | 03 | 2 | COMP-06 | e2e | `npx playwright test tests/supervisor-signoff.test.ts` | Phase 1 infra | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

No separate Wave 0 plan needed — Playwright is already installed from Phase 1. Test stub creation is implicit in each plan's verify step.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera capture on real device | COMP-02 | Requires real camera hardware | On mobile device, open walkthrough, tap camera icon, verify photo appears as thumbnail |
| Offline photo queue sync | COMP-02/03 | Requires real offline/online transition | Capture photos while offline (DevTools Network Offline), go online, verify photos appear in Supabase Storage |
| Glove-friendly photo capture | COMP-02 | Physical interaction | With work gloves, tap camera icon, verify it triggers camera successfully |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or existing infra
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
