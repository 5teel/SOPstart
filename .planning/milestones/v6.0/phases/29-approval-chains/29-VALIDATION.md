---
phase: 29
slug: approval-chains
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-12
---

# Phase 29 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (project-scoped, repo convention) |
| **Config file** | `playwright.config.ts` (`phase29-unit` + `phase29` projects, registered same-plan as specs) |
| **Quick run command** | `npx playwright test --project=phase29-unit` |
| **Full suite command** | `npx playwright test --project=phase29-unit --project=phase29 --project=phase28-unit --project=phase28 && npx tsc --noEmit` |
| **Estimated runtime** | ~40s unit / ~2 min full + tsc |

## Sampling Rate

- After every task commit: quick run
- After every wave: full suite (incl. phase28 regression)
- Before verify: full suite + `npm run build` (touches publish route + src/actions — 2026-06-27 gate)

## Per-Requirement Contract

| Requirement | Correct Behavior | Test Type |
|-------------|------------------|-----------|
| APR-01 | Chain CRUD org-scoped; no-chain publish path BYTE-IDENTICAL (source-contract proves performPublish extraction preserves order + no behavioral branch when no chain) | unit (chain validation) + source-contract |
| APR-02 | Snapshot copied at request-publish; live chain edits don't affect in-flight (pure snapshot fn unit test) | unit |
| APR-03 | Approve/request-changes wired one-click from SOP + queue (onClick → action assertions, 2026-06-05 rule) | source-contract |
| APR-04 | Final-step approve calls performPublish (same fn as route); "who's next" = first step without approved row (pure resolver unit tests incl. reject/resubmit multi-cycle) | unit + source-contract |
| APR-05 | Versions surface renders sop_approvals grouped by version | source-contract |
| Cross-org | approveStep/requestChanges/setApprovalChain org-isolated | test.fixme runtime carry + source-contract (phase27/28 convention) |

## Binding Conventions

- Pure chain logic in `src/lib/governance/approvals.ts` — NO 'use server' (2026-06-27).
- `approval_chains` RLS: `current_organisation_id()` predicate (00044 precedent — NEVER app_metadata; HR-01 class).
- `sop_approvals` idempotency: PARTIAL unique index `where action='approved'` (blanket constraint breaks reject/resubmit cycles — research pitfall).
- Both new Playwright projects in config same-plan as first specs (2026-05-25).
- Final gates: tsc + `npm run build` + phase28 projects still green (regression).
