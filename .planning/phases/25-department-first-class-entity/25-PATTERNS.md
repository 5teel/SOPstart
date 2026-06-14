# Phase 25: Department as a First-Class Entity — Pattern Map

**Mapped:** 2026-06-15
**Files analysed:** 22 (new/modified/deleted)
**Analogs found:** 22 / 22

---

## File Classification

| New/Modified/Deleted File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------------|------|-----------|----------------|---------------|
| `supabase/migrations/00035_departments_schema.sql` | migration | CRUD | `supabase/migrations/00030_sub_trades.sql` | exact |
| `supabase/migrations/00036_departments_data.sql` | migration | batch/transform | `supabase/migrations/00023_phase13_nz_global_block_seed.sql` | role-match |
| `supabase/migrations/00037_departments_rls_cleanup.sql` | migration | CRUD | `supabase/migrations/00031_fix_sops_sub_trades_rls_recursion.sql` | exact |
| `src/actions/departments.ts` | service | CRUD | `src/actions/blocks.ts` | exact |
| `src/actions/blocks.ts` (MODIFY) | service | CRUD | self | exact |
| `src/actions/sops.ts` (MODIFY) | service | CRUD | self | exact |
| `src/components/admin/departments/DepartmentPicker.tsx` | component | event-driven | `src/components/admin/SubTradePicker.tsx` | exact |
| `src/components/admin/departments/DChip.tsx` | component | request-response | `src/components/admin/SubTradePicker.tsx` pill fragment | role-match |
| `src/components/admin/departments/DepartmentCard.tsx` | component | request-response | `src/components/admin/blocks/BlockListTable.tsx` row | role-match |
| `src/components/admin/departments/DepartmentGrid.tsx` | component | request-response | `src/app/(protected)/admin/blocks/page.tsx` | role-match |
| `src/components/admin/blocks/BlockListTable.tsx` (MODIFY) | component | CRUD | self | exact |
| `src/components/admin/RoleAssignmentTable.tsx` (MODIFY) | component | CRUD | self | exact |
| `src/components/sop/CategoryBottomSheet.tsx` (MODIFY/REPLACE) | component | event-driven | self | exact |
| `src/app/(protected)/admin/departments/page.tsx` | route/page | request-response | `src/app/(protected)/admin/blocks/page.tsx` | exact |
| `src/app/(protected)/admin/blocks/page.tsx` (MODIFY) | route/page | request-response | self | exact |
| `src/app/(protected)/admin/team/page.tsx` (MODIFY) | route/page | request-response | self | exact |
| `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` (MODIFY) | component | event-driven | self | exact |
| `src/app/(protected)/admin/global-blocks/page.tsx` (DELETE) | — | — | — | — |
| `src/app/(protected)/admin/global-blocks/suggestions/page.tsx` (DELETE) | — | — | — | — |
| `src/app/(protected)/admin/sops/page.tsx` (MODIFY) | route/page | request-response | self | exact |
| `src/lib/journeys/journeys.ts` (MODIFY) | config | — | self | exact |
| `src/types/sop.ts` (MODIFY) | model | — | self | exact |

---

## Pattern Assignments

### `supabase/migrations/00035_departments_schema.sql` (migration, CRUD)

**Analog:** `supabase/migrations/00030_sub_trades.sql`

**Overall file structure** — copy this skeleton exactly:
```sql
begin;

-- 1. departments table (org-scoped)
-- 2. block_departments junction
-- 3. sop_departments junction
-- 4. member_departments junction
-- 5. SECURITY DEFINER helpers
-- 6. ADD COLUMN blocks.all_departments, sops.all_departments

commit;
```

**Table + RLS pattern** (from `00030` lines 23–68 — the `sub_trades` + `users_sub_trades` tables):
```sql
create table if not exists public.departments (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  code             text not null,
  colour           text not null default '#3b82f6',
  icon             text,
  owner_user_id    uuid references auth.users(id) on delete set null,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organisation_id, code)
);

alter table public.departments enable row level security;

create policy "departments_org_read" on public.departments
  for select to authenticated
  using (organisation_id = current_organisation_id());

-- Admin writes only
create policy "departments_admin_insert" on public.departments
  for insert to authenticated
  with check (
    organisation_id = current_organisation_id()
    and exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );
```

