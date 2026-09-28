---
phase: 54
slug: admin-inbox-floor-health-library-table
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-29
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) — source-contract + unit specs under `tests/phase54/`, deployed evals under `tests/evals/` |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase54 && npx tsc --noEmit` |
| **Full suite command** | `npm run test && npm run build` (full suite ONCE per gate — OTP budget) |
| **Estimated runtime** | ~25 s quick · ~4 min full |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase54 && npx tsc --noEmit`
- **After every plan wave:** `npm run build` (bundle gate + marker self-validation) + non-live projects touched by the wave (phase28/29/30/33/41 after any repoint)
- **Before `/gsd-verify-work`:** full suite once + `npm run eval -- --phase 54` (governance + rewritten sop-surface), screenshots read by the orchestrator
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-W0 | 01 | 0 | all | — | — | project registration | `npx playwright test --list --project=phase54` | ❌ W0 | ⬜ pending |
| 54-01-01 | 01 | 1 | ADM-02 | — | `machineHealth()` pure: no-owner › overdue › ok; unit-tested | unit | `npx playwright test --project=phase54 tests/phase54/admin-health.spec.ts` | ❌ W0 | ⬜ pending |
| 54-01-02 | 01 | 1 | ADM-03 | — | checks derivation pure: owner · reviewed ≤12 mo · approved · assigned · converted | unit | `npx playwright test --project=phase54 tests/phase54/library-table-checks.spec.ts` | ❌ W0 | ⬜ pending |
| 54-01-03 | 01 | 1 | ADM-01/02 | T-54-01 | admin site-health action: `requireAdminContext`, org-scoped, returns per-SOP owner/review/status per machine + machines with no SOPs | source-contract + live probe (once) | `npx playwright test --project=phase54 tests/phase54/site-health-action.spec.ts` | ❌ W0 | ⬜ pending |
| 54-02-01 | 02 | 2 | ADM-01 | T-54-02 | `/governance` page admin-gated; inbox rows derived from existing queue/parse/site data; ONE action per row; counted chips; all-clear state | source-contract (wiring) | `npx playwright test --project=phase54 tests/phase54/governance-inbox.spec.ts` | ❌ W0 | ⬜ pending |
| 54-02-02 | 02 | 2 | ADM-01 | T-54-02 | approve/owner actions reuse `approveStep` gating + `OwnerPicker` verbatim (no reimplementation) | source-contract | `npx playwright test --project=phase54 tests/phase54/inbox-reuses-governance-gating.spec.ts` | ❌ W0 | ⬜ pending |
| 54-03-01 | 03 | 2 | ADM-02 | — | floor beside inbox in admin repaint; pin → admin machine panel (owner · rev, Open/Edit); no-site card | source-contract (wiring) | `npx playwright test --project=phase54 tests/phase54/admin-machine-panel.spec.ts` | ❌ W0 | ⬜ pending |
| 54-04-01 | 04 | 3 | ADM-03 | — | admin `/sops` table: columns, checks row, chips; deep links `?departments=` `?collection=` `?status=` `?owner=me` resolve; `?view=access` still opens the lens; one list→builder chain | source-contract (wiring) | `npx playwright test --project=phase54 tests/phase54/library-table.spec.ts --project=phase41 tests/phase41/merged-surface.spec.ts --project=phase33 tests/phase33/sop-drilldown.spec.ts` | ❌ W0 / ✅ | ⬜ pending |
| 54-05-01 | 05 | 4 | ADM-03/04 | T-54-03 | deletions: 6 files + dead `sops-nav-types.ts` gone; markers in `check-bundle-size.ts` rewritten in the SAME commit; every spec that grepped them repointed/deleted; sweep fails on any import/href/`view=attention` outside permitted shims | source-contract sweep + build | `npx playwright test --project=phase54 tests/phase54/deletion-sweep.spec.ts && npm run build` | ❌ W0 | ⬜ pending |
| 54-05-02 | 05 | 4 | ADM-04 | — | header Governance → `/governance`; `/admin/governance` + `/sops?view=attention` shims redirect; `journeys.ts` 0 not-mapped; capability matrix; `uat/tests.ts` | source-contract + pathways spec | `npx playwright test --project=phase30 tests/phase30/governance-fold.spec.ts` | ✅ (edit) | ⬜ pending |
| 54-06-01 | 06 | 5 | ADM-01..04 | — | deployed evals: rewritten `sop-surface.eval.ts` + new `governance.eval.ts` (owner reset in beforeAll → red pin on EVAL Press → Assign owner clears; EVAL Oven → Machines row) | deployed eval | `npm run eval -- --phase 54` | ❌ W0 / ✅ rewrite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — `phase54` project (`testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/`), verified with `--list`
- [ ] `tests/phase54/` stubs for every spec above; `deletion-sweep.spec.ts` scaffolded early as `test.fixme` in the `tests/phase41/reference-sweep.spec.ts` shape (exact-route regex, `PERMITTED_FILES`, comment stripping)
- [ ] `src/lib/sop/admin-health.ts` (test-first) and the checks derivation module
- [ ] `tests/evals/governance.eval.ts` skeleton; `tests/evals/sop-surface.eval.ts` rewrite planned against the new surfaces
- [ ] Deletion inventory from 54-RESEARCH.md copied into the last plan as its checklist (importers + ~15 specs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | All phase behaviours have automated verification (pathways coverage runs as a spec) | — |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
