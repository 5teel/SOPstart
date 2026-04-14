---
phase: 3
slug: worker-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (installed in Phase 1) |
| **Config file** | playwright.config.ts (exists) |
| **Quick run command** | `npx playwright test --reporter=line` |
| **Full suite command** | `npx playwright test --reporter=html` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --reporter=line`
- **After every plan wave:** Run `npx playwright test --reporter=html`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | WORK-07 | integration | `npx playwright test tests/offline-sync.test.ts` | Wave 0 | pending |
| 03-01-02 | 01 | 1 | WORK-08 | integration | `npx playwright test tests/offline-sync.test.ts` | Wave 0 | pending |
| 03-02-01 | 02 | 2 | WORK-01 | e2e | `npx playwright test tests/walkthrough.test.ts` | Wave 0 | pending |
| 03-02-02 | 02 | 2 | WORK-02 | e2e | `npx playwright test tests/walkthrough.test.ts` | Wave 0 | pending |
| 03-02-03 | 02 | 2 | WORK-05 | e2e | `npx playwright test tests/walkthrough.test.ts` | Wave 0 | pending |
| 03-02-04 | 02 | 2 | WORK-06 | e2e | `npx playwright test tests/walkthrough.test.ts` | Wave 0 | pending |
| 03-02-05 | 02 | 2 | WORK-09 | manual | N/A (glove-friendly sizing) | N/A | pending |
| 03-02-06 | 02 | 2 | WORK-10 | manual | N/A (full-screen card interface) | N/A | pending |
| 03-03-01 | 03 | 2 | WORK-03 | e2e | `npx playwright test tests/quick-ref.test.ts` | Wave 0 | pending |
| 03-03-02 | 03 | 2 | WORK-04 | e2e | `npx playwright test tests/quick-ref.test.ts` | Wave 0 | pending |
| 03-04-01 | 04 | 3 | MGMT-01 | e2e | `npx playwright test tests/sop-assignment.test.ts` | Wave 0 | pending |
| 03-04-02 | 04 | 3 | MGMT-02 | e2e | `npx playwright test tests/sop-library.test.ts` | Wave 0 | pending |
| 03-04-03 | 04 | 3 | MGMT-03 | e2e | `npx playwright test tests/sop-library.test.ts` | Wave 0 | pending |
| 03-04-04 | 04 | 3 | MGMT-04 | e2e | `npx playwright test tests/sop-library.test.ts` | Wave 0 | pending |
| 03-05-01 | 05 | 3 | MGMT-05 | e2e | `npx playwright test tests/sop-versioning.test.ts` | Wave 0 | pending |
| 03-05-02 | 05 | 3 | MGMT-06 | e2e | `npx playwright test tests/sop-versioning.test.ts` | Wave 0 | pending |
| 03-05-03 | 05 | 3 | MGMT-07 | e2e | `npx playwright test tests/sop-versioning.test.ts` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/offline-sync.test.ts` — stubs for WORK-07, WORK-08 (offline caching, sync)
- [ ] `tests/walkthrough.test.ts` — stubs for WORK-01, WORK-02, WORK-05, WORK-06 (step navigation, safety, images)
- [ ] `tests/quick-ref.test.ts` — stubs for WORK-03, WORK-04 (tabbed sections, direct jump)
- [ ] `tests/sop-library.test.ts` — stubs for MGMT-02, MGMT-03, MGMT-04 (library, search, browse)
- [ ] `tests/sop-assignment.test.ts` — stubs for MGMT-01 (assignment)
- [ ] `tests/sop-versioning.test.ts` — stubs for MGMT-05, MGMT-06, MGMT-07 (versioning, notifications)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glove-friendly tap targets | WORK-09 | Physical interaction needed | Test on real device with work gloves, verify all primary actions (Next, Complete, tabs) are easily tappable |
| Full-screen walkthrough layout | WORK-10 | Visual verification | On mobile viewport, verify walkthrough fills screen, actions are bottom-anchored, no navbar overlap |
| Offline access after iOS eviction | WORK-07 | iOS-specific behavior | Install PWA on iOS, don't use for 8+ days, re-open offline, verify SOPs still accessible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
