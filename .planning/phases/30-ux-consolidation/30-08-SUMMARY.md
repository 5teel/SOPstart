---
phase: 30-ux-consolidation
plan: 08
subsystem: admin-governance
tags: [ux-03, ux-06, governance-fold, one-line-rows, redirect-shim, phase-gate, journeys]
requires:
  - 30-01 (phase30 harness + full-suite baseline 39F/798P/230S)
  - 30-03 (AdminNav Governance item → /admin/sops?view=attention)
  - 30-07 (SopActionsMenu in builder — labelled home for the row actions)
provides:
  - /admin/sops hosts the folded "Needs attention" governance view (?view=attention) — GovernanceFilterChips + GovernanceQueueRow reused VERBATIM (approveStep + isCallerNextApprover gate untouched)
  - /admin/sops header flag chips with counts + deep-links for all 5 flags incl. awaiting_approval (GQ-04/APR-03/04 preserved)
  - /admin/governance redirect shim (guard-first) mapping legacy ?filter=X → /admin/sops?view=attention&filter=X
  - ApprovalChainEditor + its category/chains/members assembly relocated to /admin/settings
  - One-line admin rows: title · status chip · one flag chip (worst-first) · owner; click → builder
  - STATUS_TAB failed renamed "Needs attention" → "Parse issues" (decision #4)
  - Phase gate green: full suite == 30-01 baseline failures exactly; tsc + next build + bundle gate + /pathways 0 not-mapped
affects: []
tech-stack:
  added: []
  patterns:
    - "Fold-by-reuse: relocated governance surface re-mounts the existing client components verbatim; the ONE server read (listGovernanceQueue) powers header chips + view rows + per-row flag chips"
    - "Route-coverage assertion in a spec mirrors listAppRoutes() so /pathways 0 not-mapped is CI-enforced, not eyeballed"
key-files:
  created: []
  modified:
    - src/app/(protected)/admin/sops/page.tsx
    - src/app/(protected)/admin/governance/page.tsx
    - src/app/(protected)/admin/settings/page.tsx
    - src/components/admin/governance/GovernanceFilterChips.tsx
    - src/components/admin/governance/ApprovalChainEditor.tsx (docblock repoint only)
    - src/lib/journeys/journeys.ts
    - tests/phase28/governance-queue.spec.ts
    - tests/phase28/library-and-worker.spec.ts
    - tests/phase29/approval-chain-editor.spec.ts
    - tests/phase29/queue-approve-action.spec.ts
    - tests/phase30/governance-fold.spec.ts
    - tests/phase30/list-rows.spec.ts
    - tests/phase30/admin-nav.spec.ts (deviation — shim no longer mounts AdminNav)
    - tests/phase30/role-homes.spec.ts (deviation — journeys maps /dashboard shim exactly once)
    - tests/e2e/admin-departments.spec.ts (deviation — 30-03 AdminNav fallout, NEW failure vs baseline cleared)
  deleted:
    - src/components/admin/governance/GovernanceWidget.tsx
    - src/components/admin/sops/LibraryReviewCell.tsx
decisions:
  - "One-line row flag chip derives from the SAME listGovernanceQueue read as the header chips (worst-first FLAG_PRIORITY: overdue > due_soon > awaiting_approval > unowned > stale_role) — no client date math, no second query, classification stays server-side in classify.ts"
  - "FLAG_STYLE/FLAG_LABEL duplicated locally in the server page — GovernanceQueueRow is 'use client' so its consts cannot be imported into a server component; sync enforced by specs"
  - "journeys.ts maps /dashboard exactly once as the legacy redirect-shim step so /pathways shows 0 not-mapped (the route survives per decision #5); roles.ts still lands no role there"
  - "Governance shim keeps the org-scoped admin guard IN FRONT of the redirect (T-30-08-03)"
metrics:
  duration: ~40m
  completed: 2026-07-13
requirements-completed: [UX-03, UX-06]
---

# Phase 30 Plan 08: Governance Fold + One-Line Rows + Phase Gate Summary

**One-liner:** Governance queue folded into /admin/sops as the "Needs attention" view with the approve wiring moved verbatim (APR-03/04 preserved, server actions byte-unchanged), admin rows collapsed to one line fed by the same governance read, /admin/governance now a guard-first ?filter-mapping shim, the approval-chain editor homed in /admin/settings — and the whole phase proven green against the 30-01 baseline (39F/850P/196S, zero NEW failures, tsc + build + bundle + 0 not-mapped).

## What was built

### Task 1 — Governance fold + shim + editor relocation (commit `588f24e`)
- `admin/sops/page.tsx`: `?view=attention` renders `GovernanceFilterChips` + the `GovernanceQueueRow` list (moved verbatim — the row still owns `approveStep(row.id)` behind `row.flags.includes('awaiting_approval') && row.isCallerNextApprover`); counts/visibleRows logic moved from the governance page unchanged. Header flag chips (all 5 flags with counts, deep-linking `?view=attention&filter=X`) replace the GovernanceWidget mount; a "Needs attention" tab (with live count) joins the tab bar; the old `failed` tab renders "Parse issues".
- `admin/governance/page.tsx`: redirect shim — full org-scoped admin guard first, then `redirect(filter ? \`/admin/sops?view=attention&filter=${filter}\` : '/admin/sops?view=attention')`. No surface renders.
- `admin/settings/page.tsx`: ApprovalChainEditor + its category (org-scoped sops select + dedupe), chains (`getApprovalChains`), and members (`getOrgMembers`, admin/safety_manager filtered) assembly moved in under a CONFIG section.
- `GovernanceFilterChips.tsx`: hrefs repointed to the folded view.
- `git diff --quiet src/actions/governance.ts src/actions/approvals.ts` → clean at every gate (spine untouched, T-30-08-01/02).

### Task 2 — One-line rows + deletions + spec repoints (commit `750367a`)
- Row = title · `StatusBadge` · ONE flag chip (worst-first from the governance queue) · owner label; whole row links `/admin/sops/builder/${sop.id}`. Removed from rows: `SopDepartmentEditor`, `LibraryReviewCell`, `VideoJobIndicator`, the 5 icon-only `evidence-btn` Links, `DeleteSopButton` (all live in the 30-07 builder SopActionsMenu / Assign page). Departments + sop_departments fetches dropped from the page.
- Deleted `GovernanceWidget.tsx` + `LibraryReviewCell.tsx`; `grep -rn "GovernanceWidget\|LibraryReviewCell" src` == 0.
- Repointed: phase28 `governance-queue.spec.ts` (folded view + shim + journeys), phase28 `library-and-worker.spec.ts` (widget → header chips; LibraryReviewCell → QueueRow confirm-current + classify.ts overdue + row flag chip), phase29 `approval-chain-editor.spec.ts` (editor in settings + shim doesn't mount it + no new route), phase29 `queue-approve-action.spec.ts` (widget describes → header chips). `list-rows.spec.ts` row-half flipped live with wiring assertions.

### Task 3 — journeys sweep + governance-fold spec + merged-tree gate (commit `e82b743`)
- `journeys.ts`: governance-queue journey rewritten to the folded view (queue step → `/admin/sops` with `?view=attention` detail, legacy `/admin/governance` shim step keeps the route mapped, new Approve branch for APR-03/04); log-in journey maps the `/dashboard` shim exactly once; settings hub detail notes the approval-chain editor.
- `governance-fold.spec.ts` flipped live: 6 UX-03 tests (fold render, shim guard-first + mapping, approve wiring in QueueRow AND PublishStage, header chip count+link, deletion existsSync, STATUS_TAB rename) + a route-coverage test mirroring `listAppRoutes()` asserting **every route in the tree is mapped → /pathways 0 not-mapped, CI-enforced**.
- Dead-href greps: `/admin/governance?filter` → only the shim's own docblock (no hrefs); `/walkthrough` → 0; `/dashboard` in nav surfaces (TopHeader/BottomTabBar) → 0.
- `tests/integration/departments-rls.spec.ts` needed NO repoint — its only `/dashboard` mention is a comment; no runtime navigation.

## Verification results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | clean |
| `npm run build` + postbuild bundle gate | clean — /sops/[sopId] 1056 KB, Δ 0 KB; walkthrough/pdfjs/konva isolation OK |
| `npx playwright test --project=phase28 --project=phase29 --project=phase30` | 175 passed / 4 skipped / 0 failed |
| **FULL `npm run test`** | **39 failed / 850 passed / 196 skipped** |
| Baseline comparison (30-01: 39F/798P/230S) | The 39 failures match the baseline list EXACTLY (phase3×3, phase11×13, phase12.5×12, phase15×4, phase20×1, phase21-unit×2, phase21.5×1, phase26×3) — **zero NEW failures**; +52 passed = repointed/flipped specs now live |
| `git diff --quiet src/actions/governance.ts src/actions/approvals.ts` | clean (spine byte-unchanged) |
| /pathways coverage | 0 not-mapped (35 routes, all mapped; spec-enforced) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prior-wave live specs invalidated by this plan's mandated changes**
- **Found during:** Task 3 phase30 run
- **Issue:** `admin-nav.spec.ts` (30-03, live) asserted the governance page mounts AdminNav — it's now a shim with no UI; `role-homes.spec.ts` (30-02, live) banned any `'/dashboard'` string in journeys.ts — the 0-not-mapped requirement needs the shim route mapped
- **Fix:** admin-nav spec drops governance from the AdminNav-mounting page list and instead asserts the shim keeps its guard with no nav; role-homes spec asserts journeys maps `/dashboard` EXACTLY once (the shim step) while roles.ts stays clean
- **Files modified:** tests/phase30/admin-nav.spec.ts, tests/phase30/role-homes.spec.ts (not in plan files list)
- **Commit:** `e82b743`

**2. [Rule 1 - Bug] ONE genuinely NEW failure vs baseline: phase25-e2e admin-departments.spec.ts — 30-03 fallout never repointed**
- **Found during:** Task 3 full-suite gate
- **Issue:** "page includes shared sub-nav with Departments tab" asserted the pre-30-03 inline sub-nav (incl. an `/admin/departments` self-link AdminNav doesn't have — Departments folded under Settings). Broken since 30-03, invisible because that wave only ran phase28/29/30. The final gate ("no NEW failures vs 30-01 baseline") owns it
- **Fix:** Repointed to the current contract — page imports AND renders `<AdminNav active="settings"`
- **Files modified:** tests/e2e/admin-departments.spec.ts (not in plan files list)
- **Commit:** `e82b743`

**3. [Rule 1 - Bug] Comment mentions of GovernanceWidget tripped the grep==0 acceptance criterion**
- **Found during:** Task 2 sweep
- **Issue:** Two page.tsx comments referenced the deleted component by name
- **Fix:** Reworded ("the old header/dashboard widget")
- **Commit:** `750367a`

## Deferred Issues

Appended to `deferred-items.md`: `VideoJobIndicator.tsx` + `SopDepartmentEditor.tsx` now have zero mounters (capabilities live in the builder menu / Assign page) — candidate deletions for a future sweep; out of this plan's deletion scope.

## Known Stubs

None — the folded view, shim, header chips, and one-line rows are all fully wired; no placeholder data paths introduced.

## Threat Flags

None new. T-30-08-01 mitigated (approve gate moved verbatim, approvals.ts byte-unchanged — spec-asserted); T-30-08-02 mitigated (same org-scoped `listGovernanceQueue()`, no new query path); T-30-08-03 mitigated (shim guard before redirect, settings keeps the admin guard); T-30-08-SC N/A (no installs).

## Requirements completion

- **UX-03** — complete: one governance surface (folded view + header chips + shim + editor in settings; GovernanceWidget/LibraryReviewCell gone; APR-03/04 verbatim).
- **UX-06** — complete: row half lands here (one-line rows, actions gone); builder half landed in 30-07. Both marked in REQUIREMENTS.md.

## Commits

| Commit | Description |
|--------|-------------|
| `588f24e` | feat(30-08): fold governance queue into /admin/sops needs-attention view |
| `750367a` | feat(30-08): one-line admin rows; delete GovernanceWidget + LibraryReviewCell; repoint specs |
| `e82b743` | test(30-08): journeys final sweep + governance-fold spec live + phase gate green |

## Self-Check: PASSED

SUMMARY + settings/governance pages exist on disk; GovernanceWidget/LibraryReviewCell confirmed deleted; commits 588f24e, 750367a, e82b743, 47559a8 in git log; spine diff clean; full suite matches 30-01 baseline exactly; tsc + build + bundle gate green.
