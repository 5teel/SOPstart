---
phase: 40
slug: shared-creation-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + source-contract specs) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase15-stubs` (plus phase-40 project once registered) |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` + the phase-40 spec project
- **After every plan wave:** Run `npm run test` + `npm run build`
- **Before `/gsd-verify-work`:** Full suite green AND `npm run build` clean
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

*Filled by planner — one row per task. Derived from RESEARCH.md ## Validation Architecture.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | DUP-01..04, DAT-01 | — | — | source-contract / migration assertion | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Phase-40 spec file(s) registered in a `playwright.config.ts` project regex (per [2026-05-25] learning — validate with `npx playwright test --list`)
- [ ] Source-sweep spec asserting the retired accept-list literals and picker copies no longer exist outside the shared component
- [ ] Migration assertion script pins EVERY security-relevant clause and asserts apply ORDER by index (per [2026-07-28] learning)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prod backfill leaves zero rows on retired column | DAT-01 | Requires live prod query | Run the backfill verification query against prod; expect 0 rows |
| Visual parity of consolidated surfaces | DUP-01..04 | CSS/token bugs invisible to all gates ([2026-07-14] learning) | Load each creation route on sopstart.com post-deploy and eyeball |
