# Phase 34: Supervisor Observations - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 10 new/modified
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/000XX_supervisor_observations.sql` | migration | CRUD (insert-only) | `supabase/migrations/00043_ownership_review_governance.sql` § `sop_review_events` | exact |
| `src/lib/validators/observations.ts` | validator | request-response | `src/lib/validators/completions.ts` | exact |
| `src/actions/observations.ts` (recordObservation) | service (server action) | request-response | `src/actions/completions.ts` (`signOffCompletion`) + `src/actions/escalation.ts` (`authOrg()`) | exact (role-array idiom), partial (write client — this table is session-client-only, no admin client) |
| `src/actions/observations.ts` (listObservationsForWorker / listObservationsForPerson) | service (server action) | CRUD (read) | `src/actions/escalation.ts` (`authOrg()` read pattern) | role-match |
| `src/components/observations/RecordObservationModal.tsx` | component | request-response | none exact — new UI; use blueprint primitives (pill/frame/verdict-btn) per `sketch-findings-SOPstart` skill | no analog |
| `src/components/observations/VerdictButtons.tsx` | component | request-response | none exact — small new control | no analog |
| `src/components/observations/ObservationRow.tsx` | component | CRUD (read/list) | `src/components/activity/CompletionSummaryCard.tsx` | role-match |
| `src/components/admin/org-model/PersonPanel.tsx` | component | request-response | `src/app/(protected)/activity/SupervisorActivityView.tsx` (client shell over server data) | role-match |
| `src/components/admin/org-model/OrgChartCanvas.tsx` (add onClick) | component (modify) | event-driven | same file — modify existing person-chip render | exact (self) |
| `src/components/activity/CompletionSummaryCard.tsx` (add row action) | component (modify) | event-driven | same file — modify existing `<Link>`-wrapped row | exact (self) |
| `src/app/(protected)/profile/page.tsx` (add section) | route (server component, modify) | CRUD (read) | same file — extend existing pattern (see `OrgSwitcher` as the "additive server-fetched section" precedent) | exact (self) |

## Pattern Assignments

### `supabase/migrations/000XX_supervisor_observations.sql` (migration, insert-only CRUD)

**Analog:** `supabase/migrations/00043_ownership_review_governance.sql` § "Section 4: sop_review_events" (lines ~79-108)

Copy verbatim structure, widen role list to include `supervisor`, add `observed_worker_id` self-read OR-branch (new requirement not in the precedent — OBS-02):

```sql
create table if not exists public.sop_observations (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations(id) on delete cascade,
  sop_id             uuid not null references public.sops(id) on delete cascade,
  sop_version        int not null,
  observed_worker_id uuid not null references auth.users(id) on delete cascade,
  observed_by        uuid references auth.users(id) on delete set null,
  verdict            text not null check (verdict in ('performed_to_sop', 'needs_support')),
  note               text,
  completion_id      uuid references public.sop_completions(id) on delete set null,
  created_at         timestamptz not null default now()
);

alter table public.sop_observations enable row level security;

create policy sop_observations_read_org on public.sop_observations
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    or observed_worker_id = auth.uid()          -- worker self-read (OBS-02, no precedent for this branch)
  );

create policy sop_observations_insert_recorder on public.sop_observations
  for insert to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager', 'supervisor')
    and observed_by = auth.uid()
  );

-- NO UPDATE policy — append-only
-- NO DELETE policy — append-only
```

`current_organisation_id()` / `current_user_role()` are pre-existing helpers (`00001_foundation_schema.sql`) — do not redefine.

---

### `src/lib/validators/observations.ts` (validator)

**Analog:** `src/lib/validators/completions.ts` (full file read — see `SignOffSchema`, lines 66-74)

```typescript
import { z } from 'zod'

export const VerdictSchema = z.enum(['performed_to_sop', 'needs_support'])
export type Verdict = z.infer<typeof VerdictSchema>

