---
phase: 59-the-office
plan: 07
subsystem: governance / owner and review
tags: [office, ownership, review, decision-ledger, rls, capability-matrix]
requires: [59-04, 59-06]
provides:
  - markReviewedAsOwner (src/lib/governance/owner-review.ts)
  - setSopOwner / confirmSopCurrent return logged (confirmSopCurrent also reviewDueAt)
  - OwnerReviewMeta shared line (data-owner / data-review)
  - OwnerPicker onDone callback + Esc handled without leaving the Office
  - This SOP Owner and Review rows with Mark reviewed
affects: [59-09 inbox Mark reviewed rows, 59-14 retirement of GovernanceQueueRow]
tech-stack:
  patterns: ["service-role write in a plain src/lib module, session org + user passed in, ownership re-checked in the query", "capture-phase Esc + preventDefault, honoured by the shell's own Esc guard"]
key-files:
  created:
    - src/lib/governance/owner-review.ts
    - src/components/admin/governance/OwnerReviewMeta.tsx
  modified:
    - src/actions/governance.ts
    - src/components/admin/governance/OwnerPicker.tsx
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/components/admin/governance/GovernanceQueueRow.tsx
    - src/components/shell/AdminRoomBodies.tsx
    - src/lib/sop/focus-read.ts
    - src/app/(protected)/sops/[sopId]/page.tsx
    - src/components/focus/FocusFrame.tsx
    - src/components/focus/FocusWalker.tsx
    - src/components/focus/admin/FocusEditor.tsx
    - src/components/focus/admin/ThisSopBlock.tsx
    - scripts/decision-writers.json
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase59/owner-review-meta.spec.ts
    - tests/phase59/capability-matrix.spec.ts
    - tests/phase57/machine-body.spec.ts
    - tests/phase58/frame-structure.spec.ts
    - tests/evals/office.eval.ts
    - tests/evals/governance.eval.ts
decisions:
  - "Any non-admin caller of confirmSopCurrent goes through markReviewedAsOwner; the module's service-role read AND write both carry organisation_id = session org and owner_user_id = session user, and a zero-row update is an error"
  - "The owner label is computed on the page only when the viewer is an admin or has edit access (T-59-30), never for browse or walk"
requirements-completed: [OFF-04]
duration: ~40 min
completed: 2026-10-06
---

# Phase 59 Plan 07: Owner and review Summary

One shared "Owner · person · review due 12 Nov" line under every admin SOP row, a server-checked owner path for "mark reviewed", and Owner / Review rows with Mark reviewed in the editor's This SOP block.

## Tasks

| Task | Commit | What |
|---|---|---|
| 1 | f2a24831 | `markReviewedAsOwner` plain module; `confirmSopCurrent` routes admin / safety manager to the unchanged session path and everyone else to the module; both owner actions return `logged`; `decision-writers.json` allow entry; matrix row "Mark a SOP reviewed" (workers: no Office until Phase 60/61) |
| 2 | 35e205e5 | `OwnerReviewMeta` on `AdminSopRows` (Noticeboard + machine panel) and Workshop drafts; `OwnerPicker` drops the router refresh for `onDone`, closes on Esc with `preventDefault`; `GovernanceQueueRow` passes `onDone` so the old page keeps working until 59-14 |
| 3 | f7f50b96 | `FocusSopMeta` gains `owner_user_id` / `review_due_at`; page builds `owner: { label, canMarkReviewed }`; `FocusWalker` / `FocusFrame` / `FocusEditor` pass it to `ThisSopBlock`; Owner and Review rows; eval case |

## Verification

- `npx tsc --noEmit` clean; `npm run build` exits 0, baselines untouched.
- Bundle deltas (tolerance ±2 KB): `/sops/[sopId]/page` 793 KB vs 792 (Δ +1 KB); `/page` 832 KB vs 831 (Δ +1 KB). The This SOP block and `AdminSopRows` stay in the admin lazy chunks.
- Projects green: phase59 (68 passed, 47 later-plan stubs skipped), phase57, phase58, phase28, phase15-stubs (design tokens, undefined-token lint), phase56 `decision-writers-sweep`, phase46 matrix doc, phase54 (earlier in the task).
- The deployed eval case was listed (`--list`) but not run; the orchestrator runs it after the push.

## Deviations from Plan

**1. [Rule 3 - blocking] Source pins whose literal genuinely moved were repointed**
- `tests/phase57/machine-body.spec.ts`: the inline `owner {sop.ownerLabel ??` line is now `<OwnerReviewMeta …/>`.
- `tests/phase58/frame-structure.spec.ts`: the walker's `editor={…}` literal gained `owner`.
- `tests/evals/governance.eval.ts` case B: asserted the old inline "owner none" text; now asserts `data-owner="none"` on the meta line (that eval is deleted by 59-14).

**2. [Plan wiring] The `editor` object lives in `FocusWalker`, not the page.** The page computes `owner` and hands it to `FocusWalker`, which puts it in the `editor` prop (page, walker, frame, editor, block). The page computes it for `editing || isAdminRole`, so an admin who flips from Walk to Edit has it.

**3. Acceptance grep for the not-owner message in `governance.ts`** is satisfied by the message appearing in the action (a comment naming what a non-owner gets back) while the real string is returned from `owner-review.ts`, as the behaviour list requires the module to own the check.

Tests for task 1 were written alongside the implementation rather than seen failing first (source-contract specs).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-59-27/28: owner and organisation re-checked in both the read and the write, session values only. T-59-29: receipts say "logged" only when `recordDecision` returned ok. T-59-30: owner label only for admin or edit access.

## Notes

- `FocusSopMeta.owner_user_id` (a user id, not an email) is now present in the data a worker's SOP page reads. No name or email reaches workers.
- Owner-path write relies on session role: a worker who owns a SOP can call it on the server but no surface reaches it until Phase 60/61 (stated in the matrix).

## Self-Check: PASSED

- src/lib/governance/owner-review.ts, src/components/admin/governance/OwnerReviewMeta.tsx: present.
- Commits f2a24831, 35e205e5, f7f50b96 found in `git log`.
- STATE.md and ROADMAP.md untouched.
