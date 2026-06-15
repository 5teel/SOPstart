---
phase: 25-department-first-class-entity
plan: "04"
subsystem: departments-admin-surface
tags: [departments, admin-page, DepartmentCard, DepartmentGrid, DepartmentFormModal, e2e-spec, phase25]
dependency_graph:
  requires: [25-03]
  provides: [admin-departments-route, DepartmentCard, DepartmentGrid, DepartmentFormModal, phase25-e2e-spec]
  affects: [journeys.ts, playwright.config.ts]
tech_stack:
  added: []
  patterns: [SSR-auth-guard-pattern, fixed-swatch-colour-picker, source-contract-e2e-spec, no-owner-warning-as-feature]
key_files:
  created:
    - src/components/admin/departments/DepartmentCard.tsx
    - src/components/admin/departments/DepartmentGrid.tsx
    - src/components/admin/departments/DepartmentFormModal.tsx
    - src/app/(protected)/admin/departments/page.tsx
    - tests/e2e/admin-departments.spec.ts
  modified:
    - playwright.config.ts
    - src/lib/journeys/journeys.ts
decisions:
  - "DepartmentGrid owns the h1 + CTA (client component) rather than page.tsx (server) — avoids server/client boundary issue with button onClick for modal open"
  - "Owner info rendered from DepartmentWithCounts.owner_user_id null check — owner display name deferred to runtime (client can fetch or pass from parent); card shows no-owner warning immediately when owner_user_id is null"
  - "Task 4 human-verify checkpoint auto-approved per AUTO_MODE=ACTIVE directive — real visual UAT deferred to post-deploy on sopstart.com"
  - "journeys.ts: only added manage-departments journey; curate-globals removal deferred to plan 25-05 alongside global-blocks route deletion"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-15T02:34:00Z"
  tasks_completed: 3
  tasks_total: 4
  files_created: 5
  files_modified: 2
---

# Phase 25 Plan 04: /admin/departments Management Page Summary

**One-liner:** SSR departments page + DepartmentCard (stripe/cdot/owner/stats) + DepartmentGrid (2-col grid/add-card/archived toggle) + DepartmentFormModal (8-swatch picker/owner selector) + 20-passing source-contract e2e spec registered in playwright.config.ts.

---

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | DepartmentCard + DepartmentFormModal | 34b1a11 | src/components/admin/departments/DepartmentCard.tsx, DepartmentFormModal.tsx |
| 2 | DepartmentGrid + /admin/departments route + journeys | 469e52e | src/components/admin/departments/DepartmentGrid.tsx, src/app/(protected)/admin/departments/page.tsx, src/lib/journeys/journeys.ts |
| 3 | Create + register e2e smoke spec | db36581 | tests/e2e/admin-departments.spec.ts, playwright.config.ts |
| 4 | Human-verify (auto-approved — AUTO_MODE active) | — | Deferred to post-deploy UAT on sopstart.com |

---

## What Was Built

### Task 1: DepartmentCard + DepartmentFormModal

**DepartmentCard.tsx** — per UI-SPEC §"Department Card Anatomy":
- 6px left colour stripe (`flex: 0 0 6px`, `background: department.colour`)
- `.cdot`: 26×26px rounded box with department icon/first-letter, ink-900 bg on archived
- Name h3 (15px/700) + code line (`{CODE} · department`, 10px uppercase JetBrains Mono)
- `⋯` overflow button (44px touch target) with inline edit/archive dropdown
- Owner block filled: 24×24 ink-900 avatar initials, "OWNER" label (9px uppercase), `{Name} · {Role}` (12px/600 ellipsis)
- Owner block `.owner.empty` no-owner warning: dashed `var(--accent-hazard)` border, `rgba(239,68,68,0.10)` avatar with `!`, red "No owner assigned — set one" — D-03/REQ-5 governance gap feature, deliberately styled as accountability signal, not error
- Stats row: 3 equal cells People/SOPS/BLOCKS with 17px/700 counts + 9px uppercase labels
- Archived: `opacity: 0.5`, greyed stripe (`var(--ink-300)`), "ARCHIVED" label

**DepartmentFormModal.tsx** — per UI-SPEC §"Create / Edit Department":
- Fixed 8-swatch colour radio picker (no free-form input — V5, T-25-08 CSS injection prevention)
- All 8 palette hex values: `#f97316` `#3b82f6` `#06b6d4` `#10b981` `#ec4899` `#ef4444` `#fbbf24` `#8b5cf6`
- Code auto-uppercased, max 6 chars, monospace display
- Icon: optional emoji/char, preview in cdot swatch
- Owner: searchable org-member list with "No owner" clear option
- Duplicate code error: "That code is already in use. Choose a unique code for this department." (UI-SPEC copy)
- Wires `createDepartment` / `updateDepartment` from Plan 03 actions; `useTransition` for pending state

### Task 2: DepartmentGrid + /admin/departments route + journeys

**DepartmentGrid.tsx** (client component):
- Page header row: h1 "Departments" (22px/700 JetBrains Mono) + "＋ New department" CTA (ink-900 bg, 44px min-height) — both open the create modal
- 2-col grid (`grid-template-columns: repeat(2, 1fr); gap: 14px`), single-col < 768px via inline media query
- Dashed add-card: `border: 1.5px dashed var(--ink-300)`, `min-height: 200px`, hover → `var(--accent-step)` blue; "NEW DEPARTMENT" uppercase label
- "Show archived (N)" toggle below grid when archived depts exist
- Empty state: "No departments yet" + sub-text + italicised owner accountability note
- Archive flow: `window.confirm` with UI-SPEC copy, then `archiveDepartment()` server action, optimistic update via `useState`
- Edit flow: `openEditModal(dept)` → passes dept to `DepartmentFormModal`, modal success updates local state

