---
phase: 54
slug: admin-inbox-floor-health-library-table
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-29
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Task IDs match the PLAN.md files (updated with the plans, 2026-09-29).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) — source-contract + unit specs under `tests/phase54/`, deployed evals under `tests/evals/` |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase54 && npx tsc --noEmit` |
| **Full suite command** | `npm run test && npm run build` (full suite ONCE, in 54-06 — OTP budget) |
| **Estimated runtime** | ~25 s quick · ~4 min full |

---

## Sampling Rate

- **After every task commit:** `npx playwright test --project=phase54 && npx tsc --noEmit`
- **After every plan wave:** `npm run build` (bundle gate + marker self-validation) + the non-live projects the wave touched (phase28/29/30/41/52 and the named phase32/33/36/37 page readers)
- **Before `/gsd-verify-work`:** full suite once + `npm run eval -- --phase 54` (governance + rewritten sop-surface + plant-home), screenshots read
- **Max feedback latency:** 30 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | all | — | `phase54` project registered; stubs + deletion-sweep fixme scaffold | registration | `npx playwright test --list --project=phase54` | ✅ | ✅ green |
| 54-01-02 | 01 | 1 | ADM-02/03 | — | `admin-health.ts` pure: `machineHealth` (no owner › overdue › ok), `adminSopBadge`, `machinePanelSops`, `deriveChecks` (owner · reviewed ≤12 mo · approved · assigned · converted), `tableStatus` — reads governance flags only | unit | `npx playwright test --project=phase54 tests/phase54/admin-health.spec.ts tests/phase54/library-table-checks.spec.ts` | ✅ | ✅ green |
| 54-01-03 | 01 | 1 | ADM-01/02/03 | T-54-01 | `listSiteHealthForOrg` guard-first, no service role; `listAdminSopRows` new reads session-org filtered; capability-matrix row | source-contract (runtime cross-org probe in 54-06 eval) | `npx playwright test --project=phase54 tests/phase54/site-health-action.spec.ts` | ✅ | ✅ green |
| 54-02-01 | 02 | 2 | ADM-01 | — | `deriveInbox` pure: owner/overdue/approve-me/stuck/machines rows, severities, counts, empty = all clear | unit | `npx playwright test --project=phase54 tests/phase54/governance-inbox.spec.ts -g deriveInbox` | ✅ | ✅ green |
| 54-02-02 | 02 | 2 | ADM-01 | T-54-02 | `/governance` server page admin-gated; inbox actions only via `GovernanceQueueRow`'s untouched branches (`approveStep` / `OwnerPicker` / Confirm current) | source-contract | `npx playwright test --project=phase54 tests/phase54/governance-inbox.spec.ts tests/phase54/inbox-reuses-governance-gating.spec.ts` | ✅ | ✅ green |
| 54-02-03 | 02 | 2 | ADM-04 | T-54-03a | header → `/governance`; `/admin/governance` + `/admin/sops?view=attention` redirect; journeys maps `/governance`; roles + matrix | source-contract + pathways walk | `npx playwright test --project=phase28 --project=phase30 --project=phase41` | ✅ | ✅ green |
| 54-03-01 | 03 | 3 | ADM-02 | T-54-04b | `PlantStage` paints caller-supplied health; `AdminMachinePanel` shows owner · review, Open/Edit, Add one; worker panel untouched | source-contract | `npx playwright test --project=phase54 tests/phase54/admin-machine-panel.spec.ts && npx playwright test --project=phase52` | ✅ | ✅ green |
| 54-03-02 | 03 | 3 | ADM-02 | T-54-01 | `AdminFloorHealth` beside the inbox (dynamic PlantStage), pin → panel, no-site card | source-contract + build | `npx playwright test --project=phase54 && npm run build` | ✅ | ✅ green |
| 54-04-01 | 04 | 3 | ADM-03 | T-54-03b | `AdminLibraryTable`: columns, checks, chips, one builder chain; `resolveLibraryNav` (`?departments=` `?collection=` `?status=` `?owner=me`, `?view=access`, `?view=attention` → /governance) | unit + source-contract | `npx playwright test --project=phase54 tests/phase54/library-table.spec.ts` | ✅ | ✅ green |
| 54-04-02 | 04 | 3 | ADM-03 | T-54-08 | `WorkerSimpleList` (scope chips, dept sheet, per-row Add/Remove); `BuilderCategoryButton` via `setSopCategory` | source-contract | `npx playwright test --project=phase54 tests/phase54/library-table.spec.ts -g "surviving affordances"` | ✅ | ✅ green |
| 54-04-03 | 04 | 3 | ADM-03 | T-54-04 | `/sops` swap (no Miller frame); table marker group on both routes; recursive self-validation corpus; page specs repointed; ±2 KB, baseline untouched | source-contract + build | `npm run build && npx playwright test --project=phase41 --project=phase52 --project=phase54` | ✅ | ✅ green |
| 54-05-01 | 05 | 4 | ADM-03 | T-54-02 | 7 files deleted; every spec that read them repointed / `status-attention-lenses` deleted — same commit | source-contract | `npx tsc --noEmit && npx playwright test --project=phase28 --project=phase29 --project=phase30 --project=phase41 --project=phase52 --project=phase54` | ✅ | ✅ green |
| 54-05-02 | 05 | 4 | ADM-03/04 | T-54-03 | live deletion sweep (src + non-eval tests); per-symbol lint allow-list; dead `topSignal` cleared; build green | source-contract sweep + build | `npx playwright test --project=phase54 tests/phase54/deletion-sweep.spec.ts && npm run build` | ✅ | ✅ green |
| 54-05-03 | 05 | 4 | ADM-04 | — | journeys (inbox, floor, panel, table) 0 not mapped; roles; uat; capability matrix | source-contract + pathways walk | `npx playwright test --project=phase30 tests/phase30/governance-fold.spec.ts tests/phase30/dead-weight.spec.ts` | ✅ | ✅ green |
| 54-06-01 | 06 | 5 | ADM-01..04 | T-54-10 | governance eval (owner reset + read-back in beforeAll → red pin on EVAL Press → panel → Assign owner clears; EVAL Oven → Machines row; no real-org title); sop-surface rewritten; plant-home repointed; sweep covers evals | eval authoring + sweep | `npx playwright test --project=phase54 tests/phase54/deletion-sweep.spec.ts && npx playwright test --project=evals --list` | ✅ | ✅ green |
| 54-06-02 | 06 | 5 | ADM-01..04 | T-54-11 | full suite once, build, push, deployed eval, every screenshot read, sign-off | deployed eval | `npm run eval -- --phase 54` | ✅ | ✅ green (26/26) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `playwright.config.ts` — `phase54` project (`testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/`), verified with `--list` (54-01-01)
- [x] `tests/phase54/` stubs for every spec above; `deletion-sweep.spec.ts` scaffolded as `test.fixme` in its final shape (54-01-01), later flipped live in 54-05
- [x] `src/lib/sop/admin-health.ts` test-first (54-01-02)
- [x] `tests/evals/governance.eval.ts` authored and `sop-surface.eval.ts` rewritten in 54-06-01
- [x] Deletion inventory copied into 54-05 as its checklist (files + importers + specs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| None | — | All phase behaviours have automated verification (pathways coverage runs as a spec; visuals are read from eval screenshots) | — |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] Frontmatter sets `nyquist_compliant` to `true`

**Approval:** signed off 2026-09-29 (deployed eval — 26/26 passed against https://sopstart.com at commit `3d86355`; every screenshot read; see `54-EVAL.md`)
