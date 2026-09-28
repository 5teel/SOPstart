# Phase 54: Admin — Inbox, Floor Health, Library Table - Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** ~24 (new + modified + deleted)
**Analogs found:** 21 / 24 (deletions have no analog need; nav/matrix/journeys are text edits, not code patterns)

Note: RESEARCH.md's Architecture Patterns / Code Examples sections already name exact analogs and line-anchored excerpts for most of this phase's new code — this file consolidates those into planner-ready per-file assignments and adds the remaining components (route page, redirect shims, deletion sweep, marker rewrite) research only summarized.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(protected)/governance/page.tsx` | route (server page) | request-response | `src/app/(protected)/admin/governance/page.tsx` (redirect shim, gating pattern) + `src/app/(protected)/sops/page.tsx` (server shell composing client query components) | role-match |
| `src/components/admin/governance/InboxRow.tsx` (restyle `GovernanceQueueRow.tsx` in place) | component | CRUD (action dispatch) | `src/components/admin/governance/GovernanceQueueRow.tsx` | exact |
| `src/components/admin/governance/AdminFloorHealth.tsx` | component | transform + request-response | `src/components/sop/plant/PlantStage.tsx` usage site (Phase 52 worker plant composition) | role-match |
| `src/components/admin/governance/AdminMachinePanel.tsx` | component | request-response | `src/components/sop/plant/MachinePanel.tsx` | exact (sibling by design — file's own header comment names this as the Phase 54 addition) |
| `src/lib/sop/admin-health.ts` | utility (pure classifier) | transform | `src/lib/sop/worker-signal.ts` (`derivePlantPins`) | exact |
| `src/actions/site.ts` (`listSiteForOrg` extension) | service (server action) | CRUD (read) | itself — additive `.select()` change | exact |
| `src/components/admin/AdminLibraryTable.tsx` | component | CRUD (list/read) | `src/components/sop/lenses/AdminStatusLens.tsx` (useQuery + `listAdminSopRows` shape) | exact |
| `src/lib/sop-list/admin-rows.ts` (checks derivation helper) | utility (pure classifier) | transform | `src/lib/sop-list/admin-rows.ts` itself (`stripExtension`/`shortOwner`/`relativeDay` — small pure helpers colocated with `MillerSop`) | exact |
| `src/app/(protected)/sops/page.tsx` (rewritten) | route (server page) | request-response | itself (pre-phase version) — strip Miller/nav-contract, keep `isAdmin` branch + worker branch structure | role-match |
| `src/components/sop/WorkerSimpleList.tsx` | component | CRUD (read) | `src/components/sop/SopWorkerBrowser.tsx` (pre-deletion; extract its stacked-list markup, not its Miller frame) | role-match |
| `src/app/(protected)/admin/sops/page.tsx` (view=attention branch fix) | route (redirect shim) | request-response | itself — existing `view` passthrough branch | exact |
| `src/app/(protected)/admin/governance/page.tsx` (redirect target fix) | route (redirect shim) | request-response | itself — existing hardcoded `qp = new URLSearchParams({view:'attention'})` | exact |
| `scripts/check-bundle-size.ts` (`GATED_ROUTES['/sops/page'].forbiddenMarkers` rewrite) | config | transform | itself — `collectSelfValidationCorpus()` | exact |
| `src/components/layout/TopHeader.tsx` (Governance href) | component | request-response | itself, line 146 | exact |
| `src/lib/journeys/journeys.ts` (governance journey + stale-entry sweep) | config | transform | itself — existing journey entries (admin-onboarding ~298-311, governance-queue ~576, plant ~145, access-map ~448/452/464) | exact |
| `.planning/codebase/CAPABILITY-MATRIX.md` | config | transform | itself, lines 46-47/64 | exact |
| `src/lib/uat/tests.ts` | config | transform | itself — existing entries pattern | role-match |
| `tests/phase54/governance-inbox.spec.ts` | test | request-response | `tests/phase28/governance-queue.spec.ts` | role-match |
| `tests/phase54/admin-health.spec.ts` | test (unit) | transform | `src/lib/sop/worker-signal.ts`'s existing unit test (Phase 52 pattern) / `src/lib/governance/__tests__/classify.test.ts` | exact |
| `tests/phase54/deletion-sweep.spec.ts` | test (source-contract) | transform | `tests/phase41/reference-sweep.spec.ts` + `tests/phase30/dead-weight.spec.ts` | exact |
| `tests/evals/governance.eval.ts` | test (eval) | request-response | `tests/evals/plant-home.eval.ts` (idempotent fixture setup pattern, lines ~154-181) | exact |
| `tests/evals/sop-surface.eval.ts` (rewrite) | test (eval) | request-response | itself (pre-phase version) + `tests/evals/site-editor.eval.ts` fixtures | role-match |
| Deletion set: `AdminSopSurface.tsx`, `AdminAttentionLens.tsx`, `AdminStatusLens.tsx`, `MillerPrimitives.tsx`, `SopWorkerBrowser.tsx`, `SopMillerBrowser.tsx`, `sops-nav-types.ts` | n/a | n/a | n/a | no analog needed — see Deletion Inventory in RESEARCH.md (authoritative, already grepped exhaustively) |

## Pattern Assignments

### `src/components/admin/governance/InboxRow.tsx` (component, CRUD)

**Analog:** `src/components/admin/governance/GovernanceQueueRow.tsx` (restyle in place per D-03/A3 — do not rewrite the gating from scratch)

**Imports pattern** (lines 1-9):
```typescript
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { confirmSopCurrent } from '@/actions/governance'
import type { GovernanceRow } from '@/actions/governance'
import { approveStep } from '@/actions/approvals'
import { OwnerPicker } from './OwnerPicker'
```

**Action dispatch pattern** (lines 37-59) — copy verbatim, this is the mutation wiring every inbox action reuses:
```typescript
function handleApprove() {
  setError(null)
  startTransition(async () => {
    const result = await approveStep(row.id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
  })
}
```

**Gating precedence — copy verbatim, do not re-derive** (lines 89-113):
```typescript
row.flags.includes('awaiting_approval') && row.isCallerNextApprover ? (
  <button onClick={handleApprove} disabled={isPending} className="evidence-btn !min-h-9 text-sm">
    {isPending ? 'Approving…' : 'Approve'}
  </button>
) : row.flags.includes('unowned') ? (
  <OwnerPicker sopId={row.id} ownerUserId={row.ownerUserId} ownerLabel={row.ownerLabel} />
) : row.flags.includes('stale_role') ? (
  <Link href={`/admin/sops/${row.id}/assign`} className="evidence-btn !min-h-9 text-sm">Fix assignment</Link>
) : (
  <button onClick={handleConfirmCurrent} disabled={isPending} className="evidence-btn !min-h-9 text-sm">
    {isPending ? 'Confirming…' : 'Confirm current'}
  </button>
)
```
This precedence order (approve-me → unowned → stale-role → confirm-current) is the APR-03/04 hard constraint (D-03). The new inbox adds Retry/Finish/Add branches around this block for the non-governance-queue row sources (stuck parse jobs, machines-with-no-procedures) — those are new branches, not replacements of this one.

**Flag styling tokens to reuse** (lines 11-25) — same `FLAG_STYLE`/`FLAG_LABEL` maps, do not redefine:
```typescript
const FLAG_STYLE: Record<GovernanceRow['flags'][number], string> = {
  overdue: 'bg-accent-escalate/20 text-accent-escalate',
  due_soon: 'bg-accent-decision/20 text-accent-decision',
  unowned: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  stale_role: 'bg-[var(--paper-2)] text-[var(--ink-500)]',
  awaiting_approval: 'bg-[var(--accent-signoff)]/20 text-[var(--accent-signoff)]',
}
```

---

### `src/lib/sop/admin-health.ts` (utility, transform)

**Analog:** `src/lib/sop/worker-signal.ts`

**Module discipline to copy** (per file's own header comment, CLAUDE.md 2026-09-27 rule): one pure module, no I/O, no `Date.now()` hoisted to module scope, `now` passed as a parameter with a default so tests can inject a fixed clock — exactly as `derivePlantPins` does.

**Core pattern** (already fully specified in RESEARCH.md Code Examples — reuse verbatim):
```typescript
export type AdminSopHealth = { id: string; ownerUserId: string | null; reviewDueAt: string | null; status: string }
export type MachineHealth = 'bad' | 'due' | 'ok' | null

/** Worst of no-owner (bad) > review-overdue (due) > ok, across a machine's linked SOPs. */
export function machineHealth(
  sopIds: ReadonlyArray<string>,
  sopsById: ReadonlyMap<string, AdminSopHealth>,
  now = new Date()
): MachineHealth {
  const sops = sopIds.map((id) => sopsById.get(id)).filter((s): s is AdminSopHealth => Boolean(s))
  if (sops.length === 0) return null
  if (sops.some((s) => !s.ownerUserId)) return 'bad'
  if (sops.some((s) => s.reviewDueAt && new Date(s.reviewDueAt) < now)) return 'due'
  return 'ok'
}
```

---

### `src/components/admin/governance/AdminMachinePanel.tsx` (component, request-response)

**Analog:** `src/components/sop/plant/MachinePanel.tsx` (worker variant) — its own header comment at line 8 names this exact file as "the admin variant Phase 54 adds," so treat the worker file as the layout/props analog, not a copy source for content (D-05: no worker to-do badges in the admin panel; admin panel shows owner/rev + `NO OWNER`/`REVIEW DUE`/`DRAFT`/`OK` badges instead).

**Structure to copy:** props shape (`export interface` matching the worker `MachinePanel`'s prop contract — sprite, department, name, SOP list), `Open` (SOP page) / `Edit` (builder) link pattern per SOP row, "Add one" empty state.

---

### `src/components/admin/governance/AdminFloorHealth.tsx` (component, transform + request-response)

**Analog:** `src/components/sop/plant/PlantStage.tsx` (Phase 52, reused verbatim per RESEARCH.md — "no hand-rolled copies here")

**Core pattern:** `PlantStage` takes `machines: PlantStageMachine[]` with caller-supplied `pin`/`highlighted`/`zoneColour` — `AdminFloorHealth` computes those props by mapping each machine's linked SOP ids through `machineHealth()` and a colour lookup (`bad`→red `!`, `due`→amber `↻`, `ok`→small green dot), then passes the array straight to `<PlantStage>` unchanged. Do not touch `src/lib/site/scene.ts` camera math — `PlantStage`'s own doc comment states this is centralized there.

**No-site fallback (D-06):** compact "Draw your site" card linking `/admin/site` — check `src/components/sop/plant/` or the worker plant-home composition for the existing "no site" empty-state card pattern (Phase 51/52) and reuse its markup/tokens rather than inventing a new card.

---

### `src/components/admin/AdminLibraryTable.tsx` (component, CRUD)

**Analog:** `src/components/sop/lenses/AdminStatusLens.tsx`

**Query pattern** (verbatim, from RESEARCH.md Pattern 1 / `AdminStatusLens.tsx`):
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['admin-sop-rows', status, ownerOnly, departments ?? null, collection ?? null],
  queryFn: () => listAdminSopRows({ status, owner: ownerOnly ? 'me' : undefined, departments, collection }),
  staleTime: 1000 * 60,
})
```
Shape to follow throughout: `'use client'`, `useQuery` against the existing server action, loading skeleton, error state, then render — identical to every prior lens, this is not a new pattern to invent.

**Checks-column derivation** (new pure helper, colocate with `MillerSop` in `src/lib/sop-list/admin-rows.ts` per the file's existing small-pure-helper convention — `stripExtension`/`shortOwner`/`relativeDay`):
```typescript
type Check = 'ok' | 'warn' | 'bad'

function computeChecks(sop: MillerSop, machineIds: string[]): Record<'owner' | 'review' | 'approved' | 'assigned' | 'converted', Check> {
  return {
    owner: sop.ownerLabel ? 'ok' : 'bad',
    review: sop.flagLabel === 'Overdue' ? 'bad' : sop.flagLabel === 'Due soon' ? 'warn' : 'ok',
    approved: sop.status === 'published' ? 'ok' : sop.flagLabel === 'Awaiting approval' ? 'warn' : 'bad',
    assigned: sop.allDepartments || sop.departments.length > 0 ? 'ok' : 'bad',
    converted: sop.stuck ? 'bad' : 'ok',
  }
}
```
Reuses `flagLabel`/`status`/`stuck`/`departments`/`ownerLabel` — all already on `MillerSop` (`src/lib/sop-list/admin-rows.ts:79-98`). Do not re-derive overdue/due-soon thresholds a second time (2026-09-27 "same classifier written twice will drift").

---

### `src/actions/site.ts` (`listSiteForOrg` extension) — service, CRUD read

**Analog:** itself — additive `.select()` only, no new query path

**Pattern** (exact diff, lines 122-127):
```typescript
// CURRENT
const { data: sopRows, error: sopErr } = await db
  .from('sops')
  .select('id, title')
  .eq('organisation_id', orgId)
  .not('title', 'is', null)
  .order('title', { ascending: true })

// EXTENDED
const { data: sopRows, error: sopErr } = await db
  .from('sops')
  .select('id, title, owner_user_id, review_due_at, status')
  .eq('organisation_id', orgId)
  .not('title', 'is', null)
  .order('title', { ascending: true })
```
Org-scope invariant to preserve: `.eq('organisation_id', orgId)` uses the SESSION `organisationId` from `requireAdminContext()`, never a fetched row's org (2026-07-28 CLAUDE.md rule; this file already follows it — do not regress). `SiteSopOption` type in `src/lib/validators/site.ts` grows the same 3 optional fields.

---

### `src/app/(protected)/governance/page.tsx` (route, request-response)

**Analog:** any existing `(protected)` admin server page using `requireAdminContext()` gating — e.g. `src/app/(protected)/admin/sops/page.tsx` / `src/app/(protected)/admin/governance/page.tsx` for the gating idiom; `src/app/(protected)/sops/page.tsx` for the pattern of a server shell composing `'use client'` query components below it.

**Auth pattern:** `requireAdminContext()` at the top of the server component, identical to every existing admin surface (RESEARCH.md Security Domain confirms no new pattern needed here).

---

### `src/app/(protected)/admin/governance/page.tsx` (redirect shim fix)

**Analog:** itself (current hardcoded redirect)

**Current pattern to replace:**
```typescript
const qp = new URLSearchParams({ view: 'attention' })
// redirects to /sops?{qp}
```
**New pattern:** `redirect('/governance')` (drop the `view`/`filter` passthrough unless the new inbox accepts a `?filter=` param — confirm against the new page's own query-param contract before deciding). Same fix class applies to `src/app/(protected)/admin/sops/page.tsx`'s `view === 'attention'` branch — repoint to `/governance` instead of `/sops?view=attention`. Both are named explicitly in RESEARCH.md Pitfall 4.

---

### `scripts/check-bundle-size.ts` (`GATED_ROUTES` marker rewrite)

**Analog:** itself — `collectSelfValidationCorpus()` (lines 312-349 per RESEARCH.md)

**Pattern:** remove the `SopMillerBrowser.tsx`-sourced marker group (`'Pick another scope on the left.'` / `'Pick a SOP to see its detail here.'`) entirely from `GATED_ROUTES['/sops/page'].forbiddenMarkers` in the SAME commit as the deletion. For the `GovernanceQueueRow`/`'Owner role gone'` group: either drop it too, or extend `collectSelfValidationCorpus()`'s directory walk to also scan `.next/server/app/(protected)/governance` if `GovernanceQueueRow`/`flag-display.ts`'s `FLAG_LABEL` is kept reachable from the new route. Prove the choice with a real `npm run build` — this is not a bundle-size number, it is a marker-presence assertion (RESEARCH.md Pitfall 1, highest-risk item in the phase).

---

### `tests/phase54/deletion-sweep.spec.ts` (test, source-contract)

**Analog:** `tests/phase41/reference-sweep.spec.ts` + `tests/phase30/dead-weight.spec.ts`

**Pattern** (structure, lines 1-25 of `reference-sweep.spec.ts`):
```typescript
/**
 * Pattern: tests/phase30/dead-weight.spec.ts — pair a deletion/rewrite with
 * a src/-wide reference sweep, per CLAUDE.md 2026-08-04 ("a deletion guard
 * must assert the absence of REFERENCES, not just the absence of the
 * file"). Every regex here is anchored so sibling sub-routes are NOT false
 * positives — only the exact deleted-module reference counts.
 *
 * Comment lines are stripped before every assertion below (CLAUDE.md
 * self-invalidating-header class) so a file's own explanatory prose about
 * the old route/label cannot satisfy or break either sweep.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
```
Assert: zero importers of each of the 7 deleted files (grep-based, comment-stripped first), zero remaining `view=attention` references outside the two fixed redirect shims, zero `MillerColumnHeader`/`MillerGroupLabel`/`MillerItem` imports anywhere in `src/` (Pitfall 3 — this must include `sops/page.tsx`'s own worker-side scope column, not just the admin files literally named in D-09).

---

### `tests/evals/governance.eval.ts` (eval)

**Analog:** `tests/evals/plant-home.eval.ts` (idempotent fixture setup, lines ~154-181)

**Pattern:** explicitly assert/reset `owner_user_id IS NULL` on the eval-site fixture SOP in `beforeAll` before relying on the red pin (D-13b, RESEARCH.md Open Question 3 resolution) — mirror `plant-home.eval.ts`'s "Ensure the EVAL Press machine exists" idempotent-setup style rather than assuming fixture state. Session minting via `tests/evals/lib/session.ts` (magic-link → verifyOtp → cookie), unchanged project convention.

## Shared Patterns

### Server action discriminated-union return + admin gating
**Source:** `src/actions/site.ts` (module header comment, lines 1-24) — pattern applies to every server action touched or added in this phase
**Apply to:** `listSiteForOrg` extension, any new "machines with no procedures" derivation if it becomes a server function rather than a client-side filter
```typescript
// requireAdminContext() runs first in every export; return type is always
// `{ ... } | { error }` — never throw. Explicit `.eq('organisation_id', orgId)`
// using the SESSION organisationId, never a fetched row's org (2026-07-28).
```

### Lens/query composition idiom
**Source:** `src/components/sop/lenses/AdminStatusLens.tsx`
**Apply to:** `AdminLibraryTable.tsx`, `AdminFloorHealth.tsx`, the `/governance` inbox's three query hooks
```typescript
'use client'
// useQuery against an existing server action, loading skeleton, error state, then render.
```

### Pure classifier module discipline
**Source:** `src/lib/sop/worker-signal.ts` (header comment; CLAUDE.md 2026-09-27 "same classifier written twice will drift")
**Apply to:** `src/lib/sop/admin-health.ts`, the checks-column helper in `admin-rows.ts`
```typescript
// One plain module per classification question, imported everywhere it's asked.
// No I/O, no Date.now()/navigator at module scope — now passed as a parameter.
```

### Deletion guard = absence of references, not just absence of file
**Source:** `tests/phase41/reference-sweep.spec.ts`, `tests/phase30/dead-weight.spec.ts`; CLAUDE.md 2026-08-04 + 2026-07-13
**Apply to:** `deletion-sweep.spec.ts`, and every phase28/30/33/41 spec listed in RESEARCH.md's Deletion Inventory table (repoint or delete each, in the SAME commit as the source deletion)

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/app/(protected)/governance/page.tsx` route content (inbox composition + 3-source severity sort) | route | request-response | Genuinely new composition (3 existing queries merged into one severity-sorted list) — no prior file does this exact merge; use the Shared Patterns above for its parts, not a single donor file |
| "Machines with no procedures" filter | transform | client-side filter, not a query | No existing analog performs this specific left-join-then-filter; RESEARCH.md Don't-Hand-Roll table confirms it's a filter over already-fetched `listSiteForOrg()` data, not a new query — implement inline, do not create a new server action for it |

## Metadata

**Analog search scope:** `src/actions/`, `src/components/admin/`, `src/components/sop/`, `src/components/sop/plant/`, `src/lib/sop/`, `src/lib/sop-list/`, `src/app/(protected)/`, `tests/phase28/`, `tests/phase30/`, `tests/phase41/`, `scripts/check-bundle-size.ts`
**Files scanned:** ~30 (research already performed exhaustive grep/read; this pass verified and extracted excerpts from the 6 highest-value analogs directly)
**Pattern extraction date:** 2026-09-29
