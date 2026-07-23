---
phase: 35
slug: competency-classifier-training-matrix-records
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (integration + source-contract + unit projects) |
| **Config file** | playwright.config.ts |
| **Quick run command** | `npx playwright test --project=phase15-stubs --grep phase35` (per-phase specs) |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the phase-scoped spec project for touched specs
- **After every plan wave:** Run `npx tsc --noEmit` + phase spec project
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run build` clean
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

*Filled by planner — one row per task with automated verification.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | CMP-01/02/04, MTX-01/02/03, TRN-01/02 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Unit spec for the pure classifier function (evidence → competency state) with fixture-driven cases
- [ ] Source-contract guard: worker read/walkthrough access never references competency state (fork of `tests/phase28/library-and-worker.spec.ts` GATE_PATTERN pattern)
- [ ] Register any new `tests/lint/` or phase spec files in a `playwright.config.ts` project regex; verify with `npx playwright test --list`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Matrix renders correctly on sopstart.com | MTX-01/02 | Visual/CSS token class invisible to automated gates (per CLAUDE.md learnings) | Open /admin/team third view mode, eyeball states + filters |
| CSV opens in Excel with expected columns | TRN-02 | File download + external tool | Export, open, check columns/date range filter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
