# Phase 36: Refresher Cadence + Version-Currency - Research

**Researched:** 2026-07-26
**Domain:** Derived/read-time comparison layers over existing competency + version-lineage data (no new external services, no new packages)
**Confidence:** HIGH (all findings verified against live code in this repo; no external library research required)

## Summary

Phase 36 adds two READ-TIME comparison layers over data that already exists: (1) version-currency — compare a worker's latest completion's SOP version against the SOP's current published version, surfaced as a chip beside the existing competency pill; (2) refresher cadence — a new opt-in per-SOP interval, combined with the worker's latest completion date, using the EXACT SAME pure due-date function Phase 28 already built for review cadence (`computeReviewDueDate`). Nothing here is a new subsystem — it is two small pure functions plus query-scope changes in three existing server actions (`getTrainingMatrix`, `getTrainingRecordForPerson`, `getMyCompetencyStates`), one new column on `sops`, one new admin write action, one new read action (TRN-03 panel), and chip additions to four existing components.

The single most important technical finding from this research (see Architecture Patterns § Lineage-Widening) is that **`sop_completions`, `sop_observations`, and `completion_sign_offs` are all keyed to a SPECIFIC `sop_id` row, not to the lineage root**. Phase 35's matrix/record/self-state actions currently query these tables scoped to the CURRENT published `sop_id` only. After a version supersede (`uploadNewVersion` or `cloneSopAsDraft` → publish), a worker's pre-supersede completion lives under the OLD (now-superseded) `sop_id`, which falls OUTSIDE that scope — so a naive read would show the worker as `not_started`, which is exactly the orphaning CMP-03 forbids. Closing this is the load-bearing design work of this phase; the "outdated version" chip is the easy 20% once the lineage-widening is in place.

**Primary recommendation:** Widen every evidence query (completions/sign-offs/observations) in `src/actions/competency.ts` from `sop_id = currentSopId` to `sop_id IN (all sop_ids in this SOP's version lineage)`, remap each fetched row's `sop_id` back onto the canonical "current" `sopId` before constructing `MatrixCompletion`/etc. arrays (so `classify.ts`/`matrix.ts` stay byte-unchanged per the locked "no classifier refactor" decision), and add one new field to the constructed rows: the completion's OWN `sop_version`/`sop_id`, already present, diffed against the SOP's current `version` to produce `isOutdatedVersion`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Version-currency comparison (CMP-03) | API/Backend (`src/actions/competency.ts`) | — | Pure comparison of already-fetched data; no new DB round-trip beyond lineage widening |
| Lineage resolution (which sop_ids share a root) | API/Backend | Database (existing `parent_sop_id`/`superseded_by` columns) | Reuses `getVersionHistory`'s exact `.or(parent_sop_id.eq.X,id.eq.X)` query shape |
| Refresher interval storage | Database (`sops` column) | — | Smallest migration; survives supersede only if explicitly copied forward (see Pitfall 2) |
| Refresher due-date math (REF-02) | API/Backend (pure fn, reused from `src/lib/governance/cadences.ts`) | — | `computeReviewDueDate` is already generic (baseIso + months → ISO); zero new date-math code |
| TRN-03 admin breakdown panel | API/Backend + Browser (admin route) | — | New read action + client panel on existing `/admin/sops/[sopId]/versions` page |
| Worker-facing chips (outdated / due) | Browser (Client Components) | — | Presentational only; CMP-04 guard forbids any control/gating logic here |
| Matrix chips + rollups | Browser (Client Component `TrainingMatrixView.tsx`) | API/Backend (data already flows through `getTrainingMatrix`) | Extends existing table cell + header rollup rendering |
| Axis-swap toggle (folded todo) | Browser (Client Component) | — | Pure client-side transpose of already-fetched `TrainingMatrix`; no server change |

## Package Legitimacy Audit

