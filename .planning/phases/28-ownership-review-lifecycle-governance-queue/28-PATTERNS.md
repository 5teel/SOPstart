# Phase 28: Ownership + Review Lifecycle + Governance Queue - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 13
**Analogs found:** 13 / 13 (research pass already identified exact 1:1 precedents; this map extracts concrete excerpts)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/00043_ownership_review_governance.sql` | migration | CRUD + event-driven | `00042_ai_model_settings.sql` (settings) + `00010_completion_schema.sql` (append-only) + `00003_sop_schema.sql` (existing RLS on `sops`) | exact (3-way composite) |
| `scripts/backfill-owner-review.mjs` | utility (batch) | batch | `scripts/backfill-section-layouts.ts` | exact |
| `src/actions/governance.ts` | service (server actions) | request-response / CRUD | `src/actions/ai-settings.ts` (settings write) + `src/actions/departments.ts::setDepartmentOwner` (owner reassignment) | exact |
| `src/lib/governance/classify.ts` | utility (pure) | transform | `src/lib/builder/version-lineage.ts::computeNextVersionLineage` | exact |
| `src/lib/governance/cadences.ts` | utility (pure) | transform | `src/lib/ai/org-settings.ts` (resolution-order helper, referenced by ai-settings.ts) + `version-lineage.ts` extraction precedent | role-match |
| `src/app/(protected)/admin/governance/page.tsx` | route (RSC) | request-response | `src/app/(protected)/admin/sops/page.tsx` | exact |
| `src/components/admin/governance/GovernanceQueueRow.tsx` | component | request-response | admin sops page row markup (same file) | role-match |
| `src/components/admin/governance/GovernanceFilterChips.tsx` | component | request-response | `STATUS_TABS` tab-chip block in admin sops page | exact |
| `src/components/admin/governance/OwnerPicker.tsx` | component | request-response | `SopDepartmentEditor` (admin/sop) member-picker-style inline editor | role-match |
| `src/components/sop/tabs/OverviewTab.tsx` (modify) | component | request-response | itself — `MetaRow` pattern | exact (in-place) |
| `src/lib/journeys/journeys.ts` (modify) | config | transform | existing `Journey`/`JourneyStep` objects | exact |
| `playwright.config.ts` (modify) | config | — | `phase27-unit` / `phase27-stubs` project blocks | exact |
| `database.types.ts` (modify) | model/types | — | prior manual extensions for `parent_sop_id`/`superseded_by` | exact |

## Pattern Assignments

### `supabase/migrations/00043_ownership_review_governance.sql`

**Analog 1 — additive columns riding existing RLS** (`supabase/migrations/00003_sop_schema.sql`, existing `admins_can_update_sops` policy — do not touch):
```sql
alter table public.sops
  add column if not exists owner_user_id    uuid references auth.users(id) on delete set null,
  add column if not exists review_due_at    timestamptz,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_reviewed_by uuid references auth.users(id) on delete set null;
-- No new policy needed: admins_can_update_sops already gates
-- organisation_id = current_organisation_id() AND current_user_role() IN ('admin','safety_manager')
```

**Analog 2 — org-scoped settings table** (`supabase/migrations/00042_ai_model_settings.sql:10-24`):
```sql
create table public.ai_model_settings (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  use_case        text not null,
  model_id        text not null,
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, use_case)
);
alter table public.ai_model_settings enable row level security;
create policy ai_model_settings_read_org on public.ai_model_settings
  for select
  using (organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid);
-- NO authenticated write policy — writes go through service-role action, self-enforced org scope
```
→ Copy verbatim for `sop_review_cadences(organisation_id, category, months, updated_by, updated_at)`, PK `(organisation_id, category)`.

**Analog 3 — append-only audit table** (`supabase/migrations/00010_completion_schema.sql:60-84`):
```sql
CREATE POLICY "admins_see_all_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (organisation_id = public.current_organisation_id() AND public.current_user_role() = 'admin');

