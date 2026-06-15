---
phase: 25-department-first-class-entity
verified: 2026-06-15T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Cross-tenant isolation (REQ-1 acceptance)"
    expected: "A department created in org A is invisible to org B — logged in as org B admin, /admin/departments shows zero of org A's departments"
    why_human: "RLS policy correct in migration but cross-org session isolation needs a live two-org browser session to confirm"
  - test: "Worker SOP visibility gate — Forming vs Cleaning (REQ-3 / D-02 acceptance)"
    expected: "A worker assigned only to Forming sees Forming-tagged SOPs and does NOT see Cleaning-only SOPs in /sops; RLS additive-OR gate functioning"
    why_human: "The /sops page client-side filter is deferred (passes all SOPs through, relying on RLS); needs a live session as a worker user with only Forming membership to confirm RLS gate holds"
  - test: "Member dept assignment persists member_departments row (REQ-4 / REQ-9 acceptance)"
    expected: "Assigning a member to Forming via /admin/team DepartmentPicker writes a member_departments row; removing it removes only that row"
    why_human: "The picker action path is wired (DepartmentPicker → assignMemberDepartments server action) but live DB write + row verification requires an authenticated admin session"
  - test: "Create-SOP wizard writes sop_departments rows (REQ-9 / REQ-3 acceptance)"
    expected: "Creating a SOP with two departments selected (blank wizard or AI wizard) persists two sop_departments rows in the DB"
    why_human: "Code path confirmed (WizardClient → createSopFromWizard action → sop_departments insert; PromptClient → ai-prompt API → sop_departments insert) but end-to-end row write needs live test"
  - test: "No-owner warning state renders red on department card (REQ-5 / REQ-6 acceptance)"
    expected: "A department with no owner shows red dashed border + '!' icon + 'No owner assigned — set one' text; setting an owner clears it and shows '★ Owns {Dept}' badge on the team row"
    why_human: "Code renders the correct conditional branches (DepartmentCard lines 244–350, RoleAssignmentTable line 449) but the visual state and live owner-set flow need browser confirmation"
  - test: "Block all_departments filter in /admin/blocks (REQ-2 / REQ-7 acceptance)"
    expected: "An all_departments=true block surfaces under every department filter; a block tagged only to Forming does NOT appear under Quality filter"
    why_human: "listBlocks accepts departmentId filter param and page passes dept param from searchParams; live filter click behaviour with real data needs browser verification"
  - test: "Global block data integrity post-migration (REQ-8 acceptance)"
    expected: "Zero blocks have organisation_id=null (confirmed via evidence: live DB query returned 0); all previously-global blocks readable by org and surface under 'All departments' chip in /admin/blocks"
    why_human: "The zero-null-org count is confirmed from prior session DB query. Rendering under 'All departments' in the live block library UI needs one browser check"
---

# Phase 25: Department as a First-Class Entity — Verification Report

**Phase Goal:** Introduce an org-scoped `departments` table as a first-class entity with many-to-many junctions to blocks, SOPs, and members; replace the Phase 13 org-vs-global block model and the free-text SOP `category`; deliver `/admin/departments`, block-library dept tagging/filter, team dept assignment+ownership, create-SOP dept field, and journeys.ts update.

**Contract:** 25-SPEC.md requirements 1–9 + 25-CONTEXT.md decisions D-01, D-02, D-02a, D-03, D-04

