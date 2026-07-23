# Phase 35: Competency Classifier + Training Matrix + Records - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 11 new/modified
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/lib/competency/classify.ts` | utility (pure classifier) | transform | `src/lib/governance/classify.ts` | exact |
| `src/lib/competency/matrix.ts` | utility (pure assembler) | transform | `src/lib/org-model/resolve-sop-access.ts` | exact |
| `src/lib/competency/csv.ts` | utility (generator) | transform | none in-repo — new pattern (see below) | no analog |
| `src/actions/competency.ts` | service (server actions) | CRUD/read + batch | `src/actions/grants.ts` (materialize fanout, Promise.all) + `src/actions/observations.ts` (role-gated reads, admin-client-on-behalf) | exact (composite) |
| `src/components/admin/competency/TrainingMatrixView.tsx` | component | request-response | `src/components/admin/org-model/OrgColumnsBoard.tsx` (via `TeamViewShell` wiring) | role-match |
| `src/components/admin/competency/StatePill.tsx` | component | transform (render) | `src/components/observations/ObservationRow.tsx` (pill/label rendering) | role-match |
| `src/components/admin/competency/TrainingRecordSection.tsx` | component | request-response | `PersonPanel.tsx` "Growth point" section slot | exact |
| `src/components/profile/CompetencySection.tsx` | component (RSC) | request-response | `src/components/profile/ObservationsSection.tsx` | exact |
| `src/components/admin/org-model/TeamViewShell.tsx` (modified) | provider/state-shell | event-driven (view toggle) | itself — extend `'chart'\|'columns'` union to include `'matrix'` | exact |
| `src/components/admin/org-model/PersonPanel.tsx` (modified) | component | request-response | itself — extend with `focusSopId` prop + render `TrainingRecordSection` | exact |
| `tests/phase35/no-competency-gate.spec.ts` | test (source-contract) | request-response | `tests/phase28/library-and-worker.spec.ts` | exact |

## Pattern Assignments

### `src/lib/competency/classify.ts` (utility, transform)

**Analog:** `src/lib/governance/classify.ts`

**Full file is the pattern** (46 lines) — sync, DB-free, no `'use server'`, exported type union + one function taking a plain input object and returning derived output:

```typescript
// src/lib/governance/classify.ts (lines 1-11, 29-46)
// Pure helper — classifies a single SOP's governance flags from already-fetched,
// RLS-scoped inputs. No server-action directive, no I/O, no supabase import —
// sync export so it stays directly unit-testable (2026-06-27 learning: a sync
// export inside a server-action module breaks `next build`).

export type GovernanceFlag = 'overdue' | 'due_soon' | 'unowned' | 'stale_role' | 'awaiting_approval'

