# Phase 36: Refresher Cadence + Version-Currency - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 13 (new + modified)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/competency/version-currency.ts` (new) | utility (pure fn) | transform | `src/lib/governance/cadences.ts` | exact |
| `src/lib/competency/refresher.ts` (new) | utility (pure fn) | transform | `src/lib/governance/cadences.ts` (`computeReviewDueDate`) | exact |
| `src/lib/competency/__tests__/version-currency.test.ts` (new) | test | transform | `src/lib/competency/__tests__/classify.test.ts` (Phase 35, same dir) | exact |
| `src/lib/competency/__tests__/refresher.test.ts` (new) | test | transform | same as above | exact |
| `src/actions/competency.ts` (extend: `getTrainingMatrix`, `getTrainingRecordForPerson`, `getMyCompetencyStates`, new `getVersionCompletionBreakdown`) | service/controller | CRUD (read, lineage-widened) | `src/actions/versioning.ts` (`getVersionHistory`, lineage query shape) | exact |
| `src/actions/governance.ts` or `competency.ts` (new `setRefresherInterval`) | service/controller | CRUD (write) | `src/actions/governance.ts` `setSopOwner` (lines 104-147) | exact |
| `src/lib/competency/matrix.ts` (extend `MatrixCell`) | model/transform | transform | same file, Phase 35 shape (additive fields) | exact |
| `src/lib/competency/csv.ts` (extend `HEADER`/`TrainingCsvRow`) | utility | batch (CSV) | same file, Phase 35 `csvField()` pattern | exact |
| `src/components/admin/competency/StatePill.tsx` (extend w/ badge prop) | component | request-response (render) | same file, existing `needsSupportFlag` sibling-pill pattern (lines 50-52) | exact |
| `src/components/admin/competency/TrainingMatrixView.tsx` (extend: rollups, axis-swap) | component | request-response (render) | same file, existing rollup tally rendering | exact |
| `src/components/profile/CompetencySection.tsx` (extend w/ chips) | component | request-response (render) | `StatePill.tsx` + `SopLibraryCard.tsx` badge pattern | role-match |
| `src/components/sop/SopLibraryCard.tsx` (extend w/ due chip) | component | request-response (render) | same file, existing `hasNewerVersion` badge (lines 9-17, 55-60) | exact |
| `app/admin/sops/[sopId]/versions/page.tsx` (extend w/ TRN-03 panel) | route/component | CRUD (read) | same file, existing supersede-history panel + `getVersionHistory` data source | exact |
| `supabase/migrations/000XX_refresher_interval.sql` (new) | migration | schema | `supabase/migrations/00043_ownership_review_governance.sql` (additive `sops` column + RLS reuse) | exact |
| `tests/phase36/no-refresher-gate.spec.ts` (new) | test | source-contract | `tests/phase35/no-competency-gate.spec.ts` | exact |
| `tests/phase36/version-currency-lineage.spec.ts`, `version-breakdown-panel.spec.ts` (new) | test | source-contract / RLS | `tests/phase35/competency-rls-probe.spec.ts` | exact |
| `playwright.config.ts` (extend: register `phase36`/`phase36-unit` projects) | config | — | existing `phase34`/`phase35` project registration blocks | exact |

## Pattern Assignments

### `src/lib/competency/refresher.ts` + `version-currency.ts` (utility, pure transform)

**Analog:** `src/lib/governance/cadences.ts` (full file read above)

**Core pattern — reuse verbatim, do not reimplement:**
```typescript
// src/lib/governance/cadences.ts:25-37 — computeReviewDueDate
export function computeReviewDueDate(baseIso: string, months: number): string {
  const base = new Date(baseIso)
  const targetDay = base.getUTCDate()
  base.setUTCDate(1)
  base.setUTCMonth(base.getUTCMonth() + months)
  const lastDayOfTargetMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(targetDay, lastDayOfTargetMonth))
  return base.toISOString()
}
```
New `refresher.ts` is a thin re-export/wrapper calling this — no new date math:
```typescript
import { computeReviewDueDate } from '@/lib/governance/cadences'
export function refresherDueDate(lastCompletionIso: string, intervalMonths: number): string {
  return computeReviewDueDate(lastCompletionIso, intervalMonths)
}
```
Do NOT reuse `resolveCadenceMonths` — D-02 forbids org/category fallback for the refresher interval (unset = null, no ladder).

