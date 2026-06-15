---
phase: 25-department-first-class-entity
plan: "03"
subsystem: departments-actions-and-components
tags: [departments, server-actions, components, integration-spec, phase25]
dependency_graph:
  requires: [25-02]
  provides: [departments-actions-contract, DChip, DepartmentPicker, member-dept-spec]
  affects: [blocks-actions, sops-actions, auth-actions, ai-prompt-route, admin-blocks-page, wizard-client]
tech_stack:
  added: []
  patterns: [requireAdmin-jwt-pattern, replace-semantics-junction, z.enum-colour-allowlist, localOnly-no-server-action]
key_files:
  created:
    - src/actions/departments.ts
    - src/components/admin/departments/DChip.tsx
    - src/components/admin/departments/DepartmentPicker.tsx
    - tests/integration/member-dept.spec.ts
  modified:
    - src/actions/blocks.ts
    - src/actions/sops.ts
    - src/actions/auth.ts
    - src/app/api/sops/ai-prompt/route.ts
    - src/app/(protected)/admin/blocks/page.tsx
    - src/app/(protected)/admin/global-blocks/page.tsx
    - src/app/(protected)/admin/global-blocks/suggestions/page.tsx
    - src/components/admin/blocks/BlockPicker.tsx
    - src/components/admin/blocks/SaveToLibraryModal.tsx
    - src/components/admin/blocks/SuggestionReviewRow.tsx
    - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
    - playwright.config.ts
decisions:
  - "supabase as any cast used for new tables (departments, block_departments, sop_departments, member_departments) not yet in database.types.ts auto-generation — consistent with existing blocks.ts pattern for block_suggestions"
  - "setDepartmentOwner creates a fresh supabase client (not the any-cast ctx.supabase) for the organisation_members check to ensure type safety on the RLS-guarded query"
  - "SuggestionReviewRow.tsx stubbed rather than deleted — full deletion deferred to Wave 4 plan 25-05 alongside the route file deletions"
  - "WizardClient.tsx passes empty departmentIds/allDepartments defaults — full picker integration deferred to Wave 4 plan 25-04"
  - "global-blocks/page.tsx and suggestions/page.tsx redirect to /admin/blocks rather than deleted — Wave 4 will remove the route segments"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-15T02:17:12Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 12
---

# Phase 25 Plan 03: Server Actions + Shared Primitives Summary

**One-liner:** Department CRUD + junction assigners (8 exports, replace-semantics, D-03/D-04), org/global API retired from blocks.ts, createSopFromWizard + AI-prompt route wired to sop_departments, DChip/DepartmentPicker shared components built to UI-SPEC, 13-passing member-dept integration spec registered.

---

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | departments.ts — CRUD, counts, owner, junction assigners | 106a69a | src/actions/departments.ts |
| 2 | blocks.ts + sops.ts + auth.ts modifications | 29b26e3 | src/actions/blocks.ts, sops.ts, auth.ts, ai-prompt/route.ts, blocks/page.tsx, WizardClient.tsx |
| 3 | DChip + DepartmentPicker + member-dept spec | a108074 | src/components/admin/departments/DChip.tsx, DepartmentPicker.tsx, tests/integration/member-dept.spec.ts |

---

## What Was Built

### Task 1: src/actions/departments.ts

New server action file with the complete 8-export contract Wave 4 imports:

- `listDepartments()` — `DepartmentWithCounts[]` with live people/sop/block counts via three separate junction queries, RLS-scoped to caller's org
- `createDepartment()` — insert with `organisation_id` from JWT claims (never client), `colour` validated via `z.enum` of the 8 UI-SPEC hex values (V5 — no CSS injection, T-25-08)
- `updateDepartment()` — partial update with `updated_at` timestamp
- `archiveDepartment()` — sets `archived = true`, never issues DELETE (REQ-6)
- `setDepartmentOwner()` — verifies `userId ∈ organisation_members` for the **same org** before update (D-03, T-25-03)
- `assignMemberDepartments(memberId, ids)` — replace-semantics: delete-then-insert with `assigned_by` (REQ-4)
- `assignBlockDepartments(blockId, ids, allDepartments)` — D-04: `allDepartments=true` sets flag + clears junction; else clears flag + replaces junction rows
- `assignSopDepartments(sopId, ids, allDepartments)` — same D-04 pattern for SOPs

Security: `requireAdmin()` copied verbatim from blocks.ts (JWT claims path, no client trust). All functions return discriminated union, never throw.

### Task 2: Retire org/global API, wire sop_departments

**blocks.ts:**
- Removed `includeGlobal`, `globalOnly` from `ListBlocksOptions`; added `departmentId` filter
- `departmentId` implementation: fetches `block_departments` junction for tagged block IDs, then `.or()` to include `all_departments = true` blocks
- Removed `suggest_global` from `CreateBlockInput.scope` and `SaveFromSectionInput.scope` (only `'org'` remains)
- Removed the `suggest_global` write branch from `saveFromSection`
- Deleted `listBlockSuggestions`, `promoteSuggestion`, `rejectSuggestion`, `requirePlatformAdmin` (A5/A6)

**sops.ts:**
- Extended `CreateSopFromWizardInput` with `departmentIds` + `allDepartments` (REQ-9, D-04)
- Post-insert: if `allDepartments` → update `sops.all_departments = true`; else insert `sop_departments` junction rows

**ai-prompt/route.ts:**
- Threads `departmentIds` + `allDepartments` from request body into the same post-insert dept write (A3)