**Junction table pattern** (mirror `users_sub_trades` / `sops_sub_trades` from `00030` lines 43–97):
```sql
-- Non-sensitive UUID-pair junctions — using(true) for SELECT to avoid recursion
-- (exact fix from migration 00031)

create table if not exists public.block_departments (
  block_id       uuid not null references public.blocks(id) on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  primary key (block_id, department_id)
);
alter table public.block_departments enable row level security;
create policy "block_departments_read_all_auth" on public.block_departments
  for select to authenticated using (true);
-- writes: admin server actions only — no authenticated INSERT policy

create table if not exists public.sop_departments (
  sop_id         uuid not null references public.sops(id) on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  primary key (sop_id, department_id)
);
alter table public.sop_departments enable row level security;
create policy "sop_departments_read_all_auth" on public.sop_departments
  for select to authenticated using (true);

create table if not exists public.member_departments (
  member_id      uuid not null references auth.users(id) on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  assigned_at    timestamptz not null default now(),
  assigned_by    uuid references auth.users(id),
  primary key (member_id, department_id)
);
alter table public.member_departments enable row level security;
create policy "member_departments_self_read" on public.member_departments
  for select to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );
```

**SECURITY DEFINER helpers** (mirror `current_user_sub_trades` + `sub_trade_id_intersects` from `00030` lines 103–134):
```sql
create or replace function public.current_user_department_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
  select department_id from public.member_departments where member_id = auth.uid();
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

**Column additions:**
```sql
alter table public.blocks
  add column if not exists all_departments boolean not null default false;

alter table public.sops
  add column if not exists all_departments boolean not null default false;
```

**Third permissive SELECT policy on `sops`** (additive OR — do NOT touch existing policies):
```sql
create policy "sops_visible_by_department" on public.sops
  for select to authenticated
  using (
    sops.all_departments = true
    or not exists (select 1 from public.sop_departments sd where sd.sop_id = sops.id)
    or sop_in_user_departments(sops.id)
  );
```

**CRITICAL ANTI-PATTERN to avoid** (per `00031` learning): Never write a SELECT policy on `sop_departments` / `block_departments` that references `sops` or `blocks` — this creates the 00030 recursion bug (`42P17`). All three junction tables must use `using(true)` for SELECT.

---

### `supabase/migrations/00036_departments_data.sql` (migration, batch/transform)

**Analog:** `supabase/migrations/00023_phase13_nz_global_block_seed.sql` (structure: `begin; inserts; commit;`)

**Required data steps — PL/pgSQL loop pattern:**
```sql
begin;

DO $$
DECLARE
  org RECORD;
  dept_id uuid;
  global_block RECORD;
BEGIN
  -- Step 1: Create one 'General' department per existing org
  FOR org IN SELECT id FROM public.organisations LOOP
    INSERT INTO public.departments (organisation_id, name, code, colour)
    VALUES (org.id, 'General', 'GEN', '#3b82f6')
    ON CONFLICT DO NOTHING
    RETURNING id INTO dept_id;

    -- Step 2: Assign ALL existing org-owned SOPs for this org to General dept
    INSERT INTO public.sop_departments (sop_id, department_id)
    SELECT s.id, dept_id
    FROM public.sops s
    WHERE s.organisation_id = org.id
    ON CONFLICT DO NOTHING;

    -- Step 3: Assign ALL existing org-owned blocks to General dept
    INSERT INTO public.block_departments (block_id, department_id)
    SELECT b.id, dept_id
    FROM public.blocks b
    WHERE b.organisation_id = org.id
    ON CONFLICT DO NOTHING;

    -- Step 4: Copy each global block (organisation_id IS NULL) to this org
    -- with all_departments = true. Do NOT update in-place (other orgs would lose access).
    FOR global_block IN SELECT * FROM public.blocks WHERE organisation_id IS NULL LOOP
      INSERT INTO public.blocks (organisation_id, kind_slug, name, category_tags,
                                  free_text_tags, created_by, all_departments, current_version_id)
      SELECT org.id, global_block.kind_slug, global_block.name,
             global_block.category_tags, global_block.free_text_tags,
             global_block.created_by, true, global_block.current_version_id
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Step 5: Delete original global rows (organisation_id IS NULL) AFTER per-org copies made
  DELETE FROM public.blocks WHERE organisation_id IS NULL;

  -- Idempotency assertion
  IF (SELECT COUNT(*) FROM public.blocks WHERE organisation_id IS NULL) > 0 THEN
    RAISE EXCEPTION 'Migration failed: orphaned global blocks remain';
  END IF;
END;
$$;

commit;
```

**Key ordering rule (D-01 / Pitfall 5):** INSERT `departments` rows BEFORE inserting junction rows. Use `RETURNING id` to capture the new department id.

---

### `supabase/migrations/00037_departments_rls_cleanup.sql` (migration, CRUD)

**Analog:** `supabase/migrations/00031_fix_sops_sub_trades_rls_recursion.sql` (drop-then-replace pattern)

**Pattern** (from `00031` lines 28–38):
```sql
begin;

-- Drop global-write RLS policies no longer applicable (org/global model removed)
drop policy if exists "blocks_global_read" on public.blocks;         -- 00019/00022 null-org read
drop policy if exists "blocks_platform_admin_write" on public.blocks; -- 00022 global write gate
drop policy if exists "block_suggestions_read_pending" on public.block_suggestions;
drop table if exists public.block_suggestions;

