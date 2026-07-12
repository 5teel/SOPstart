# Phase 29: Approval Chains — Pattern Map

Maps every new Phase 29 file to its closest existing analog, with excerpts, so the planner/executor
copies a proven shape instead of inventing one. Companion to `29-RESEARCH.md`.

---

## 1. Migration: `00045_approval_chains.sql` → analog `00043_ownership_review_governance.sql` (+ RLS fix from `00044_fix_cadence_rls_org_claim.sql`)

**Same shape as 00043:** additive nullable columns on `sops` (no new RLS needed, rides `admins_can_update_sops`/`org_members_can_view_sops`) + one settings table (no authenticated write policy, service-role only) + one append-only audit table (authenticated insert with a self-check).

**Difference from 00043 — use the CORRECT RLS predicate from the start**, i.e. skip straight to what 00044 had to retroactively fix:

```sql
-- 00043 shipped this (WRONG — had to be fixed in 00044):
create policy sop_review_cadences_read_org on public.sop_review_cadences
  for select
  using (organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid);

-- 00044 fixed it to:
create policy sop_review_cadences_read_org on public.sop_review_cadences
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- 00045 (approval_chains) must use the 00044 form DIRECTLY — do not copy 00043's
-- original text even though it's the more "recent" file on disk.
create policy approval_chains_read_org on public.approval_chains
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
```

**Difference from `sop_review_events` (append-only precedent) — partial unique index:**

```sql
-- sop_review_events (00043) has no per-row uniqueness constraint at all —
-- every confirm/supersede event is allowed to repeat freely.
--
-- sop_approvals needs ONE new thing sop_review_events didn't: an idempotency
-- guard for double-click approve, WITHOUT blocking repeat changes_requested
-- rows across multiple reject/resubmit cycles. Use a PARTIAL unique index:
create unique index if not exists sop_approvals_one_approval_per_step
  on public.sop_approvals(sop_id, version, step_index)
  where action = 'approved';
```

**Full new migration skeleton:**

```sql
-- Section 1: sops columns (mirrors 00043 Section 1)
alter table public.sops
  add column if not exists approval_state    text check (approval_state in ('pending', 'approved')),
  add column if not exists approval_snapshot jsonb;
-- No new policy: admins_can_update_sops / org_members_can_view_sops (00003) already gate these.

-- Section 2: approval_chains (mirrors 00043 Section 3 / sop_review_cadences, WITH the 00044 fix)
create table if not exists public.approval_chains (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  category        text not null,
  steps           jsonb not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, category)
);
alter table public.approval_chains enable row level security;
create policy approval_chains_read_org on public.approval_chains
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
-- NO authenticated write policy — service-role only (setApprovalChain).

-- Section 3: sop_approvals (mirrors 00043 Section 4 / sop_review_events, PLUS partial unique index)
create table if not exists public.sop_approvals (
  id               uuid primary key default gen_random_uuid(),
  sop_id           uuid not null references public.sops(id) on delete cascade,
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  version          int not null,
  step_index       int not null,
  approver_user_id uuid references auth.users(id) on delete set null,
  action           text not null check (action in ('approved', 'changes_requested')),
  comment          text,
  created_at       timestamptz not null default now()
);
create index if not exists sop_approvals_sop_id_idx on public.sop_approvals(sop_id);
create unique index if not exists sop_approvals_one_approval_per_step
  on public.sop_approvals(sop_id, version, step_index)
  where action = 'approved';

alter table public.sop_approvals enable row level security;
create policy sop_approvals_read_org on public.sop_approvals
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
create policy sop_approvals_insert_self on public.sop_approvals
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and approver_user_id = auth.uid()
  );
-- NO UPDATE/DELETE — append-only.
```

---

## 2. Pure logic: `src/lib/governance/approvals.ts` → analog `src/lib/governance/classify.ts`

Same extraction discipline: no `'use server'`, no I/O, no supabase import, sync exports, unit-tested directly (2026-06-27 learning — a sync export inside a `'use server'` module breaks `next build`).

