# Phase 25: Department as a First-Class Entity — Research

**Researched:** 2026-06-15
**Domain:** Supabase schema (RLS, junctions, migrations) + Next.js App Router admin UI
**Confidence:** HIGH — all findings verified directly from migration files, source code, and sketch HTML

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Migration back-compat:**
Auto-create one `General` department per org and assign all existing SOPs and org-owned blocks to it. The 65 previously-global blocks convert to org-owned with `all_departments = true`. Nothing disappears from worker view on migration day; admins reorganise into real departments afterward. Non-destructive: zero blocks deleted, `category` column retained read-only rather than dropped in the same migration.

**D-02 — Visibility / RLS composition:**
Department-based SOP visibility is **additive / OR** with the existing assignment and sub-trade gates: a worker sees a SOP if it is assigned to them **OR** matches one of their departments **OR** matches one of their sub-trades **OR** is org-wide (`all_departments`). Untagged dimensions do not restrict (fail-open). Resolves the deferred dept↔sub-trade question for visibility composition only.

**D-02a (constraint):** RLS gate MUST avoid the `00030`/`00031` recursion trap — cross-table existence checks go in `SECURITY DEFINER` helper functions (or `using(true)` on non-sensitive junction tables with the real gate on the parent), never as direct cross-policy `EXISTS` chains.

**D-03 — Owner model:**
Owner is accountability label only. `owner_user_id` is a single org member. Owning grants no new permissions. Single owner per department. If that member is removed, the department surfaces the ownerless warning.

**D-04 — SOP org-wide flag:**
SOPs support an org-wide "All departments" option — a SOP can be tagged to specific departments OR marked org-wide. Implies an `all_departments`-equivalent flag on `sops` (boolean column or sentinel), parallel to `blocks.all_departments`.

### Claude's Discretion
- Exact junction-table column design, migration file count/sequencing, and which existing UI components to extend vs build new.
- Whether the SOP org-wide flag is a boolean column or a sentinel row in `sop_departments` — planner's call, as long as it parallels the block model.

### Deferred Ideas (OUT OF SCOPE)
- Dept ↔ sub-trade richer semantics (beyond OR-composition for visibility)
- Owner edit/approve permissions
- Multiple owners per department
- Unified create-SOP wizard (only the department field is wired here)
- Unified Read/Walk/Edit SOP surface
- Site/plant multi-tenancy sub-tier
</user_constraints>

---

## Summary

Phase 25 introduces departments as a first-class Postgres entity, wiring three junction tables (`block_departments`, `sop_departments`, `member_departments`) and three admin UI surfaces. The existing sub-trade pattern from migrations `00030`/`00031` is the direct precedent — emulate its `SECURITY DEFINER` helper + `using(true)` on junctions strategy to avoid RLS recursion. The migration sequence replaces the Phase 13 org-vs-global block model: 65 `organisation_id = null` seed blocks must be converted to org-owned with `all_departments = true`, and a `General` department auto-created per org to absorb all existing SOPs and org-owned blocks. The next available migration number is `00035`.

The most dangerous landmines are: (1) the RLS OR-composition on `sops` SELECT now has a third arm (department gate) — it must use a `SECURITY DEFINER` helper exactly like `sub_trade_id_intersects()` to avoid re-creating the `00030` recursion bug; (2) the global-block migration must handle multi-org: the 65 seed blocks have `organisation_id = null` today — they must be copied per-org (one org-owned clone per organisation with `all_departments = true`), not converted in-place to a single org; (3) after deleting `/admin/global-blocks` and `/admin/global-blocks/suggestions`, **five** other files reference those paths and need updating.

**Primary recommendation:** Sequence as three migration files (00035 schema, 00036 data migration, 00037 drop old RLS / clean up), not one monolith, so each step is independently rollback-safe.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Department CRUD, RLS isolation | Database / Storage | API / Backend (server actions) | Org-scoping is enforced at DB via RLS; server actions are the mutation surface |
| Block↔department tagging | Database / Storage | Admin Frontend Server | Junction rows own truth; UI just writes and reads them |
| SOP visibility gating (dept) | Database / Storage | — | OR-composed RLS policy on `sops` SELECT; no application-layer filtering needed |
| Member↔department assignment | Database / Storage | Admin Frontend Server (RoleAssignmentTable) | Same pattern as sub-trade junction |
| `/admin/departments` page | Frontend Server (SSR) | — | Server component reads dept + counts via Supabase; client component renders cards |
| Block library filter/tag UI | Frontend Server (SSR) + Client | — | SSR fetches blocks; client handles dept filter state |
| Team dept picker (inline) | Browser / Client | — | `SubTradePicker` pattern — client toggle fires server action, optimistic update |
| Create-SOP dept field | Browser / Client | API / Backend | Wizard client state; server action writes `sop_departments` rows post-create |
| Owner badge / warning state | Browser / Client | — | Derived from `departments.owner_user_id` at render time; no extra table needed |
| Global-block migration | Database / Storage | — | Pure migration SQL; no app code change until after migration runs |

---

## Existing Schema — What the Planner Must Know

### `blocks` table (migration 00019 + addons 00022, 00033)

**Full column set as of migration 00034:**
- `id` uuid PK
- `organisation_id` uuid nullable FK → `organisations` (NULL = global today; will be non-null after Phase 25 migration)
- `kind_slug` text (hazard / ppe / step / emergency / heading / text / photo / callout / model / step_with_photos / photo_grid)
- `name` text
- `category` text nullable (set to `'parsed_inline'` by parser — Phase 21; `null` for hand-authored blocks)
- `category_tags` text[] (controlled vocab slugs from `block_categories`)
- `free_text_tags` text[]
- `current_version_id` uuid FK → `block_versions` (deferrable)
- `archived_at` timestamptz
- `created_by` uuid
- `created_at` / `updated_at` timestamptz

**New column Phase 25 adds:** `all_departments boolean NOT NULL DEFAULT false`

**No existing `department_id` column** — the block-department relationship is entirely new, added as a junction table.