-- Remove platform_admin guard function references if no other consumer
-- (verify before dropping — is_platform_admin() may still be used by other policies)

commit;
```

---

### `src/actions/departments.ts` (service, CRUD)

**Analog:** `src/actions/blocks.ts`

**Imports + requireAdmin pattern** (from `blocks.ts` lines 1–55):
```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Department } from '@/types/sop'

async function requireAdmin() { /* same pattern as blocks.ts lines 40–55 */ }
```

**Zod input schemas** (mirror `CreateBlockInput` at `blocks.ts` line 77):
```typescript
const CreateDepartmentInput = z.object({
  name:    z.string().min(1).max(100),
  code:    z.string().min(1).max(6).toUpperCase(),
  colour:  z.enum(['#f97316','#3b82f6','#06b6d4','#10b981','#ec4899','#ef4444','#fbbf24','#8b5cf6']),
  icon:    z.string().max(4).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
})

const AssignDepartmentsInput = z.object({
  targetId:      z.string().uuid(),
  departmentIds: z.array(z.string().uuid()).max(20),
  allDepartments: z.boolean().optional().default(false),
})
```

**CRUD function structure** (mirror `archiveBlock` at `blocks.ts` lines 391–410 for simple mutations):
```typescript
export async function createDepartment(
  input: z.input<typeof CreateDepartmentInput>
): Promise<{ department: Department } | { error: string }> {
  const parsed = CreateDepartmentInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data, error } = await ctx.supabase
    .from('departments')
    .insert({ ...parsed.data, organisation_id: ctx.organisationId })
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to create department' }
  return { department: data as unknown as Department }
}
```

**Replace-semantics junction write** (pattern for `assignMemberDepartments`, `assignBlockDepartments`, `assignSopDepartments`):
```typescript
export async function assignMemberDepartments(
  memberId: string,
  departmentIds: string[]
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // Replace semantics: delete existing, insert new
  const { error: delErr } = await ctx.supabase
    .from('member_departments')
    .delete()
    .eq('member_id', memberId)
  if (delErr) return { error: delErr.message }

  if (departmentIds.length > 0) {
    const rows = departmentIds.map(department_id => ({ member_id: memberId, department_id, assigned_by: ctx.user.id }))
    const { error: insErr } = await ctx.supabase.from('member_departments').insert(rows)
    if (insErr) return { error: insErr.message }
  }
  return { success: true }
}
```

**listDepartments with counts** — use Supabase aggregates or separate count queries, returning:
```typescript
export type DepartmentWithCounts = Department & {
  people_count: number
  sop_count: number
  block_count: number
}
```

**Security constraint (D-03):** `setDepartmentOwner` must verify `owner_user_id` exists in `organisation_members` for the same org before updating `departments.owner_user_id`.

---

### `src/actions/blocks.ts` (MODIFY, service, CRUD)

**Analog:** self

**Option type change** (lines 132–150 — remove `includeGlobal` / `globalOnly`, add `departmentId`):
```typescript
// BEFORE (remove these):
//   includeGlobal?: boolean
//   globalOnly?: boolean

// AFTER (replace with):
export type ListBlocksOptions = {
  kindSlug?: string
  includeArchived?: boolean
  departmentId?: string        // NEW: filter to this dept (or all_departments=true)
  includeContent?: boolean
  includeParsedInline?: boolean
}
```

**Query logic change** (lines 451–458 — replace the `globalOnly`/`includeGlobal` branch):
```typescript
// REMOVE:
//   if (opts.globalOnly) { query = query.is('organisation_id', null) }
//   else if (!opts.includeGlobal) { query = query.not('organisation_id', 'is', null) }