CREATE POLICY "workers_can_insert_own_completions"
  ON public.sop_completions FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_organisation_id() AND worker_id = auth.uid());

-- NO UPDATE policy — append-only (COMP-07, D-15)
-- NO DELETE policy — append-only (COMP-07, D-15)
```
→ Copy for `sop_review_events`: SELECT org-scoped, INSERT with `reviewed_by = auth.uid()` + role check (admin/safety_manager), no UPDATE/DELETE. Exact target shape already fully specified in RESEARCH.md Pattern 3 — use it verbatim.

---

### `scripts/backfill-owner-review.mjs`

**Analog:** `scripts/backfill-section-layouts.ts` (idempotent, only-missing-rows, per-row log, no null-clobber — 2026-07-05 learning).

Pattern to copy: loop rows missing owner/review_due_at → compute patch object conditionally (`if (!sop.owner_user_id && owner) patch.owner_user_id = owner`) → skip write if patch empty → log per-row outcome. Full skeleton already given in RESEARCH.md "Backfill script skeleton" — use verbatim, do not re-derive.

---

### `src/actions/governance.ts`

**Analog — settings write self-enforcing org scope** (`src/actions/ai-settings.ts:1-33`):
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseJwtPayload } from '@/lib/supabase/jwt'

type AdminCtx = { userId: string; organisationId: string }

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const role = claims['user_role'] as string | undefined
  if (!role || !['admin', 'safety_manager'].includes(role)) return { error: 'Admin access required' }
  const organisationId = claims['organisation_id'] as string | undefined
  if (!organisationId) return { error: 'No organisation found' }
  return { userId: user.id, organisationId }
}
```
Use this `requireAdmin()` exactly for `listGovernanceQueue`/`setSopOwner`/`confirmSopCurrent`/`setReviewCadence`.

**Analog — owner reassignment with org-membership verification** (`src/actions/departments.ts:290-329`, `setDepartmentOwner`):
```typescript
export async function setDepartmentOwner(
  departmentId: string,
  userId: string | null
): Promise<{ success: true } | { error: string }> {
  if (!departmentId) return { error: 'departmentId required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  if (userId !== null) {
    const regularSupabase = await createClient()
    const { data: member } = await regularSupabase
      .from('organisation_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organisation_id', ctx.organisationId)
      .maybeSingle()
    if (!member) return { error: 'Owner must be a member of this organisation' }
  }

  const { error } = await ctx.supabase
    .from('departments')
    .update({ owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', departmentId)

  if (error) { console.error('[setDepartmentOwner] update error', error); return { error: error.message } }
  return { success: true }
}
```
→ Copy directly for `setSopOwner(sopId, userId)`: same membership-verification block, but write with **plain session client** (`createClient()`), NOT admin client — `admins_can_update_sops` RLS already covers `sops` writes (RESEARCH Pitfall 1). Only `sop_review_cadences` writes use `createAdminClient()` (mirrors `ai-settings.ts` exactly, including the `as any` cast noted there for un-typed tables).

**Error handling pattern:** every action returns `{ success: true } | { error: string }` (or `{ ok: true } | { error }`), logs via `console.error('[fnName] ...', error)` — no thrown exceptions. Follow same shape for `confirmSopCurrent`.

---

### `src/lib/governance/classify.ts` + `cadences.ts`

**Analog — pure sync helper extracted OUT of a `'use server'` file** (`src/lib/builder/version-lineage.ts`, full file, 20 lines — 2026-06-27 learning, mandatory pattern):
```typescript
// Pure helper — lives outside the 'use server' action module so it can be a
// SYNC export (Next.js requires every export of a 'use server' file to be async).
// Imported by versioning.ts and unit-tested directly without a DB.
export function computeNextVersionLineage(oldSop: {
  id: string
  version: number
  parent_sop_id: string | null
}): { newVersion: number; newParentId: string } {
  return {
    newVersion: oldSop.version + 1,
    newParentId: (oldSop.parent_sop_id as string | null) ?? oldSop.id,
  }
}
```
`classifyGovernanceRow`/`resolveCadenceMonths` MUST follow this exact placement rule — plain modules, no `'use server'` directive, imported into `governance.ts`. Full target implementation already specified in RESEARCH.md "Code Examples" section — copy verbatim (types `GovernanceFlag`, `GovernanceInput`, `DUE_SOON_WINDOW_DAYS = 30`).