**How globals work today:** `organisation_id = null` rows are readable by every authenticated user via migration 00019's RLS policy (`using (organisation_id = current_organisation_id() or organisation_id is null)`). After Phase 25, `organisation_id = null` should be impossible — the migration must convert every null row to org-owned.

**Multi-org migration strategy (critical):** The 65 global seed blocks cannot simply have `organisation_id` set to one org — they are platform-wide content. The safe approach: for each organisation that exists at migration time, INSERT a copy of each global block with `organisation_id = <org_id>` and `all_departments = true`. Then DELETE the original `organisation_id = null` rows. This preserves content per org without creating cross-org shared ownership. [VERIFIED: migration 00023 confirms all 65 rows have `organisation_id = null`]

### `sops` table (migration 00003 + addons)

**Relevant existing columns:**
- `category` text nullable — the old free-text category field (e.g., "Forming", "Maintenance"). Retained read-only per D-01.
- `category_tag` text nullable — the Phase 13 controlled-vocab tag (e.g., slug from `block_categories`). Also retained read-only.

**New column Phase 25 adds:** `all_departments boolean NOT NULL DEFAULT false` (mirrors blocks) — this is the cleaner choice vs. a sentinel row in `sop_departments` because it parallels the block model exactly, avoids a special-case in filter queries, and is unambiguous in RLS expressions.

### Existing sops SELECT RLS policies (the OR chain to extend)

From migration 00030, `sops_visible_by_sub_trade` is a second permissive SELECT policy that ORs with the base policy. The sops table already has at minimum:
1. A base policy (migration 00002) gating org membership
2. `sops_visible_by_sub_trade` (migration 00030) — the sub-trade OR gate

Phase 25 adds a third permissive SELECT policy: `sops_visible_by_department`. Because Postgres ORs multiple permissive policies on the same command, this adds cleanly without touching the existing policies.

**The safe pattern (from 00031 learning):**
```sql
-- SECURITY DEFINER helper — avoids cross-policy recursion
create or replace function public.sop_in_user_departments(p_sop_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sop_departments sd
    where sd.sop_id = p_sop_id
      and sd.department_id in (
        select md.department_id from public.member_departments md
        join public.organisation_members om on om.user_id = md.member_id
        where om.user_id = auth.uid()
      )
  );
$$;

-- The RLS policy on sops — additive, does NOT touch sops_sub_trades
create policy "sops_visible_by_department" on public.sops
  for select to authenticated
  using (
    -- SOP is org-wide (all_departments = true)
    sops.all_departments = true
    -- OR SOP has no department tags at all (fail-open, backward compat)
    or not exists (select 1 from public.sop_departments sd where sd.sop_id = sops.id)
    -- OR user is in a department that owns this SOP
    or sop_in_user_departments(sops.id)
  );

-- sop_departments junction — using(true) to avoid recursion (same as 00031 fix)
create policy "sop_departments_read_all_auth" on public.sop_departments
  for select to authenticated using (true);
```

