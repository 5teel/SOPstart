---
phase: 59-the-office
plan: 14
subsystem: retirement A
tags: [office, deletion, consumer-graph, dropped-features, sweeps]
requires: [59-13]
provides:
  - "governance, admin/team and admin/access pages, the governance inbox wrapper and queue row, the org-chart and column views, the old role table and the org-model write actions are deleted"
  - "office-pages dropped feature (3 link-anchored route-page entries, 9 file entries) live in the Phase 55 deletion sweep"
  - "59-14 retirement sweep live; LIVE_PLANS = 59-05, 59-12, 59-14"
affects: [59-15, 59-16]
requirements-completed: []
key-files:
  deleted:
    - "src/app/(protected)/governance/page.tsx"
    - "src/app/(protected)/admin/team/page.tsx"
    - "src/app/(protected)/admin/access/page.tsx"
    - src/components/admin/governance/GovernanceInbox.tsx
    - src/components/admin/governance/GovernanceQueueRow.tsx
    - src/components/admin/org-model/{TeamViewShell,OrgChartCanvas,OrgColumnsBoard,ViewToggle}.tsx
    - src/components/admin/RoleAssignmentTable.tsx
    - src/lib/org-model/auto-layout.ts
    - src/lib/org-model/__tests__/auto-layout.test.ts
    - tests/phase32/org-chart-build.spec.ts
    - tests/phase54/inbox-reuses-governance-gating.spec.ts
    - tests/evals/governance.eval.ts
  modified:
    - src/actions/org-model.ts
    - scripts/dropped-features.json
    - tests/phase59/{retirement-sweep,repoint-inventory}.spec.ts
completed: 2026-10-06
---

# Phase 59 Plan 14: Retirement A Summary

**The governance, team and access pages and everything only they used are gone from `src/`; `org-model.ts` is read-only (`listOrgTree`); a link-anchored `office-pages` dropped feature plus a live 59-14 sweep keep them gone. tsc and `npm run build` are clean at every commit; `/page` is 834 KB, delta 0, `.bundle-baseline.json` untouched.**

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | da175bf3 | source deletion by consumer graph, org-model writes removed, pathways access table + UAT list reworded |
| 2 | 6e45c2f4 | specs and evals repointed, trimmed or deleted |
| 3 | 24170b0b | `office-pages` dropped feature, sweeps live, `LIVE_PLANS` appended |

Task 2 sits after Task 1 as the plan orders it, so specs that read the deleted files were red between those two commits (tsc and build stay green; specs are not part of either).

## Deleted modules (consumer graph cleared)

| Module | Importers (all deleted here) |
|---|---|
| three page folders | none (59-13 already redirected the addresses) |
| `GovernanceInbox`, `GovernanceQueueRow` | the governance page, each other |
| `TeamViewShell` | team page |
| `OrgChartCanvas`, `OrgColumnsBoard` | `TeamViewShell` (only comment mentions in `WiringPatchBay*`, reworded) |
| `ViewToggle` | `TeamViewShell` |
| `RoleAssignmentTable` | `OrgColumnsBoard` (still named in a UAT entry, removed) |
| `lib/org-model/auto-layout.ts` + its unit test | the two canvases |
| `org-model.ts`: `createArea`, `updateArea`, `archiveArea`, `createRole`, `updateRole`, `archiveRole`, `assignRoleMembers`, `setDepartmentArea` | `OrgChartCanvas`, `OrgColumnsBoard` (T-59-52: POST-reachable surface removed) |

## Survivors and what keeps them

| Survivor | Consumer |
|---|---|
| `listOrgTree` (`org-model.ts`, read-only now) | `admin-access-view.ts`, `/admin/training` |
| `PersonPanel`, `TrainingMatrixView` | `TrainingBridge` on `/admin/training` (A-05) |
| `AssessmentRequestsPanel` | `/admin/training` page |
| `OwnerPicker` | Office `InboxRow`, `ThisSopBlock` |
| `ApprovalChainEditor` | `/admin/settings` |
| `AdminMachinePanel` | shell room bodies |
| `resolve-access`, `resolve-sop-access`, `sop-collections` | Access lens / grants |
| `AdminAccessLens` (not edited, D-12) | Office Access tab |

## Moved assertions and spec dispositions