```typescript
// classify.ts (existing) — the shape to mirror exactly:
export type GovernanceFlag = 'overdue' | 'due_soon' | 'unowned' | 'stale_role'
export interface GovernanceInput { /* plain fields, an optional `now?: Date` for test control */ }
export function classifyGovernanceRow(input: GovernanceInput): GovernanceFlag[] { /* pure */ }

// approvals.ts (new) — same shape, different domain:
import type { AppRole } from '@/types/auth'

export interface ChainStep {
  role?: AppRole
  userId?: string
  label: string
}

export function resolveNextStepIndex(stepCount: number, approvedStepIndexes: Set<number>): number {
  for (let i = 0; i < stepCount; i++) {
    if (!approvedStepIndexes.has(i)) return i
  }
  return -1
}

export function stepMatchesCaller(step: ChainStep, caller: { userId: string; role: AppRole }): boolean {
  if (step.userId && step.userId === caller.userId) return true
  if (step.role && step.role === caller.role) return true
  return false
}

export function isChainComplete(stepCount: number, approvedStepIndexes: Set<number>): boolean {
  return resolveNextStepIndex(stepCount, approvedStepIndexes) === -1
}
```

Test file mirrors `src/lib/governance/__tests__/classify.test.ts` (already exists, wired to `phase28-unit`) →
new `src/lib/governance/__tests__/approvals.test.ts`, wired to `phase29-unit`.

---

## 3. Server actions: `src/actions/approvals.ts` → analog `src/actions/governance.ts`

Same file header discipline (doc comment listing every export + which client each uses + why), same
`requireAdmin`-style context helper (reuse it — export it from `governance.ts` rather than
duplicating), same `(supabase as any)` cast convention for tables not yet in `database.types.ts`.

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/actions/governance'   // REUSE — don't duplicate (ladder rung 2)
import { getOrgMembers } from '@/actions/assignments'
import { resolveNextStepIndex, stepMatchesCaller, type ChainStep } from '@/lib/governance/approvals'
import { performPublish } from '@/lib/governance/publish-core'

// setApprovalChain — mirrors setReviewCadence EXACTLY (service-role, org from ctx only):
export async function setApprovalChain(
  category: string,
  steps: ChainStep[],
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  // ... Zod validate steps.length 1-4, exactly one of role/userId per step ...
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { error } = await admin.from('approval_chains').upsert(
    { organisation_id: ctx.organisationId, category, steps, created_by: ctx.userId, updated_at: new Date().toISOString() },
    { onConflict: 'organisation_id,category' },
  )
  if (error) return { error: error.message }
  return { success: true }
}

// approveStep — mirrors confirmSopCurrent's shape (plain session client — Pitfall 1/3
// scoping means every caller here IS admin/safety_manager, admins_can_update_sops covers it):
export async function approveStep(
  sopId: string,
  comment?: string,
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const supabase = await createClient()
  const { data: sop } = await supabase
    .from('sops')
    .select('id, version, category, approval_state, approval_snapshot, parent_sop_id')
    .eq('id', sopId)
    .maybeSingle()

  if (!sop || sop.approval_state !== 'pending') return { error: 'No pending approval for this SOP' }
  const steps = (sop.approval_snapshot as unknown as ChainStep[]) ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvedRows } = await (supabase as any)
    .from('sop_approvals')
    .select('step_index')
    .eq('sop_id', sopId)
    .eq('version', sop.version)
    .eq('action', 'approved')

  const approvedIndexes = new Set((approvedRows ?? []).map((r: { step_index: number }) => r.step_index))
  const nextIndex = resolveNextStepIndex(steps.length, approvedIndexes)
  if (nextIndex === -1) return { error: 'Chain already complete' }
  if (!stepMatchesCaller(steps[nextIndex], { userId: ctx.userId, role: ctx.role })) {
    return { error: 'Not your turn to approve' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any).from('sop_approvals').insert({
    sop_id: sopId,
    organisation_id: ctx.organisationId,
    version: sop.version,
    step_index: nextIndex,
    approver_user_id: ctx.userId,
    action: 'approved',
    comment: comment ?? null,
  })
  if (insertErr && insertErr.code !== '23505') return { error: insertErr.message } // 23505 = idempotent no-op

  if (nextIndex === steps.length - 1) {
    const result = await performPublish(supabase, {
      sopId, organisationId: ctx.organisationId, userId: ctx.userId, approvalState: 'approved',
    })
    if (!result.success) return { error: result.error }
  }
  return { success: true }
}