**auth.ts:**
- Added `department_ids: string[]` to `TeamMember` interface
- `getTeamMembersWithEmails` now fetches `member_departments` per member and populates `department_ids`

**Call-site fixes:**
- `admin/blocks/page.tsx`: removed scope tabs, simplified `listBlocks` call
- `BlockPicker.tsx`: removed `includeGlobal: true`
- `WizardClient.tsx`: added empty `departmentIds/allDepartments` defaults
- `global-blocks/page.tsx` + `suggestions/page.tsx`: redirect to `/admin/blocks`
- `SaveToLibraryModal.tsx`: removed `suggest_global` scope UI
- `SuggestionReviewRow.tsx`: stubbed (suggestions table dropped in migration 00037)

### Task 3: DChip + DepartmentPicker + integration spec

**DChip.tsx** — three variants per UI-SPEC §"Cross-Surface: Department Chip Component Contract":
- `variant='department'`: `var(--paper-2)` bg + `var(--ink-300)` border + 7px colour swatch + optional ` ★`
- `variant='all-departments'`: `rgba(6,182,212,0.06)` bg + `var(--accent-mcu)` border + `◇ All departments` (no swatch)
- `variant='add'`: dashed `var(--accent-step)` border + `＋` + min 44×44px tap target (PWA glove-friendly)

**DepartmentPicker.tsx** — mirrors SubTradePicker with three PATTERNS deltas:
1. `departments` prop passed in (no internal fetch)
2. `selectedIds` prop passed in (no internal state fetch)
3. Colour swatch `<span>` (7px×7px) before each label
- mode=`member`: `assignMemberDepartments` + inline "Set owner / ★ Owner" per assigned dept (D-03)
- mode=`block`/`sop`: `assignBlock/SopDepartments` + "All departments" toggle mutually exclusive with individual IDs (D-04)
- `localOnly` prop: suppresses server action on toggle, fires `onChange` only — wizard create mode (A4)
- `useTransition` optimistic toggle + revert-on-error pattern from SubTradePicker

**member-dept.spec.ts** — 15 tests registered in `phase25-integration` playwright project:
- 13 source-contract tests: all pass (assignMemberDepartments replace-semantics, member_departments DDL, department_ids on TeamMember, setDepartmentOwner org-member check, colour z.enum allow-list, all_departments flag wiring, createSopFromWizard schema)
- 2 runtime stubs: `test.fixme` — activate after migrations applied

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Supabase typed client rejects new table names**
- **Found during:** Task 1 TypeScript check
- **Issue:** `supabase.from('departments')` etc. fail TS2769 because the auto-generated `database.types.ts` doesn't include the new tables yet
- **Fix:** Used `supabase as any` in `requireAdmin()` return type + at call sites, consistent with how `blocks.ts` handles `block_suggestions` (same pattern project-wide)
- **Files modified:** src/actions/departments.ts

**2. [Rule 1 - Bug] Multiple call sites still used retired ListBlocksOptions fields**
- **Found during:** Task 2 TypeScript check + grep scan
- **Issue:** `blocks/page.tsx` used `includeGlobal`/`globalOnly`; `BlockPicker.tsx` used `includeGlobal: true`; `SaveToLibraryModal.tsx` + `SuggestionReviewRow.tsx` used retired `suggest_global`/promotion API; `global-blocks` pages imported retired functions
- **Fix:** Updated all 6 consumer files; stubbed `SuggestionReviewRow.tsx`; redirected global-blocks routes
- **Files modified:** 6 additional files beyond the plan's explicit list

**3. [Rule 1 - Bug] WizardClient.tsx call to createSopFromWizard lacked required new fields**
- **Found during:** Task 2 TypeScript check
- **Issue:** `departmentIds` + `allDepartments` added to Zod schema as `default([])` / `default(false)` but the TypeScript inferred type required them
- **Fix:** Added empty defaults `departmentIds: [], allDepartments: false` at the call site; full picker integration deferred to Wave 4

---

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `SuggestionReviewRow.tsx` renders placeholder text | `src/components/admin/blocks/SuggestionReviewRow.tsx` | Suggestions model retired; route redirects; Wave 4 plan 25-05 deletes the route + component |
| `global-blocks/page.tsx` redirects | `src/app/(protected)/admin/global-blocks/page.tsx` | Wave 4 plan 25-05 deletes the route segment |
| `WizardClient.tsx` passes empty departmentIds | `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` | Full DepartmentPicker integration in wizard deferred to Wave 4 plan 25-04 |

---

## Threat Surface Scan

No new network endpoints or auth paths introduced beyond what the plan's threat model covers. The `assignSopDepartments` in the ai-prompt route uses `departmentIds` from the request body — but these are only inserted into `sop_departments` (UUID values), not reflected to the user or executed as SQL. No injection risk beyond what Supabase parameterised queries already mitigate.

---

## Self-Check

Files created:
- `src/actions/departments.ts` — FOUND
- `src/components/admin/departments/DChip.tsx` — FOUND
- `src/components/admin/departments/DepartmentPicker.tsx` — FOUND
- `tests/integration/member-dept.spec.ts` — FOUND

Commits:
- `106a69a` — FOUND (feat(25-03): create src/actions/departments.ts)
- `29b26e3` — FOUND (feat(25-03): retire org/global model, wire sop_departments)
- `a108074` — FOUND (feat(25-03): DChip + DepartmentPicker shared components)

`npx tsc --noEmit`: CLEAN (0 errors)
`npx playwright test --project=phase25-integration member-dept`: 13 passed, 2 skipped (fixme)

## Self-Check: PASSED