// REPLACE WITH:
if (opts.departmentId) {
  // blocks tagged to this department OR org-wide
  // requires a join — use supabase .or() with subquery or an RPC
  // Simplest: fetch block ids from block_departments first, then OR with all_departments
  // (planner chooses RPC vs application-layer join based on Supabase JS version)
}
// RLS already excludes organisation_id IS NULL after migration 00036 — no explicit filter needed
```

**Also remove** (lines 77–106): `scope: z.enum(['org', 'global'])` from `CreateBlockInput` — replace with `scope: z.enum(['org'])` (global scope no longer exists).

**Also remove** (lines 117–125): `scope: z.enum(['org', 'suggest_global'])` from `SaveFromSectionInput` — replace with `scope: z.enum(['org'])` and remove the `if (data.scope === 'suggest_global')` branch (lines 562–596).

**Remove** functions `listBlockSuggestions`, `promoteSuggestion`, `rejectSuggestion`, `requirePlatformAdmin` — these only served the global-blocks model being deleted.

---

### `src/actions/sops.ts` (MODIFY, service, CRUD)

**Analog:** self — specifically the `createSopFromWizard` function

**Input schema extension** (add after existing fields):
```typescript
// In the createSopFromWizard Zod schema, add:
departmentIds:  z.array(z.string().uuid()).max(20).optional().default([]),
allDepartments: z.boolean().optional().default(false),
```

**Post-insert junction writes** (add after the `sops` INSERT, mirroring the `assignSopDepartments` pattern from `departments.ts`):
```typescript
// After sop row is inserted and sopId is known:
if (data.allDepartments) {
  await supabase.from('sops').update({ all_departments: true }).eq('id', sopId)
} else if (data.departmentIds.length > 0) {
  const rows = data.departmentIds.map(department_id => ({ sop_id: sopId, department_id }))
  await supabase.from('sop_departments').insert(rows)
}
```

---

### `src/components/admin/departments/DepartmentPicker.tsx` (component, event-driven)

**Analog:** `src/components/admin/SubTradePicker.tsx` — copy this file and adapt

**Full file pattern** (from `SubTradePicker.tsx` lines 1–140):
```typescript
'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { assignMemberDepartments, assignBlockDepartments, assignSopDepartments } from '@/actions/departments'
import type { Department } from '@/types/sop'

type Props =
  | { mode: 'member'; memberId: string; departments: Department[]; selectedIds: string[]; onChange?: (ids: string[]) => void }
  | { mode: 'block';  blockId: string;  departments: Department[]; selectedIds: string[]; allDepartments?: boolean; onChange?: (ids: string[], all: boolean) => void }
  | { mode: 'sop';    sopId: string;    departments: Department[]; selectedIds: string[]; allDepartments?: boolean; onChange?: (ids: string[], all: boolean) => void }
```

**Key delta from SubTradePicker:**
1. `departments` prop passed in (pre-fetched by server component) — no internal `listSubTrades()` fetch
2. `selectedIds` prop passed in — no internal `getUserSubTrades()` / `getSopSubTrades()` fetch (initial state comes from server)
3. Render a colour swatch `<span style={{ background: dept.colour }} />` (7×7px, rounded-sm) before each label
4. For `mode: 'block'` and `mode: 'sop'`: add an "All departments" toggle option — when checked, clear individual IDs and set `allDepartments = true`; when unchecked, revert to individual selection
5. For `mode: 'member'`: add inline owner-set affordance (see team surface spec in UI-SPEC.md)

**Toggle + optimistic update pattern** (from `SubTradePicker.tsx` lines 72–92 — copy exactly):
```typescript
function toggle(id: string) {
  const prev = new Set(selectedIds)
  const next = new Set(selectedIds)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  setSelectedIds(next)
  startTransition(async () => {
    setError(null)
    const result = props.mode === 'member'
      ? await assignMemberDepartments(props.memberId, Array.from(next))
      : props.mode === 'block'
        ? await assignBlockDepartments(props.blockId, Array.from(next), allDepts)
        : await assignSopDepartments(props.sopId, Array.from(next), allDepts)
    if ('error' in result) {
      setError(result.error)
      setSelectedIds(prev)  // revert on error
    } else {
      props.onChange?.(Array.from(next), allDepts)
    }
  })
}
```

**Pill button pattern** (from `SubTradePicker.tsx` lines 115–132 — add swatch):
```typescript
<button
  key={dept.id}
  type="button"
  onClick={() => toggle(dept.id)}
  disabled={pending}
  aria-pressed={isOn}
  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
    isOn
      ? 'bg-[var(--ink-900)] text-[var(--paper)] border-[var(--ink-900)]'
      : 'bg-[var(--paper)] text-[var(--ink-700)] border-[var(--ink-200)] hover:border-[var(--ink-500)]'
  }`}
>
  <span style={{ background: dept.colour }} className="w-1.5 h-1.5 rounded-sm flex-shrink-0" aria-hidden />
  {dept.name}
</button>
```

---

### `src/components/admin/departments/DChip.tsx` (component, request-response)

**Analog:** inline chip `<span>` fragments in `BlockListTable.tsx` (lines 93–105) — extract into a standalone component

**Full component** (new file, implement to UI-SPEC contract):
```typescript
interface DChipProps {
  variant: 'department' | 'all-departments' | 'add'
  department?: { name: string; colour: string }
  showOwnerStar?: boolean
  onClick?: () => void
}

export function DChip({ variant, department, showOwnerStar, onClick }: DChipProps) {
  if (variant === 'all-departments') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
                       text-[var(--accent-mcu)] border border-[var(--accent-mcu)]"
            style={{ background: 'rgba(6,182,212,0.06)' }}>
        ◇ All departments
      </span>
    )
  }
  if (variant === 'add') {
    return (
      <button type="button" onClick={onClick}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold
                         text-[var(--accent-step)] border border-dashed border-[var(--accent-step)]
                         cursor-pointer min-h-[44px] min-w-[44px]"
              style={{ background: 'rgba(59,130,246,0.04)' }}>
        ＋
      </button>
    )
  }
  // variant === 'department'
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
                     text-[var(--ink-700)] border border-[var(--ink-300)] bg-[var(--paper-2)]">
      <span style={{ background: department!.colour }} className="w-1.5 h-1.5 rounded-sm flex-shrink-0" aria-hidden />
      {department!.name}{showOwnerStar ? ' ★' : ''}
    </span>
  )
}
```

