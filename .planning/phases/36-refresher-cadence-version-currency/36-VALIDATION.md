---
phase: 36
slug: refresher-cadence-version-currency
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| (filled by planner) | — | — | CMP-03 / TRN-03 / REF-01 / REF-02 | — | — | — | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/phase36/` spec stubs for CMP-03, TRN-03, REF-01, REF-02
- [ ] `playwright.config.ts` — register a `phase36` project with `testMatch: tests/phase36/**` (single broad registration per CLAUDE.md 2026-05-25 unregistered-spec learning)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Refresher chips render visibly on sopstart.com post-deploy | REF-01/REF-02 | CSS-token/visibility class is invisible to all automated gates (CLAUDE.md 2026-07-14) | Open worker home + SOP detail on prod, confirm chips visible in light/dark |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