**No external packages are introduced by this phase.** Every capability (due-date math, lineage query, CSV column, chip rendering) is built from code and libraries already present in the repo (`zod`, `@supabase/supabase-js`, native `Date`/UTC math). Skip the slopcheck/registry-verification gate — nothing to verify.

## Architecture Patterns

### System Flow — Version-Currency + Refresher (read path)

```
Worker completes SOP v1 (sop_completions.sop_id = A, sop_version = 1)
        |
        v
Admin supersedes: uploadNewVersion / cloneSopAsDraft creates SOP row B
        (B.parent_sop_id = A, B.version = 2) -> publish -> A.superseded_by = B
        |
        v
getTrainingMatrix / getTrainingRecordForPerson / getMyCompetencyStates
  1. Resolve required sopIds as TODAY (sop_departments / sop_access_people,
     already keyed to the CURRENT sop_id B — Phase 32/33's ensureSopCollectionsForOrg
     re-materializes this on every publish, confirmed in publish-core.ts Step 3c)
  2. NEW: for each required sopId B, resolve its lineage {A, B, ...} via the
     SAME query shape as getVersionHistory (.or(parent_sop_id.eq.root,id.eq.root))
  3. NEW: fetch sop_completions/sop_observations WHERE sop_id IN {A, B, ...}
     (not just B) -- this is the orphaning fix
  4. Remap every fetched row's sop_id -> canonical B before building
     MatrixCompletion[] / MatrixObservation[] (classify.ts/matrix.ts untouched)
  5. classifyCompetency() runs exactly as in Phase 35 -- sees the worker's v1
     completion as valid evidence, never demotes state
  6. NEW comparison: latestCompletion.sopId === B (current)?
        no  -> isOutdatedVersion = true -> render chip beside StatePill
  7. NEW refresher: due = computeReviewDueDate(latestCompletion.submittedAt,
     sop.refresher_interval_months) if refresher_interval_months is set
        now > due -> render due/overdue chip (never gates anything, CMP-04)
```

### Recommended file layout (new files only)

```
src/lib/competency/
  version-currency.ts     # NEW pure fn: isOutdatedVersion(latestVersion, currentVersion)
  refresher.ts            # NEW thin wrapper: refresherDueDate(lastCompletionIso, intervalMonths)
                           #   -- literally re-exports/calls computeReviewDueDate from
                           #      src/lib/governance/cadences.ts; do NOT reimplement the math
  __tests__/
    version-currency.test.ts   # lands in existing phase35-unit Playwright project (testDir
    refresher.test.ts          #   already points at src/lib/competency/__tests__ -- zero config edit)

src/actions/
  competency.ts            # EXTEND: lineage-widen fetches; add isOutdatedVersion +
                            #   refresherDueAt to MatrixCell/MyCompetencyState/
                            #   RequiredSopRecord; add getVersionCompletionBreakdown()
  governance.ts             # EXTEND (or competency.ts): setRefresherInterval(sopId, months|null)
                            #   -- mirrors setSopOwner's plain-session-client update pattern

src/components/
  admin/competency/StatePill.tsx          # EXTEND: optional outdated-version badge prop
  admin/competency/TrainingMatrixView.tsx  # EXTEND: outdated tally in rollups, axis-swap toggle
  profile/CompetencySection.tsx            # EXTEND: due/overdue + outdated chips
  sop/SopLibraryCard.tsx                   # EXTEND: due/overdue chip (D-08)
  admin/sops/[sopId]/versions/             # EXTEND page.tsx: TRN-03 breakdown panel
```

### Pattern: Lineage resolution (reuse, do not reinvent)

`getVersionHistory` in `src/actions/versioning.ts` already contains the exact query shape needed:

```typescript
// Source: src/actions/versioning.ts:235-244 (existing code, Phase 23)
const parentId: string = (sop.parent_sop_id as string | null) ?? sop.id
const { data: versions } = await supabase
  .from('sops')
  .select('id, version, status, ... superseded_by, parent_sop_id')
  .or(`parent_sop_id.eq.${parentId},id.eq.${parentId}`)
  .order('version', { ascending: false })
```