---

### `src/app/(protected)/admin/governance/page.tsx`

**Analog:** `src/app/(protected)/admin/sops/page.tsx:1-50` (auth guard + role check + tab pattern):
```typescript
import { createClient } from '@/lib/supabase/server'
// ...
export default async function SopsLibraryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
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
  // ...
}

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drafts', value: 'draft' },
  // ...
]
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
}
```
→ Copy the auth+role guard verbatim; replace `STATUS_TABS` with governance filter chips (Overdue / Due soon / Unowned / Stale-role / All); reuse `formatDate` (`en-NZ` locale) for review-due dates and worker "Current as of" caption — matches `feedback_nz_metric_only` convention already baked into this file.

---

### `src/components/admin/governance/GovernanceQueueRow.tsx` / `GovernanceFilterChips.tsx`

**Analog:** row/action markup already in `admin/sops/page.tsx` (icon-action column: `Users, History, Video, Pencil, QrCode` from `lucide-react`, `StatusBadge`, `DeleteSopButton`). Reuse the same icon-button + `StatusBadge`-style pill convention for governance flags (`overdue`/`due_soon`/`unowned`/`stale_role` badges). Filter chips: replace `STATUS_TABS` render loop 1:1 for the 5 governance chips.

**Wired-handler requirement (2026-05-25 / 2026-06-05 learning, GQ-02):** each row's primary action button MUST call a real handler (server action bound via `<form action={...}>` or a client `onClick` invoking the imported action), not merely reference a prop name — source-contract test must grep for the actual call, not just the button label.

---

### `src/components/admin/governance/OwnerPicker.tsx`