**page.tsx** (SSR server component):
- Auth: `createClient()` → `auth.getUser()` → `organisation_members` role check → `redirect('/dashboard')` for non-admin/safety_manager (REQ-1, T-25-01)
- Fetches: `listDepartments()` (DepartmentWithCounts[]) + `getTeamMembersWithEmails()` for owner selector
- Shared sub-nav: SOPs | Library | Team | Departments — Departments tab active (`border-bottom: 2px solid var(--ink-900)`)
- Sub-heading copy from UI-SPEC: "A first-class entity. SOPs, blocks and people all reference departments…"
- Passes `departments` + `orgMembers` to `<DepartmentGrid />`

**journeys.ts** updates:
- Added `manage-departments` journey (group: 'Library & team', route: `/admin/departments`)
- Updated `manage-team` step detail to include departments

### Task 3: e2e smoke spec + registration

**tests/e2e/admin-departments.spec.ts** — 22 tests (20 source-contract + 2 fixme runtime stubs):
- 5 tests: DepartmentCard anatomy (stripe, cdot, owner block, no-owner warning, archived)
- 5 tests: DepartmentGrid contracts (add-card copy, DepartmentCard wiring, archive toggle, action wiring, empty state)
- 5 tests: page.tsx contracts (listDepartments, auth guard, DepartmentGrid prop, sub-nav, copywriting)
- 5 tests: DepartmentFormModal contracts (8-swatch picker, code uppercase, owner selector, action wiring, duplicate error)
- 2 fixme: runtime stubs (page load + card render after chromium install + db push)

**playwright.config.ts** — `phase25-e2e` project added:
```ts
{ name: 'phase25-e2e', testMatch: /admin-departments\.(test|spec)\.ts$/, use: { browserName: 'chromium' } }
```
`npx playwright test --list | grep admin-departments` → 22 tests listed (registration confirmed).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Server component cannot contain onClick handler for modal trigger**
- **Found during:** Task 2 initial draft
- **Issue:** The plan said to put the "＋ New department" header CTA in the page.tsx (server component), but a `button onClick` in a server component causes a hydration error (`onClick` is a client prop)
- **Fix:** Moved h1 + CTA into `DepartmentGrid.tsx` (client component), which already owns the modal open state. Page.tsx renders only static SSR content (sub-heading + sub-nav) then `<DepartmentGrid />`. Clean server/client boundary.
- **Files modified:** src/components/admin/departments/DepartmentGrid.tsx, src/app/(protected)/admin/departments/page.tsx

### Task 4: Human-Verify Checkpoint — Auto-Approved (AUTO_MODE)

Per the execution prompt `<auto_mode>` directive, the `type="checkpoint:human-verify"` Task 4 is auto-approved. Real visual UAT is deferred to post-deploy on sopstart.com per the Railway-only testing memory note.

**Deferred UAT checklist** (for human to run at sopstart.com post-deploy):
1. Sign in as admin → visit `/admin/departments`
2. Verify: one card per department with colour stripe, code, owner line, People/SOPs/Blocks counts
3. General department (auto-created by migration 00036) shows red "No owner assigned — set one" warning
4. Click "＋ New department" → modal opens → create (name + code + swatch + optional icon + optional owner) → card appears
5. Set owner on a card → red warning clears, owner line shows "{Name} · {Role}"
6. Archive a department → card leaves active grid; "Show archived" reveals it greyed at 0.5 opacity; junction history preserved

---

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `DepartmentCard` receives `owner={null}` from DepartmentGrid — owner display name not resolved | src/components/admin/departments/DepartmentGrid.tsx | Owner name lookup requires either a separate DB query per card or passing owner data from listDepartments (which returns owner_user_id only, not the user's name). Deferred: either extend listDepartments to join auth.users via admin client, or pass owners map from page.tsx. Card correctly shows no-owner warning when owner_user_id is null; filled state will work once owner data is plumbed. |
| Runtime fixme stubs in e2e spec | tests/e2e/admin-departments.spec.ts | Require chromium binary + db push + running app |

---

## Threat Surface Scan

No new network endpoints or trust boundaries beyond what the plan's threat model covers. The `/admin/departments` page is SSR-only and auth-gated. `DepartmentFormModal` calls server actions (createDepartment/updateDepartment) which are already validated by Plan 03's Zod schema + requireAdmin guard.

---

## Self-Check

Files created:
- `src/components/admin/departments/DepartmentCard.tsx` — FOUND
- `src/components/admin/departments/DepartmentGrid.tsx` — FOUND
- `src/components/admin/departments/DepartmentFormModal.tsx` — FOUND
- `src/app/(protected)/admin/departments/page.tsx` — FOUND
- `tests/e2e/admin-departments.spec.ts` — FOUND

Commits:
- `34b1a11` — feat(25-04): DepartmentCard + DepartmentFormModal — FOUND
- `469e52e` — feat(25-04): DepartmentGrid + /admin/departments route + journeys — FOUND
- `db36581` — feat(25-04): add admin-departments e2e smoke spec + register in playwright.config.ts — FOUND

`npx tsc --noEmit`: CLEAN (0 errors)
`npx playwright test --project=phase25-e2e`: 20 passed, 2 skipped (fixme)
`npx playwright test --list | grep admin-departments`: 22 tests listed — registration confirmed

## Self-Check: PASSED
