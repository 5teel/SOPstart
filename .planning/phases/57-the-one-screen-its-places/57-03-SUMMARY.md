---
phase: 57-the-one-screen-its-places
plan: 03
subsystem: data
tags: [inbox, admin-shell, departments, site-editor, capability-matrix]
requires:
  - phase: 57-01
    provides: phase57 project, spec stubs
provides:
  - loadInbox() - the one inbox read behind /governance and the Office
  - getAdminShell() - admin-gated, parameterless shell read
  - DEPT_COLOURS, deriveDepartmentCode (plain module)
  - createDepartment (code derived), updateDepartment/archiveDepartment (session-org filtered), archive refused while in use
  - DepartmentsStrip, SiteWorkspace "New department" create row, SiteEmptyState onDone
affects: [57-04, 57-05, 57-07]
tech-stack:
  added: []
  patterns: [one shared read for page and pin, refusal-checked archive returning counts]
key-files:
  created:
    - src/lib/governance/load-inbox.ts
    - src/actions/shell.ts
    - src/lib/site/departments.ts
    - src/components/admin/site/DepartmentsStrip.tsx
  modified:
    - src/app/(protected)/governance/page.tsx
    - src/actions/departments.ts
    - src/components/admin/site/SiteWorkspace.tsx
    - src/components/admin/site/SiteEmptyState.tsx
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase57/one-query.spec.ts
    - tests/phase57/departments.spec.ts
    - tests/phase54/governance-inbox.spec.ts
    - tests/phase54/admin-machine-panel.spec.ts
    - tests/phase28/governance-queue.spec.ts
    - tests/phase30/governance-fold.spec.ts
    - tests/integration/member-dept.spec.ts
key-decisions:
  - "Completions awaiting sign-off stay out of loadInbox; a spec pins that neither file mentions completions"
  - "Select option '__new' is routed through handleDepartmentChange so the phase51 wiring guard on the select onChange string stays valid"
requirements-completed: []
duration: ~55min
completed: 2026-10-05
---

# Phase 57 Plan 03: Admin data and department tools Summary

/governance now renders `loadInbox()`, the same read `getAdminShell()` counts for the Office; departments are created from a name, refused on remove while in use, and edited from a strip in the site editor.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1. loadInbox, getAdminShell, matrix | f2f3252 | one-query.spec live (5 tests), phase54/28/30/46 green |
| 2. Departments by name, refused on remove | f6a95fc | 8 unit + source-contract tests, live describe passes with PHASE57_LIVE=1 |
| 3. Strip and in-place create | 3be44ad | 6 strip contracts, phase51 + phase26 + token lints green |

Requirements PLC-04, PLC-05, SHL-05 are not ticked: nothing mounts the strip or reads `getAdminShell()` yet (57-05 does), so they are not proven end to end.

## Verification

- `npx tsc --noEmit`: clean after every task.
- `npm run build`: exit 0 after task 3 (`/sops` 818 KB vs baseline 817 KB, +1 KB, unchanged from 57-02; baseline untouched).
- phase57 66 passed / 18 skipped (fixme stubs for later plans); phase54 124; phase46 30; phase28 41; phase30 51; phase51 + phase57 146; phase26 77; phase15-stubs (both token lints) 80; phase25-integration 49 passed.
- `PHASE57_LIVE=1`: the live describe confirms the eval-site "Forming" department has at least one machine, so a remove would be refused. Service-key read only, no session minted.
- Not run: deployed eval (nothing mounts the new pieces yet; 57-10 owns it). No migration in this plan.

## Deviations from Plan

**1. [Rule 3 - Blocking] Stale source guards repointed.** Moving the read into `loadInbox()` broke four guards that grepped the page for `listGovernanceQueue()` or the old variable names: `tests/phase28/governance-queue.spec.ts`, `tests/phase30/governance-fold.spec.ts`, `tests/phase54/admin-machine-panel.spec.ts` (plan only named governance-inbox.spec.ts), and `tests/integration/member-dept.spec.ts` (the colour hex list moved to the plain module). Each now asserts the page calls `loadInbox(` and that the behaviour lives in the new module.

**2. [Plan wording] `getAdminShell` checks `organisationId` and returns `{ error }` before reading placement**, in addition to `requireAdminContext()`.

**3. Archive refusal counts.** `sop_departments` has no `organisation_id` column, so that count carries no org filter; the department itself is first proven to be in the session org, which scopes the rows. The machine count and the archive write both filter by the session org.

## Deferred Issues

`tests/integration/wizard-sop-dept.spec.ts:61` (`DepartmentPicker ... __new__ sentinel`) fails in phase25-integration. It greps a component this plan did not touch (the Phase 40 SOP metadata dialog replaced the picker), so it is a pre-existing failure; not fixed.

## Known Stubs

None. `getAdminShell`, `DepartmentsStrip` and `onDepartmentsChanged` / `onDone` are complete but unmounted until 57-05 (the plan's intent).

## Threat Flags

None new. T-57-08 to T-57-13 are covered by source contracts: `getAdminShell()` takes no parameters and runs `requireAdminContext()` before `loadInbox()`; the placement read filters by the session org; no service-role client in `shell.ts`, `load-inbox.ts` or the three department bodies; the colour stays a `z.enum` and the strip offers only those values; update and archive carry the session-org filter.

## Self-Check: PASSED

- Files exist: load-inbox.ts, shell.ts, departments.ts (lib), DepartmentsStrip.tsx.
- Commits found: f2f3252, f6a95fc, 3be44ad.
- STATE.md and ROADMAP.md not modified; CAPABILITY-MATRIX.md updated in the same commit as `getAdminShell()`.