export const RecordObservationSchema = z.object({
  workerId: z.string().uuid(),
  sopId: z.string().uuid(),
  verdict: VerdictSchema,
  note: z.string().max(2000).optional(),
  completionId: z.string().uuid().optional(),
})
export type RecordObservationInput = z.infer<typeof RecordObservationSchema>
```

Mirror the file-header doc-comment convention (explain the table this schema feeds, cite the migration).

---

### `src/actions/observations.ts` (service, server action)

**Analog A — role check + org guard:** `src/actions/completions.ts::signOffCompletion` (lines 117-141)
**Analog B — lighter read-only auth wrapper:** `src/actions/escalation.ts::authOrg()` (lines 8-14)

`signOffCompletion`'s role check to copy verbatim (widen the array):
```typescript
const { userId, role, organisationId } = await getSessionContext()
if (!userId) return { success: false, error: 'Not authenticated' }
if (!role || !['supervisor', 'admin', 'safety_manager'].includes(role)) {
  return { success: false, error: 'Only supervisors, admins and safety managers can record observations.' }
}
if (!organisationId) return { success: false, error: 'No organisation found' }
```

**Critical divergence from `signOffCompletion`:** that function uses `createAdminClient()` for its write (lines 143, 195). Do NOT copy that part — `sop_observations` RLS is the safety mechanism (D-12), so use the session client from `getSessionContext()` for the insert, same as `escalation.ts`'s `authOrg()` pattern (`supabase` returned directly, no admin client anywhere in that file).

`authOrg()`-style thin wrapper for the two read actions (`listObservationsForWorker`, `listObservationsForPerson`):
```typescript
async function authOrg() {
  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' as const }
  if (!organisationId) return { error: 'Missing organisation_id claim' as const }
  return { supabase, user: { id: userId }, orgId: organisationId }
}
```

Full composed shape (already validated in RESEARCH.md Code Examples section — treat as final):
```typescript
'use server'
import { getSessionContext } from '@/lib/auth/session-context'
import { RecordObservationSchema } from '@/lib/validators/observations'

export async function recordObservation(rawInput: unknown) {
  const parsed = RecordObservationSchema.safeParse(rawInput)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!role || !['supervisor', 'admin', 'safety_manager'].includes(role)) {
    return { success: false, error: 'Only supervisors, admins and safety managers can record observations.' }
  }
  if (!organisationId) return { success: false, error: 'No organisation found' }

  const { workerId, sopId, verdict, note, completionId } = parsed.data

  const { data: sop, error: sopError } = await supabase
    .from('sops').select('version').eq('id', sopId).single()
  if (sopError || !sop) return { success: false, error: 'SOP not found.' }

  const { error } = await supabase.from('sop_observations').insert({
    organisation_id: organisationId,
    sop_id: sopId,
    sop_version: sop.version,
    observed_worker_id: workerId,
    observed_by: userId,
    verdict,
    note: note ?? null,
    completion_id: completionId ?? null,
  })

  if (error) {
    console.error('recordObservation insert error:', error)
    return { success: false, error: 'Failed to record observation.' }
  }
  return { success: true as const }
}
```

---

### `src/components/observations/ObservationRow.tsx` (component, list read)

**Analog:** `src/components/activity/CompletionSummaryCard.tsx` (full file, 85 lines)

Reuse conventions directly:
- `formatNZDateTime` helper (lines 18-28) — copy verbatim for observation `created_at` display.
- `getInitials` helper (lines 30-36) — copy verbatim for observer/worker avatar chip.
- Card shell classes: `bg-white border border-[var(--ink-100)] rounded-xl` (line 51) for each observation row.
- No `<Link>` wrapper needed (observations don't navigate to a detail page) — render as a plain `<div>` list item, avoiding the Pitfall-3 class entirely (nothing to `stopPropagation` on here).

---

### `src/components/activity/CompletionSummaryCard.tsx` (modify — add row action)

**Analog:** itself, current structure (lines 49-84) — entire row is one `<Link href={...}>`.

**Pitfall to avoid (confirmed in RESEARCH.md Pitfall 3):** a naive button inside the existing `<Link>` triggers navigation on click. Precedent fix pattern already used elsewhere in this codebase for the same failure class: `StepPhotoZone` calls `e.stopPropagation()` on its internal click handler to stop a parent toggle from firing (see CLAUDE.md Phase 04 Learnings). Apply identically:
```typescript
<button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onObserve(); }}>
  I observed this