Reuse this exact `.or(parent_sop_id.eq.X,id.eq.X)` shape (via the admin client, since Phase 35's competency reads already use `createAdminClient()` throughout) to build a `Map<currentSopId, string[] /* all sop_ids in lineage */>` once per matrix/record fetch, batched across all required SOPs in a single query (`.in('parent_sop_id', rootIds)` OR-ed with `.in('id', rootIds)`), not one query per SOP.

### Pattern: Refresher due-date (reuse verbatim)

```typescript
// Source: src/lib/governance/cadences.ts (existing, Phase 28) — reuse the MATH,
// not the review-cadence VALUE (CONTEXT D-01: separate per-SOP setting).
import { computeReviewDueDate } from '@/lib/governance/cadences'

export function refresherDueDate(lastCompletionIso: string, intervalMonths: number): string {
  return computeReviewDueDate(lastCompletionIso, intervalMonths)
}
```

`resolveCadenceMonths` (org/category fallback ladder) is NOT reused — D-02 is explicit: unset = no refresher, no org default, no category default. A refresher-interval resolver is a one-line null check (`sop.refresher_interval_months == null ? null : ...`), not a ladder.

### Pattern: Admin write for the new per-SOP column (reuse `setSopOwner`'s shape)

```typescript
// Source: src/actions/governance.ts:104-147 (existing pattern, Phase 28) — mirror
// this exactly for setRefresherInterval. sops already has admins_can_update_sops
// RLS (org + admin/safety_manager) covering ANY additive column — no new policy
// needed (same precedent as migration 00043's owner_user_id/review_due_at columns).
export async function setRefresherInterval(
  sopId: string,
  months: number | null,
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (months !== null && (!Number.isInteger(months) || months < 1 || months > 120)) {
    return { error: 'months must be an integer between 1 and 120' }
  }
  const supabase = await createClient() // plain session client — NOT admin client (Pitfall 1 precedent)
  const { data: updated, error } = await supabase
    .from('sops')
    .update({ refresher_interval_months: months, updated_at: new Date().toISOString() })
    .eq('id', sopId)
    .select('id')
  if (error) return { error: error.message }
  if (!updated || updated.length === 0) return { error: 'SOP not found' } // LR-01: 0 rows = RLS filtered, not silent success
  return { success: true }
}
```

### Anti-Patterns to Avoid

- **Re-deriving required SOPs from `access_grants` directly** — MTX-02 (locked in Phase 35) forbids this; always consume the already-materialized `sop_departments`/`sop_access_people` output, exactly as `getTrainingMatrix` does today.
- **Widening the lineage query per-SOP in a loop** — batch it (`.in('parent_sop_id', rootIds)`), matching the existing batched-fetch discipline in `getTrainingMatrix` (Promise.all pairs throughout).
- **Comparing by `sop_id` instead of `version` (int)** for the outdated flag — `version` is a plain monotonic integer per lineage and is simpler/less error-prone than comparing UUIDs across a remapped set; use `latestCompletionVersion !== currentSop.version`.
- **Reimplementing due-date math** — `computeReviewDueDate`'s UTC end-of-month clamping (Jan 31 + 1mo → Feb 28, not Mar 2/3) is a subtle correctness detail already solved in Phase 28; do not write a second date-math function.
- **Gating anything on `isOutdatedVersion` or refresher due/overdue** — both are informational chips only (CMP-04 / D28-07 precedent); extend `tests/phase35/no-competency-gate.spec.ts`'s `GATE_PATTERN` regex (or add a sibling regex) to also forbid `isOutdatedVersion` / `refresherDue` / `isOverdue` conditionals in worker-facing files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Due-date math (refresher) | New date-add function | `computeReviewDueDate` from `src/lib/governance/cadences.ts` | Already handles UTC + end-of-month clamping correctly; a second implementation risks a subtly different (wrong) edge case |
| CSV generation | New CSV writer for the 2 new columns | Extend `TrainingCsvRow` + `HEADER` + the row-mapping in `generateTrainingCsv` (`src/lib/competency/csv.ts`) | One generator behind both export entry points (35 D-16); `csvField()` already neutralizes formula-injection triggers — new columns get this for free if they go through `csvField()` |
| Lineage traversal | A new recursive/graph SOP-version walker | The flat `parent_sop_id`/`id` OR-query already used by `getVersionHistory` | Lineage is always exactly one level deep (root + siblings), never a tree — no graph traversal needed |
| Pill/chip visual system | New badge component | `StatePill`'s existing accent-var + `pill` CSS class pattern, and the already-declared `--accent-decision` (amber, coaching-not-discipline) token | Every existing coaching-flavoured signal (needs-support) uses `--accent-decision`; outdated/due chips are siblings of that pattern per CONTEXT `## Specifics` |
| Compaction / axis-swap layout math | New responsive breakpoint logic | `TrainingMatrixView`'s existing `ResizeObserver` + `COLUMN_WIDTH_PX` compaction calc (D-07) | Axis-swap only transposes which array indexes rows vs columns; the compaction math is symmetric already (rows.length * COLUMN_WIDTH_PX vs cols.length * ROW_HEIGHT — same formula) |

**Key insight:** every piece of "new" logic in this phase is a recombination of Phase 28/35 primitives (due-date math, pill vocabulary, CSV generator, batched-fetch discipline, admin-write pattern). The only genuinely new mechanism is the lineage-widening query — everything else is composition.

## Common Pitfalls

### Pitfall 1: Evidence orphaning across a version supersede (THE central risk of this phase)
**What goes wrong:** After `uploadNewVersion`/`cloneSopAsDraft` creates a new `sop_id` for the next version, `sop_completions`/`sop_observations` rows recorded against the OLD `sop_id` fall outside any query scoped to `.eq('sop_id', currentSopId)` or `.in('sop_id', currentRequiredSopIds)`. A worker who completed v1 shows as `not_started` for v2 — literally the orphaning CMP-03 exists to prevent.
**Why it happens:** Phase 35's `getTrainingMatrix`/`getTrainingRecordForPerson`/`getMyCompetencyStates` were built and correctly scoped BEFORE this phase's lineage requirement existed (D-05 explicitly deferred version-currency to Phase 36). Completions/observations are physically keyed to a specific SOP row, not a lineage root.
**How to avoid:** Widen every completions/observations/sign-offs fetch to `.in('sop_id', lineageSopIds)` per required SOP (batched), remap to the canonical current `sopId` before constructing evidence arrays, per the Architecture Patterns section above.
**Warning signs:** A test worker who completed the PRE-supersede version of a required SOP shows `not_started` in the matrix/profile immediately after a version bump — this is the single most important scenario to write a runtime/unit test for.

### Pitfall 2: `refresher_interval_months` silently lost on supersede
**What goes wrong:** `uploadNewVersion` and `cloneSopAsDraft` both build their `sops` INSERT payload as an EXPLICIT field list (not a spread of the old row) — see `src/actions/versioning.ts` lines 63-74 and 316-329. A new column added to `sops` is NOT automatically carried into the next version's row; an admin who set a refresher interval on v1 would find v2 silently has none.
**Why it happens:** Both insert sites enumerate fields by name for clarity/safety (avoids accidentally copying `status`/`superseded_by`/etc.). This is deliberate elsewhere but becomes a trap for any NEW column that SHOULD carry forward.
**How to avoid:** Add `refresher_interval_months: oldSop.refresher_interval_months` explicitly to BOTH insert payloads (and the corresponding `select()` field lists that fetch `oldSop`/`sourceSop` beforehand). This must be a single locked task in the plan — it is easy to add the column and forget both copy-forward sites (there are two, not one).
**Warning signs:** Set an interval on a SOP, click "Edit into new version," check the new draft's interval — if it's `null`, this bug is present.

### Pitfall 3: Access-grant re-materialization masks or unmasks Pitfall 1 depending on when you test
**What goes wrong:** `performPublish` (Step 3c, `src/lib/governance/publish-core.ts`) calls `ensureSopCollectionsForOrg` for every newly published SOP, which re-establishes `sop_collections` membership and (transitively, via `materializeSopAccess`) `sop_departments`/`sop_access_people` for the NEW `sop_id`. This means the "required SOPs" set DOES correctly follow the current version after supersede — but this happens asynchronously/best-effort inside publish (logged, non-fatal on failure) and is a SEPARATE mechanism from the evidence-query scoping in Pitfall 1. Do not conflate "the SOP is still required" (this mechanism, already correct) with "the worker's old evidence is still visible" (Pitfall 1, needs the fix above).
**Why it happens:** Two independent subsystems (Phase 32/33 access-grant materialization vs Phase 35 evidence queries) both key off `sop_id`, and only one of them (access materialization) already handles the version transition.
**How to avoid:** Verify empirically (UAT) that a freshly-published new version DOES appear in `sop_departments`/`sop_access_people` for the org (confirms Pitfall 3 is a non-issue) before spending time debugging what looks like a requirement-derivation bug when it is actually the Pitfall 1 evidence-scoping bug.
**Warning signs:** If a superseded lineage's new version disappears from the matrix ENTIRELY (zero rows, not just wrong state), suspect `ensureSopCollectionsForOrg` failure (check server logs — it logs loudly on failure) rather than the evidence-widening logic.

### Pitfall 4: CSV formula-injection on the new columns
**What goes wrong:** Any new CSV column derived from user-authored or admin-set text (there are none planned here — `on_current_version` is boolean/string-literal, due-dates are ISO strings) is safe by construction, but a future column reusing `sop.title`/worker names must still route through `csvField()`.
**How to avoid:** New columns in `generateTrainingCsv` MUST use the existing `csvField()` helper (already neutralizes `=+-@` triggers per the 2026-07-24 CLAUDE.md learning) — never string-concatenate a raw value into a CSV row.
**Warning signs:** A new column bypasses `csvField()` in the row-mapping array.

### Pitfall 5: New CSS custom properties referenced without declaration
**What goes wrong:** The 2026-07-14 CLAUDE.md learning documents six prior instances of `var(--x)` referenced but never declared in any stylesheet, silently rendering invisible/wrong.
**How to avoid:** This phase does NOT need new tokens — `--accent-decision` (amber, already used for needs-support/awaiting-sign-off) is the correct token for BOTH the outdated-version chip and the due/overdue chip (both are "coaching, not discipline" per CONTEXT `## Specifics`). If a visually distinct color is desired for outdated-vs-due, reuse `--accent-voice` (orange, already declared in `blueprint-theme.css` line 47) rather than inventing a new token — grep `blueprint-theme.css` before introducing anything new.
**Warning signs:** Any `var(--accent-outdated)` or `var(--accent-refresher)` that doesn't appear in a `grep -rn -- "--accent-" src/styles/blueprint-theme.css` result.

### Pitfall 6: Wave-0 Playwright project registration forgotten
**What goes wrong:** New spec files under `tests/phase36/` never run if no project's `testMatch` regex covers them (2026-05-25 CLAUDE.md learning; recurred as recently as Phase 34's org-wide RLS hole because a probe wasn't run, not because a spec was unregistered — but the failure MODE is the same class: "green" that isn't).
**How to avoid:** Register a `phase36` project in `playwright.config.ts` with `testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/` (identical broad-registration shape as phase34/35) in Wave 0. New PURE-function unit tests can skip this entirely if placed in `src/lib/competency/__tests__/` — the existing `phase35-unit` project already targets that exact directory and will pick up new `.test.ts` files with zero config edit.
**Warning signs:** `npx playwright test --list --project=phase36` returns fewer tests than files created.