export function classifyGovernanceRow(input: GovernanceInput): GovernanceFlag[] {
  const now = input.now ?? new Date()
  const flags: GovernanceFlag[] = []
  if (input.ownerUserId === null || !input.ownerIsActiveMember) flags.push('unowned')
  if (input.reviewDueAt) {
    const due = new Date(input.reviewDueAt)
    if (due < now) flags.push('overdue')
    else if (due.getTime() - now.getTime() <= DUE_SOON_WINDOW_DAYS * 86_400_000) flags.push('due_soon')
  }
  if (input.danglingDepartmentRefs || input.departmentRenamedSinceReview) flags.push('stale_role')
  if (input.hasPendingApproval) flags.push('awaiting_approval')
  return flags
}
```

Copy the shape verbatim for `classifyCompetency()`: sync export, `CompetencyState` union (4 members per CMP-01 exact wording), `now?: Date` injectable for deterministic unit tests. RESEARCH.md already drafted the exact target function (Pattern 1, lines 124-165 of 35-RESEARCH.md) — use it as-is, it already mirrors this analog's discipline (evidence-rows-in, no DB, ladder logic, D-01/D-02 comments inline).

**Never put this in `src/actions/`** — a sync export inside a `'use server'` file breaks `next build` (2026-06-27 learning, cited in the analog's own header comment).

---

### `src/lib/competency/matrix.ts` (utility, transform)

**Analog:** `src/lib/org-model/resolve-sop-access.ts`

**Pure assembler pattern** (lines 70-118 of resolve-sop-access.ts): takes pre-fetched arrays + lookup maps, returns computed sets — zero I/O, zero Supabase import:

```typescript
// src/lib/org-model/resolve-sop-access.ts (lines 70-84, shape only)
export function resolveSopAccess(input: ResolveSopAccessInput): ResolveSopAccessResult {
  const { orgId, depts, roles, membersByRole, collectionGrantsByUnit, collectionPersonGrants, sopCollectionIds, sopTargetGrants } = input
  const overridden = sopTargetGrants.length > 0
  // ... assembles Sets purely from already-fetched arrays, no db calls
  return { overridden, deptSet, personSet }
}
```

`buildMatrix()` should follow the same shape: accept `{ people, requiredSopsByPerson, completions, signOffs, observations }` (all pre-fetched arrays from `getTrainingMatrix`), map each `(person, sopId)` pair through `classifyCompetency()`, return rows/cols + rollups. Keep it a plain exported function, unit-testable with hand-built arrays, no DB import — mirrors the "Anti-Patterns to Avoid" note in RESEARCH.md (don't re-derive `resolveEffectiveAccess`'s inheritance chain here; read the **materialized** `sop_departments`/`sop_access_people` output only).

---

### `src/lib/competency/csv.ts` (utility, transform)

**No in-repo analog** — this is the one genuinely new pattern (no CSV generator exists anywhere in the codebase). RESEARCH.md's Don't-Hand-Roll table already specifies the approach: inline RFC-4180 quoting, no new dependency.

```typescript
// Inline quote helper (RESEARCH.md "Don't Hand-Roll" table, verbatim recommendation)
function csvField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}
```
Keep this sync/pure like the other two `src/lib/competency/*` modules — `rows in, CSV string out`, no Supabase import, no `'use server'`.

---

### `src/actions/competency.ts` (service, CRUD/read + batch)

**Analogs:** `src/actions/grants.ts` (batched `Promise.all` fanout + admin-client org-scoping) and `src/actions/observations.ts` (role-gated reads, admin-client-on-behalf-of-other-user pattern).

**Imports + auth pattern** (mirrors `observations.ts` lines 1-17):
```typescript
'use server'

import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyCompetency } from '@/lib/competency/classify'
import { buildMatrix } from '@/lib/competency/matrix'
```

**Role-gate pattern to copy verbatim** (`observations.ts` lines 132, 189-202, `RECORDER_ROLES`):
```typescript
const RECORDER_ROLES = ['supervisor', 'admin', 'safety_manager']

export async function getTrainingMatrix(deptId: string) {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !RECORDER_ROLES.includes(role)) return { error: 'Not authorized' }
  if (!organisationId) return { error: 'No organisation' }
  // ... admin-client batched fetch (Pattern 2 below)
}
```
Apply the SAME role gate to `getTrainingRecordForPerson` and `exportTrainingCsv`. For the worker's own `/profile` read (`getMyCompetencyStates` or similar), mirror `listObservationsForWorker` (`observations.ts` lines 173-185) instead — self-scoped, session client only, filter by `auth.uid()`, no role check beyond authentication, no admin client.

**Batched per-department fetch (Promise.all fanout)** — mirrors `grants.ts`'s `materializeSopAccessForOrg` (lines 451-460, the `Promise.all` of four independent admin-client queries) and RESEARCH.md's own Pattern 2 code example (lines 172-195 of 35-RESEARCH.md — use that block near-verbatim, it's already written against this repo's real table names):
```typescript
const [{ data: completions }, { data: signOffs }, { data: observations }] = await Promise.all([
  admin.from('sop_completions').select('id, worker_id, sop_id, sop_version, submitted_at').in('worker_id', personIds).in('sop_id', sopIds),
  admin.from('completion_sign_offs').select('completion_id, decision, created_at').in('completion_id', completionIds),
  admin.from('sop_observations').select('observed_worker_id, sop_id, verdict, created_at').in('observed_worker_id', personIds).in('sop_id', sopIds),
])
```

**Admin-client-on-behalf-of-other-worker pattern** (`observations.ts` lines 241-270, `listWorkerSopsForPicker`) — copy this defensively: reads of `sop_access_people`/`sop_completions`/`sop_observations` keyed to OTHER people's ids must go through `createAdminClient()`, self-enforcing `organisation_id` filters on every query, exactly because session-client RLS on these tables may only expose the caller's own rows (per RESEARCH Pitfall 4 / Assumption A3 — verify `sop_access_people`'s admin/supervisor RLS branch has a role check before trusting the session client for that one table).

**Display-name resolution** — reuse `resolveDisplayNames()` (`observations.ts` lines 145-156) verbatim (or import it) rather than writing a second `listUsers()`-based name lookup — this is also the answer to RESEARCH's Assumption A1 (no full-name field; email is the display/CSV name column everywhere in this app).

---

### `src/components/admin/org-model/TeamViewShell.tsx` (modify — extend view union)

**Analog:** itself (32-07). Full file is 67 lines; the only change is:
```typescript
// line 38 — extend the union
const [view, setView] = useState<'chart' | 'columns' | 'matrix'>('chart')

// lines 24-27 — extend VIEW_OPTIONS
const VIEW_OPTIONS = [
  { value: 'chart', label: '⊞ Chart' },
  { value: 'columns', label: '▤ Columns' },
  { value: 'matrix', label: '▦ Matrix' },
]

// lines 52-63 — add a third branch
) : view === 'matrix' ? (
  <TrainingMatrixView tree={tree} departments={departments} onSelectCell={(personId, sopId) => { setSelectedPerson(...); setFocusSopId(sopId) }} />
) : ( ... )
```
`ViewToggle` itself (`ViewToggle.tsx`, full 38-line file) needs ZERO changes — it is already a pure controlled component keyed by string value, per its own header comment ("no view owns private state, the toggle is a pure controlled component").

---

### `src/components/admin/org-model/PersonPanel.tsx` (modify — training record growth point)

**Analog:** itself (34-06), the explicit "Growth point (Phase 35)" comment at lines 127-129:
```typescript
{/* Growth point (Phase 35): this section list is where the
    per-worker training record will be appended. Nothing to
    render here yet — intentionally lean. */}