**Verified:** 2026-06-15
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `departments` table exists, org-scoped via RLS; cross-tenant isolation enforced | VERIFIED | `00035_departments_schema.sql` creates table + `departments_org_read` policy using `current_organisation_id()`; RLS enabled |
| 2 | `block_departments`, `sop_departments`, `member_departments` junctions exist with many-to-many rows | VERIFIED | All three tables created in 00035 with PK `(block_id, department_id)` etc.; live DB shows 74 / 12 / 0 rows |
| 3 | `blocks.all_departments = true` makes a block appear under every department filter | VERIFIED | Column added in 00035; migration 00036 sets `all_departments=true` for all 65 converted global blocks; `listBlocks` uses this flag |
| 4 | Worker assigned only to Forming sees Forming SOPs and not Cleaning-only SOPs (RLS) | VERIFIED (code) / HUMAN (runtime) | `sops_visible_by_department` policy added in 00035 using `sop_in_user_departments()` SECURITY DEFINER helper (D-02a); additive-OR composition (D-02) confirmed in migration comment; live session check deferred to human UAT |
| 5 | `/admin/departments` renders one card per department with People/SOPs/Blocks counts, create/edit/archive, and owner setter | VERIFIED | Page route exists at `src/app/(protected)/admin/departments/page.tsx`; `listDepartments()` returns `DepartmentWithCounts` with counts computed from junctions; `DepartmentGrid` + `DepartmentCard` render all required anatomy |
| 6 | "No owner assigned" warning state renders; setting an owner clears it and shows "★ Owns {Dept}" on team row | VERIFIED (code) / HUMAN (visual) | `DepartmentCard` lines 244–350 branch on `department.owner_user_id && owner`; `RoleAssignmentTable` line 449 renders `★ Owns {d.name}` badge; `setDepartmentOwner` verifies org membership (D-03) |
| 7 | `/admin/global-blocks` and `/admin/global-blocks/suggestions` routes deleted; no My/Global scope control remains | VERIFIED | `ls` confirms route directory does not exist; `grep global-blocks src/` returns only code comments and `platform-admin-guard.ts` comment — zero live route refs; `journeys.ts` has no global-blocks references |
| 8 | After migration, zero blocks have `organisation_id=null`; all previously-global blocks available under "All departments" | VERIFIED (DB) / HUMAN (UI) | Live DB query (prior session) confirmed 0 null-org blocks; migration 00036 performs per-org copy of 65 globals with `all_departments=true` then deletes null-org originals with fail-fast assertion; UI rendering needs browser check |
| 9 | Create-SOP flow writes `sop_departments` rows; `/admin/team` writes `member_departments` rows | VERIFIED (code) / HUMAN (runtime) | `createSopFromWizard` (actions/sops.ts lines 562–574) and ai-prompt API route (lines 80–86) both write `sop_departments`; `DepartmentPicker` mode="member" calls `assignMemberDepartments` (line 117); blank wizard (`WizardClient`) and AI wizard (`PromptClient`) both wire department state to the action |

