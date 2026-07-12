---
phase: 29-approval-chains
plan: 03
subsystem: ui
tags: [nextjs-server-components, react, dnd-kit, playwright, governance]

requires:
  - phase: 29-02
    provides: setApprovalChain/getApprovalChains actions, chainStepSchema validation, requireAdmin() with role, ChainStep type
provides:
  - src/components/admin/governance/ApprovalChainEditor.tsx (category picker + 1-4 step dnd-kit editor, wired to setApprovalChain)
  - Approval chains config panel mounted on /admin/governance (no new route)
affects: [29-04 (ApprovalChainPanel in builder PublishStage), 29-05 (GovernanceQueueRow Approve action, version history)]

tech-stack:
  added: []
  patterns:
    - "ApprovalChainEditor is presentational + local edit state only — all data (categories, members, chains) fetched server-side by governance/page.tsx and passed as props, mirroring PublishStage's controlled/presentational contract"
    - "dnd-kit drag-reorder copies the Phase 26 ArrayFieldEditor idiom verbatim (DndContext/SortableContext/useSortable/restrictToVerticalAxis) — no new drag logic invented"

key-files:
  created:
    - src/components/admin/governance/ApprovalChainEditor.tsx
    - tests/phase29/approval-chain-editor.spec.ts
  modified:
    - src/app/(protected)/admin/governance/page.tsx

key-decisions:
  - "Distinct sops.category values fetched with a plain .select('category') + JS Set dedupe — no new table/RPC, per RESEARCH Don't Hand-Roll"
  - "Member picker reuses getOrgMembers() (already reused 3x in 29-02) filtered client-side to admin/safety_manager, matching chainStepSchema's role enum"

requirements-completed: [APR-01]

duration: ~20min
completed: 2026-07-12
---

# Phase 29 Plan 03: Approval Chains Config UI Summary

**ApprovalChainEditor — a category picker plus a 1-4 step dnd-kit drag-order editor (role-or-member per step, restricted to admin/safety_manager) mounted as a panel on the existing /admin/governance page and wired to setApprovalChain.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- `ApprovalChainEditor.tsx` — category `<select>` loads that category's existing chain into local edit state; 1-4 step rows each toggle role (admin/safety_manager only) vs named member (filtered `getOrgMembers()` list); `@dnd-kit/core` + `@dnd-kit/sortable` reorder copied from the Phase 26 `ArrayFieldEditor` idiom; Save button calls `setApprovalChain(category, steps)` inside a `useTransition`, surfaces `{ error }` inline, `router.refresh()` on success.
- `/admin/governance/page.tsx` now fetches distinct `sops.category` values, `getApprovalChains()`, and `getOrgMembers()` (filtered to admin/safety_manager) server-side and renders the panel below the existing queue list — no new route (D29-05), queue/filter behavior untouched.
- `tests/phase29/approval-chain-editor.spec.ts` — source-contract proof of dnd-kit imports, role restriction, wired save handler, step-count bounds, and that no new route file was added.

## Task Commits

1. **Task 1: ApprovalChainEditor.tsx — category picker + 1-4 step dnd-kit editor** - `a1aebaf` (feat)
2. **Task 2: Mount the editor on /admin/governance + source-contract spec** - `47a2548` (feat)

## Files Created/Modified

- `src/components/admin/governance/ApprovalChainEditor.tsx` - category picker + step editor, dnd-kit reorder, wired to setApprovalChain
- `src/app/(protected)/admin/governance/page.tsx` - server-fetches categories/members/chains, mounts ApprovalChainEditor panel
- `tests/phase29/approval-chain-editor.spec.ts` - source-contract spec (phase29 project, no config edit needed — broad testMatch already covers it)

## Decisions Made

- Category list derived from `sops.category` directly (simple select + JS dedupe), no new table, per PATTERNS.md § 5.
- Member options filtered to admin/safety_manager in the page (server) and re-validated by the existing `chainStepSchema` refine on save — belt-and-suspenders, not a new validation path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required, no new dependencies (dnd-kit already installed Phase 26), no schema changes.

## Next Phase Readiness

- Admins can now define, reorder, and save per-category approval chains from the existing governance page.
- `getApprovalStatus`/`getApprovalHistory` (29-02) are unconsumed by any UI yet — ready for 29-04 (builder `PublishStage` panel) and 29-05 (`GovernanceQueueRow` Approve action + version history display) to build directly on top.
- `npx tsc --noEmit` and `npm run build` both clean; bundle gate unaffected (admin-only surface, Δ0 KB on the worker-facing `/sops/[sopId]` bundle).
- `/pathways` unaffected — no new route added, existing `/admin/governance` journey entry already covers this page.
- No blockers.

---
*Phase: 29-approval-chains*
*Completed: 2026-07-12*

## Self-Check: PASSED