```
Replace this comment with `<TrainingRecordSection personId={person.id} focusSopId={focusSopId} />` as a THIRD `<section>` sibling of the existing "Record CTA" and "Observation history" sections (lines 87-125). Extend props per RESEARCH's Code Examples section (already drafted, copy verbatim):
```typescript
interface PersonPanelProps {
  person: { id: string; name: string; roleLabel?: string } | null
  focusSopId?: string | null   // NEW — Phase 35: scroll+highlight this SOP's evidence block on open
  onClose: () => void
}
```
Reuse the exact `useState` "reset at the moment the selected person changes, during render" idiom (lines 40-45) if `focusSopId` also needs reset-on-change behavior.

---

### `src/components/profile/CompetencySection.tsx` (new, RSC)

**Analog:** `src/components/profile/ObservationsSection.tsx` (full 53-line file — copy this file's shape wholesale, swap the action + copy):
```typescript
// Full analog pattern — async Server Component, Promise.all of two server actions,
// blueprint-frame card, trust-framing caption, read-only map over rows.
export async function ObservationsSection() {
  const [observations, labels] = await Promise.all([
    listObservationsForWorker(),
    getObservationLabels(),
  ])
  return (
    <div className="blueprint-frame p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--ink-100)]">
        <h2 className="mono text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider">
          Observations about you
        </h2>
        <span className="pill text-[var(--ink-500)]">{observations.length} RECORDS</span>
      </div>
      <div className="px-5 py-3 border-b border-[var(--ink-100)] text-sm text-[var(--ink-700)] leading-relaxed"
           style={{ background: 'color-mix(in srgb, var(--accent-decision) 6%, white)' }}>
        These are records your supervisors made... they're yours to see. Nothing here is hidden from you.
      </div>
      {/* map rows */}
    </div>
  )
}
```
`CompetencySection` swaps `listObservationsForWorker`/`getObservationLabels` for the new self-scoped competency action, keeps the "yours to see, nothing hidden" trust-framing caption style (D-04 requires the same trust framing), and renders `StatePill` per required SOP instead of `ObservationRow`. **CMP-04 applies here too — no lock icons, no gating copy, purely informational**, exactly like `ObservationsSection` has zero edit/hide control (D-08 there, D-04 here).

---

### `tests/phase35/no-competency-gate.spec.ts` (test, source-contract)

**Analog:** `tests/phase28/library-and-worker.spec.ts` (full 151-line file) — fork verbatim, only the regex and target file paths change:

```typescript
// tests/phase28/library-and-worker.spec.ts (lines 30-47, pattern to fork)
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const READ_TAB = path.join(ROOT, 'src', 'components', 'sop', 'tabs', 'ReadTab.tsx')
const WORKER_SOP_DETAIL = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

const GATE_PATTERN = /review_due_at\s*[<>]|owner_user_id\s*[=!]==?\s*null|if\s*\([^)]*(review_due_at|owner_user_id)/