`version-currency.ts` is a one-line comparator, no analog needed beyond the file-header comment convention (see `cadences.ts:1-6` module doc block) — mirror that doc-comment style: state the requirement ID (CMP-03), note it's pure/no I/O, and reference the consuming action.

File header convention to copy:
```typescript
// ------------------------------------------------------------
// isOutdatedVersion — pure helper for version-currency (CMP-03/D-06).
// No server-action directive, no I/O — sync export imported into
// src/actions/competency.ts (2026-06-27 learning: sync exports must
// live outside 'use server' files).
// ------------------------------------------------------------
```

---

### `src/actions/competency.ts` — lineage-widened evidence queries (service, CRUD read)

**Analog:** `src/actions/versioning.ts` — `getVersionHistory` (lines 235-244)

**Lineage query pattern to reuse verbatim (batched form, not per-SOP loop):**
```typescript
// src/actions/versioning.ts:235-244 (existing, Phase 23)
const parentId: string = (sop.parent_sop_id as string | null) ?? sop.id
const { data: versions } = await supabase
  .from('sops')
  .select('id, version, status, ... superseded_by, parent_sop_id')
  .or(`parent_sop_id.eq.${parentId},id.eq.${parentId}`)
  .order('version', { ascending: false })
```
For the batched matrix/record fetch, widen to `.in()` across all required root ids in a single query (Promise.all discipline already used throughout `getTrainingMatrix`), then build `Map<currentSopId, string[] /* lineage sop_ids */>`, fetch `sop_completions`/`sop_observations`/`completion_sign_offs` with `.in('sop_id', allLineageIds)`, and remap each row's `sop_id` back to the canonical current id before constructing `MatrixCompletion[]` — `classify.ts`/`matrix.ts` stay byte-unchanged (locked decision, no classifier refactor).

**Org-scope self-enforcement (mandatory on every new admin-client read) — copy this shape from the existing `competency.ts` reads:**
```typescript
// existing pattern throughout src/actions/competency.ts — verify caller org
// before returning any row fetched via admin/service-role client
const orgId = ctx.organisationId
// ...fetch via createAdminClient()...
// then filter/verify: row.organisation_id === orgId before use
```
This is the mandatory mitigation for the recurring cross-org admin-client class (2026-06-15/26/07-20 learnings) — apply to `getVersionCompletionBreakdown` too.

---

### `setRefresherInterval` (service, CRUD write)

**Analog:** `src/actions/governance.ts` `setSopOwner` (lines 104-147, read in full above)