**Analog:** `getOrgMembers()` in `src/actions/assignments.ts:163` — reuse this existing member-list fetcher (don't hand-roll a second "list org members" query, per RESEARCH "Don't Hand-Roll" table). Popover UI pattern: mirror `SopDepartmentEditor` (`src/components/admin/sop/SopDepartmentEditor.tsx`) inline-editor-with-popover structure — read that file directly at execution time for its exact JSX/state shape (not reproduced here to avoid a stale copy; same directory as this map's other admin components).

---

### `src/components/sop/tabs/OverviewTab.tsx` (modify — worker currency caption, REV-03/D28-07)

**Analog:** its own `MetaRow` helper (`src/components/sop/tabs/OverviewTab.tsx:5-12`):
```tsx
function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-4 py-2 border-b border-[var(--ink-100)] last:border-b-0">
      <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)] w-[120px] flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[var(--ink-900)] flex-1">{value}</span>
    </div>
  )
}
```
→ Add ONE passive line using this exact component/style, e.g. `<MetaRow label="Reviewed" value={formatNzDate(sop.last_reviewed_at ?? sop.published_at)} />` inside the existing "SOP Details" `blueprint-frame` block (next to `Revised`). **Anti-pattern (D28-07 hard rule):** no badge, no colour-coded warning, no conditional block on `review_due_at < now()` anywhere in this worker-facing file — plain informational text only, same visual weight as `Author`/`Category`.

---

### `src/lib/journeys/journeys.ts` (modify)

**Analog:** existing `Journey`/`JourneyStep` shape (lines 15-34, types already read above). Add one new `JourneyStep` with `route: '/admin/governance'` inside a relevant admin `Journey`, or a new governance-queue journey entirely, in the SAME commit that creates the route (project convention, CLAUDE.md § Pathways Map Maintenance + RESEARCH Pitfall 7).

---

### `playwright.config.ts` (modify)

**Analog — unit project** (`playwright.config.ts:224-234`, `phase27-unit`):
```typescript
{
  name: 'phase27-unit',
  testDir: './src/lib/ai/__tests__',
  testMatch: /.*\.test\.ts$/,
},
```
→ Copy for `phase28-unit`: `testDir: './src/lib/governance/__tests__'`, same `testMatch`.

**Analog — stub/integration project** (`playwright.config.ts:236-244`, `phase27-stubs`):
```typescript
{
  name: 'phase27-stubs',
  testDir: '.',
  testMatch: /tests\/phase27\/.*\.(spec|test)\.ts$/,
  use: { browserName: 'chromium' },
},
```
→ Copy for `phase28`/`phase28-stubs`: `testMatch: /tests\/phase28\/.*\.(spec|test)\.ts$/`. Register in Wave 0, verify with `npx playwright test --list --project=phase28-unit` (2026-05-25 learning — unregistered specs never run).

---

### `database.types.ts` (modify)

**Analog:** prior manual extensions for `parent_sop_id`/`superseded_by` on the `sops` Row/Insert/Update types (Pitfall 4). Add `owner_user_id`, `review_due_at`, `last_reviewed_at`, `last_reviewed_by` (all `string | null`) to the three `sops` type variants. For `sop_review_cadences` / `sop_review_events` (new tables, not in generated types), use `(supabase as any)` casts at call sites — same as `ai_model_settings`/`departments`/`block_suggestions` precedent. Do not attempt full type regen.

## Shared Patterns

### Auth/org-scope guard (`requireAdmin`)
**Source:** `src/actions/ai-settings.ts:19-32`
**Apply to:** every exported function in `src/actions/governance.ts`
```typescript
async function requireAdmin(): Promise<{ userId: string; organisationId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  const claims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const role = claims['user_role'] as string | undefined
  if (!role || !['admin', 'safety_manager'].includes(role)) return { error: 'Admin access required' }
  const organisationId = claims['organisation_id'] as string | undefined
  if (!organisationId) return { error: 'No organisation found' }
  return { userId: user.id, organisationId }
}
```

### JWT decode
**Source:** `src/lib/supabase/jwt.ts` (`parseJwtPayload`, full file above)
**Apply to:** ALL new governance action code — never raw `atob` (2026-06-26 learning; `departments.ts`/`auth.ts` still have the old violation, do not copy it).

### Cross-tenant write guard (membership verification before UPDATE)
**Source:** `src/actions/departments.ts:305-319` (`setDepartmentOwner`)
**Apply to:** `setSopOwner` (verify target `userId` is an `organisation_members` row in caller's org) and any `sop_review_cadences` write (org id sourced only from JWT, never a parameter — mirrors `setAiModelSetting`).

### Error/response shape
**Source:** `src/actions/departments.ts` and `src/actions/ai-settings.ts` throughout
**Apply to:** all new `governance.ts` exports — `{ success: true } | { error: string }` (or `{ ok: true }`), `console.error('[fnName] ...', error)`, never throw.

### Pure-helper extraction discipline
**Source:** `src/lib/builder/version-lineage.ts` (2026-06-27 learning — recurrence risk explicitly flagged in RESEARCH Pitfall 5)
**Apply to:** `classify.ts`, `cadences.ts` — must NOT live inside `governance.ts`.

## No Analog Found

None — every file in scope has a direct precedent already identified in RESEARCH.md and confirmed against source in this pass.

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/actions/`, `src/lib/builder/`, `src/lib/supabase/`, `src/app/(protected)/admin/sops/`, `src/components/sop/tabs/`, `src/lib/journeys/`, `playwright.config.ts`
**Files scanned:** 9 read directly this pass (ai-settings.ts, departments.ts, version-lineage.ts, jwt.ts, 00042, 00010, admin/sops/page.tsx, journeys.ts, playwright.config.ts, OverviewTab.tsx) + RESEARCH.md's own prior 15+ file reads reused
**Pattern extraction date:** 2026-07-12