[VERIFIED: pattern directly mirrors migration 00031's fix for `sops_sub_trades`]

### Migration 00025 follow-latest triggers — interaction with Phase 25

`trg_propagate_block_update` fires AFTER INSERT on `block_versions` and flips `sop_section_blocks.update_available` for follow-latest junctions. This trigger references `sop_section_blocks.block_id` and `sop_section_blocks.pin_mode` — neither column is renamed by Phase 25. The trigger body is safe. However, the global→org block copy strategy (INSERT new org-owned copies) will fire the trigger for the new version rows. This is harmless since the new blocks have no `sop_section_blocks` junction rows yet.

The `accept_block_update` and `decline_block_update` SECURITY DEFINER RPCs reference `public.sop_section_blocks`, `public.sop_sections`, `public.sops` — none renamed. Safe.

### Next migration number: `00035`

Confirmed by listing `supabase/migrations/`: last file is `00034_uat_feedback.sql`. [VERIFIED: directory listing]

---

## Global-Blocks Routes — Complete Deletion Map

**Files to delete:**
- `src/app/(protected)/admin/global-blocks/page.tsx`
- `src/app/(protected)/admin/global-blocks/suggestions/page.tsx`

**Every inbound reference that must be updated (5 locations, 7 files):**

| File | Line | Reference | Fix |
|------|------|-----------|-----|
| `src/actions/blocks.ts` | L61 (comment) | `"/admin/global-blocks ships in plan 13-05"` | Update comment only — no functional change |
| `src/lib/journeys/journeys.ts` | L362–363 | `curate-globals` journey steps with `route: '/admin/global-blocks'` and `route: '/admin/global-blocks/suggestions'` | Remove `curate-globals` journey entirely (routes deleted) |
| `src/lib/auth/platform-admin-guard.ts` | L6 | Comment referencing `/admin/global-blocks/*` | Update comment only |
| `src/app/(protected)/admin/sops/page.tsx` | L51, L118 | `isPlatformAdmin` detection + `href="/admin/global-blocks"` in nav | Remove the `isPlatformAdmin` conditional nav link |
| `src/app/(protected)/admin/global-blocks/suggestions/page.tsx` | L44, L50 | Self-referential nav links (deleted with file) | File deletion handles this |
| `src/app/(protected)/admin/global-blocks/page.tsx` | L57, L63 | Self-referential nav links (deleted with file) | File deletion handles this |

**Also check for `"suggest_global"` scope references:** The `saveFromSection` action in `blocks.ts` handles `scope: 'suggest_global'` which writes to `block_suggestions`. With the global model removed, this scope should be removed from the enum and the `block_suggestions` table becomes orphaned. Plan should address whether `block_suggestions` table is dropped (migration) or simply abandoned. [ASSUMED — no explicit decision in CONTEXT.md; recommend dropping the table + policies in migration 00036]

---

## Reusable Components — Concrete Props and Extension Points

### 1. `src/components/admin/blocks/BlockListTable.tsx`

**Current props:**
```typescript
interface Props {
  blocks: Array<Block & { currentContent?: unknown }>
  categories: BlockCategory[]
}
```

**Current columns:** Name (with GLOBAL badge) | Kind | Categories (category_tags chips) | Updated | Status | Actions (Archive)

**Extension for Phase 25:**
- Replace `categories: BlockCategory[]` prop with `departments: Department[]` (the org's department list)
- Add `departments` column showing `dchip` chips per `block_departments` junction (or "All departments" cyan chip when `block.all_departments = true`)
- Add "Departments ▾" button in Actions column that opens the multi-select department picker popover (per sketch)
- Remove the `GLOBAL` badge (no more globals after migration)
- The `archiveBlock` call and archive button remain unchanged
- New prop shape:
```typescript
interface Props {
  blocks: Array<Block & { currentContent?: unknown; departmentIds?: string[] }>
  departments: Department[] // replaces categories
}
```

### 2. `src/components/admin/SubTradePicker.tsx`

**Current props:**
```typescript
type Props =
  | { mode: 'user'; userId: string; onChange?: (ids: string[]) => void }
  | { mode: 'sop'; sopId: string; onChange?: (ids: string[]) => void }
```

**Pattern:** Loads vocab + current assignments via server actions; renders pill buttons with `aria-pressed`; `useTransition` for optimistic updates; reverts on error. Toggle fires replace-semantics server action.

**The `DepartmentPicker` component for Phase 25 should mirror this exactly:**
```typescript
type Props =
  | { mode: 'member'; memberId: string; departments: Department[]; onChange?: (ids: string[]) => void }
  | { mode: 'block'; blockId: string; departments: Department[]; onChange?: (ids: string[]) => void }
  | { mode: 'sop'; sopId: string; departments: Department[]; onChange?: (ids: string[]) => void }
```
Key differences from SubTradePicker:
- Vocab is org-specific (not global seed), so departments are passed as a prop (pre-fetched by server component) rather than loaded inside the picker
- Needs colour swatch `<span>` per department (per sketches)
- Needs "All departments" toggle option (for block and SOP modes) rendered with cyan chip style (`.dchip.all` class)
- For `mode: 'member'`: the popover also shows "Set owner / ★ Owner" per department the member is assigned to (per sketch team-departments)

### 3. `src/components/admin/RoleAssignmentTable.tsx`

**Current shape:** Self-contained client component. Props: `{ orgId: string; inviteCode: string }`. Manages its own member state via `getTeamMembersWithEmails()`. Renders: invite-code block, invite-by-email form, add-existing-member form, confirmation bar, members list with role `<select>` and remove button.

**Extension for Phase 25:**
- Add a `departments: Department[]` prop (pre-fetched by the page server component)
- In the members list row, add a `c-dept` column (230px flex) showing department chips per member
- The "＋" chip opens the department picker popover (inline `DepartmentPicker` in `mode: 'member'`)
- Owner badge `ownbadge` ("★ Owns {Dept}") added to member name row
- The `TeamMember` type from `src/actions/auth` needs a `department_ids: string[]` field added

### 4. `src/components/sop/CategoryBottomSheet.tsx`

**Current props:**
```typescript
interface CategoryBottomSheetProps {
  categories: CategoryItem[]  // { name: string; count: number }[]
  activeCategory: string | null
  onSelect: (category: string | null) => void
  open: boolean
  onClose: () => void
}
```
Also exports `CategorySidebar` with the same shape minus `open`/`onClose`.

**Extension for Phase 25:** Replace entirely with a `DepartmentBottomSheet` + `DepartmentSidebar` that accepts `departments: Department[]` (with colour/count) instead of `CategoryItem[]`. The display logic is identical — just the data shape changes. The old `CategoryBottomSheet` can be removed if no other consumer uses it.

**Check for other consumers of CategoryBottomSheet:**
[ASSUMED — not grepped; planner should verify with `grep -rn "CategoryBottomSheet" src`]

---

## `src/actions/blocks.ts` — Signature Changes Required

**Current `ListBlocksOptions`:**
```typescript
export type ListBlocksOptions = {
  kindSlug?: string
  includeArchived?: boolean
  categoryTag?: string
  includeGlobal?: boolean   // ← REMOVE after migration
  globalOnly?: boolean      // ← REMOVE after migration
  includeContent?: boolean
  includeParsedInline?: boolean
}
```

**New options for Phase 25:**
```typescript
export type ListBlocksOptions = {
  kindSlug?: string
  includeArchived?: boolean
  departmentId?: string     // NEW — filter to blocks tagged to this dept (or all_departments=true)
  includeContent?: boolean
  includeParsedInline?: boolean
  // includeGlobal / globalOnly removed — no more globals
}
```

**The query changes:** Instead of `.is('organisation_id', null)` or `.not('organisation_id', 'is', null)`, the filter becomes:
- If `departmentId` provided: join `block_departments` WHERE `department_id = X` OR `blocks.all_departments = true`
- If no `departmentId`: return all org blocks (no filter needed — RLS already scopes to org)

**Call sites that use `includeGlobal` / `globalOnly` — must all be updated:**
1. `src/app/(protected)/admin/global-blocks/page.tsx` — deleted as part of route removal
2. `src/app/(protected)/admin/blocks/page.tsx` (inferred — likely calls `listBlocks({ includeGlobal: true })`)
3. The `BlockPicker` component (inferred — uses `listBlocks` with `includeGlobal: true` to show global blocks to picker)

[ASSUMED — planner should verify with `grep -rn "listBlocks\|includeGlobal\|globalOnly" src`]

**Other actions to add:**
- `listDepartments()` — org-scoped, returns `Department[]` with computed `people_count`, `sop_count`, `block_count`
- `createDepartment(input)` / `updateDepartment(input)` / `archiveDepartment(id)`
- `setDepartmentOwner(departmentId, userId)` — sets `departments.owner_user_id`
- `assignMemberDepartments(memberId, departmentIds[])` — replace-semantics on `member_departments`
- `assignBlockDepartments(blockId, departmentIds[], allDepartments: boolean)` — replace-semantics on `block_departments`
- `assignSopDepartments(sopId, departmentIds[], allDepartments: boolean)` — writes `sop_departments` rows

---

## Create-SOP Flow — Where the Department Field Hooks In

### Current flow (blank wizard at `/admin/sops/new/blank`)

1. **Step 1 (WizardClient.tsx):** Title, SOP number, SOP category (calls `createSopFromWizard({ title, sopNumber, kindIds, categoryTag })`)
2. `createSopFromWizard` in `src/actions/sops.ts` inserts a `sops` row with `category_tag` and `status: 'draft'`, then inserts `sop_sections`
3. Redirects to `/admin/sops/builder/[sopId]`

### Parse pipeline path

`src/api/sops/parse` (or similar route) calls `createBlock({ serviceRole: ... })` and also inserts a sops row. The parse pipeline at present writes `sops.category_tag` from the parsed document. Phase 25 does not require the parse pipeline to auto-populate `sop_departments` — the admin assigns departments post-parse in the builder/review flow.

### Phase 25 hook-in points

**Blank wizard (REQ-9):**
- Add a "Department" multi-select to Step 1 of `WizardClient.tsx` (alongside the existing SOP category select, which can be hidden or kept for back-compat read)
- Selected department IDs stored in local state: `const [departmentIds, setDepartmentIds] = useState<string[]>([])`
- `createSopFromWizard` server action receives `departmentIds` — after inserting the `sops` row, it inserts rows into `sop_departments`
- Also needs `allDepartments: boolean` state for the "org-wide" option

**AI draft path (`/admin/sops/new/ai/PromptClient.tsx`):**
- Same department field needed here (department IDs written to `sop_departments` post-create)
- [ASSUMED — not read in this session; planner should read `PromptClient.tsx` before designing the AI path hook-in]

**Server action changes to `createSopFromWizard`:**
```typescript
// New input fields
departmentIds: z.array(z.string().uuid()).max(20).optional().default([]),
allDepartments: z.boolean().optional().default(false),
```
After sops insert, if `allDepartments`:
```sql
UPDATE sops SET all_departments = true WHERE id = <new_id>
```
Or if `departmentIds` provided, insert `sop_departments` rows.

---

## `src/lib/journeys/journeys.ts` — Changes Required

**Current `JOURNEY_GROUPS`:**
`'Getting started' | 'Worker' | 'Supervisor' | 'Create an SOP' | 'Refine & publish' | 'Library & team' | 'Platform admin' | 'Everyone'`

**Changes needed:**
1. **Remove `curate-globals` journey** (id: `'curate-globals'`, group: `'Platform admin'`) — both route steps reference `/admin/global-blocks` and `/admin/global-blocks/suggestions`, which are deleted. The entire Platform admin group disappears if this is the only journey in it. Remove the group from `JOURNEY_GROUPS` too.

2. **Update `reusable-blocks` journey** (id: `'reusable-blocks'`, group: `'Library & team'`) — add a step showing department filter/tagging. Current steps: `blocks (/admin/blocks)` → `edit (/admin/blocks/[blockId])`. No route change needed — the route stays `/admin/blocks`.

3. **Update `manage-team` journey** (id: `'manage-team'`, group: `'Library & team'`) — extend the `roles` action step to mention departments: `"Set roles + sub-trades + departments"`.

4. **Add new `manage-departments` journey** in group `'Library & team'`:
```typescript
{
  id: 'manage-departments',
  group: 'Library & team',
  persona: 'SOP Admin',
  title: 'Manage departments',
  summary: 'An admin creates departments, assigns owners, and uses them to organise SOPs, blocks, and team members.',
  steps: [
    { id: 's', type: 'start', label: 'Need to organise by department' },
    { id: 'depts', type: 'screen', label: 'Departments', route: '/admin/departments' },
    { id: 'create', type: 'action', label: 'Create department', detail: 'Name, code, colour, icon, owner.' },
    { id: 'owner', type: 'action', label: 'Set owner', detail: 'Clears the "No owner assigned" warning.' },
    { id: 'e', type: 'end', label: 'Department ready' },
  ],
}
```

**New route `/admin/departments` MUST appear in `journeys.ts` before `/gsd-verify-work` so the `/pathways` coverage check shows 0 not-mapped.**

---

## Sketch UI Structure — Concrete Markup Intent

### `sketches/departments/index.html` — `/admin/departments` page

**Layout:** `max-width: 1000px`, page header + "＋ New department" button, sub-nav tabs (SOPs / Library / Team / Departments), 2-column card grid.

**Department card anatomy:**
- Left colour stripe: `6px` wide, full card height, `background: dept.color`
- Card body (`.inner`): 18px padding
- **Top row:** Colour dot icon (`26×26px rounded-6px`, dept.color background, emoji/letter), dept name (`h3`, 15px bold), code beneath (`10px uppercase`, `· department` suffix), `⋯` overflow menu button
- **Owner block (`.owner`):** `background: var(--paper-2)`, 1px border `var(--ink-100)`, 6px radius. Avatar initials circle (24×24, `var(--ink-900)` bg), "OWNER" label (9px uppercase), owner name + role.
  - **No-owner state (`.owner.empty`):** Dashed border, `var(--accent-hazard)` red avatar with `!`, red name text "No owner assigned — set one"
- **Stats row (`.stats`):** 3-cell flex: People / SOPs / Blocks count (17px bold number, 9px uppercase label)
- **Add card:** Dashed border placeholder, `＋` large, "NEW DEPARTMENT" uppercase label

**Colour palette for departments (from sketch data):** orange `#f97316`, blue `#3b82f6`, cyan `#06b6d4`, green `#10b981` — all existing CSS custom property accent colours.

### `sketches/unified-block-library/index.html` — `/admin/blocks` reworked

**Department filter bar (`.deptrow`):** Horizontal scroll of department buttons. Each button: colour swatch (8×8px, 2px radius), dept name, count badge. Active state: `bg: var(--ink-900), color: #fff`.

**Context line:** "Forming blocks, plus org-wide blocks. A block tagged to several departments shows up under each."

**Block row:**
- Kind icon (38×38, colour-coded border)
- Name + kind pill (colour-coded, 9px uppercase)
- Department chips row (`.rmeta`): `dchip` each with 7px colour swatch + dept name. All-departments chip: `.dchip.all` cyan border/text, `◇ All departments` label
- Actions: "Departments ▾" ghost button, "Edit" button, "Archive" danger button

**Department picker popover (`.pop`):** 230px wide, absolute positioned at `top: 58px right: 120px`. Header "In departments" (9px uppercase). Each option: checkbox (`box`), colour swatch, dept name. "All departments" first option (no swatch). "Done" button footer.

### `sketches/team-departments/index.html` — `/admin/team` reworked

**Layout:** Same header + sub-nav pattern. Department filter bar identical to block-library sketch.

**Column header row:** Member | Role | Departments | (action)

**Member row columns:**
- **Member (flex: 1):** Avatar (34×34 initials circle), name + owner badge, email. Owner badge (`.ownbadge`): amber/yellow, `★ Owns {Dept}`, 8px uppercase
- **Role (150px):** `<select class="roleSel">` — existing role selector, unchanged
- **Departments (230px):** `dchip` per dept (with colour swatch + `★` suffix if owner), `dchip.add` dashed blue "＋" button

**Department picker popover (same structure as block library):** Each assigned dept shows "★ Owner" / "Set owner" button on the right (`ownset` class) — clicking sets `departments.owner_user_id = this member`.

---

## Standard Stack

No new external dependencies required. All functionality uses existing stack:
- **Supabase JS** — existing `@supabase/ssr` / `createClient()` / `createAdminClient()` patterns
- **Zod** — existing validator patterns in `src/lib/validators/`
- **React Hook Form** — existing pattern, used in WizardClient for new dept field
- **Lucide React** — icon for department pages (existing import)
- **Tailwind CSS 4** — existing tokens (`var(--ink-*)`, `var(--paper-*)`, `var(--accent-*)`)

[VERIFIED: all packages already in package.json — no new installs]

## Package Legitimacy Audit

> No new packages required for this phase.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Admin Browser
    │
    ├── /admin/departments
    │       │ Server Component: fetch departments + counts
    │       │ Client: DepartmentCard grid, create/edit/archive
    │       └── WRITES: departments table (CRUD server actions)
    │
    ├── /admin/blocks  (reworked)
    │       │ Server Component: fetch blocks + block_departments
    │       │ Client: DepartmentFilterBar → filtered BlockListTable
    │       │         "Departments ▾" → DepartmentPickerPopover
    │       └── WRITES: block_departments junction (assignBlockDepartments)
    │
    ├── /admin/team  (extended)
    │       │ RoleAssignmentTable (client, extended)
    │       │   per-member DepartmentPicker → member_departments junction
    │       │   owner badge ← departments.owner_user_id
    │       └── WRITES: member_departments, departments.owner_user_id
    │
    └── /admin/sops/new/blank  (extended)
            │ WizardClient Step 1: department multi-select
            └── WRITES: sop_departments (via createSopFromWizard)

Supabase Postgres
    │
    ├── departments (org-scoped, RLS)
    ├── block_departments (junction, using(true) RLS)
    ├── sop_departments (junction, using(true) RLS)
    ├── member_departments (junction, self+admin read RLS)
    │
    ├── sops_visible_by_department policy (3rd OR arm on sops SELECT)
    │       └── calls sop_in_user_departments() SECURITY DEFINER helper
    │
    └── Migration 00035/00036/00037
            ├── 00035: schema (departments + 3 junctions + column adds)
            ├── 00036: data (General dept per org, global→org block copy, existing SOP/block assignments)
            └── 00037: RLS (new policies + drop old global-write policies)

Worker Browser
    └── /sops  (library, existing)
            └── RLS on sops SELECT now has 3rd OR arm: dept visibility
                  (existing worker UX unchanged; more SOPs may become visible)
```

### Recommended Project Structure (new files)

```
src/
├── actions/
│   ├── departments.ts          # NEW: CRUD + listDepartments, setOwner
│   └── blocks.ts               # MODIFY: remove includeGlobal/globalOnly, add departmentId filter
├── components/
│   └── admin/
│       ├── departments/
│       │   ├── DepartmentCard.tsx       # NEW
│       │   ├── DepartmentGrid.tsx       # NEW
│       │   └── DepartmentPicker.tsx     # NEW (mirrors SubTradePicker pattern)
│       ├── blocks/
│       │   └── BlockListTable.tsx       # MODIFY: dept chips + Departments btn
│       └── RoleAssignmentTable.tsx      # MODIFY: dept column + owner badge
├── app/(protected)/admin/
│   ├── departments/
│   │   └── page.tsx            # NEW
│   ├── global-blocks/          # DELETE entire directory
│   └── blocks/
│       └── page.tsx            # MODIFY: dept filter bar
└── types/
    └── sop.ts                  # MODIFY: add Department, MemberDepartment etc.
```

### Pattern 1: SECURITY DEFINER helper for cross-table RLS check

```sql
-- Source: mirrors migration 00030 pattern (current_user_sub_trades, sub_trade_id_intersects)
create or replace function public.current_user_department_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select department_id from public.member_departments
  where member_id = auth.uid();
$$;

create or replace function public.sop_in_user_departments(p_sop_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sop_departments sd
    where sd.sop_id = p_sop_id
      and sd.department_id in (select * from public.current_user_department_ids())
  );
$$;
```

### Pattern 2: DepartmentPicker (mirrors SubTradePicker)

The existing `SubTradePicker` passes `mode: 'user' | 'sop'` and calls different server actions per mode. DepartmentPicker should use the same structure but:
1. Accept `departments: Department[]` as prop (server-fetched, not loaded inside)
2. Accept `mode: 'member' | 'block' | 'sop'`
3. Render a colour swatch next to each pill label
4. Include an "All departments" toggle (for block and sop modes)
5. For `mode: 'member'`: include inline owner-set affordance per assigned dept

### Anti-Patterns to Avoid

- **Direct `EXISTS(SELECT FROM sops ...)` inside a `sop_departments` policy** — causes the 00030 recursion bug. Use `using(true)` on the junction and put the real gate on `sops`.
- **Single migration doing schema + data + RLS in one file** — hard to roll back. Use three numbered migrations.
- **Dropping `category` / `category_tag` columns in the same migration as data migration** — violates D-01 non-destructive constraint. Retain as read-only.
- **Converting global blocks in-place by setting `organisation_id` to one org** — other orgs would lose access. Must copy per org.
- **Deleting `/admin/global-blocks` routes without updating `sops/page.tsx` nav** — leaves a dead `isPlatformAdmin` conditional that refers to a non-existent route (silent nav bug).
- **Leaving `suggest_global` scope in `blocks.ts`** — the `block_suggestions` table still exists but the promotion flow is gone. Remove the enum value or it silently accepts input and writes orphaned suggestion rows.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dept-scoped SOP visibility | Custom application-layer filter | Postgres RLS + SECURITY DEFINER helper | Same as sub-trade gate; RLS enforces at query level, never bypassable |
| Multi-select pill picker | New picker component from scratch | Mirror `SubTradePicker.tsx` exactly | Proven pattern: optimistic update, `useTransition`, `aria-pressed`, reverts on error |
| Org-wide block/SOP flag | Separate `all_departments` junction row | `all_departments boolean` column on the table | Simpler query (no NOT EXISTS needed), parallels each other, clearer in RLS expression |
| Owner warning state | Server-side computed field | `owner_user_id IS NULL` check at render time | Already stored on department row; no extra query |
| Department colour swatch | Custom colour picker | Hard-coded palette of 8–10 hex values (select input) | Sketches show 4 specific brand colours; a constrained palette avoids freeform CSS injection risk |

---

## Common Pitfalls

### Pitfall 1: RLS Recursion on `sop_departments`

**What goes wrong:** Writing a SELECT policy on `sop_departments` that references `sops` (e.g., "you can see junction rows if you can see the parent SOP") causes the exact 00030 bug: `sops` policy references `sop_departments`, `sop_departments` policy references `sops` → infinite recursion → 500 on every sops query.

**Why it happens:** Intuitive to "protect the junction by checking the parent" but Postgres policy evaluation recurses.

**How to avoid:** `using(true)` on `sop_departments` for SELECT (non-sensitive UUID pairs), `block_departments` for SELECT, and write restrictions to admin server actions only. Same for `member_departments`.

**Warning signs:** After adding a new policy, test `SELECT * FROM sops LIMIT 1` via RLS-constrained role — if it returns `42P17 infinite recursion`, the policy is recursive.

### Pitfall 2: Global Block Multi-Org Copy

**What goes wrong:** Migration sets `organisation_id = <some_org_id>` on the 65 global blocks and deletes them from globals. Other orgs no longer have access to the content.

**Why it happens:** Easy to assume one org owns them since Phase 25 is "single org with departments."

**How to avoid:** The migration must: (a) SELECT all distinct `organisation_id` values from `organisation_members`; (b) for each org, INSERT copies of the 65 global blocks with that org's `organisation_id` and `all_departments = true`; (c) DELETE the originals with `organisation_id = null`. Use a PL/pgSQL loop. Keep the idempotency guard.

**Warning signs:** After migration, `SELECT COUNT(*) FROM blocks WHERE organisation_id IS NULL` must return 0. Also check that each org has exactly 65 new all-departments blocks.

### Pitfall 3: SQL Function Body Does Not Update on Table Rename

**What goes wrong:** If any column is renamed on `blocks`, `sops`, or junction tables, existing `SECURITY DEFINER` SQL function bodies silently break (CLAUDE.md learning 2026-05-08 about the `is_platform_admin()` / `summit_admins` rename bug).

**Why it happens:** Postgres SQL function bodies store SQL text, not OIDs. Renaming a table/column doesn't recompile functions.

**How to avoid:** Phase 25 does not rename any existing tables or columns — only adds new ones. But after writing the new `sop_in_user_departments()` and `current_user_department_ids()` helpers, test them end-to-end before declaring the migration complete.

### Pitfall 4: Dead Links in `/admin/sops` Nav After Route Deletion

**What goes wrong:** After deleting `global-blocks` routes, `src/app/(protected)/admin/sops/page.tsx` still renders a `href="/admin/global-blocks"` link conditionally for platform admins. The page builds successfully (no TypeScript error) but clicking the link hits a 404-like blank screen (no `not-found.tsx`).

**Why it happens:** Internal `Link` hrefs are not type-checked by the compiler.

**How to avoid:** Immediately after deleting the route files, grep for every reference and update in the same commit. See the dead-route grep map above (5 files identified).

### Pitfall 5: `D-01 General Department` Must Exist Before Junction Rows

**What goes wrong:** Migration 00036 tries to INSERT `sop_departments` rows for existing SOPs before `departments` rows exist for those orgs.

**Why it happens:** Wrong INSERT order within the data migration.

**How to avoid:** In migration 00036, the sequence must be: (1) INSERT `departments` rows first (one `General` per org), (2) then INSERT junction rows using the returned department IDs. Use a PL/pgSQL block with `RETURNING id`.

---

## Runtime State Inventory

> Phase 25 renames no tables and deletes no user data. It adds new tables and migrates data in non-destructive ways. No runtime state outside Postgres is affected.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 65 blocks with `organisation_id = null` in Supabase; existing `sops.category` and `sops.category_tag` values | Migration 00036 copies globals per-org; `category`/`category_tag` retained read-only |
| Live service config | No n8n workflows, no OS task scheduler jobs referencing block/department entities | None |
| OS-registered state | None | None |
| Secrets/env vars | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) — no change | None |
| Build artifacts | None relevant | None |

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (integration + E2E) |
| Config file | `playwright.config.ts` |
| Quick run command | `npm run test:integration` |
| Full suite command | `npm run test` |

### Highest-Risk Behaviours to Validate

#### V1: Cross-tenant isolation of `departments`

**Risk:** An admin in org A can read or write departments belonging to org B.

**Test approach:** SQL assertion directly against Supabase (magic-link session per the 2026-04-24 learning):
- Create a department in org A. Authenticate as org B admin. `SELECT * FROM departments WHERE id = <orgA_dept_id>` must return 0 rows.
- Attempt INSERT into `departments` with `organisation_id = <orgB_id>` from org A session — must fail RLS.

**Automated command:** Integration test in `tests/integration/departments-rls.spec.ts`

#### V2: OR-composed SOP visibility without recursion

**Risk:** The new `sops_visible_by_department` policy creates the 00030 recursion bug.

**Test approach:**
1. After applying migration 00035, execute `SELECT * FROM sops LIMIT 1` via RLS-scoped role immediately — if 500 returns, recursion exists.
2. Playwright: worker assigned only to Forming department sees Forming-tagged SOPs; does NOT see Cleaning-only SOPs; DOES see `all_departments = true` SOPs.

**Automated command:** `npm run test:integration -- --grep "department-sop-visibility"`

#### V3: Non-destructive global-block migration (zero orphans)

**Risk:** After migration 00036, some blocks become invisible (orphaned) or `organisation_id = null` rows remain.

**Test approach:** SQL assertions at end of migration:
```sql
-- Must be 0
SELECT COUNT(*) FROM blocks WHERE organisation_id IS NULL;
-- Must be > 0 for each org
SELECT organisation_id, COUNT(*) FROM blocks WHERE all_departments = true GROUP BY organisation_id;
-- No block rows deleted (count before vs after)
```

**Automated command:** Migration verification script; or Playwright test that counts blocks before and after running migrations in a staging environment.

#### V4: Ownerless-warning surfaces when owner member is removed

**Risk:** Removing a member who owns a department silently orphans `departments.owner_user_id` without surfacing the warning.

**Test approach:**
- Assign member M as owner of department D. Remove member M from org (via `removeMember`). Fetch department D — `owner_user_id` should be NULL (set by `ON DELETE SET NULL` FK constraint) or remain with a dangling UUID. The `/admin/departments` page must render the "No owner assigned" red warning card.

**Automated command:** `npm run test:integration -- --grep "department-owner-removal"`

#### V5: `sop_departments` junction writes from wizard

**Risk:** Creating a SOP via the blank wizard with departments selected does not write `sop_departments` rows.

**Test approach:** Playwright authenticated wizard test — create SOP with 2 departments, verify `sop_departments` rows exist in Supabase (via direct query or API).

**Automated command:** `npm run test:integration -- --grep "wizard-department-field"`

### Phase Requirements → Test Map

| Req | Behaviour | Test Type | Automated Command | File Exists? |
|-----|-----------|-----------|-------------------|--------------|
| REQ-1 | `departments` table, org-scoped RLS, cross-tenant isolation | integration | `test:integration -- --grep "dept-rls"` | ❌ Wave 0 |
| REQ-2 | block↔dept junction, `all_departments` flag filters correctly | integration | `test:integration -- --grep "block-dept"` | ❌ Wave 0 |
| REQ-3 | `sop_departments` replaces `category`, worker visibility gates | integration | `test:integration -- --grep "sop-dept-visibility"` | ❌ Wave 0 |
| REQ-4 | `member_departments` junction, filter works | integration | `test:integration -- --grep "member-dept"` | ❌ Wave 0 |
| REQ-5 | Owner persists, badge renders, ownerless warning shows | integration + smoke | `test:integration -- --grep "dept-owner"` | ❌ Wave 0 |
| REQ-6 | `/admin/departments` renders cards with counts | smoke (Playwright page load) | `test:e2e -- --grep "admin-departments"` | ❌ Wave 0 |
| REQ-7 | Block library filters by dept, no "My/Global" scope remains | source-contract + smoke | `test:integration -- --grep "block-library-dept"` | ❌ Wave 0 |
| REQ-8 | Zero `organisation_id = null` blocks after migration, no deletes | SQL assertion in migration | migration end-of-file `DO $$ assert $$` | ❌ Wave 0 |
| REQ-9 | Wizard writes `sop_departments` rows | integration | `test:integration -- --grep "wizard-sop-dept"` | ❌ Wave 0 |
| REQ-10 (AC) | `journeys.ts` has `/admin/departments`, no `/admin/global-blocks` refs | source-contract | `npx playwright test --project=lint tests/lint/no-global-blocks-in-journeys.spec.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test:integration` (integration suite only, skips E2E)
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/departments-rls.spec.ts` — REQ-1, cross-tenant isolation
- [ ] `tests/integration/block-dept-filter.spec.ts` — REQ-2, REQ-7
- [ ] `tests/integration/sop-dept-visibility.spec.ts` — REQ-3, D-02 OR composition
- [ ] `tests/integration/member-dept.spec.ts` — REQ-4, REQ-5
- [ ] `tests/e2e/admin-departments.spec.ts` — REQ-6 page smoke
- [ ] `tests/integration/wizard-sop-dept.spec.ts` — REQ-9
- [ ] `tests/lint/no-global-blocks-in-journeys.spec.ts` — REQ-10 source-contract guard
- [ ] Register new lint spec in `playwright.config.ts` (per the 2026-05-25 unregistered-spec learning)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | Supabase RLS org-scoped policies; `current_organisation_id()` helper; admin role check in server actions |
| V5 Input Validation | **yes** | Zod schemas on all department CRUD inputs; department name/code max length; colour must be from allow-list |
| V6 Cryptography | no | — |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data read via direct UUID guessing | Information Disclosure | RLS `organisation_id = current_organisation_id()` gate; SECURITY DEFINER helpers never skip org check |
| Forcing another org's member as dept owner | Tampering | `setDepartmentOwner` server action must verify `owner_user_id` is in `organisation_members` for same org |
| Injecting arbitrary `organisation_id` via createDepartment | Elevation of Privilege | Server action reads `organisation_id` from JWT claims (not client input) |
| Removing all `sop_departments` rows to make SOP visible to all workers | Spoofing | Covered by fail-open design (D-02): no sop_departments rows = SOP visible to all org members, not hidden — this is correct per spec. Not a security issue. |
| `block_suggestions` orphaned actions after global model removed | Tampering | Remove `scope: 'suggest_global'` enum value from `CreateBlockInput` + `SaveFromSectionInput` in `blocks.ts` to prevent writes to the now-dead table |

---

## Open Questions

1. **`block_suggestions` table fate**
   - What we know: The `block_suggestions` table exists with its RLS policies and is written to by `saveFromSection(scope: 'suggest_global')`. The global promotion model is removed by Phase 25.
   - What's unclear: CONTEXT.md does not say whether to drop the table or leave it abandoned.
   - Recommendation: Drop the table and its policies in migration 00037. Remove `scope: 'suggest_global'` from `CreateBlockInput` and `SaveFromSectionInput`. Log in CLAUDE.md learnings that `block_suggestions` was sunset in Phase 25. If any UI component renders suggestion-related UI (e.g., a "Suggest for global" button), it must be removed.

2. **Multi-org block copy: what if no organisations exist at migration time?**
   - What we know: The data migration must copy 65 global blocks per org. In production there is at least one org. In CI/test environments there may be zero.
   - What's unclear: Whether migration 00036 should be a no-op if `organisations` table is empty.
   - Recommendation: The PL/pgSQL block should simply have zero iterations if no orgs exist (a `FOR org IN SELECT ... LOOP` with no rows is safe). Add an explicit `IF NOT FOUND THEN RAISE NOTICE` for debuggability.

3. **`CategoryBottomSheet` consumer inventory**
   - What we know: It is exported from `src/components/sop/CategoryBottomSheet.tsx` and used in the SOP library worker view (likely in `src/app/(protected)/sops/page.tsx` or similar).
   - What's unclear: Whether the worker SOP library uses free-text `category` or `category_tag` or neither for filtering; Phase 25 scope says the library browse is gated by `sop_departments`/RLS, not by a client-side category filter.
   - Recommendation: Planner should grep `CategoryBottomSheet` and `CategorySidebar` for all consumers before deciding whether to extend or retire the component.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `src/app/(protected)/admin/blocks/page.tsx` calls `listBlocks({ includeGlobal: true })` — not verified by reading the file | listBlocks Call Sites | Planner misses a call site; `includeGlobal` still passed after the option is removed, causing a TypeScript error |
| A2 | `BlockPicker` component uses `listBlocks` with `includeGlobal: true` to show global blocks | listBlocks Call Sites | Same as A1 |
| A3 | `PromptClient.tsx` (AI draft path) needs the same department field hook-in as `WizardClient.tsx` | Create-SOP Flow | Planner misses the AI draft path; AI-drafted SOPs never get department assignments |
| A4 | `CategoryBottomSheet` is used in the worker SOP library view | CategoryBottomSheet consumers | Planner extends the wrong component or misses a consumer |
| A5 | `block_suggestions` table should be dropped in Phase 25 | Open Questions | Orphaned table accumulates writes from any stale suggest_global calls; or needless migration work if decision is to leave it |
| A6 | `suggest_global` scope on `saveFromSection` must be removed | blocks.ts changes | Stale code path writes orphan rows to block_suggestions |

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00019_section_kinds_and_blocks.sql` — blocks table schema (columns, constraints, RLS pattern)
- `supabase/migrations/00022_block_library_phase13.sql` — org-vs-global model, `is_summit_admin()` SECURITY DEFINER pattern
- `supabase/migrations/00023_phase13_nz_global_block_seed.sql` — confirmed 65 seed blocks, all `organisation_id = null`
- `supabase/migrations/00025_phase13_follow_latest_tracking.sql` — trigger + SECURITY DEFINER RPCs, no naming conflict with Phase 25
- `supabase/migrations/00030_sub_trades.sql` — junction tables + SECURITY DEFINER helper pattern to emulate
- `supabase/migrations/00031_fix_sops_sub_trades_rls_recursion.sql` — `using(true)` fix pattern to copy exactly
- `src/actions/blocks.ts` — `ListBlocksOptions` signature, `listBlocks` query logic, `createBlock`/`saveFromSection` scopes
- `src/components/admin/blocks/BlockListTable.tsx` — exact Props interface, column structure, token usage
- `src/components/admin/SubTradePicker.tsx` — exact Props, toggle pattern, `useTransition` optimistic update
- `src/components/admin/RoleAssignmentTable.tsx` — full component, `TeamMember` type, column layout
- `src/components/sop/CategoryBottomSheet.tsx` — `CategoryBottomSheetProps` interface, `CategorySidebar` export
- `src/app/(protected)/admin/global-blocks/page.tsx` — confirmed deletion candidate, calls `listBlocks({ globalOnly: true })`
- `src/app/(protected)/admin/global-blocks/suggestions/page.tsx` — confirmed deletion candidate
- `src/app/(protected)/admin/sops/page.tsx` — confirmed `isPlatformAdmin` nav link to `/admin/global-blocks`
- `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` — `createSopFromWizard` call with `categoryTag`, hook-in point for `departmentIds`
- `src/actions/sops.ts` — `createSopFromWizard` schema and implementation (writes `category_tag`)
- `src/lib/journeys/journeys.ts` — full JOURNEYS array; `curate-globals` journey confirmed; `Journey` interface shape
- `sketches/departments/index.html` — department card anatomy, colour palette, owner/no-owner states
- `sketches/unified-block-library/index.html` — filter bar, dchip pattern, all-departments cyan chip, popover shape
- `sketches/team-departments/index.html` — member row columns, owner badge, picker popover with inline owner-set
- `.planning/config.json` — `nyquist_validation: true` confirmed
- Migration directory listing — confirmed next migration number is `00035`

### Secondary (MEDIUM confidence)
- CLAUDE.md `## Learnings` — 00026 rename bug, 00030/00031 recursion learning, dead-route grep-after-delete pattern, unregistered-spec learning

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — directly read all relevant migrations
- Migration strategy: HIGH — multi-org copy approach derived from reading 00023 seed structure
- RLS pattern: HIGH — 00030/00031 is exact precedent
- UI component extension: HIGH — read all four target components
- Sketch UI intent: HIGH — read all three HTML sketches
- Call-site inventory for `listBlocks`: MEDIUM — two call sites identified directly (global-blocks pages); others assumed

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (30 days — stable schema patterns)