// requestChanges — mirrors the "clear pending, keep snapshot" decision (Pattern 2):
export async function requestChanges(
  sopId: string,
  comment: string,
): Promise<{ success: true } | { error: string }> {
  if (!comment?.trim()) return { error: 'A comment is required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // ... same next-approver gate as approveStep, then:
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('sop_approvals').insert({
    sop_id: sopId, organisation_id: ctx.organisationId, version: /* sop.version */ 0,
    step_index: /* nextIndex */ 0, approver_user_id: ctx.userId, action: 'changes_requested', comment,
  })
  const { error } = await supabase
    .from('sops')
    .update({ approval_state: null }) // approval_snapshot INTENTIONALLY left in place (Pattern 2)
    .eq('id', sopId)
  if (error) return { error: error.message }
  return { success: true }
}
```

---

## 4. Shared publish core: `src/lib/governance/publish-core.ts` → analog: the publish route itself (extraction, not a new pattern)

This is a **relocation**, not a new invention — cut the existing route's steps 2 through 5 into a
function; the route becomes a thin caller. Side-by-side:

```typescript
// BEFORE — everything inline in route.ts (today, ~200 lines)
export async function POST(request, { params }) {
  // 1. auth + org
  // 2. unapproved-sections gate
  // 2b. verify-checklist gate
  // 3. status -> published
  // 3b. review-clock reset + superseded event
  // 4. video auto-queue
  // 5. agent synthesis
  return NextResponse.json({ success: true, pipelineAutoQueued })
}

// AFTER — route.ts keeps step 1 + the NEW chain-gate check, delegates the rest
export async function POST(request, { params }) {
  // 1. auth + org  (unchanged)
  // NEW: chain-gate check (Pattern 2) — short-circuits into pending_approval, or falls through
  const result = await performPublish(supabase, { sopId, organisationId, userId: user.id })
  if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ success: true, pipelineAutoQueued: result.pipelineAutoQueued })
}

// publish-core.ts — steps 2 through 5, VERBATIM, just relocated + parameterized
export async function performPublish(
  supabase: SupabaseClient,
  params: { sopId: string; organisationId: string; userId: string; approvalState?: 'approved' },
): Promise<
  | { success: true; pipelineAutoQueued: boolean }
  | { success: false; error: string; status: number }