test.describe('ReadTab — passive currency caption, no gate (D28-07)', () => {
  test('contains NO review_due_at conditional/gate anywhere', () => {
    expect(read(READ_TAB)).not.toMatch(GATE_PATTERN)
  })
})
```

Fork to (RESEARCH.md already specifies the exact regex, lines 253-271 of 35-RESEARCH.md):
```typescript
const GATE_PATTERN = /competency_state\s*[<>=!]|competencyState\s*[<>=!]|if\s*\([^)]*(competency_state|competencyState)/
const PROFILE_COMPETENCY_SECTION = path.join(ROOT, 'src', 'components', 'profile', 'CompetencySection.tsx')
```
Test three targets: `ReadTab.tsx`, the worker SOP detail route, and the NEW `CompetencySection.tsx` — same three-file pattern the analog already checks, plus one new file. **Must register** in `playwright.config.ts` as a new `phase35` project (`testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/`) and verify with `npx playwright test --list --project=phase35` — per the 2026-05-25/2026-06-02 registration-discipline learnings cited in RESEARCH.md.

---

## Shared Patterns

### Auth idiom — every new server entrypoint
**Source:** `src/lib/auth/session-context.ts` (`getSessionContext()`) + `src/lib/auth/guards.ts` (`requireAdminContext()`)
**Apply to:** All of `src/actions/competency.ts`'s exports, `CompetencySection.tsx`'s data fetch.
```typescript
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  // ... returns { supabase, userId, userEmail, role, organisationId }
})
```
Self-scoped worker reads (own `/profile` competency): use `getSessionContext()` directly, filter by `userId`, no role check. Admin/supervisor/safety_manager reads (matrix, CSV, PersonPanel training record): role-check `role in ['admin','safety_manager','supervisor']` inline (matches `RECORDER_ROLES` in `observations.ts`, NOT `requireAdminContext()` which excludes `supervisor`).

### Cross-org / on-behalf-of-worker admin-client reads
**Source:** `src/actions/observations.ts` lines 241-270 (`listWorkerSopsForPicker`) + `src/actions/grants.ts` `callerOrgId()` helper (lines 59-68)
**Apply to:** Every `src/actions/competency.ts` query that reads another person's `sop_completions`/`sop_observations`/`sop_access_people` rows.
```typescript
const admin = createAdminClient()
const orgId = await callerOrgId(admin, ctx)  // grants.ts pattern — never trust JWT org claim alone
const { data } = await admin.from('sop_completions').select('...').eq('worker_id', workerId).eq('organisation_id', orgId) // self-enforced org scope
```
Per CLAUDE.md's 2026-06-15/2026-06-26/2026-07-20 recurring bug class: service-role bypasses RLS — the ACTION must self-enforce `organisation_id` on every query, and must role-gate BEFORE attempting any org-wide read, not just filter after.

### Pure derivation module discipline
**Source:** `src/lib/governance/classify.ts` + `src/lib/org-model/resolve-sop-access.ts`
**Apply to:** All three `src/lib/competency/*.ts` files.
Rule: no `'use server'`, no Supabase import, sync exports only, plain data in → plain data out. This is a HARD requirement (2026-06-27 learning: a sync export inside a `'use server'` module breaks `next build`, not just style preference).

### Display name resolution (no full-name field exists)
**Source:** `src/actions/observations.ts` lines 145-156 (`resolveDisplayNames`)
**Apply to:** CSV export person names, matrix row labels, `CompetencySection` (n/a — self, no name needed).
```typescript
async function resolveDisplayNames(userIds: string[]): Promise<Record<string, string>> {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data.users) { if (ids.includes(u.id) && u.email) names[u.id] = u.email }
  return names
}
```
Do not invent a `full_name` field — email is the display name everywhere in this app (RESEARCH Assumption A1).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/competency/csv.ts` | utility | transform | No CSV generator exists anywhere in the codebase yet — first one. Use the RFC-4180 inline-quote approach from RESEARCH.md's Don't-Hand-Roll table (no library); shape otherwise follows the same pure-module discipline as `classify.ts`/`matrix.ts`. |

## Metadata

**Analog search scope:** `src/lib/governance/`, `src/lib/org-model/`, `src/actions/grants.ts`, `src/actions/observations.ts`, `src/actions/completions.ts`, `src/components/admin/org-model/`, `src/components/profile/`, `tests/phase28/`
**Files scanned:** 12 (all read in full or targeted excerpt)
**Pattern extraction date:** 2026-07-23