## Code Examples

### Extending `MyCompetencyState` / `MatrixCell` with version-currency + refresher fields

```typescript
// src/lib/competency/matrix.ts — additive fields only, classify.ts ladder untouched
export interface MatrixCell {
  // ...existing fields unchanged...
  latestCompletionAt: string | null
  latestCompletionVersion: number | null
  // NEW (Phase 36):
  isOutdatedVersion: boolean   // latestCompletionVersion !== currentSop.version (false when no completion yet)
  refresherDueAt: string | null // null when sop.refresher_interval_months is unset (D-02)
  isRefresherOverdue: boolean
}
```

### `on_current_version` CSV column (D-05)

```typescript
// src/lib/competency/csv.ts — extend HEADER + TrainingCsvRow + row mapping
const HEADER = [
  'worker_email', 'worker_name', 'sop_identifier', 'sop_title', 'sop_version',
  'completion_date', 'signoff_status', 'signoff_by', 'signoff_date',
  'on_current_version',      // NEW — 'yes' | 'no', always through csvField()
  'refresher_due_date',      // NEW — ISO or '' when unset
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Evidence queries scoped to current `sop_id` only (Phase 35) | Evidence queries scoped to full version lineage, remapped to canonical current `sopId` | This phase (Phase 36) | Closes the orphaning gap CMP-03 requires; retroactively fixes a latent bug in Phase 35's post-supersede behaviour (Phase 35 shipped before any SOP in its test data had been superseded, so the gap was never exercised) |

**Deprecated/outdated:** None — this phase is purely additive.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Refresher-interval edit surface should live on the `/admin/sops/[sopId]/versions` page (reusing the existing action-button row) rather than builder settings or the library row | Architecture Patterns / Claude's Discretion (CONTEXT) | Low — CONTEXT explicitly leaves this to Claude's discretion; wrong surface choice is a cheap UI relocation, not a data-model change |
| A2 | The TRN-03 breakdown panel should reuse `RECORDER_ROLES`-style gating consistent with `competency.ts`, OR should it match the STRICTER `['admin','safety_manager']` gate the versions page currently uses (excludes supervisor)? This research assumes the versions page's EXISTING gate (admin/safety_manager only) should NOT be loosened without an explicit product decision, since loosening an access boundary is a bigger decision than adding a panel | Common Pitfalls / Open Questions | Medium — if the planner assumes RECORDER_ROLES (adds supervisor access to the versions page) without confirming, this silently expands who can see version/approval history, a decision CONTEXT does not make |
| A3 | Refresher due-date should use the LINEAGE-WIDE latest completion (any version), not just completions against the current version — inferred from D-06's "resolves via lineage" applied consistently to D-03's "any completed walkthrough resets the clock" | Architecture Patterns (Pattern: Refresher due-date) | Medium — if wrong, a worker who completed v1 recently but hasn't yet re-walked the newly-published v2 would incorrectly show as refresher-overdue immediately after supersede, which contradicts the "never orphan" spirit even though REF-01/02 don't explicitly mention supersede interaction |

**If this table is empty:** N/A — see above; all three assumptions are LOW-MEDIUM risk UI/scope calls, not safety-critical or compliance claims.

## Open Questions

1. **Does the TRN-03 panel need supervisor visibility, or admin/safety_manager only?**
   - What we know: the versions page today gates to `['admin','safety_manager']` (see `uploadNewVersion`/`cloneSopAsDraft`/`getSopVersionForDiff` role checks in `versioning.ts`); the training matrix (Phase 35) gates to `RECORDER_ROLES` (adds supervisor).
   - What's unclear: whether the completion-breakdown-per-version panel should follow the versions-page precedent (stricter) or the competency-surface precedent (looser).
   - Recommendation: default to the versions-page's existing gate (admin/safety_manager) since the panel lives ON that page and CONTEXT does not ask to expand the page's access boundary; flag for a one-line confirmation in planning if supervisor visibility is desired.

2. **Should refresher due-date use lineage-wide latest completion, or only completions against the currently-published version?**
   - What we know: D-03 says "any completed walkthrough resets the clock"; D-06 says version-currency "resolves via lineage."
   - What's unclear: CONTEXT does not explicitly state whether REF-01/02's due-date math should also span the lineage (see Assumption A3).
   - Recommendation: use lineage-wide latest completion for consistency with the "never orphan" philosophy — a version supersede should not manufacture a false "overdue" the instant it publishes.

3. **Does an old (superseded) SOP's `sop_departments`/`sop_access_people` rows get cleaned up, or do they linger?**
   - What we know: `ensureSopCollectionsForOrg` runs on the NEW sop_id at publish time (confirmed in `publish-core.ts`); no code path was found that explicitly DELETES the OLD sop_id's materialized junction rows.
   - What's unclear: whether stale junction rows for a superseded SOP could cause it to still appear as "required" alongside its successor (a possible double-counting bug, orthogonal to this phase's scope but worth a quick UAT check).
   - Recommendation: not a blocker for Phase 36 — verify empirically during UAT (supersede a test SOP, check whether both the old and new sop_id appear as separate matrix columns); if so, file as a backlog item rather than expanding this phase's scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (project-per-phase pattern established since Phase 2) |
| Config file | `playwright.config.ts` (repo root) |
| Quick run command | `npx playwright test --project=phase36-unit` (pure fn tests) and `npx playwright test --project=phase36` (source-contract/RLS) |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-03 | Superseded SOP surfaces "outdated version" chip; worker's evidence not orphaned across supersede | unit (`isOutdatedVersion` pure fn) + source-contract (chip rendered, no gate) | `npx playwright test tests/phase36/version-currency-lineage.spec.ts` | ❌ Wave 0 |
| TRN-03 | Admin sees per-version completion counts + worker list on versions page | source-contract (panel present, gated correctly) | `npx playwright test tests/phase36/version-breakdown-panel.spec.ts` | ❌ Wave 0 |
| REF-01 | Due/overdue chips surface to workers (profile + library) and supervisors (matrix + rollups), never gate | source-contract (chip present) + CMP-04-guard extension | `npx playwright test tests/phase36/no-refresher-gate.spec.ts` | ❌ Wave 0 |
| REF-02 | Due-date = last completion + per-SOP interval, unset = no due-date | unit (`refresherDueDate` pure fn, reuses `computeReviewDueDate` test coverage) | `npx playwright test --project=phase36-unit` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase36-unit --project=phase36`
- **Per wave merge:** `npm run test` (full suite) + `npx tsc --noEmit` + `npm run build` (2026-06-27 learning: `next build` enforces constraints `tsc` alone does not)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/phase36/version-currency-lineage.spec.ts` — covers CMP-03 (the orphaning scenario from Pitfall 1 is the must-have case)
- [ ] `tests/phase36/version-breakdown-panel.spec.ts` — covers TRN-03
- [ ] `tests/phase36/no-refresher-gate.spec.ts` — extends the CMP-04/`GATE_PATTERN` regex idiom from `tests/phase35/no-competency-gate.spec.ts` to the new chips/files
- [ ] `src/lib/competency/__tests__/version-currency.test.ts` + `refresher.test.ts` — pure-function unit tests (land in existing `phase35-unit` project, zero config edit)
- [ ] `playwright.config.ts` — register `phase36` project (broad `tests/phase36/**` testMatch, mirrors phase34/35 registration exactly)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | No new auth surface — all reads/writes ride existing `getSessionContext()`/`requireAdmin()` |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | `setRefresherInterval` gates to admin/safety_manager (mirrors `setSopOwner`); TRN-03 panel read gates to the existing versions-page role check (see Open Question 1); matrix/profile chip reads ride the ALREADY-AUDITED Phase 35 org-scope self-enforcement (admin-client + explicit `organisation_id` checks) — no new admin-client read site should skip this pattern |
| V5 Input Validation | yes | `setRefresherInterval`'s `months` param validated as integer 1-120 (mirrors `setReviewCadence`'s existing Zod-adjacent inline check) — reject non-integer/out-of-range before any DB write |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-org read via admin-client bypass of RLS (recurring class, 2026-06-15/26/07-20) | Information Disclosure | Every NEW admin-client read this phase (lineage-widening query, `getVersionCompletionBreakdown`) MUST re-verify the SOP/lineage belongs to `ctx.organisationId` before returning data — copy the existing `callerOrgId()` + explicit `.eq('organisation_id', orgId)` pattern already used throughout `competency.ts`, never trust a client-supplied `sopId` alone |
| Client-supplied `months`/`sopId` on `setRefresherInterval` | Tampering | Validate `months` range server-side (not just client `<input>` constraints); rely on `admins_can_update_sops` RLS as the final backstop (org + role), exactly as `setSopOwner` does |
| CSV formula injection via new columns | Tampering (client-side, on open in Excel) | Route every new CSV field through the existing `csvField()` helper — see Pitfall 4 |

## Sources

### Primary (HIGH confidence — direct code read, this repo)
- `src/lib/competency/classify.ts`, `matrix.ts`, `csv.ts` — Phase 35 pure modules (read in full)
- `src/actions/competency.ts` — Phase 35 server actions (read in full)
- `src/lib/governance/cadences.ts` — `resolveCadenceMonths`/`computeReviewDueDate` (read in full)
- `src/lib/builder/version-lineage.ts`, `src/actions/versioning.ts` — lineage/supersede mechanics (read in full)
- `src/actions/governance.ts` — `setSopOwner`/`confirmSopCurrent`/`setReviewCadence` write patterns (read relevant sections)
- `src/lib/governance/publish-core.ts` — confirmed `ensureSopCollectionsForOrg` runs on every publish (Step 3c)
- `src/lib/org-model/resolve-sop-access.ts`, `src/actions/grants.ts` — confirmed `access_grants.sop_id` targets a specific row, not a lineage
- `supabase/migrations/00043_ownership_review_governance.sql`, `00050_access_grants_sop_target.sql` — schema precedent for additive columns + RLS reuse
- `src/types/database.types.ts` (sops table) — confirmed existing columns (`version`, `parent_sop_id`, `superseded_by`, `category`)
- `src/components/admin/competency/StatePill.tsx`, `TrainingMatrixView.tsx`, `src/components/profile/CompetencySection.tsx`, `src/components/sop/SopLibraryCard.tsx` — chip-host components (read in full)
- `src/styles/blueprint-theme.css` — confirmed existing token declarations (no new tokens needed)
- `tests/phase35/no-competency-gate.spec.ts`, `competency-rls-probe.spec.ts` — guard patterns to extend
- `playwright.config.ts` — phase34/35 project registration pattern to mirror for phase36
- `.planning/phases/36-refresher-cadence-version-currency/36-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — locked decisions + requirement wording

### Secondary / Tertiary
- None — this phase required no external library research (Context7/WebSearch), since it is entirely composition of existing in-repo primitives.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new packages) — HIGH confidence, verified by direct code inspection
- Architecture (lineage-widening design): HIGH — verified against actual query code in `competency.ts`/`versioning.ts`/`grants.ts`, not inferred
- Pitfalls: HIGH — Pitfall 1/2/3 each traced to specific line ranges in existing files, not speculative

**Research date:** 2026-07-26
**Valid until:** 30 days (stable internal codebase, no external API/library dependency to go stale)