> {
  // ... unapproved-sections gate (verbatim from today's step 2) ...
  // ... verify-checklist gate (verbatim from today's step 2b) ...
  // ... status -> published, AND approval_state: params.approvalState ?? undefined ...
  // ... review-clock reset + superseded event (verbatim step 3b) ...
  // ... video auto-queue (verbatim step 4) ...
  // ... agent synthesis (verbatim step 5) ...
}
```

`approveStep`'s final-step branch calls this SAME function with `approvalState: 'approved'` —
this is the literal mechanism behind APR-04's "same publish logic completes automatically."

---

## 5. Chain config UI: `ApprovalChainEditor.tsx` → analog `GovernanceWidget.tsx` (data shape) + `OwnerPicker.tsx` (member-picker interaction) + `@dnd-kit` (already installed, Phase 26 block canvas)

- Category picker: distinct `sops.category` values for the org (simple `SELECT DISTINCT category FROM sops WHERE organisation_id=...`, no new table).
- Step rows (1–4): each row is a role-OR-member picker — reuse `OwnerPicker.tsx`'s open/fetch-on-first-open/commit shape (`getOrgMembers()`, filtered to `admin`/`safety_manager` per Pitfall 3) for the named-member option, plus a plain `<select>` of `['admin','safety_manager']` for the role option.
- Drag-reorder: `@dnd-kit/core` + `@dnd-kit/sortable` (already `dependencies` — installed Phase 26 for the block canvas, `DndContext`/`SortableContext`/`useSortable`) — do not hand-roll drag logic.
- Mounted as a small panel section on `/admin/governance/page.tsx` (same page, not a new route — D29-05).

---

## 6. Chain display: `ApprovalChainPanel.tsx` → analog `PublishStage.tsx` (controlled/presentational contract)

`PublishStage.tsx`'s own file header states its contract: "Controlled / presentational component
... Does NOT call fetch / Supabase / publish route directly." `ApprovalChainPanel` follows the
identical contract — pure props in (`steps`, `approvals`, `nextStepIndex`, `isCallerNextApprover`),
two callbacks out (`onApprove`, `onRequestChanges`), no internal data-fetching. Mounted conditionally
inside `PublishStage` (or as a sibling passed down from `BuilderStageShell`) exactly where
`hasSourceDoc` currently gates the progress-summary block:

```typescript
// PublishStage.tsx — additive prop, additive conditional block, nothing else touched
export type PublishStageProps = {
  // ...existing props unchanged...
  approvalStatus?: {
    state: 'pending' | 'approved' | null
    steps: ChainStep[]
    approvals: ApprovalRow[]
    nextStepIndex: number
    isCallerNextApprover: boolean
  }
}

// inside the component, alongside the existing "3. Progress summary" block:
{approvalStatus?.state === 'pending' && (
  <ApprovalChainPanel
    steps={approvalStatus.steps}
    approvals={approvalStatus.approvals}
    nextStepIndex={approvalStatus.nextStepIndex}
    canAct={approvalStatus.isCallerNextApprover}
    onApprove={onApproveStep}
    onRequestChanges={onRequestChanges}
  />
)}
```

---

## 7. Queue row extension: `GovernanceQueueRow.tsx` (modified in place, not a new component) → analog: itself (additive branch)

```typescript
// BEFORE (existing, verbatim from src/components/admin/governance/GovernanceQueueRow.tsx):
{row.flags.includes('unowned') ? (
  <OwnerPicker sopId={row.id} ownerUserId={row.ownerUserId} ownerLabel={row.ownerLabel} />
) : row.flags.includes('stale_role') ? (
  <Link href={`/admin/sops/${row.id}/assign`} className="evidence-btn !min-h-[36px] text-sm">
    Fix assignment
  </Link>
) : (
  <button onClick={handleConfirmCurrent} disabled={isPending} className="evidence-btn !min-h-[36px] text-sm">
    {isPending ? 'Confirming…' : 'Confirm current'}
  </button>
)}

// AFTER — one new branch prepended, same if/else-if chain shape, same styling class:
{row.flags.includes('awaiting_approval') && row.isCallerNextApprover ? (
  <button onClick={handleApprove} disabled={isPending} className="evidence-btn !min-h-[36px] text-sm">
    {isPending ? 'Approving…' : 'Approve'}
  </button>
) : row.flags.includes('unowned') ? (
  <OwnerPicker sopId={row.id} ownerUserId={row.ownerUserId} ownerLabel={row.ownerLabel} />
) : row.flags.includes('stale_role') ? (
  <Link href={`/admin/sops/${row.id}/assign`} className="evidence-btn !min-h-[36px] text-sm">
    Fix assignment
  </Link>
) : (
  <button onClick={handleConfirmCurrent} disabled={isPending} className="evidence-btn !min-h-[36px] text-sm">
    {isPending ? 'Confirming…' : 'Confirm current'}
  </button>
)}
```

`FLAG_STYLE`/`FLAG_LABEL` maps (top of the same file) get one new entry each:
`awaiting_approval: 'bg-[var(--accent-signoff)]/20 text-[var(--accent-signoff)]'` /
`'Awaiting approval'` — same `Record<GovernanceRow['flags'][number], string>` shape, no new pattern.

`GovernanceFilterChips.tsx` gets one new chip (`{ label: 'Awaiting approval', value: 'awaiting_approval' }`)
in the same `CHIPS` array — identical to how the existing 5 chips are declared.

---

## 8. Dashboard widget: `GovernanceWidget.tsx` (modified in place) → analog: itself

```typescript
// BEFORE:
const counts = { overdue: 0, unowned: 0, due_soon: 0 }
for (const row of result.rows) {
  if (row.flags.includes('overdue')) counts.overdue++
  if (row.flags.includes('unowned')) counts.unowned++
  if (row.flags.includes('due_soon')) counts.due_soon++
}

