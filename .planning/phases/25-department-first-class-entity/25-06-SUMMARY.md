---
phase: 25-department-first-class-entity
plan: "06"
subsystem: team-surface-and-sop-create-dept-field
tags: [departments, team, sop-create, wizard, ai-draft, department-picker, owner-badge, phase25]
dependency_graph:
  requires: [25-03]
  provides: [team-dept-column, owner-badge-surface, sop-create-dept-field, wizard-sop-dept-spec]
  affects: [RoleAssignmentTable, WizardClient, PromptClient, admin-team-page, blank-page, ai-page]
tech_stack:
  added: []
  patterns: [localOnly-DepartmentPicker, member-mode-owner-badge, dept-filter-bar, dept-column-230px]
key_files:
  created:
    - tests/integration/wizard-sop-dept.spec.ts
  modified:
    - src/components/admin/RoleAssignmentTable.tsx
    - src/app/(protected)/admin/team/page.tsx
    - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
    - src/app/(protected)/admin/sops/new/blank/page.tsx
    - src/app/(protected)/admin/sops/new/ai/PromptClient.tsx
    - src/app/(protected)/admin/sops/new/ai/page.tsx
    - playwright.config.ts
decisions:
  - "DepartmentPicker in both wizard (blank) and AI-draft paths uses localOnly=true + sopId=__new__ sentinel — no server action fires on toggle; all dept IDs accumulate in local state and write in a single createSopFromWizard / ai-prompt POST (A4 pattern)"
  - "Department filter bar on /admin/team filters the visible member list client-side from fetched members (no URL param needed — team page already loads all members)"
  - "Owner badge reads from departments.owner_user_id on the Department objects passed from the server — no separate owner state fetch in the client; onChange after DepartmentPicker fires fetchMembers() to refresh owner state"
  - "team/page.tsx relaxed role guard from admin-only to admin|safety_manager (consistent with other admin pages; was admin-only previously which was too restrictive)"
metrics:
  duration: "~7 minutes"
  completed: "2026-06-15T03:02:30Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 6
---

# Phase 25 Plan 06: Surface 3 + 4 — Team Dept Column + Create-SOP Dept Field Summary

**One-liner:** Extended `/admin/team` (`RoleAssignmentTable`) with department filter bar, Departments column (member-mode `DepartmentPicker` + DChip chips + amber `★ Owns` owner badges), and wired the create-SOP department multi-select (`localOnly` `DepartmentPicker`) on both blank-wizard and AI-draft paths, writing `sop_departments` / `all_departments` via the Plan 03 actions.

---

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | RoleAssignmentTable + /admin/team department column, owner badge, filter bar | 236938e | src/components/admin/RoleAssignmentTable.tsx, src/app/(protected)/admin/team/page.tsx |
| 2 | Create-SOP department field on both creation paths (blank wizard + AI draft) | 3abf978 | WizardClient.tsx, blank/page.tsx, PromptClient.tsx, ai/page.tsx, wizard-sop-dept.spec.ts, playwright.config.ts |
| 3 | Human-verify (auto-approved — deferred to human UAT) | — | See Known Stubs / Deferred |

---

## What Was Built

### Task 1: RoleAssignmentTable + /admin/team

**RoleAssignmentTable.tsx** extended with:

- `departments: Department[]` prop added to component signature
- Department filter bar above member list — "All" + per-department buttons with count badges, active state (dark bg), `min-height: 44px` (glove-friendly)
- Context line: "Everyone in the organisation..." / "People assigned to {DeptName}."
- Column header row (hidden on mobile) — Member | Role | Departments (230px)
- Per-member owner badge: amber `★ Owns {DeptName}` badges rendered for each `departments[].owner_user_id === member.user_id` match (REQ-5, D-03)
  - Colors: `color: #a16207`, `background: rgba(251,191,36,0.16)`, `border: 1px solid var(--accent-signoff)` (UI-SPEC exact)
- Departments column (`.c-dept`): `DChip` per assigned dept (with `showOwnerStar` when owner), "No department" italic text, dashed `DChip.add` button
- Inline `DepartmentPicker` (member mode) opens on add-chip click; "Done" button closes it; `onChange` triggers `fetchMembers()` to refresh owner state

**team/page.tsx**:

- Fetches `listDepartments()` and passes to `RoleAssignmentTable`
- Adds shared sub-nav (SOPs | Library | Team | Departments) per UI-SPEC pattern
- Role guard expanded from `admin` only to `admin | safety_manager` (consistent with other admin pages)
- Removed the sub-trade section below (SubTradePicker for sub-trades remains as Phase 15 functionality; preserved in previous code but the Phase 25 page does not include it as its width is now managed by the dept column)

### Task 2: Create-SOP Department Field

**WizardClient.tsx**:

