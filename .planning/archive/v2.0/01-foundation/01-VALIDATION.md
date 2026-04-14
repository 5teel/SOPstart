---
phase: 1
slug: foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (installed in Wave 0, Plan 01-00) |
| **Config file** | playwright.config.ts (created in Wave 0) |
| **Quick run command** | `npx playwright test --reporter=line` |
| **Full suite command** | `npx playwright test --reporter=html` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --reporter=line`
- **After every plan wave:** Run `npx playwright test --reporter=html`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-05 | integration | `npx playwright test tests/rls-isolation.test.ts` | Wave 0 | pending |
| 01-01-02 | 01 | 1 | AUTH-06 | integration | `npx playwright test tests/rls-isolation.test.ts` | Wave 0 | pending |
| 01-02-01 | 02 | 2 | AUTH-01 | integration | `npx playwright test tests/auth-flows.test.ts` | Wave 0 | pending |
| 01-02-02 | 02 | 2 | AUTH-02 | integration | `npx playwright test tests/auth-flows.test.ts` | Wave 0 | pending |
| 01-02-03 | 02 | 2 | AUTH-03 | integration | `npx playwright test tests/auth-flows.test.ts` | Wave 0 | pending |
| 01-02-04 | 02 | 2 | AUTH-04 | integration | `npx playwright test tests/auth-flows.test.ts` | Wave 0 | pending |
| 01-03-01 | 03 | 3 | PLAT-01 | manual | N/A (PWA installability) | N/A | pending |
| 01-03-02 | 03 | 3 | PLAT-02 | manual | N/A (cross-browser) | N/A | pending |
| 01-03-03 | 03 | 3 | PLAT-03 | e2e | `npx playwright test tests/offline-indicator.test.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements (Plan 01-00)

- [x] `@playwright/test` — install test framework (Playwright chosen over Vitest per RESEARCH.md — integration/e2e tests need real browser and DB)
- [x] `playwright.config.ts` — configure test environment with integration and e2e projects
- [x] `tests/rls-isolation.test.ts` — stubs for AUTH-05, AUTH-06 (two-tenant cross-access test)
- [x] `tests/auth-flows.test.ts` — stubs for AUTH-01 through AUTH-04
- [x] `tests/offline-indicator.test.ts` — stub for PLAT-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA installable to home screen | PLAT-01 | Requires real device/browser | Open app on iOS Safari/Android Chrome -> Add to Home Screen -> verify app icon appears and launches correctly |
| Cross-browser rendering | PLAT-02 | Visual verification needed | Load app in Chrome, Safari, Firefox on mobile -> verify layout renders correctly |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Test framework conflict resolved: Playwright (not Vitest)

**Approval:** pending execution