// AFTER — one new counter, one new Link, same shape:
const counts = { overdue: 0, unowned: 0, due_soon: 0, awaiting_approval: 0 }
for (const row of result.rows) {
  // ...existing three unchanged...
  if (row.flags.includes('awaiting_approval')) counts.awaiting_approval++
}
// + one new <Link href="/admin/governance?filter=awaiting_approval"> chip, same styling pattern
```

Satisfies GQ-04's requirement text ("overdue / unowned / awaiting approval") — this exact widget was
built ahead of the approval flag existing (Phase 28), so this is a same-file, same-shape extension,
not new work.

---

## 9. Version history: `/admin/sops/[sopId]/versions/page.tsx` (modified) → analog: itself + `listGovernanceQueue`'s `ownerLabelById` resolution

```typescript
// BEFORE: page fetches only getVersionHistory(sopId) -> VersionRecord[]

// AFTER: also fetch approval rows for every version id in the lineage, resolve
// approver labels via getOrgMembers() exactly like listGovernanceQueue does:
const versionIds = versions.map(v => v.id)
const approvalsResult = await getApprovalHistory(versionIds)     // new action, src/actions/approvals.ts
const membersResult = await getOrgMembers()                      // REUSE — third call site, same as
                                                                  // listGovernanceQueue's ownerLabelById
const approverLabelById = Object.fromEntries(
  (membersResult.success ? membersResult.members : []).map(m => [m.user_id, memberLabel(m)])
)

// Render grouped under each version row (read-only addition, D29-06):
{approvalsResult.rows.filter(a => a.sop_id === ver.id).map(a => (
  <li key={a.id}>{approverLabelById[a.approver_user_id] ?? 'Unknown'} — {a.action} — {formatDate(a.created_at)}</li>
))}
```

Step LABEL for each row resolves from that version's `approval_snapshot[a.step_index].label` —
no new column (Don't Hand-Roll in `29-RESEARCH.md`).

---

## 10. Specs: `tests/phase29/*.spec.ts` → analog `tests/phase28/governance-actions.spec.ts` + `tests/phase28/governance-queue.spec.ts`

Same source-contract shape: `fs.readFileSync` the target file, regex out the function body, assert
real call sites (`.from('sop_approvals')`, `stepMatchesCaller(`, `performPublish(`) — never bare
token/prop-name presence (2026-06-05 dead-feature-passes-GREEN learning class). Cross-org write
isolation and partial-unique-index double-click behavior carried as `test.fixme` per the
Railway-only-testing convention, same precedent as `tests/phase27/ai-settings-org-scope.spec.ts` and
`tests/phase28/governance-actions.spec.ts`'s 3 fixme cases.

Registration mirrors `phase28`/`phase28-unit` exactly:

```typescript
// playwright.config.ts — add alongside the existing phase28/phase28-unit entries
{
  name: 'phase29-unit',
  testDir: './src/lib/governance/__tests__',
  testMatch: /.*\.test\.ts$/,
},
{
  name: 'phase29',
  testDir: '.',
  testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/,
  use: { browserName: 'chromium' },
},
```
