---
phase: 54-admin-inbox-floor-health-library-table
plan: 01
subsystem: admin health / library data layer
tags: [governance, site-health, admin-sops, playwright-harness]
requires: []
provides:
  - src/lib/sop/admin-health.ts (machineHealth, machinesWithoutSops, adminSopBadge, machinePanelSops, deriveChecks, tableStatus, CHECK_ORDER)
  - src/actions/site.ts listSiteHealthForOrg()
  - MillerSop check-input fields (ownerUserId, flags, lastReviewedAt, chainRequired, hasPersonGrant, parseFailed, machines)
  - phase54 Playwright project + 8 spec files
affects:
  - src/actions/admin-sop-list.ts
  - src/lib/sop-list/admin-rows.ts
  - src/lib/validators/site.ts
  - .planning/codebase/CAPABILITY-MATRIX.md
tech-stack:
  added: []
  patterns:
    - "one pure classifier module reads governance flags, never re-derives them (CLAUDE.md 2026-09-27)"
    - "source-contract Playwright specs with comment-stripping to pin guard order/literals"
key-files:
  created:
    - src/lib/sop/admin-health.ts
    - tests/phase54/*.spec.ts (8 files)
  modified:
    - src/actions/admin-sop-list.ts
    - src/actions/site.ts
    - src/lib/sop-list/admin-rows.ts
    - src/lib/validators/site.ts
    - playwright.config.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase41/spec-repoint-inventory.spec.ts
decisions:
  - "Health is derived from listGovernanceQueue's flags (joined on the page), not a second raw-column classifier — unowned already covers an owner who left the org, which a raw owner_user_id check would miss (deviation from RESEARCH, sanctioned by CONTEXT D-04, documented in the plan's own objective)."
metrics:
  duration: "~50 min"
  completed: 2026-09-29
---

# Phase 54 Plan 01: Admin health classifier + library/floor data layer Summary

One pure module (`src/lib/sop/admin-health.ts`) now answers every admin health question — floor pin severity, machine-panel badges, the five library checks, and table status — from the existing governance flags, and the data layer (`listAdminSopRows`, new `listSiteHealthForOrg`) carries every input those questions need, all org-scoped behind `requireAdminContext()`.

## What Was Built

**Task 1 — phase54 harness.** Registered the `phase54` Playwright project in `playwright.config.ts` (after `phase53`, same comment-block style). Created all 8 spec files: `admin-health.spec.ts`, `library-table-checks.spec.ts`, `site-health-action.spec.ts` (flipped live in Tasks 2/3), `governance-inbox.spec.ts`, `inbox-reuses-governance-gating.spec.ts`, `admin-machine-panel.spec.ts`, `library-table.spec.ts` (fixme scaffolds for later plans), and `deletion-sweep.spec.ts` in its final shape (5 fixme tests covering the D-09 seven-file deletion, dead-name/dead-param reference sweeps across `src/` and `tests/`, the attention-compare permitted-count check, and the bundle-size marker repoint — activates in 54-05).

**Task 2 — admin-health.ts (TDD).** RED: 36 unit tests across `admin-health.spec.ts` (machineHealth, machinesWithoutSops, adminSopBadge, machinePanelSops) and `library-table-checks.spec.ts` (deriveChecks, tableStatus, CHECK_ORDER), confirmed failing on missing module. GREEN: `src/lib/sop/admin-health.ts` — plain module, type-only imports (`GovernanceFlag`, `SopMachineLink`), no I/O, no module-scope clock:
- `machineHealth`: worst-of unowned > overdue > ok across a machine's linked SOPs; absent from the map if no resolvable links.
- `machinesWithoutSops`: zero-link machines, input order.
- `adminSopBadge`: NO OWNER > REVIEW DUE > DRAFT > OK precedence.
- `machinePanelSops`: per-machine SOP rows sorted by badge rank then title.
- `deriveChecks(sop, now)`: five independent check states (owner/review/approved/assigned/converted) — review uses a calendar-year staleness cut (`setUTCFullYear`), approved treats `published` as always-ok regardless of chain, assigned is ok on allDepartments/any department/person grant.
- `tableStatus`: stuck/parseFailed → STUCK, published → LIVE, else DRAFT.

**Task 3 — data layer.** `listAdminSopRows` (`src/actions/admin-sop-list.ts`) gained `organisationId` from context with a `No organisation` guard, `last_reviewed_at` on `SOP_SELECT`, and five new org-scoped parallel reads (`approval_chains`, `sop_access_people`, `parse_jobs`, `sop_machines`, `site_machines`) feeding `chainCategories`, `personGrantSops`, latest-parse-status-per-SOP, and sorted machine names per SOP. Every row's `flags` now comes from the *full* governance read (not just the flagged subset) so a clean SOP still classifies correctly. `MillerSop` (`src/lib/sop-list/admin-rows.ts`) gained the seven check-input fields, structurally satisfying `admin-health`'s `CheckInput`. `listSiteHealthForOrg()` (`src/actions/site.ts`) reshapes `listSiteForOrg`'s admin-scoped read into the worker floor render shape (`AdminSiteFloor = WorkerSiteData`, added to `src/lib/validators/site.ts`), signing sprite URLs itself and returning `links` unfiltered (drafts included, unlike the worker's published-only read). `requireAdminContext()` first, no service-role client anywhere in either file. Capability matrix gained a "Library health data" row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] `tests/phase41/spec-repoint-inventory.spec.ts` regression from the new deletion-sweep scaffold**
- **Found during:** Task 3 regression run (`--project=phase28 --project=phase30 --project=phase41`)
- **Issue:** `deletion-sweep.spec.ts`'s `PERMITTED_ATTENTION_FILES` constant legitimately names `src/app/(protected)/admin/sops/page.tsx` as CODE (one of the two files allowed to still carry `=== 'attention'` after the 54-05 deletion). `spec-repoint-inventory.spec.ts` flags any spec referencing that shim path as CODE unless it's on an explicit allowlist — the same pattern `reference-sweep.spec.ts` already navigates.
- **Fix:** Added `tests/phase54/deletion-sweep.spec.ts` to the `ALLOWLIST` in `tests/phase41/spec-repoint-inventory.spec.ts`, with a doc-comment entry mirroring the existing five.
- **Files modified:** `tests/phase41/spec-repoint-inventory.spec.ts`
- **Commit:** `6c38c1e`

No other deviations — the rest of the plan executed as written, including the calendar-year (not 365-day) review-staleness cut and the "published always approves regardless of chain" precedence exactly as specified in `<behavior>`.

## Known Stubs

None — this plan produces no rendered UI; all output is data-layer/classifier code plus test scaffolding, none of it wired to a stub render path.

## Verification

- `npx playwright test --list --project=phase54` → 28 tests across 8 files (all discovered)
- `npx playwright test --project=phase54` → 274 passed, 32 skipped (fixme scaffolds for 54-02..54-06, one runtime-smoke e2e skip in phase32), 0 failed
- `npx tsc --noEmit` → clean
- `npx playwright test --project=phase28 --project=phase30 --project=phase41` → 173 passed, 3 skipped (pre-existing baseline), 0 failed
- `npx playwright test tests/phase32/library-filter-deeplink.spec.ts` → 5 passed, 1 skipped (runtime smoke, expected local skip), 0 failed
- Acceptance greps: `grep -c "name: 'phase54'" playwright.config.ts` = 1; `grep -c "export async function listSiteHealthForOrg" src/actions/site.ts` = 1; `grep -c "createAdminClient" src/actions/site.ts src/actions/admin-sop-list.ts` totals 0; `grep -c "Library health data" .planning/codebase/CAPABILITY-MATRIX.md` = 1

## Commits

- `70d9106` test(54-01): register phase54 project, Wave-0 stubs, deletion-sweep scaffold
- `070a95c` feat(54-01): admin-health.ts — the one admin health classifier, test-first
- `6c38c1e` feat(54-01): library rows carry check inputs; listSiteHealthForOrg; matrix row

## Self-Check

- `src/lib/sop/admin-health.ts` — FOUND
- `src/actions/site.ts` contains `export async function listSiteHealthForOrg` — FOUND
- `.planning/codebase/CAPABILITY-MATRIX.md` contains "Library health data" — FOUND
- Commit `70d9106` — FOUND in `git log`
- Commit `070a95c` — FOUND in `git log`
- Commit `6c38c1e` — FOUND in `git log`

## Self-Check: PASSED
