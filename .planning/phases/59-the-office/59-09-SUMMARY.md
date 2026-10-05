---
phase: 59-the-office
plan: 09
subsystem: office pane / inbox
tags: [office, inbox, pane, sign-off, approve, receipts, shell-cache, eval]
requires: [59-03, 59-04, 59-07, 59-08]
provides:
  - "src/components/office/InboxRow.tsx: one row, one button, accordion into SignOffPanel / ApprovePanel"
  - "src/components/office/InboxTab.tsx: useOfficeInbox, InboxChips, InboxTab (cache patch, 200 ms collapse, focus move, empty states)"
  - "src/components/office/OfficePane.tsx: header, role-aware manual-activation tab control, receipt slot, Inbox arm"
  - "OwnerPicker triggerClassName / triggerTestId props"
  - "tests/evals/office.eval.ts: inbox, sign-off (admin + supervisor), owner review, reject, approve, real-org cases"
affects: [59-10, 59-11, 59-12, 59-14, 59-16]
key-files:
  created:
    - src/components/office/InboxRow.tsx
    - src/components/office/InboxTab.tsx
    - src/components/office/OfficePane.tsx
  modified:
    - src/components/admin/governance/OwnerPicker.tsx
    - tests/phase59/office-pane-structure.spec.ts
    - tests/evals/office.eval.ts
key-decisions:
  - "Chip bar and receipt slot live in the pane header (chip state in OfficePane), the list in InboxTab; both read the one OFFICE_INBOX_KEY query so the tab count, chips and list can never disagree"
  - "A cleared row stays rendered as a 'ghost' for 200 ms (max-h collapse) after the refetch says it is gone; under reduced motion it is removed at once"
  - "Row Esc listener is on the document in the capture phase, so the lightbox's own window-capture listener (which swallows its Esc) always runs first"
requirements-completed: []
completed: 2026-10-06
---

# Phase 59 Plan 09: Office pane and Inbox Summary

The Office pane exists as one module nothing imports yet: header, role-aware tabs, reserved receipt slot, chips, rows with exactly one button each, in-place Sign off / Approve panels, owner Mark reviewed rows, the goal-state empty view, and a shell-cache patch that keeps the Office pin equal to the tab count.

Requirements OFF-01..OFF-04 are not ticked: the pane is mounted in 59-12 and proven by the deployed eval in 59-16.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 27fe979e | `InboxRow`, `OwnerPicker` trigger props, six live row cases in `office-pane-structure` |
| 2 | 81d5892b | `OfficePane`, `InboxTab`, nine more live structure cases |
| 3 | 93b4bc2f | ten live eval cases (nine 59-09 plus the real-org read) |

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0. Bundle gate unchanged: `/page` 832 KB (baseline 831, Δ +1 KB), `/sops/[sopId]/page` 793 KB (Δ +1 KB), baseline untouched, nothing imports `OfficePane`.
- phase59 (14 office-pane-structure cases live; whole project plus phase54 and phase15-stubs: 221 passed, 41 later-plan stubs skipped); phase15-stubs includes design-tokens and no-undefined-css-tokens.
- `npx playwright test --list --project=evals office` lists all 16 cases (10 live for 59-07 / 59-09, 6 fixme for 59-10, 11, 13, 15). Evals were authored and listed, not run.

## Deviations from Plan

**1. [Rule 2 - Missing detail] Approve row detail reads "Your approval is next."** The plan's "Step n of N is yours." needs a step index that `GovernanceRow` does not carry; adding it would change the governance data shape. The panel underneath shows "step n of N" in its chain list.

**2. [Minor] Row Esc listener registered on `document` (capture), not `window`.** A window-capture listener registered first would run before the sign-off lightbox's own window-capture handler and collapse the row under an open lightbox. On `document` it runs after, so the lightbox swallows its Esc and the row never sees it.

**3. [Minor] Eval seeds the approve chain in each draft's `approval_snapshot` only, no `approval_chains` row.** `approveStep` reads the snapshot; writing a chain for a category would change the shared eval-site org's real chain behaviour. Drafts are owned by the admin so the approval is their only inbox row.

**4. [Minor] `confirmSopCurrent(` appears once in `InboxRow`** (a shared `markReviewed(sopId)` helper used by both the governance and owned-review branches), not on two lines. The structure spec pins both branches to that helper.

**5. [Minor] `OwnerPicker` gained `triggerClassName` / `triggerTestId`** (not in the plan's file list) so its trigger is the row's one button with the neutral row style and test id; defaults keep every other caller unchanged.

Tests were written alongside the components (source-contract specs), not seen failing first.

## Eval notes for 59-16

- Sign-off rows share the walk fixture SOP's title, so cases tell them apart by photo count (1, 2, 3, 4).
- The approve case annotates `approve-outcome` (`published` or `refused-by-gate`); the gate was not run here, so which one happens is unrecorded until 59-16.
- Lightbox is located by `.yarl__root`; the worker reject check reads the Phase 57 worker Office card's "Sent back: n" line (before + 1).

## Known Stubs

None. The Decisions, People and Access arms are intentionally absent until 59-10 and 59-11, before the pane is mounted.

## Threat Flags

None beyond the register. T-59-35: rows only show a button, actions keep their server guards. T-59-36: no router, no navigation from an effect, tab changes through `select()` (spec-pinned). T-59-37: "logged" suffix only when `logged === true`; a failed ledger write reads in the escalate colour. T-59-38: every seed calls `assertEvalOrg()`; the real-org case is read-only. T-59-38b: the supervisor case asserts the unsupervised worker's walk (and email) is absent.

## Self-Check: PASSED

- Files exist: InboxRow.tsx, InboxTab.tsx, OfficePane.tsx, office.eval.ts, this SUMMARY.
- Commits 27fe979e, 81d5892b, 93b4bc2f in `git log`.
- STATE.md and ROADMAP.md untouched.
