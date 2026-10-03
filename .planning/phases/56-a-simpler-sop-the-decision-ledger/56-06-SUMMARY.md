---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 06
subsystem: standards
tags: [standards, server-actions, builder-tools-menu, capability-matrix, journeys]
requires: [56-04]
provides:
  - src/lib/validators/standards.ts (schemas, StandardRow, StandardsPanel types)
  - src/actions/standards.ts (listStandards, createStandard, renameStandard, removeStandard, getSopStandardsPanel, setStandardAttachment)
  - BuilderStandardsButton (Tools-menu row + portal modal, data-testid standards-panel)
  - journey label-with-standards; matrix guard reference
affects: [56-09, 61]
key-files:
  created:
    - src/lib/validators/standards.ts
    - src/actions/standards.ts
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStandardsButton.tsx
    - tests/phase56/standards-actions.spec.ts
  modified:
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/lib/journeys/journeys.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "Session client only (RLS write policies from 00069 are the backstop); no service-role client in standards.ts"
  - "Sections are scoped through their SOP (looked up by id + session org); steps, standards and attachments carry organisation_id and are filtered by it"
  - "Attach treats a 23505 as success; detach deletes by standard + target + org"
  - "No ledger write: managing a label is not a decision"
requirements-completed: [SOP-02]
duration: 25min
completed: 2026-10-04
---

# Phase 56 Plan 06: Standards List and Manager Panel Summary

**An admin opens Tools for this SOP, then Standards, and in one panel adds, renames and removes the organisation's standards and puts any of them on the whole SOP, a section or a single converted step, through six guarded server actions.**

## What was built

- **Actions:** every export opens with `requireAdminContext()`, takes the organisation from the session only (no export has an organisation parameter), and filters every standards, attachments, focus-steps and sops query by it. `setStandardAttachment` checks the standard and the target (SOP, section via its SOP, or step) in the org before inserting. `removeStandard` counts attachments first and reports `detached`. Duplicate names map 23505 to `A standard with that name already exists`.
- **Panel:** All standards (rows with used-in-n-places, inline Rename, two-step `Remove — comes off n places`, add input) and On this SOP (Whole SOP row, one row per section, `Steps` disclosure with per-step toggles, `No steps to label yet.` when empty). Toggles are optimistic with rollback and a Saving/Saved line. Attached state is a quiet `font-mono text-micro text-accent-inspect bg-accent-inspect/10` label. Copy says section and step; tokens only.
- **Mount, journey, matrix:** panel rendered after `BuilderMachinesButton`; `builder-review-publish` Tools list rewritten to what the menu holds today; new `label-with-standards` journey; the "Manage standards" matrix row names the action guard.

## Verification

- `npx playwright test --project=phase56`: 70 passed, 14 skipped (56-08 writers and live-gated schema specs). The new spec has 10 tests: guard first, no organisation in signatures, org filter on every chain, 23505 handling, checks before the insert, handler wiring to onClick, no "block" in the panel, journey present, no `/sops` file imports the panel.
- design-tokens, no-undefined-css-tokens, no-dead-internal-hrefs: pass.
- `npx tsc --noEmit` clean; eslint clean on the three new source files. `npm run build` clean; bundle gate /sops and /sops/[sopId] at 818 KB vs 817 KB baseline (within tolerance).

## Deviations from Plan

None. The panel was not exercised in a browser or against the live database here; the deployed eval for it is part of plan 56-10.

## Known Stubs

None.

## Threat Flags

None. All four register threats (T-56-04, T-56-20, T-56-21, T-56-22) are mitigated as planned.

## Task commits

1. Task 1 (validators, actions, source spec): `01e412b`
2. Task 2 (panel, mount, journey, matrix, wiring spec): `57d05d6`

## Self-Check: PASSED

- All four created files present; both commits on master; no file deletions in either commit.