**Score:** 9/9 truths verified at code level. 7 items require human browser UAT for runtime confirmation.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00035_departments_schema.sql` | Tables + RLS + SECURITY DEFINER helpers | VERIFIED | Creates departments, block_departments, sop_departments, member_departments, two SECURITY DEFINER functions, sops_visible_by_department policy |
| `supabase/migrations/00036_departments_data.sql` | D-01 back-compat migration (General dept + global→org conversion) | VERIFIED | Per-org General department, SOP/block assignment, 65-global conversion to all_departments=true, null-org delete + fail-fast assertion |
| `supabase/migrations/00037_departments_rls_cleanup.sql` | Retire global-block model RLS + block_suggestions table | VERIFIED | Drops blocks_read_global_plus_org, summit-admin write policies, block_suggestions policies + table |
| `src/actions/departments.ts` | All 8 server actions (list, create, update, archive, setOwner, assignMember, assignBlock, assignSop) | VERIFIED | All 8 exports present, substantive, with Zod validation, admin-only guards, D-03 org-membership check for owner |
| `src/app/(protected)/admin/departments/page.tsx` | SSR route with auth guard, listDepartments fetch, DepartmentGrid render | VERIFIED | Route exists; fetches departments + org members; renders DepartmentGrid with both |
| `src/components/admin/departments/DepartmentCard.tsx` | Cards with colour stripe, owner block (filled/empty states), stats row | VERIFIED | Full anatomy per sketch: stripe, cdot, name/code, owner conditional branches, People/SOPs/Blocks stats |
| `src/components/admin/departments/DepartmentGrid.tsx` | Grid with create/edit/archive state | VERIFIED | File exists, imports DepartmentCard, DepartmentFormModal |
| `src/components/admin/departments/DepartmentPicker.tsx` | Multi-select picker, three modes (member/sop/block) | VERIFIED | `assignMemberDepartments` called at line 117, `assignSopDepartments` at lines 133 + 166 |
| `src/components/admin/departments/DChip.tsx` | Dept chip variants (department, all-departments, add) | VERIFIED | File exists; used in BlockListTable, PromptClient, WizardClient, RoleAssignmentTable |
| `src/components/admin/RoleAssignmentTable.tsx` | Department filter bar + DepartmentPicker in member mode + owner badge | VERIFIED | DepartmentPicker imported + rendered at lines 519–533; owner badge at line 449; dept filter at lines 150–157 |
| `src/app/(protected)/admin/blocks/page.tsx` | Department filter + block_departments junction query + BlockListTable with dept | VERIFIED | listDepartments + block_departments junction fetch; augmented blocks passed to BlockListTable; dept param from searchParams |
| `src/lib/journeys/journeys.ts` | manage-departments journey added; no global-blocks refs | VERIFIED | manage-departments journey with route `/admin/departments` at line 353; zero global-blocks references |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `DepartmentPicker` (mode=member) | `member_departments` table | `assignMemberDepartments` server action | WIRED | Called at `DepartmentPicker.tsx:117` |
| `DepartmentPicker` (mode=sop) | `sop_departments` table | `assignSopDepartments` server action | WIRED | Called at `DepartmentPicker.tsx:133, 166` |
| `DepartmentPicker` (mode=block) | `block_departments` table + `blocks.all_departments` | `assignBlockDepartments` server action | WIRED | Called at `DepartmentPicker.tsx` |
| `WizardClient` (blank SOP) | `sop_departments` via `createSopFromWizard` | `departmentIds` in form body → `actions/sops.ts:566` | WIRED | Confirmed at `sops.ts` lines 562–574 |
| `PromptClient` (AI SOP) | `sop_departments` via ai-prompt API route | `departmentIds` in POST body → `api/sops/ai-prompt/route.ts:84` | WIRED | Confirmed at `route.ts` lines 80–86 |
| `/admin/departments/page.tsx` | `DepartmentGrid` | `listDepartments()` result prop | WIRED | Page passes `departments={departments}` and `orgMembers={orgMembers}` |
| `RoleAssignmentTable` | owner badge render | `departments.filter(d => d.owner_user_id === member.user_id)` | WIRED | Lines 419 + 449 |
| Migration 00036 | zero null-org blocks assertion | fail-fast `RAISE EXCEPTION` | WIRED | Lines 139–142; live DB confirms 0 null-org blocks |
| `sops_visible_by_department` policy | `sop_in_user_departments()` helper | SECURITY DEFINER function | WIRED | Policy in 00035 calls helper; helper queries `member_departments` + `sop_departments` without cross-policy recursion |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `DepartmentCard` | `department.people_count`, `sop_count`, `block_count` | `listDepartments()` → junction table COUNT queries | Yes — three separate `supabase.from('member_departments')` etc. queries | FLOWING |
| `DepartmentCard` | `department.owner_name`, `department.owner_role` | `listDepartments()` → admin auth + `organisation_members` lookup | Yes — admin API + role lookup loop at `departments.ts:172–186` | FLOWING |
| `BlockListTable` | `block.departmentIds`, `block.allDepartments` | `block_departments` junction fetch in `blocks/page.tsx` + `blockDeptMap` build | Yes — live `block_departments` table query | FLOWING |
| `/admin/departments` | `departments` array | `listDepartments()` server action | Yes — live DB: 3 department rows confirmed | FLOWING |

---

### Behavioral Spot-Checks

Step 7b skipped — SOPstart UAT is railway-only (no localhost test runs per project memory). All behavioral verification routed to human UAT items.

---

### Probe Execution

Step 7c: 52 source-contract Playwright tests PASS (phase25-integration project), 10 runtime tests are `test.fixme` stubs deferred pending multi-session auth seeding — noted as known deferred, not a blocker.

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| REQ-1 | Departments table, org-scoped RLS, cross-tenant isolation | VERIFIED (code) / HUMAN (runtime isolation) | 00035 migration; departments_org_read policy |
| REQ-2 | block_departments many-to-many + all_departments flag | VERIFIED | 00035 schema + 00036 data migration; BlockListTable wired |
| REQ-3 | sop_departments replacing free-text category; worker visibility gate | VERIFIED (code) / HUMAN (runtime RLS) | sops_visible_by_department policy + sop_in_user_departments() helper; create flows write sop_departments |
| REQ-4 | member_departments many-to-many junction | VERIFIED (code) / HUMAN (runtime write) | 00035 schema; assignMemberDepartments action; DepartmentPicker wired |
| REQ-5 | Department owner_user_id; "No owner assigned" warning; "★ Owns" badge | VERIFIED (code) / HUMAN (visual) | DepartmentCard lines 244–350; RoleAssignmentTable line 449; setDepartmentOwner D-03 validation |
| REQ-6 | /admin/departments CRUD (create/edit/archive); counts; owner setter | VERIFIED (code) / HUMAN (visual) | Page route + DepartmentGrid + DepartmentCard + all server actions |
| REQ-7 | Block library department tagging/filter; global-blocks routes deleted | VERIFIED | blocks/page.tsx fetches dept filter + junction; global-blocks dir absent; journeys.ts clean |
| REQ-8 | 65 NZ seed globals converted; zero null-org blocks; all_departments=true | VERIFIED (DB confirmed) / HUMAN (UI surface) | 00036 migration logic + live DB: 0 null-org blocks confirmed |
| REQ-9 | /admin/team writes member_departments; create-SOP writes sop_departments | VERIFIED (code) / HUMAN (runtime) | Both code paths wired per Key Links table above |

---

### Anti-Patterns Found

No blockers found. Scanned modified files:

- `src/actions/departments.ts` — no TBD/FIXME/XXX; no stub returns
- `src/actions/blocks.ts` — comment referencing global blocks at line 248 and 413 are explanatory comments (not live route refs)
- `src/components/admin/RoleAssignmentTable.tsx` — no debt markers
- `src/components/admin/departments/*.tsx` — no debt markers
- `supabase/migrations/00035–00037` — no debt markers; fail-fast assertion in 00036 is a correctness guard

Deferred stubs (acknowledged, not blockers):
- Worker `/sops` page passes all SOPs through client-side without dept filter (`page.tsx:98` comment explicitly notes RLS is the real gate and client filter is deferred)
- 10 `test.fixme` runtime Playwright tests in phase25-integration (multi-session auth seeding not yet set up)

---

### Human Verification Required

#### 1. Cross-tenant Isolation

**Test:** Log in as an admin in Org A (the existing test org on sopstart.com), note department names. Then log in as an admin in a second org. Open `/admin/departments`.
**Expected:** Zero of Org A's departments appear. The departments list is empty or shows only Org B's own departments.
**Why human:** RLS policy uses `current_organisation_id()` helper which is correct in code, but two-session cross-org isolation requires a real multi-org browser session.

#### 2. Worker SOP Visibility Gate (Forming vs Cleaning)

**Test:** As an admin, create two departments (Forming, Cleaning). Assign one published SOP to Forming only and another to Cleaning only. Create a worker, assign them only to Forming. Log in as that worker and open `/sops`.
**Expected:** Worker sees the Forming SOP. Worker does NOT see the Cleaning-only SOP.
**Why human:** The `sops_visible_by_department` policy is confirmed in code (additive-OR, D-02), but the actual RLS gate requires a live worker session with controlled dept membership. The client-side SOP page notes it passes all SOPs through (relying on RLS).

#### 3. Member Department Assignment Persists DB Row

**Test:** As an admin, open `/admin/team`. For any member, click the `+` department chip, select Forming, click Done.
**Expected:** A `member_departments` row for (member_id, forming_dept_id) exists in the DB. Removing Forming removes only that row.
**Why human:** `DepartmentPicker` → `assignMemberDepartments` code path is wired; live DB write verification requires an authenticated session.

#### 4. Create-SOP Wizard Writes sop_departments Rows

**Test:** Create a SOP using either `/admin/sops/new/blank` or `/admin/sops/new/ai`. Select two departments in the department picker. Complete/submit.
**Expected:** Two rows exist in `sop_departments` for the new SOP's ID.
**Why human:** Both code paths (`createSopFromWizard` and ai-prompt API) write `sop_departments` — confirmed in code. Runtime write + row count needs a live session.

#### 5. "No Owner Assigned" Warning + Owner Set Flow

**Test:** Open `/admin/departments`. Identify a department with no owner (should show red dashed border, "No owner assigned — set one" text). Edit it to set an owner. Confirm the card updates. Then open `/admin/team` and confirm the owner's row shows a "★ Owns {DeptName}" badge.
**Expected:** Warning state is visually red/dashed; after setting owner the card shows filled owner block; team row shows ★ badge.
**Why human:** Code implements both branches (DepartmentCard, RoleAssignmentTable) but visual fidelity + owner-set round-trip needs browser confirmation.

#### 6. Block Library "All Departments" + Department Filter

**Test:** Open `/admin/blocks`. Click a specific department filter (e.g. Forming). Confirm only blocks tagged to Forming or `all_departments=true` appear. Click a different department — confirm Forming-only blocks are absent.
**Expected:** Filters work correctly; `all_departments` blocks surface under every filter.
**Why human:** The page passes `departmentId` to `listBlocks` via searchParams — correct in code — but live filter interaction needs browser confirmation.

#### 7. Global Block Availability Under "All Departments"

**Test:** Open `/admin/blocks`. In the block list, verify blocks converted from the 65 NZ globals show the "All departments" chip (cyan). Confirm they appear regardless of which department filter is active.
**Expected:** Converted globals show `all_departments` chip; they surface under every department filter.
**Why human:** DB confirms 0 null-org blocks. The `all_departments=true` flag is set by migration. The "All departments" chip render in BlockListTable needs visual browser confirmation.

---

### Gaps Summary

No gaps — all 9 SPEC requirements are met at the code and DB level. All 7 human verification items are runtime/visual checks on correct implementations. The 10 `test.fixme` Playwright stubs are explicitly deferred pending multi-session auth seeding infrastructure and are not acceptance criteria failures.

---

_Verified: 2026-06-15_
_Verifier: Claude (gsd-verifier)_
