---
phase: 57-the-one-screen-its-places
plan: 05
subsystem: ui
tags: [shell, admin, noticeboard, pins, edit-mode, bundle-gate, pathways]
requires:
  - phase: 57-03
    provides: getAdminShell, loadInbox, DepartmentsStrip
  - phase: 57-04
    provides: ShellFrame/WorkerShell, lazy AdminShell seam in OneScreen
provides:
  - AdminShell (lazy): one admin read feeds health pins, Office card, rooms and edit mode
  - AdminMachineBody / AdminSopRows (Walk when published, Edit, New SOP for this machine)
  - AdminRoomBodies (Office, Workshop drafts, Noticeboard with a draft tail)
  - noticeboardSops, healthPinCount in admin-health
  - blank wizard ?machine=<uuid> that links the new SOP through setSopMachines
  - /governance reduced to the inbox; AdminFloorHealth deleted
affects: [57-06, 57-08, 57-09, 57-10]
key-files:
  created:
    - src/components/shell/AdminRoomBodies.tsx
  modified:
    - src/components/shell/AdminShell.tsx
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/lib/sop/admin-health.ts
    - src/app/(protected)/admin/sops/new/blank/page.tsx
    - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
    - src/app/(protected)/governance/page.tsx
    - src/lib/journeys/journeys.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
  deleted:
    - src/components/admin/governance/AdminFloorHealth.tsx
requirements-completed: [PLC-02, PLC-03, PLC-04, PLC-05, SHL-05]
completed: 2026-10-05
---

# Phase 57 Plan 05: Admin one screen Summary

Admins now land on the one screen with red/amber/green machine marks, an Office card whose number equals the Office pin, a Workshop drafts list, an admin Noticeboard (published first, drafts as a tail) and site edit mode with the departments strip. All of it sits in the lazy `AdminShell` chunk. `/governance` is the inbox alone.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1. Admin machine body, room bodies, new SOP for this machine, floor card retired | e12aa42 | phase57, phase54, phase15-stubs green; tsc clean |
| 2. AdminShell seam filled, edit mode, pins/parity specs | 6f63ecc | phase57/26/51 green; build + gate green |
| 3. Matrix, journeys, repoint inventory (57-05 live) | 9d6d010 | phase57/54/46/28/30/41/15-stubs/26/51/52 green (724 passed, 15 skipped fixme stubs for later plans) |

## Bundle gate (build run after Task 3)

| Route | Size | Baseline | Delta |
|-------|------|----------|-------|
| `/sops/[sopId]/page` | 817 KB | 817 | 0 |
| `/sops/page` | 817 KB | 817 | 0 |
| `/page` | 792 KB | 792 | 0 |

`.bundle-baseline.json` is untouched. Konva, pdfjs, mammoth isolation checks and marker self-validation pass. `AdminShell` is referenced only by `OneScreen.tsx`'s `next/dynamic` import.

## Key behaviour

- One `useQuery(['shell-admin'], getAdminShell)` supplies `inboxCount`, which is the single identifier behind the Office pin, the Office card and the Office body. Sign-offs waiting come from `useSupervisorCompletions` and appear only on their own line (opens /activity) and the summary line.
- Machine marks come from `machineHealth`; the Noticeboard pin from `healthPinCount(noticeboardSops(...))`; the Workshop pin is `drafts.length`. The shell classifies nothing (spec asserts no `flags.includes`).
- Edit mode (`?place=edit`): `SiteEditSurface` mounts `['site-org']` only when editing; Done invalidates both reads then exits.
- `?machine=` is kept only if it is a UUID; `setSopMachines` runs after `createSopFromWizard` and before the builder push. A failed link does not block the push (the SOP exists).

## Deviations from Plan

**1. [Rule 3 - Blocking] The floor card was deleted in Task 1, not Task 3.** Rewriting `AdminMachinePanel.tsx` removed the `AdminMachinePanel` export that `AdminFloorHealth` imported, so tsc could not stay green. I deleted `AdminFloorHealth`, trimmed `/governance` to the inbox, and repointed `tests/phase54/admin-machine-panel.spec.ts` and `tests/lint/no-static-admin-lens-import.spec.ts` in the same commit (the plan allowed the delete in Task 1). Task 3 then held only matrix, journeys and the inventory.

**2. [Rule 1 - Bug] The admin-lens import guard matched substrings.** `getAdminShell` in `AdminShell.tsx` tripped the new `AdminShell: []` entry. The regex now requires word boundaries around the symbol. Mutation check: the pattern matches `import { AdminShell } from` and not `import { getAdminShell } from`. (A first attempt with a bare backslash-b inside a template literal silently produced a backspace character and made the guard vacuous; caught by re-testing the regex and fixed.)

**3. [Minor] `src/lib/uat/tests.ts` background text** named `AdminFloorHealth`; reworded to remove the retired token. The UAT questions there still describe the floor card on Governance and belong to the 57-09 "UAT links" sweep.

**4. [Minor] `journeys.ts` line about plant home** now says the admin floor is on the one screen. The `/sops` plant journey itself is 57-08's.

## Known Stubs

None. Workshop and Office worker copy that says requests arrive later is 57-04's, unchanged.

## Threat Flags

None new. T-57-19 (every call from the lazy module is `requireAdminContext()`-gated), T-57-20 (UUID check in the page; `setSopMachines` revalidates against the session org), T-57-21 (admin markers absent from `/page`, lint `AdminShell: []`), T-57-22 (one `inboxCount`, spec-pinned) are covered by source-contract specs.

## Verification

- `npx tsc --noEmit`: clean.
- `npm run build`: green including postbuild gate (numbers above).
- `npx playwright test` projects phase57, phase54, phase46, phase28, phase30, phase41, phase15-stubs, phase26, phase51, phase52: 724 passed, 15 skipped (fixme stubs for 57-06..10), 0 failed.
- Not run: deployed eval (nothing pushed; 57-10 owns it). The edit-mode and Done flow, and the wizard machine link, are verified by source contracts only; a browser run is for 57-10.

## Self-Check: PASSED

- Files exist: AdminRoomBodies.tsx, AdminShell.tsx, AdminMachinePanel.tsx, this SUMMARY; AdminFloorHealth.tsx gone.
- Commits found: e12aa42, 6f63ecc, 9d6d010.
- STATE.md and ROADMAP.md not modified. Nothing pushed.
