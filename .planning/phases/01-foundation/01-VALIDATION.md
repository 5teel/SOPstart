---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (installed in Wave 0) |
| **Config file** | vitest.config.ts (created in Wave 0) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-05 | integration | `npx vitest run tests/rls-isolation.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-06 | integration | `npx vitest run tests/rls-isolation.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AUTH-01 | integration | `npx vitest run tests/auth-flows.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | AUTH-02 | integration | `npx vitest run tests/auth-flows.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | AUTH-03 | integration | `npx vitest run tests/auth-flows.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 1 | AUTH-04 | integration | `npx vitest run tests/auth-flows.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | PLAT-01 | manual | N/A (PWA installability) | N/A | ⬜ pending |
| 01-03-02 | 03 | 1 | PLAT-02 | manual | N/A (cross-browser) | N/A | ⬜ pending |
| 01-03-03 | 03 | 1 | PLAT-03 | unit | `npx vitest run tests/offline-indicator.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@vitest/coverage-v8` — install test framework
- [ ] `vitest.config.ts` — configure test environment
- [ ] `tests/rls-isolation.test.ts` — stubs for AUTH-05, AUTH-06 (two-tenant cross-access test)
- [ ] `tests/auth-flows.test.ts` — stubs for AUTH-01 through AUTH-04
- [ ] `tests/offline-indicator.test.ts` — stub for PLAT-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA installable to home screen | PLAT-01 | Requires real device/browser | Open app on iOS Safari/Android Chrome → Add to Home Screen → verify app icon appears and launches correctly |
| Cross-browser rendering | PLAT-02 | Visual verification needed | Load app in Chrome, Safari, Firefox on mobile → verify layout renders correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