| Inventory row | Done |
|---|---|
| `tests/phase32/org-chart-build.spec.ts` | deleted (subjects gone; its runtime smoke was `fixme`) |
| `tests/phase54/inbox-reuses-governance-gating.spec.ts` | deleted; "inbox model never calls the row actions" moved to `phase59/inbox-model.spec.ts`; approve > owner > stale precedence and the confirm / approve wiring were already pinned for the Office rows in `phase59/office-pane-structure` and `approve-actions` |
| `tests/evals/governance.eval.ts` | deleted; case A/D covered by the 59-09 inbox case, B by the 59-07 meta case, C and the Machines row moved into a new `office.eval.ts` case (EVAL Oven, Write a SOP link, Machines chip, no real-org title), E by the Office cases |
| `tests/phase28/governance-queue.spec.ts` | kept and trimmed (data gate, OwnerPicker, redirect and journeys guards); row disposition changed `delete` -> `repoint` in the inventory |
| `phase28/library-and-worker`, `phase29/{phase-gate,queue-approve-action,approval-chain-editor}` | row reads repointed to `InboxRow` / `ApprovePanel`; page absence asserted |
| `phase30/{governance-fold,admin-nav}` | page wiring replaced by Office reads; `REDIRECT_ONLY` exemption from 59-13 removed |
| `phase32/{banner-slot-stability,library-filter-deeplink,wire-up-mode,wiring-at-scale}`, `phase33/{teams-ladder,sop-drilldown}` | access address -> Office Access tab; the `?sop=` UUID pin now asserted on `place.ts` + `OfficePane` |
| `phase43/dead-controls` | `<ViewToggle` token dropped |
| `phase54/governance-inbox` | `deriveInbox` units kept; `loadInbox` one-`Promise.all` pin kept; page/component wiring dropped |
| `phase57/{one-query,retirement-sweep,departments}` | one-query asserts `getOfficeInbox` and `getAdminShell` both read `loadInbox`; sweep drops the two page cases; departments reads `PeopleTab` |
| `tests/lint/design-tokens`, `no-static-admin-lens-import` | org-model path and `GovernanceQueueRow` entries removed (keeps `WiringPatchBayShell`, `AdminShell: []`, `OfficePane: []`) |
| `tests/e2e/sub-trade-assignment` | team-page describe -> People tab member picker |
| `tests/evals/{dead-surface,sop-focus,sop-ledger}` | governance test ids -> `office-pane` / `office-row`; legacy-address expectations -> Office places |
| `phase37/assessor-ui-observation` (59-15 row, 59-14 token) | panel mount asserted on `/admin/training` |

## Deviations from Plan

**1. [Rule 3 - Blocking] Earlier-phase inventories listed the deleted specs.** `phase57/repoint-inventory` and `phase58/repoint-inventory` required `org-chart-build.spec`, `governance.eval` and `inbox-reuses-governance-gating.spec` to exist; their rows now read `delete` with a note.

**2. [Rule 3 - Blocking] Phase 55 sweep bounds.** `deletion-sweep.spec.ts` only accepted entry phases 55/57/58; added 59 alongside `office-pages`.

**3. [Rule 1 - Dead references] Reworded, not deleted:** `ACCESS_MATRIX` in `src/lib/journeys/roles.ts` still named `/governance` and `/admin/team` as routes (now one Office row each, in the same commit); the UAT `p32-org-model-team-view` entry described a chart that no longer exists and was removed; comments in `grants.ts`, `flag-display.ts`, `check-bundle-size.ts`, `WiringPatchBay*` and two UAT backgrounds were reworded in words.

**4.** The plan lists `tests/phase59/owner-review-meta.spec.ts` nowhere, but it read `GovernanceQueueRow`; its onDone assertion now reads `InboxRow`.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0 (Task 1 and after Task 3): `/page` 834 KB delta 0, `/sops/[sopId]/page` 794 KB delta +2 (within tolerance); baseline file untouched.
- Playwright: phase59, 55, 56, 15-stubs, 43, 30, 57, 28, 29, 32, 33, 54, 37, 46, 41 all green (1098 passed, 36 skipped); phase58/53/52/34/26/27/23/28-unit/29-unit/32-unit/35-unit green apart from the items below. `npx playwright test --list` loads (2270 tests, no missing import). Evals not run (59-16).
- `npm run lint`: 39 errors, all pre-existing in untracked scratch dirs (`transcripts/` etc.); touched files have 0 errors.
- Pathways: no `route:` names a retired address; phase30 coverage spec (0 not-mapped) green with the exemption removed.

## Deferred Issues

See `deferred-items.md`: (a) pre-existing red `phase40/dat01-category-column` census from 59-07's `owner-review.ts` write; (b) `materializeOrgAccess` has no caller left; (c) live-probe specs in phase35/36/51 fail locally (environment, rate-limit class), not run live per instructions.

## Known Stubs

None.

## Threat Flags

None. T-59-52 mitigated (eight write exports deleted, spec asserts `org-model.ts` has no write call); T-59-53 (`office-pages` live in the dropped list); T-59-54 (dead-href lint green, link-anchored refs checked against `href`, router call and template spellings).

## Self-Check: PASSED

- Commits da175bf3, 6e45c2f4, 24170b0b exist; the three page folders and eight modules are absent; `STATE.md`, `ROADMAP.md`, `.bundle-baseline.json` untouched; nothing pushed.