</button>
```
Or restructure so the action sits as a flex sibling outside the `<Link>` boundary and only the text block is wrapped — either approach avoids the trap; `e.stopPropagation()` inline is the smaller diff given the current single-`<Link>` layout.

---

### `src/components/admin/org-model/OrgChartCanvas.tsx` (modify — add person-chip click)

**Analog:** itself, `person-chip` render (lines 232-236) — currently a plain `<span>` with no handler:
```tsx
{role.people.map((person, i) => (
  <span key={person.id ?? `vacant-${i}`} className={`person-chip${person.isVacancy ? ' vacant' : ''}`}>
    <span className="avatar">{person.isVacancy ? '+' : initials(person.name)}</span>
    {person.isVacancy ? 'Vacant' : person.name}
```
No existing click handler anywhere in this component (verified — grep for `onClick` in this file returns nothing). This is genuinely new wiring, not a tweak: add `onClick`, gate on `!person.isVacancy`, lift open/close state to a client wrapper following the exact same "async Server Component can't hold client state" escape hatch already used by `TeamViewShell.tsx` (Phase 32 precedent) — do not add local `useState` directly inside `OrgChartCanvas` if it's currently server-rendered; check its `'use client'` directive first.

---

### `src/app/(protected)/profile/page.tsx` (modify — add "Observations about you" section)

**Analog:** itself — the file's own `<section className="blueprint-frame p-5">` pattern (lines 18-26) for the "Account" block, and `<OrgSwitcher />` (line 29) as the precedent for "additive server-fetched section rendered as its own component below the static blocks."

```tsx
{/* Account info */}
<section className="blueprint-frame p-5">
  <h2 className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider mb-3">
    Account
  </h2>
  ...
</section>

{/* Org memberships + switcher */}
<OrgSwitcher />
```
New section should follow this identical shell (`blueprint-frame p-5`, `mono text-xs ... uppercase` section heading) and be pulled out into its own component (e.g. `src/components/profile/ObservationsSection.tsx`) exactly as `OrgSwitcher` is — keeps `page.tsx` a thin server-component list of sections, consistent with current file shape (35 lines total, additive only).

---

## Shared Patterns

### Session-only auth resolution (no old createClient/getUser triplet)
**Source:** `src/lib/auth/session-context.ts` (`getSessionContext()`)
**Apply to:** all new server entrypoints in `observations.ts`, and the server-rendered `PersonPanel`/`profile` sections.
```typescript
const { supabase, userId, role, organisationId } = await getSessionContext()
```
Per the 2026-07-13 CLAUDE.md Learning — do not reintroduce `createClient()` + `auth.getUser()` + a separate member-role query.

### Role-array inline check (NOT `requireAdminContext()`)
**Source:** `src/actions/completions.ts::signOffCompletion` line 138; `src/actions/escalation.ts::authOrg()`
**Apply to:** `recordObservation` — `requireAdminContext()` hardcodes `['admin','safety_manager']` and must not be edited (≥8 other callers depend on excluding `supervisor`). Always inline the array check for this action.

### Append-only RLS (no UPDATE/DELETE policy)
**Source:** `supabase/migrations/00043_ownership_review_governance.sql` § sop_review_events
**Apply to:** the `sop_observations` migration — do not add a soft-delete flag or an "edit" UI affordance anywhere (D-12/D-08 explicit).

### CSS token — use `--accent-signoff`, never `--brand-yellow`
**Source:** `src/styles/blueprint-theme.css` (confirmed declared); sketch HTML declares `--brand-yellow` only in its own standalone `:root`, never ported to `src/`.
**Apply to:** `RecordObservationModal` primary CTA ("＋ RECORD OBSERVATION", "SAVE OBSERVATION") and `VerdictButtons` selected state — grep `blueprint-theme.css` to confirm exact token names before use; do not port `.btn.yellow` literally.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/observations/RecordObservationModal.tsx` | component | request-response | No existing multi-step (worker → SOP → verdict → note) modal in the codebase; compose from blueprint primitives (pill/frame/verdict-btn) per `sketch-findings-SOPstart` skill and the approved sketch `sketches/supervisor-observations/index.html` §03 |
| `src/components/observations/VerdictButtons.tsx` | component | request-response | New small control; no existing binary-choice button pair to copy — use the sketch's verdict-btn class shape with `--accent-signoff`/neutral tokens |
| `src/components/admin/org-model/PersonPanel.tsx` | component | request-response | No existing side-panel-over-org-chart component; closest structural cousin is `SupervisorActivityView`'s "client shell over server-fetched data" shape, but the slide-over/panel chrome itself is new — follow sketch §01 |

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/actions/`, `src/lib/validators/`, `src/components/activity/`, `src/components/admin/org-model/`, `src/app/(protected)/profile/`, `src/app/(protected)/activity/`
**Files scanned:** 11 (migration, 2 actions files, 2 validator files, CompletionSummaryCard, SupervisorActivityView, OrgChartCanvas, profile page, session-context.ts, guards.ts referenced via research)
**Pattern extraction date:** 2026-07-20