---

### `src/components/admin/blocks/BlockListTable.tsx` (MODIFY, component, CRUD)

**Analog:** self

**Props change** (lines 10–13 — replace `categories` with `departments`):
```typescript
// BEFORE:
interface Props {
  blocks: Array<Block & { currentContent?: unknown }>
  categories: BlockCategory[]
}

// AFTER:
interface Props {
  blocks: Array<Block & { currentContent?: unknown; departmentIds?: string[]; allDepartments?: boolean }>
  departments: Department[]
}
```

**Column header change** (lines 57–65 — replace "Categories" header with "Departments"):
```typescript
// Remove: <th className="px-4 py-3 text-left">Categories</th>
// Add:    <th className="px-4 py-3 text-left">Departments</th>
```

**Row: remove GLOBAL badge** (lines 80–85 — delete the `isGlobal &&` block entirely):
```typescript
// DELETE this block:
// {isGlobal && (
//   <span className="ml-2 text-[10px] font-bold uppercase ...">GLOBAL</span>
// )}
```

**Row: replace category chips with department chips** (lines 91–107 — replace `category_tags` chips with `DChip` components):
```typescript
// REPLACE the category_tags .map() cell with:
<td className="px-4 py-3">
  <div className="flex flex-wrap gap-1">
    {b.allDepartments
      ? <DChip variant="all-departments" />
      : (b.departmentIds ?? []).map(dId => {
          const dept = deptMap.get(dId)
          return dept ? <DChip key={dId} variant="department" department={dept} /> : null
        })
    }
  </div>
</td>
```

**Row: add "Departments ▾" button** (in the actions `<td>`, before Archive button — lines 121–133):
```typescript
// Add before the archive button:
<button type="button" onClick={() => setOpenPickerId(b.id)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--ink-500)]
                   border border-transparent hover:text-[var(--ink-900)] hover:border-[var(--ink-300)] transition-colors">
  Departments ▾
</button>
// DepartmentPicker popover rendered conditionally when openPickerId === b.id
```

**Also add** `const deptMap = new Map(departments.map(d => [d.id, d]))` at the top of the component (mirrors `categoryMap` at line 27).

---

### `src/components/admin/RoleAssignmentTable.tsx` (MODIFY, component, CRUD)

**Analog:** self

**Props change** (line 25 — add `departments` prop):
```typescript
// BEFORE: export default function RoleAssignmentTable({ orgId, inviteCode: initialCode }: { orgId: string; inviteCode: string })
// AFTER:
export default function RoleAssignmentTable({
  orgId,
  inviteCode: initialCode,
  departments,
}: {
  orgId: string
  inviteCode: string
  departments: Department[]
})
```

**Column header additions** (in the members list section — add after Role header):
```typescript
// Add to the column header row after role:
<div style={{ width: 230, flexShrink: 0 }}
     className="text-[9px] uppercase tracking-[0.08em] text-[var(--ink-500)]">
  Departments
</div>
```

**Member row additions** (in the member map — add owner badge after name, add dept column after role):
```typescript
// Owner badge (when member owns any departments):
{memberOwnedDepts.map(d => (
  <span key={d.id} className="text-[8px] font-bold uppercase tracking-[0.05em] inline-flex items-center gap-1
                               px-1 py-px rounded border border-[var(--accent-signoff)]"
        style={{ color: '#a16207', background: 'rgba(251,191,36,0.16)' }}>
    ★ Owns {d.name}
  </span>
))}

// Dept column — DepartmentPicker in mode='member':
<div style={{ width: 230, flexShrink: 0 }} className="flex flex-wrap gap-1 items-center">
  <DepartmentPicker
    mode="member"
    memberId={member.id}
    departments={departments}
    selectedIds={member.department_ids ?? []}
    onChange={(ids) => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, department_ids: ids } : m))}
  />
</div>
```

**`TeamMember` type** (in `src/actions/auth.ts` — add field):
```typescript
// Add to TeamMember type:
department_ids: string[]
```

---

### `src/components/sop/CategoryBottomSheet.tsx` (MODIFY/REPLACE, component, event-driven)

**Analog:** self