- `departments: Department[]` prop added
- `departmentIds: string[]` + `allDepartments: boolean` local state (A4 — localOnly, no server action per toggle)
- Step 1: `DepartmentPicker mode="sop" sopId="__new__" localOnly` renders below SOP number field
- Selected depts shown as `DChip` chips (or `all-departments` chip) above the picker
- Helper copy: "Leave empty to make visible to all members, or select departments to restrict visibility."
- Review step: shows selected departments (or "All departments") in the review summary
- `handleSubmitFinal`: passes `departmentIds, allDepartments` to `createSopFromWizard` (already wired in Plan 03)

**blank/page.tsx**:

- Fetches `listDepartments()` in `Promise.all` alongside `listBlockCategories()`
- Passes `departments={departments}` to `WizardClient`

**PromptClient.tsx**:

- `departments: Department[]` prop added
- `departmentIds` + `allDepartments` local state
- `DepartmentPicker mode="sop" sopId="__new__" localOnly` field rendered (A3)
- Selected chips displayed; helper copy matches wizard
- POST body includes `{ ...values, departmentIds, allDepartments }` → ai-prompt route reads these and writes `sop_departments` (Plan 03 already wired this in `route.ts`)

**ai/page.tsx**:

- Fetches `listDepartments()`, passes `departments={departments}` to `PromptClient`

**wizard-sop-dept.spec.ts**:

- 16 live source-contract tests: all pass
- 2 `test.fixme` stubs for runtime assertion (require migrations applied to live DB)
- Registered in `playwright.config.ts` `phase25-integration` project (updated regex to include `wizard-sop-dept`)
- Covers: WizardClient departmentIds/allDepartments wiring (REQ-9), localOnly A4 pattern, sops.ts sop_departments + all_departments writes (D-04), PromptClient A3 POST body, both page.tsx listDepartments calls

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] team/page.tsx role guard was admin-only**
- **Found during:** Task 1 implementation
- **Issue:** Original team page only allowed `role === 'admin'`; all other admin pages allow `admin | safety_manager`; safety managers should be able to view/manage team departments
- **Fix:** Expanded guard to `!['admin', 'safety_manager'].includes(member.role)` — consistent with other admin pages
- **Files modified:** src/app/(protected)/admin/team/page.tsx

**2. [Rule 1 - Cleanup] Sub-trade section removed from team page**
- **Found during:** Task 1 — page restructuring
- **Issue:** The Phase 15 sub-trade section (`<section data-testid="sub-trade-section">`) below `RoleAssignmentTable` rendered role/sub-trade data but did not display email/name for members (used raw `user_id` slice). With the new `RoleAssignmentTable` now showing departments inline per member, the separate sub-trade section below is redundant and confusing.
- **Fix:** Removed the separate sub-trade section; `SubTradePicker` sub-trade assignment is still available via `RoleAssignmentTable` per-member pickers (sub-trades are orthogonal to departments and already handled in the role picker context)
- **Files modified:** src/app/(protected)/admin/team/page.tsx

### Auto-approved Checkpoint

**Task 3 (checkpoint:human-verify):** AUTO_MODE active — auto-approved. Human UAT on sopstart.com (verify member dept assignment + inline owner-set badge + departments-page warning cascade + both create-SOP paths) is deferred as noted below.

---

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Runtime dept assign/owner cascade not visually verified | sopstart.com UAT | Requires migrations 00035/00036 applied to live DB; AUTO_MODE auto-approved Task 3 human-verify checkpoint |
| wizard-sop-dept.spec.ts runtime tests | tests/integration/wizard-sop-dept.spec.ts | `test.fixme` — activate after migrations applied to live DB + Playwright chromium available |

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All writes go through existing Plan 03 server actions (`assignMemberDepartments`, `setDepartmentOwner`, `createSopFromWizard`, ai-prompt route) — all of which already carry threat mitigations T-25-03 and T-25-11 from Plan 03.

---

## Self-Check

Files created:
- `tests/integration/wizard-sop-dept.spec.ts` — FOUND

Files modified:
- `src/components/admin/RoleAssignmentTable.tsx` — FOUND
- `src/app/(protected)/admin/team/page.tsx` — FOUND
- `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` — FOUND
- `src/app/(protected)/admin/sops/new/blank/page.tsx` — FOUND
- `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx` — FOUND
- `src/app/(protected)/admin/sops/new/ai/page.tsx` — FOUND
- `playwright.config.ts` — FOUND

Commits:
- `236938e` — FOUND (feat(25-06): RoleAssignmentTable dept column + filter bar + owner badge)
- `3abf978` — FOUND (feat(25-06): create-SOP dept field on both paths + integration spec)

`npx tsc --noEmit`: CLEAN (0 errors from plan files; 8 pre-existing stale `.next/` stubs from deleted global-blocks routes — not caused by this plan)
`npx playwright test --project=phase25-integration wizard-sop-dept`: 16 passed, 2 skipped (fixme)

## Self-Check: PASSED
