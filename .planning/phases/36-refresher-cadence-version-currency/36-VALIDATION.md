---
phase: 36
slug: refresher-cadence-version-currency
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-26
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (@playwright/test) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase36` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~120 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase36`
- **After every plan wave:** Run `npm run test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run build` clean
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-T2 | 36-01 | 0 | CMP-03 | T-36-01-01 | Worker's v1 completion evidence survives supersede to v2, flagged isOutdatedVersion (not orphaned) | Runtime probe (test.fixme, activates 36-10) | `npx playwright test --project=phase36 --grep "CMP-03"` | ✅ | ✅ green (fixme) |
| 36-01-T2 | 36-01 | 0 | TRN-03 | T-36-01-02 | getVersionCompletionBreakdown exists, gated to `['admin','safety_manager']` (stricter than RECORDER_ROLES), wired into versions page | Source-contract (self-activating stub) | `npx playwright test --project=phase36 --grep "TRN-03"` | ✅ | ✅ green (skipped) |
| 36-01-T2 | 36-01 | 0 | REF-01 | T-36-01-01 | No refresher/version-currency derived field (isOutdatedVersion, refresherDueAt, isRefresherOverdue, isRefresherDue, refresher_interval_months) gates control flow on 5 worker-facing files | Source-contract (live guard, GATE_PATTERN) | `npx playwright test --project=phase36 --grep "REF-01"` | ✅ | ✅ green |
| 36-01-T2 | 36-01 | 0 | REF-02 | — | Pure refresher-cadence math (refresherDueDate, isRefresherOverdue) unit-tested | Unit | `npx playwright test --project=phase35-unit` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/phase36/` spec stubs for CMP-03, TRN-03, REF-01, REF-02
- [x] `playwright.config.ts` — register a `phase36` project with `testMatch: tests/phase36/**` (single broad registration per CLAUDE.md 2026-05-25 unregistered-spec learning)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Refresher chips render visibly on sopstart.com post-deploy | REF-01/REF-02 | CSS-token/visibility class is invisible to all automated gates (CLAUDE.md 2026-07-14) | Open worker home + SOP detail on prod, confirm chips visible in light/dark |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] frontmatter `nyquist_compliant` flag set true

**Approval:** Wave 0 approved (36-01)