**New props contract** (replaces old `CategoryBottomSheetProps`):
```typescript
// OLD:
// interface CategoryBottomSheetProps {
//   categories: CategoryItem[]
//   activeCategory: string | null
//   onSelect: (category: string | null) => void
//   open: boolean
//   onClose: () => void
// }

// NEW — DepartmentBottomSheet:
interface DepartmentBottomSheetProps {
  departments: Department[]
  selectedIds: string[]
  allDepartments: boolean
  onSelect: (ids: string[], allDepts: boolean) => void
  open: boolean
  onClose: () => void
}
```

**Grep before modifying:** Run `grep -rn "CategoryBottomSheet\|CategorySidebar" src` to find all consumers before replacing. If the worker SOP library (`/sops/page.tsx`) uses `CategorySidebar`, that consumer must be updated to `DepartmentSidebar` in the same wave.

**Visual pattern:** Preserve the slide-up panel structure exactly. Replace `CategoryItem[]` iteration with `departments` iteration, add colour swatch per row, add "All departments" option at top (cyan chip style). "Done" button at bottom commits the selection (same as current "close on select" pattern or explicit Done button per UI-SPEC).

---

### `src/app/(protected)/admin/departments/page.tsx` (route/page, request-response)

**Analog:** `src/app/(protected)/admin/blocks/page.tsx`

**Server component pattern** (from `blocks/page.tsx` lines 1–53 — copy auth + redirect pattern exactly):
```typescript
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listDepartments } from '@/actions/departments'
import { DepartmentGrid } from '@/components/admin/departments/DepartmentGrid'

export const metadata: Metadata = { title: 'Departments' }

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  const departments = await listDepartments()  // returns DepartmentWithCounts[]

  return (
    <main className="max-w-[1000px] mx-auto px-6 py-6 pb-[60px]">
      {/* Sub-nav: SOPs | Library | Team | Departments */}
      {/* h1 + New department button */}
      <DepartmentGrid departments={departments} />
    </main>
  )
}
```

**Sub-nav pattern** (shared across all four admin pages — add "Departments" tab linking to `/admin/departments`):
```typescript
// Existing sub-nav in /admin/sops, /admin/blocks, /admin/team — extend with:
<Link href="/admin/departments"
      className={`pb-[11px] font-medium text-[13px] border-b-2 ${
        pathname === '/admin/departments'
          ? 'text-[var(--ink-900)] border-[var(--ink-900)]'
          : 'text-[var(--ink-500)] border-transparent'
      }`}>
  Departments
</Link>
```

---

### `src/app/(protected)/admin/blocks/page.tsx` (MODIFY, route/page, request-response)

**Analog:** self

**Remove** (lines 22–25): `SCOPE_TABS` constant and any scope tab rendering — the My/Global distinction is gone.

**Remove** (lines 46–53): `scope` param reading and `scope: 'global'` branch in `listBlocks` call.

**Add** department filter state (URL search param `dept`):
```typescript
// Add to searchParams destructuring:
const dept = params.dept  // undefined = All

// Pass to listBlocks:
const blocks = await listBlocks({ departmentId: dept, kind })
```

**Add** department fetch alongside blocks:
```typescript
const [blocks, departments] = await Promise.all([
  listBlocks({ departmentId: dept, kind }),
  listDepartments(),
])
```

**Pass `departments` to `BlockListTable`** (replace `categories` prop):
```typescript
// BEFORE: <BlockListTable blocks={blocks} categories={categories} />
// AFTER:  <BlockListTable blocks={blocks} departments={departments} />
```

**Add department filter bar** above the kind filter row — rendered as a server-rendered list of `<Link href="?dept=X">` buttons (no client state needed; active state derived from URL param).

---

### `src/app/(protected)/admin/sops/page.tsx` (MODIFY, route/page, request-response)

**Analog:** self

**Remove** (from RESEARCH line 171): the `isPlatformAdmin` conditional nav link to `/admin/global-blocks`:
```typescript
// DELETE this block (exact lines identified in RESEARCH.md line 171):
// {isPlatformAdmin && (
//   <Link href="/admin/global-blocks">Global blocks</Link>
// )}
```

**Add** Departments link to the sub-nav in this page as well (consistent with the shared sub-nav pattern above).

---

### `src/app/(protected)/admin/team/page.tsx` (MODIFY, route/page, request-response)

**Analog:** self

**Add `departments` fetch** alongside existing org/member fetches:
```typescript
// Add to the Promise.all or sequential fetches:
const departments = await listDepartments()

// Pass to RoleAssignmentTable:
<RoleAssignmentTable orgId={org.id} inviteCode={org.invite_code} departments={departments} />
```

---

### `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx` (MODIFY, component, event-driven)

**Analog:** self

**Add state** (after existing `categoryTag` state at line 61):
```typescript
const [departmentIds, setDepartmentIds] = useState<string[]>([])
const [allDepartments, setAllDepartments] = useState(false)
```

