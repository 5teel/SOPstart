---
phase: 28
slug: ownership-review-lifecycle-governance-queue
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.x (project-scoped unit + source-contract specs — repo convention) |
| **Config file** | `playwright.config.ts` (new `phase28-unit` + `phase28-stubs` projects, registered Wave 0/1) |
| **Quick run command** | `npx playwright test --project=phase28-unit` |
| **Full suite command** | `npx playwright test --project=phase28-unit --project=phase28-stubs && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds (unit) / ~90 seconds (full + tsc) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=phase28-unit`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` clean (phase touches `src/actions/*` — 2026-06-27 gate)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> Filled by the planner with concrete task IDs. Contract per requirement:

| Requirement | Secure/Correct Behavior | Test Type | Automated Command |
|-------------|------------------------|-----------|-------------------|
| OWN-01 | Backfill sets owner on every SOP; new SOPs default owner = creator | unit (pure resolver) + migration assertion | `npx playwright test --project=phase28-unit` |
| OWN-02 | Reassign action org-scopes the write (no cross-org owner set) | source-contract + test.fixme live runtime (Railway-only convention, phase27 precedent) | `npx playwright test --project=phase28-stubs` |
| OWN-03 | Queue classifies unowned when owner missing/no longer a member | unit (pure classifier fn with fixture rows) | `npx playwright test --project=phase28-unit` |
| OWN-04 | owner=me filter returns only caller-owned SOPs | source-contract (filter wiring) | `npx playwright test --project=phase28-stubs` |
| REV-01 | Cadence resolution: SOP override > category cadence > 12mo default | unit (pure fn) | `npx playwright test --project=phase28-unit` |
| REV-02 | Overdue badge renders in admin library; NO worker-route gating (assert no review-state check in worker routes) | source-contract | `npx playwright test --project=phase28-stubs` |
| REV-03 | Worker view renders "Current as of" caption from last_reviewed_at ?? published_at | unit (date-format fn) + source-contract | `npx playwright test --project=phase28-unit` |
| REV-04 | Confirm-current sets last_reviewed_at + resets review_due_at + appends review event; org-scoped | unit (pure next-due calc) + source-contract on action | both projects |
| GQ-01/GQ-02 | Queue query classifies 4 buckets; each row action wired (onClick references the action — 2026-06-05 wiring rule) | unit (classifier) + source-contract (wiring) | both projects |
| GQ-03 | Dangling department reference detection (departments only — sub_trades descoped per research) | unit (pure detector fn) | `npx playwright test --project=phase28-unit` |
| GQ-04 | Dashboard widget counts match classifier output; deep links carry filter param | source-contract | `npx playwright test --project=phase28-stubs` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/governance/__tests__/` — unit specs for pure classifier/cadence/date fns (registered as `phase28-unit`)
- [ ] `tests/phase28/` — source-contract specs (registered as `phase28-stubs`)
- [ ] Both projects appear in `npx playwright test --list` (2026-05-25 registration gate)

## Conventions (binding)

- Pure logic (queue classification, cadence resolution, next-due calc, dangling-ref detection) lives in `src/lib/governance/*` — NOT in `'use server'` files (2026-06-27) — so it is directly unit-testable.
- Live-DB runtime assertions (cross-org write isolation) are `test.fixme` with full inline Steps docs, per Railway-only-testing convention (phase27 `ai-settings-org-scope.spec.ts` precedent).
- Final gates: `npx tsc --noEmit` + `npm run build` (bundle checks must stay green; worker bundle Δ within ±2 KB tolerance).
