---
phase: 35
slug: competency-classifier-training-matrix-records
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-23
audited: 2026-07-25
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright — `phase35` (source-contract, testDir '.') + `phase35-unit` (static-@/-import behavioral, testDir src/lib/competency/__tests__) |
| **Config file** | playwright.config.ts (both projects registered in 35-01 Task 1) |
| **Quick run command** | `npx playwright test --project=phase35 && npx playwright test --project=phase35-unit` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched phase35 / phase35-unit specs
- **After every plan wave:** `npx tsc --noEmit` + both phase35 projects
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` clean (next build catches 'use server' async-only + type scope that tsc/per-project miss — CLAUDE.md 2026-06-02/06-27)
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-T1 | 35-01 | 1 | CMP-01, CMP-02 | T-35-01-03 | four-member state enum, D-01 ladder + D-02 reset | unit (static import) | `npx playwright test --project=phase35-unit tests=classify` | ✅ | ✅ green |
| 35-01-T2 | 35-01 | 1 | MTX-02, TRN-02 | T-35-01-02 | no access_grants second derivation; RFC-4180 CSV quoting | unit + source-contract | `npx playwright test --project=phase35-unit` / `... --project=phase35 tests/phase35/matrix-derivation.spec.ts` | ✅ | ✅ green |
| 35-01-T3 | 35-01 | 1 | CMP-04 | T-35-01-03 | no competency-state gate in worker surfaces (locked) | source-contract | `npx playwright test --project=phase35 tests/phase35/no-competency-gate.spec.ts` | ✅ | ✅ green |
| 35-02-T1 | 35-02 | 2 | MTX-03 | T-35-02-06 | Zod filter validation; declared CSS tokens; informational pill | source-contract | `npx playwright test --project=phase35 tests/phase35/state-pill.spec.ts` | ✅ | ✅ green |
| 35-02-T2 | 35-02 | 2 | CMP-01, TRN-01, TRN-02 | T-35-02-01/02/03/04/05 | role-gate + admin-client org-self-enforce; self-scoped worker read; CSV via action not route | build/type | `npx tsc --noEmit` | ✅ | ✅ green |
| 35-02-T3 | 35-02 | 2 | CMP-04, MTX-02 | T-35-02-02/03/05 | per-role RLS probe (pos+neg); supervisor-not-empty; no over-share | source-contract + runtime(fixme) | `npx playwright test --project=phase35 tests/phase35/competency-actions.spec.ts` | ✅ | ✅ green |
| 35-03-T1 | 35-03 | 3 | MTX-01, MTX-03, CMP-01 | T-35-03-02 | matrix pills passive (no worker gate); fit-driven compaction | source-contract | `npx playwright test --project=phase35 tests/phase35/training-matrix-view.spec.ts tests/phase35/matrix-filters.spec.ts` | ✅ | ✅ green |
| 35-03-T2 | 35-03 | 3 | TRN-01 | T-35-03-01 | grouped-by-SOP record + other-completed; informational | source-contract | `npx playwright test --project=phase35 tests/phase35/training-record.spec.ts` | ✅ | ✅ green |
| 35-03-T3 | 35-03 | 3 | MTX-01 | T-35-03-03 | matrix view wired; /pathways 0 not-mapped | build/type + source-contract | `npx tsc --noEmit && npx playwright test --project=phase35` | ✅ | ✅ green |
| 35-03-T4 | 35-03 | 3 | TRN-02 | T-35-03-04 | both D-16 export buttons INVOKE exportTrainingCsv → Blob download (wiring, not string presence) | source-contract | `npx playwright test --project=phase35 tests/phase35/training-matrix-view.spec.ts tests/phase35/training-record.spec.ts` | ✅ | ✅ green |
| 35-04-T1 | 35-04 | 3 | CMP-01, CMP-04 | T-35-04-01/02 | worker own-states informational; guard now active on CompetencySection | source-contract | `npx tsc --noEmit && npx playwright test --project=phase35 tests/phase35/no-competency-gate.spec.ts` | ✅ | ✅ green |
| 35-04-T2 | 35-04 | 3 | CMP-04 | T-35-04-01/02 | self-scoped (getMyCompetencyStates only); gate-free | source-contract | `npx playwright test --project=phase35 tests/phase35/profile-competency.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Unit spec for the pure classifier (evidence → state) — `src/lib/competency/__tests__/classify.test.ts` (35-01 T1, static @/ import under phase35-unit)
- [x] Source-contract guard: worker read/walkthrough never references competency state — `tests/phase35/no-competency-gate.spec.ts` (35-01 T3, forked D28-07 GATE_PATTERN, fs.existsSync-tolerant so CompetencySection self-activates in 35-04)
- [x] MTX-02 no-double-derivation source-contract — `tests/phase35/matrix-derivation.spec.ts` (35-01 T2)
- [x] Register phase35 + phase35-unit projects; verify with `npx playwright test --list --project=phase35` and `--project=phase35-unit` (35-01 T1)
- [x] Runtime per-role RLS probe (supervisor same-org allowed / worker denied / admin cross-org denied / worker own-vs-peer) — `tests/phase35/competency-rls-probe.spec.ts` staged with tripwires (35-02 T3 + WR-07 fix `1d8eeae`); live RUN still pending sopstart.com UAT (see Manual-Only)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Matrix renders correctly on sopstart.com | MTX-01/02 | Visual/CSS token class invisible to automated gates (CLAUDE.md 2026-07-14) | Open /admin/team → Matrix view; eyeball pills, rollups, compaction, filters |
| Cell click opens record at right SOP | MTX-01/TRN-01 | Interactive deep-link | Click a coloured cell; PersonPanel opens focused on that SOP's evidence |
| CSV opens in Excel with expected columns | TRN-02 | File download + external tool | Export filtered cut; open; check columns + completion-date range |
| Worker sees own states, no lock icons | CMP-04/D-04 | Visual, worker session | Worker /profile → "Your training"; confirm informational, nothing gated |
| Per-role RLS isolation (live) | CMP-04/MTX-02 | Requires live Supabase sessions | Un-fixme competency-rls-probe; run supervisor/worker/admin/cross-org matrix |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (classifier unit, CMP-04 guard, MTX-02 contract, project registration; runtime RLS probe staged for live UAT)
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-25 — all automated coverage green post-execution

---

## Validation Audit 2026-07-25

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated (manual-only, pre-declared) | 5 |

All 13 spec/test files from the per-task map exist and run green: phase35 66 + phase35-unit 21 = 87 passed, 4 skipped (staged live-UAT RLS probes), 0 failed; `npx tsc --noEmit` and `npm run build` clean. Coverage exceeds plan: the review-fix pass (`1a6fccf`..`1d8eeae`) added unit cases for CSV formula-injection neutralization (=/+/-/@, bare \r) and the classify needs_support reset floor (`hasCompletion ? 'read' : 'not_started'`), plus tripwires in the staged RLS probes so un-fixme'ing without real assertions fails loudly. Manual-Only table unchanged — 5 items await live sopstart.com UAT (visual matrix render, cell deep-link, Excel CSV open, worker profile view, live per-role RLS probes).