**Add prop** (extend `WizardClientProps` at line 51):
```typescript
interface WizardClientProps {
  categories: BlockCategory[]  // keep for backward compat or remove
  departments: Department[]    // NEW
}
```

**Add dept field in Step 1 render** (after the title/sopNumber fields, replacing/hiding the old SOP category select):
```typescript
// Hide old category select (retain prop for backward compat; don't render)
// Add:
<DepartmentPicker
  mode="sop"
  sopId="__new__"   // sentinel — picker in "create" mode passes ids via onChange, not server action
  departments={departments}
  selectedIds={departmentIds}
  allDepartments={allDepartments}
  onChange={(ids, all) => { setDepartmentIds(ids); setAllDepartments(all) }}
/>
<p className="text-xs text-[var(--ink-500)]">
  Leave empty to make visible to all members, or select departments to restrict visibility.
</p>
```

**Note on DepartmentPicker in "create" mode:** For the wizard, the picker must NOT fire server actions on toggle (the SOP doesn't exist yet). Use a local-only variant: pass a `localOnly` flag or use the `onChange` callback only, suppressing the internal `assignSopDepartments` call until `createSopFromWizard` runs. This is a delta from the `SubTradePicker` pattern — the create-wizard case requires local state only, then a single server call at submission.

**Pass dept fields to `createSopFromWizard`** in the submit handler:
```typescript
// In the existing submit call, add:
await createSopFromWizard({
  title: titleValues.title,
  sopNumber: titleValues.sopNumber,
  kindIds: selectedKindIds,
  // categoryTag removed from UI but schema retained for back-compat:
  departmentIds,
  allDepartments,
})
```

---

### `src/app/(protected)/admin/global-blocks/page.tsx` (DELETE)
### `src/app/(protected)/admin/global-blocks/suggestions/page.tsx` (DELETE)

No pattern — delete both files entirely. After deletion, run the dead-link grep from RESEARCH.md:

```
Files requiring updates after deletion (from RESEARCH.md lines 164–175):
1. src/actions/blocks.ts               — remove comment referencing /admin/global-blocks
2. src/lib/journeys/journeys.ts        — remove curate-globals journey entirely
3. src/lib/auth/platform-admin-guard.ts — update comment
4. src/app/(protected)/admin/sops/page.tsx — remove isPlatformAdmin nav link (handled above)
```

---

### `src/lib/journeys/journeys.ts` (MODIFY, config)

**Analog:** self

**Exact lines to change** (from journeys.ts lines 320–367):

**1. Remove `curate-globals` journey entirely** (lines 354–367 — delete the whole object):
```typescript
// DELETE:
// {
//   id: 'curate-globals',
//   group: 'Platform admin',
//   ...
// }
```

**2. Remove `'Platform admin'` from `JOURNEY_GROUPS`** (line 47 — remove the entry):
```typescript
// BEFORE:
export const JOURNEY_GROUPS = [
  ..., 'Library & team', 'Platform admin', 'Everyone',
] as const

// AFTER:
export const JOURNEY_GROUPS = [
  ..., 'Library & team', 'Everyone',
] as const
```

**3. Update `manage-team` journey** (lines 348–349 — extend the roles step detail):
```typescript
// BEFORE:
{ id: 'roles', type: 'action', label: 'Set roles + sub-trades', detail: 'Worker / Supervisor / SOP Admin / Safety Manager.' },

// AFTER:
{ id: 'roles', type: 'action', label: 'Set roles + sub-trades + departments', detail: 'Worker / Supervisor / SOP Admin / Safety Manager. Departments gate SOP visibility.' },
```

**4. Add `manage-departments` journey** (after `manage-team`, before Platform admin section):
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
},
```

**Verification:** After edits, confirm `/pathways` "All screens" shows 0 not-mapped for `/admin/departments` and no references to `/admin/global-blocks` or `/admin/global-blocks/suggestions` remain in the file.

---

### `src/types/sop.ts` (MODIFY, model)

**Analog:** self — existing `SubTrade` type as the template:
```typescript
// Existing SubTrade type to mirror:
export interface SubTrade {
  id: string
  slug: string
  label: string
  sort_order: number
  created_at: string
}