**Full pattern to mirror (plain session client, not admin client — RLS is the backstop):**
```typescript
// src/actions/governance.ts:104-147
export async function setSopOwner(
  sopId: string,
  userId: string | null,
): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  // ...validation...
  const supabase = await createClient() // plain session client — admins_can_update_sops RLS gates this write
  const { data: updated, error } = await supabase
    .from('sops')
    .update({ owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', sopId)
    .select('id')
  if (error) { console.error('[setSopOwner] update error', error); return { error: error.message } }
  if (!updated || updated.length === 0) return { error: 'SOP not found' } // 0 rows = RLS filtered, not silent success
  return { success: true }
}
```
`setRefresherInterval(sopId, months: number | null)` copies this exactly, swapping the validation block for an integer 1-120 range check (mirrors `setReviewCadence`'s inline validation at `governance.ts:214-247`), and updates `refresher_interval_months` instead of `owner_user_id`. No new RLS policy needed — `admins_can_update_sops` already covers any additive `sops` column (same precedent as migration 00043).

**Imports pattern** (top of `governance.ts`):
```typescript
import { createClient } from '@/lib/supabase/server'
```

---

### `StatePill.tsx` — outdated-version badge (component, render)

**Analog:** same file, existing sibling-pill pattern (lines 45-53, read in full above)

**Pattern to copy — badge rendered as a second `<span className="pill ...">` sibling, never replacing the primary pill:**
```tsx
// src/components/admin/competency/StatePill.tsx:45-53
return (
  <span className="inline-flex items-center gap-1.5">
    <span className="pill" style={{ color: `var(${accentVar})`, borderColor: `var(${accentVar})` }}>
      {label}
    </span>
    {needsSupportFlag && (
      <span className="pill state-pill-support">Needs support</span>
    )}
  </span>
)
```
Add `isOutdatedVersion?: boolean` prop, render a third sibling `<span className="pill">Outdated version</span>` using `--accent-decision` (amber, coaching-not-discipline token — already declared, do not invent a new token per the 2026-07-14 CLAUDE.md learning). The component doc comment at lines 1-16 explicitly states "purely informational... never a control" — preserve that framing verbatim for the new badge.

---

### `SopLibraryCard.tsx` — refresher due/overdue chip (component, render)

**Analog:** same file — `hasNewerVersion` prop + badge (lines 9-17, 51-60, read in full above)

This is a near-identical existing pattern from a prior phase (AFL-VER-04/D-09): an optional boolean prop computed by the parent page, rendered as an informational badge, explicitly commented "no forced re-walk." Copy this exact shape for the new `refresherDue`/`refresherOverdue` prop:
```tsx
interface SopLibraryCardProps {
  sop: CachedSop
  isCached: boolean
  hasNewerVersion?: boolean
  // NEW (Phase 36, REF-01/D-08): informational only, computed by parent page
  // from refresherDueAt vs now — no forced re-walk, no gating (CMP-04).
  isRefresherDue?: boolean
}
```
```tsx
{hasNewerVersion && (
  <span data-updated-badge="true" ...>Updated</span>
)}
{isRefresherDue && (
  <span data-refresher-due-badge="true" className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--accent-decision)]/10 text-[var(--accent-decision)] text-xs font-semibold rounded">
    Refresher due
  </span>
)}
```

---

### `versions/page.tsx` — TRN-03 breakdown panel (route/component, CRUD read)

**Analog:** same file's existing supersede-history rendering, fed by `getVersionHistory` (see `src/actions/versioning.ts:235-244` above)

New `getVersionCompletionBreakdown(sopId)` server action (in `competency.ts`) follows the lineage-query pattern above, gated to the SAME role check the versions page already uses (`['admin','safety_manager']` — do NOT loosen to `RECORDER_ROLES`/supervisor without an explicit product decision; Open Question 1 in RESEARCH.md flags this). Panel renders per-version completion counts + expandable worker list as a new section alongside the existing version-history list — same page, same data-fetch-then-render shape already established there.

---

### CSV columns (utility, batch)

**Analog:** `src/lib/competency/csv.ts` — `csvField()` helper (Phase 35, formula-injection neutralized per 2026-07-24 learning)

New `on_current_version` ('yes'|'no') and `refresher_due_date` (ISO or '') columns MUST route through the existing `csvField()` helper in the row-mapping array — never string-concatenate raw values. Extend `HEADER` array and `TrainingCsvRow` interface additively; do not touch the generator's core loop structure.

---

### Test files (source-contract / RLS probe / unit)

**Analog:** `tests/phase35/no-competency-gate.spec.ts` (CMP-04 guard) + `tests/phase35/competency-rls-probe.spec.ts` (live RLS probe harness)

`tests/phase36/no-refresher-gate.spec.ts` extends the SAME `GATE_PATTERN` regex idiom (or adds a sibling regex) to forbid `isOutdatedVersion`/`refresherDue`/`isOverdue` conditionals from appearing in any worker-facing gating context — copy the regex-over-file-contents approach, not a new mechanism.

`tests/phase36/version-currency-lineage.spec.ts` copies the ephemeral-org + minted-session harness from `competency-rls-probe.spec.ts` to set up a real supersede scenario (complete v1 → supersede → assert v1 evidence still surfaces under v2's read).

Unit tests (`version-currency.test.ts`, `refresher.test.ts`) land in `src/lib/competency/__tests__/` — the existing `phase35-unit` Playwright project already targets this directory; zero config edit needed for those two files. `playwright.config.ts` DOES need a new `phase36` project block (mirror the existing `phase34`/`phase35` broad-registration regex shape) for the source-contract/RLS specs under `tests/phase36/`.

## Shared Patterns

### Additive migration for a per-SOP column
**Source:** `supabase/migrations/00043_ownership_review_governance.sql` precedent (owner_user_id/review_due_at columns + RLS reuse)
**Apply to:** new `refresher_interval_months` column on `sops`
No new RLS policy — `admins_can_update_sops` already covers org+role gating for any additive column.

**Critical wiring, not optional:** both `uploadNewVersion` (versioning.ts ~lines 63-74) and `cloneSopAsDraft` (~lines 316-329) build their INSERT payload as an explicit field list, NOT a spread — `refresher_interval_months` must be added to BOTH insert payloads and their preceding `select()` field lists, or the interval silently drops on every version supersede (Pitfall 2 in RESEARCH.md). This is a single locked task — two sites, not one.

### Pure-function module convention
**Source:** `src/lib/governance/cadences.ts` (module doc header, sync exports, no `'use server'`)
**Apply to:** `version-currency.ts`, `refresher.ts` — sync exports must live outside any `'use server'` file (2026-06-27 CLAUDE.md learning: Server Actions must be async; a pure sync helper inside a `'use server'` module breaks `next build`).

### CSS token reuse — no new tokens needed
**Source:** `--accent-decision` (amber) already used for `needsSupportFlag` in `StatePill.tsx`; `--accent-voice` (orange, declared in `blueprint-theme.css` line 47) available if a visually distinct color is wanted for outdated-vs-due.
**Apply to:** all new chips (outdated-version badge, refresher due/overdue chip). Before introducing anything, `grep -rn -- "--accent-" src/styles/blueprint-theme.css` to confirm no new token is needed (2026-07-14 CLAUDE.md learning — six prior invisible-render bugs from undeclared tokens).

### Org-scope self-enforcement on admin-client reads
**Source:** existing pattern throughout `src/actions/competency.ts` (Phase 35)
**Apply to:** every new admin-client read this phase (lineage-widening query, `getVersionCompletionBreakdown`) — verify `organisation_id` matches caller's org before returning data; never trust a client-supplied `sopId` alone (recurring cross-org class, 2026-06-15/26/07-20).

## No Analog Found

None — every file in this phase's scope has a strong existing analog (RESEARCH.md confirms this phase is pure composition of Phase 23/28/35 primitives, no new subsystem).

## Metadata

**Analog search scope:** `src/lib/governance/`, `src/lib/competency/`, `src/actions/governance.ts`, `src/actions/versioning.ts`, `src/actions/competency.ts`, `src/components/admin/competency/`, `src/components/profile/`, `src/components/sop/`, `tests/phase35/`, `supabase/migrations/`
**Files scanned:** 9 read in full (cadences.ts, StatePill.tsx, governance.ts excerpt, SopLibraryCard.tsx excerpt) + RESEARCH.md's own confirmed reads of classify.ts, matrix.ts, csv.ts, competency.ts, version-lineage.ts, versioning.ts, publish-core.ts, TrainingMatrixView.tsx, CompetencySection.tsx, no-competency-gate.spec.ts, competency-rls-probe.spec.ts, playwright.config.ts
**Pattern extraction date:** 2026-07-26