// New Department type (add to sop.ts):
export interface Department {
  id: string
  organisation_id: string
  name: string
  code: string
  colour: string
  icon: string | null
  owner_user_id: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface DepartmentWithCounts extends Department {
  people_count: number
  sop_count: number
  block_count: number
}
```

---

## Shared Patterns

### Authentication / Admin Guard
**Source:** `src/actions/blocks.ts` lines 40–55 (`requireAdmin` function)
**Apply to:** `src/actions/departments.ts` — copy verbatim, only the function name changes

```typescript
async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims: Record<string, any> = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string = jwtClaims['user_role'] ?? ''
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  return { supabase, user: { id: user.id }, role, organisationId }
}
```

### Server Action Error Handling
**Source:** `src/actions/blocks.ts` — every exported function
**Apply to:** All functions in `src/actions/departments.ts`

Pattern: `safeParse` → early return `{ error }` → DB call → check error → return `{ data }` or `{ error }`. Never throw — always return discriminated union.

### RLS Recursion Avoidance
**Source:** `supabase/migrations/00031_fix_sops_sub_trades_rls_recursion.sql`
**Apply to:** All three junction table policies in `00035`

Rule: junction tables (`block_departments`, `sop_departments`, `member_departments`) use `using(true)` for SELECT. The real gate stays on the parent table (`sops`, `blocks`). Never reference a parent table from a junction policy.

### Design Tokens
**Source:** Project globals — `var(--paper)`, `var(--paper-2)`, `var(--ink-*)`, `var(--accent-*)`
**Apply to:** All new UI components (`DChip`, `DepartmentCard`, `DepartmentPicker`, filter bars)

Key token mapping for this phase:
- `var(--accent-mcu)` = `#06b6d4` — "All departments" chip ONLY
- `var(--accent-step)` = `#3b82f6` — add-dept chip ("＋" dashed button)
- `var(--accent-signoff)` = `#fbbf24` — owner badge border
- `var(--accent-hazard)` = `#ef4444` — no-owner warning state
- `#a16207` (hardcoded) — owner badge text colour (amber-700, per UI-SPEC)

### Optimistic Update + Revert
**Source:** `src/components/admin/SubTradePicker.tsx` lines 72–92
**Apply to:** `DepartmentPicker.tsx`

Copy the `useTransition` + revert-on-error pattern exactly. State shape changes (Set → array-based for dept IDs), but the toggle/revert logic is identical.

### Server Component Auth + Redirect
**Source:** `src/app/(protected)/admin/blocks/page.tsx` lines 33–43
**Apply to:** `src/app/(protected)/admin/departments/page.tsx`

```typescript
const { data: member } = await supabase
  .from('organisation_members')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle()
if (!member || !['admin', 'safety_manager'].includes(member.role)) {
  redirect('/dashboard')
}
```

---

## No Analog Found

No files in this phase lack an analog. All patterns have direct precedents in the codebase.

---

## Assumptions Requiring Planner Verification

| # | Assumption | File affected | Verify with |
|---|-----------|---------------|-------------|
| A1 | `blocks/page.tsx` calls `listBlocks({ includeGlobal: true })` | `src/app/(protected)/admin/blocks/page.tsx` | Read lines 50–55 (confirmed: calls `listBlocks` with `scope` param) |
| A2 | `BlockPicker` uses `includeGlobal` | `src/components/admin/blocks/BlockPicker.tsx` | `grep -rn "includeGlobal\|globalOnly" src` |
| A3 | `CategoryBottomSheet` consumer(s) in worker SOP library | `src/app/(protected)/sops/page.tsx` | `grep -rn "CategoryBottomSheet\|CategorySidebar" src` |
| A4 | `DepartmentPicker` in wizard must be local-only (no server action on toggle during create) | `WizardClient.tsx` | Confirm `createSopFromWizard` is the only write point |

---

## Metadata

**Analog search scope:** `src/actions/`, `src/components/admin/`, `src/app/(protected)/admin/`, `supabase/migrations/`, `src/lib/journeys/`, `src/types/`
**Files read:** 13 source files + 4 planning docs
**Pattern extraction date:** 2026-06-15

---

## PATTERN MAPPING COMPLETE

**Phase:** 25 - Department as a First-Class Entity
**Files classified:** 22
**Analogs found:** 22 / 22

### Coverage
- Files with exact analog: 14
- Files with role-match analog: 6
- Files with no analog: 0

### Key Patterns Identified
- All junction tables use `using(true)` SELECT policy (the 00031 fix) — never reference parent table from junction policy
- `DepartmentPicker` is a near-verbatim copy of `SubTradePicker` with three deltas: prop-passed vocab, colour swatch per pill, "All departments" toggle
- Server actions follow the `requireAdmin()` → Zod `safeParse` → discriminated-union return pattern from `blocks.ts`
- All admin pages share the same auth + redirect guard from `blocks/page.tsx` lines 33–43
- The third permissive SELECT policy on `sops` (`sops_visible_by_department`) adds cleanly via Postgres OR semantics without touching the existing sub-trade policy
- Data migration must use a PL/pgSQL loop: INSERT departments first, then junctions, then copy globals per-org, then DELETE `organisation_id IS NULL` blocks

### File Created
`C:\Development\SOPstart\.planning\phases\25-department-first-class-entity\25-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
