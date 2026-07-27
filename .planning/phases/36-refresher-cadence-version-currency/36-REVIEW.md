---
phase: 36-refresher-cadence-version-currency
reviewed: 2026-07-28T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - playwright.config.ts
  - scripts/apply-phase36-migration.mjs
  - src/actions/competency.ts
  - src/actions/governance.ts
  - src/actions/versioning.ts
  - src/app/(protected)/admin/sops/[sopId]/versions/page.tsx
  - src/app/(protected)/sops/page.tsx
  - src/components/admin/competency/StatePill.tsx
  - src/components/admin/competency/TrainingMatrixView.tsx
  - src/components/sop/SopLibraryCard.tsx
  - src/lib/competency/__tests__/csv.test.ts
  - src/lib/competency/__tests__/matrix.test.ts
  - src/lib/competency/__tests__/refresher.test.ts
  - src/lib/competency/__tests__/version-currency.test.ts
  - src/lib/competency/csv.ts
  - src/lib/competency/matrix.ts
  - src/lib/competency/refresher.ts
  - src/lib/competency/version-currency.ts
  - src/lib/journeys/journeys.ts
  - src/lib/uat/tests.ts
  - src/types/database.types.ts
  - supabase/migrations/00055_sops_refresher_interval.sql
  - tests/phase35/competency-actions.spec.ts
  - tests/phase35/competency-rls-probe.spec.ts
  - tests/phase35/training-matrix-view.spec.ts
  - tests/phase36/lineage-widening.spec.ts
  - tests/phase36/matrix-chips-and-axis-swap.spec.ts
  - tests/phase36/no-refresher-gate.spec.ts
  - tests/phase36/refresher-interval-write.spec.ts
  - tests/phase36/version-breakdown-panel.spec.ts
  - tests/phase36/version-currency-lineage.spec.ts
  - tests/phase36/worker-library-chip.spec.ts
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
fix_status: critical_and_warnings_fixed
fixed_at: 2026-07-28
fixed: 8
skipped: 4
---

# Phase 36: Code Review Report

**Reviewed:** 2026-07-28
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 36's core promise — lineage-widened evidence, informational-only refresher/version chips, interval copy-forward across both supersede paths — is largely delivered and well-guarded. Verified clean against the phase context's high-value checks: `org_members_can_view_sops` (migration 00003) does grant org-wide `sops` SELECT including superseded rows, so `getMyCompetencyStates`'s session-client lineage read is real, not a 34-10 dead feature; `setRefresherInterval` correctly rides `admins_can_update_sops` RLS with range validation, a null-clear path, and zero-row-means-not-found handling; both `uploadNewVersion` and `cloneSopAsDraft` copy `refresher_interval_months` forward; the new CSV columns route through the formula-neutralizing `csvField()`; month arithmetic delegates to the existing end-of-month-clamped `computeReviewDueDate`; no gating branch exists on any worker surface; `journeys.ts` and `uat/tests.ts` were updated in-phase; migration 00055 is idempotent and constraint-checked.

However, the **CSV export path computes version currency against the wrong baseline** (Critical — the export's `on_current_version` column can say "yes" for a worker trained on a superseded version, which is precisely the misinformation this phase exists to eliminate, in the artifact handed to auditors). Several Warning-level gaps cluster around the same theme: surfaces that did NOT get lineage/currency treatment (worker library chip, SOP-filtered export) silently diverge from surfaces that did (matrix, training record), and the versions-page refresher control can write to a draft instead of the live version.

## Critical Issues

### CR-01: `exportTrainingCsv` derives "current version" from the completed rows themselves — `on_current_version` reports `yes` for workers trained on a superseded version

**File:** `src/actions/competency.ts:894-918` (root cause in `resolveLineage`, lines 104-105 and 112)
**Issue:** `resolveLineage` seeds `currentVersionBySopId` and `refresherIntervalBySopId` **only from its input rows** (`new Map(requiredSops.map(s => [s.id, s.version]))`); its lineage query selects only `id, parent_sop_id` (line 112), so it never learns the actual current version. In the matrix/record flows this is safe because the input rows come from re-materialized junctions pointing at the current version. But in `exportTrainingCsv` the input rows are **the SOPs of the completions in the export cut** (line 894: `resolveLineage(sopRowsTyped, ...)` where `sopRowsTyped` is derived from `completions.map(c => c.sop_id)`). Consequence: a worker completed v1; the SOP is now at v3; **no completion on v3 exists in this cut** (the norm for the PersonPanel single-worker export, and easily forced by the `workerId`/`dateFrom`/`dateTo` filters). Then `requiredByRoot` picks v1 as the "highest version", `currentVersionForThisLineage` = 1, and line 917 emits `onCurrentVersion: !isOutdatedVersion(1, 1)` → **`yes`** — a false training-currency claim in an auditor-facing document. The sibling field `refresher_due_date` (line 918) has the same defect: it takes `refresher_interval_months` from the stale completed row, so an interval the admin changed (or set) on the current version after supersede is ignored, diverging from the matrix's overdue chips. The live probe (`version-currency-lineage.spec.ts`) never catches this because it only exercises the junction-driven matrix path, not the export path.
**Fix:** Make `resolveLineage` derive currency from the lineage members it already fetches, instead of trusting input rows:
```ts
// resolveLineage lineage query — widen the select:
let query = client.from('sops')
  .select('id, parent_sop_id, version, status, refresher_interval_months')
  .or(`parent_sop_id.in.(${roots.join(',')}),id.in.(${roots.join(',')})`)
// ...then per root, current = the highest-version PUBLISHED member
// (must exclude drafts: a cloned-but-unpublished v+1 draft would otherwise
// mark every worker outdated against an unshipped version):
const currentByRoot = new Map<string, { version: number | null; interval: number | null }>()
for (const m of members) {
  if (m.status !== 'published') continue
  const root = m.parent_sop_id ?? m.id
  const prev = currentByRoot.get(root)
  if (!prev || (m.version ?? 0) > (prev.version ?? 0)) {
    currentByRoot.set(root, { version: m.version, interval: m.refresher_interval_months })
  }
}
// and key currentVersionBySopId/refresherIntervalBySopId off currentByRoot
// (falling back to the input row's own values when a root has no published member).
```
This also hardens the matrix/record paths against the stale-junction case ("a lingering superseded-version junction — RESEARCH Open Question 3") the code already acknowledges. Repoint `tests/phase36/version-currency-lineage.spec.ts` assertions if literals move, and add a regression: export a single worker whose only completion is on v1 of a v2-current SOP and assert the row says `no`.

## Warnings

### WR-01: Versions-page refresher control reads/writes the DRAFT when an unpublished new version exists

**File:** `src/app/(protected)/admin/sops/[sopId]/versions/page.tsx:185, 189-234, 379-414`
**Issue:** `currentSop` is `versions.find(v => v.superseded_by === null) ?? versions[0]`, over a list ordered `version DESC`. A cloned-but-unpublished draft (created by the "Edit into new version" button on this same page) has `superseded_by === null` and the highest version, so it wins — while the row-level "Current" badge on line 519 correctly requires `status === 'published'`. Result: with a draft in flight, `handleSaveRefresher`/`handleClearRefresher` target the **draft's** id. Workers' chips read the interval from the published SOP (`sops/page.tsx` reads by the assigned sop id), so the admin's change silently does nothing until the draft publishes — and is silently lost if the draft is abandoned/deleted. The input is also seeded from the draft's value, so the control can display an interval that is not what workers are living under.
**Fix:** Resolve the refresher target with the same predicate the badge uses:
```ts
const currentSop = versions.find(v => v.superseded_by === null && v.status === 'published') ?? versions[0]
```
(If the compare-link semantics intentionally want the newest row, split into two variables — `latestVersion` for compare, `publishedCurrent` for the refresher control and title.)

### WR-02: Worker-library completion query is not filtered to the current user — supervisor/admin/safety_manager sessions compute refresher and "Updated" badges from OTHER workers' completions

**File:** `src/app/(protected)/sops/page.tsx:246-265` (consumed by `refresherState` at 300-306 and `hasNewerVersion` at 313-319)
**Issue:** The `worker-last-completions` query selects `sop_id, submitted_at` from `sop_completions` with **no `worker_id` filter**, relying on RLS ("RLS scopes this to the current user"). That claim is only true for plain workers. Migration 00010 gives admins and safety managers **org-wide** completion SELECT, and supervisors read all their assigned workers' completions — so for those roles `lastCompletionMap` holds the newest completion per SOP *across other people*, and the new refresher chips (plus the pre-existing "Updated" badge) render from someone else's training clock. An admin who never walked a SOP can see "Refresher overdue" because a worker completed it 7 months ago. The badge is informational, so this is a data-correctness bug, not a disclosure — those roles may legitimately read the rows — but it makes the Phase 36 chip wrong for three of four personas.
**Fix:** Filter explicitly:
```ts
const { data: { user } } = await supabase.auth.getUser()
const { data } = await supabase
  .from('sop_completions')
  .select('sop_id, submitted_at')
  .eq('worker_id', user?.id ?? '')
  .order('submitted_at', { ascending: false })
```
Per CLAUDE.md rule 5 (fix the scope): this corrects the pre-existing `hasNewerVersion` inaccuracy too.

### WR-03: Worker refresher chip is not lineage-aware — the due clock silently resets to "no chip" the moment a SOP is superseded

**File:** `src/app/(protected)/sops/page.tsx:246-306`
**Issue:** `lastCompletionMap` and `refresherIntervalMap` are keyed by exact `sop_id`. After a supersede, `notifyAssignedWorkers` repoints `sop_assignments` to the new sop id, so the card renders under the v2 id while the worker's completion sits on the v1 id → `refresherDueDate(null, interval)` → `null` → no chip. This is the exact evidence-orphaning gap CMP-03 closes on the server side; the worker surface reintroduces it. Concrete divergence: the supervisor matrix shows "refresher overdue" (lineage-widened `getTrainingMatrix`) while the same worker's own library shows nothing — the worker is the persona the nudge exists for. The plan accepted a no-server-action tradeoff (T-36-08-01/03), but the tradeoff as shipped isn't "cheaper data", it's "wrong data after every supersede".
**Fix:** Cheapest lineage-consistent option without a server action: also select `parent_sop_id` in the two queries and key both maps by `parent_sop_id ?? id` (the lineage root), then look up via the card SOP's root. `useAssignedSops`/`CachedSop` already carry the sop row; if `parent_sop_id` isn't cached, add it to the select. Alternatively, reuse `getMyCompetencyStates()` (already lineage-correct, already self-scoped) and join its `refresherDueAt` onto the cards.

### WR-04: `isRefresherDue` and `isRefresherOverdue` are the same predicate — the "Refresher due" (non-overdue) label is dead UI

**File:** `src/app/(protected)/sops/page.tsx:300-306`; `src/components/sop/SopLibraryCard.tsx:93-101`
**Issue:** `isDue = due !== null && now >= due` and `isOverdue = now > due` differ only at the single millisecond where `now === due`. The badge renders only when `isDue` is true, and its text is `refresherOverdue ? 'Refresher overdue' : 'Refresher due'` — so "Refresher due" is unreachable in practice; workers will only ever see "Refresher overdue". The prop docs ("true when the due date has passed (vs. just due)") describe a distinction the math doesn't implement. Either the card intended a lead-in window (due = approaching, overdue = passed) or one of the two labels/props should not exist.
**Fix:** Pick one: (a) give "due" a lead window, e.g. `isDue = due !== null && now >= addDays(due, -14)` (or reuse month math for a fraction of the interval); or (b) drop `isRefresherDue`, pass only `isRefresherOverdue`, and render a single "Refresher overdue" badge. (b) is the smaller diff and matches actual behavior.

### WR-05: SOP-filtered CSV export drops pre-supersede completions the matrix still shows

**File:** `src/actions/competency.ts:856` (`if (sopId) query = query.eq('sop_id', sopId)`)
**Issue:** The matrix fetch is lineage-widened (`.in('sop_id', lineage.allSopIds)`), but the export's `sopId` filter matches the raw completion `sop_id` only. Filter the matrix to one SOP → cells show workers competent-on-outdated-version; hit "Export CSV" on that exact cut → those workers' rows are absent from the file. An auditor cross-checking the screen against the export sees phantom discrepancies, and a per-SOP training-history export understates who has trained on the procedure — the D-16 promise is that both entry points export the same evidence the UI shows.
**Fix:** Resolve the filter SOP's lineage first and widen the filter:
```ts
if (sopId) {
  const { data: filterSop } = await admin.from('sops')
    .select('id, version, parent_sop_id, refresher_interval_months')
    .eq('id', sopId).eq('organisation_id', orgId).maybeSingle()
  if (!filterSop) return { error: 'SOP not found in this organisation' }
  const filterLineage = await resolveLineage([filterSop], admin, orgId)
  query = query.in('sop_id', filterLineage.allSopIds)
}
```

### WR-06: The no-refresher-gate guard's own documentation is false, and the sibling guard in worker-library-chip.spec.ts is weaker than it claims

**File:** `tests/phase36/no-refresher-gate.spec.ts:18-31, 85-88`; `tests/phase36/worker-library-chip.spec.ts:56-66`
**Issue:** Two defects in the mechanical guard pair protecting the phase's locked north star. (1) The long comment in `no-refresher-gate.spec.ts` states the regex fires "never on bare `=` adjacency" and that the 36-08 spread/`??` workarounds in `SopLibraryCard.tsx`/`sops/page.tsx` "are no longer required by THIS guard." That is wrong: `GATE_PATTERN`'s character class is `[<>=!]`, which **includes `=`**, so a plain JSX prop `isRefresherDue={x}` or destructuring default `isRefresherDue = false` still matches. Anyone following the comment and reverting the workarounds turns the guard red on passive code — and the likely "fix" at that point is weakening the regex, which is failure mode (2): `worker-library-chip.spec.ts` already did exactly that, using `[<>!]` (no `=`), which means an equality-comparison gate (`isRefresherDue === true ? blocked : open`) in those two files passes its guard (`===` starts with `=`, which is not in `[<>!]`, and no `if` is required for a ternary gate). Neither pattern catches a bare ternary gate (`isRefresherOverdue ? lockedView : normalView`) at all.
**Fix:** (a) Correct the comment in `no-refresher-gate.spec.ts` to state that bare `=` DOES match and the call-site workarounds ARE still load-bearing. (b) Strengthen `worker-library-chip.spec.ts`'s class to catch equality/ternary: `(${GATE_FIELDS})\\s*(===|!==|==|!=|[<>]|\\?)` alongside the `if(...)` alternative, and add a ternary case (`isRefresherOverdue ? 'Refresher overdue' : 'Refresher due'` inside JSX text is a *render* choice — scope the ternary check to exclude the known passive label if needed, or assert via the existing chip-window slicing).

### WR-07: `resolveLineage` exported from a `'use server'` module is a publicly invokable server-action endpoint

**File:** `src/actions/competency.ts:97-103`
**Issue:** Every async export of a `'use server'` file is registered as a POST-invokable server action for any authenticated client — not just an import surface for tests. `resolveLineage(requiredSops, client, orgId)` takes its DB client as a parameter, so a remote invocation today gets a deserialized plain object and crashes at `client.from(...)` (no data leak) — but the exposure is gratuitous, the crash is an unhandled 500 on a free endpoint, and the pattern is one refactor away from exploitable (e.g., a future default `client = createAdminClient()` plus caller-supplied `orgId` is precisely the 2026-07-05 parameter-trusting service-role hole). The justifying comment addresses only the async-export *build* constraint, not the *exposure* constraint.
**Fix:** Move `resolveLineage` (and its interfaces) to `src/lib/competency/lineage.ts` (no directive — an async function in a plain module builds fine), import it back into `competency.ts`, and repoint the import in `tests/phase36/version-currency-lineage.spec.ts` plus the source-contract literals in `tests/phase36/lineage-widening.spec.ts` **in the same commit** (2026-07-13 stale-guard learning).

## Info

### IN-01: `getVersionCompletionBreakdown.isCurrent` is relative to the caller-supplied sopId, not the lineage's published current

**File:** `src/actions/competency.ts:808`
**Issue:** `isCurrent: version === sopRow.version` — invoked with a superseded version's id (the versions route accepts any lineage member), the old version reports `isCurrent: true` and the real current reports `false`. The page currently ignores this field (it derives currency from `superseded_by` itself), so no user-visible defect today, but the API lies for half its valid inputs.
**Fix:** Compute against the max published version in the lineage (falls out of the CR-01 fix for free), or drop the field until a consumer needs it.

### IN-02: CSV `refresher_due_date` emits a full ISO timestamp, not a date

**File:** `src/lib/competency/csv.ts:19-21`; producer `src/actions/competency.ts:918`
**Issue:** Header/doc say "an ISO date"; the value is `2026-07-01T00:00:00.000Z`. Excel-bound audit consumers get a timestamp column named `_date`, inconsistent with the day-granularity semantics of a refresher cadence.
**Fix:** `refresherDueDate(...)?.slice(0, 10)` at the CSV row-build site (leave the pure helper full-precision for the overdue comparison).

### IN-03: `latestOf` / `latestTimestamp` duplicated

**File:** `src/actions/competency.ts:178-181`; `src/lib/competency/matrix.ts:210-213`
**Issue:** Identical max-ISO-string reducers in two modules; the classify-input assembly around them is also near-duplicated between `getTrainingRecordForPerson`, `getMyCompetencyStates`, and `buildMatrix`. Divergence risk when the evidence ladder changes.
**Fix:** Export one helper from `src/lib/competency/matrix.ts` (or a shared `evidence.ts`) and import it in the action file.

### IN-04: `resolveLineage` builds its `.or()` filter by string interpolation of ids

**File:** `src/actions/competency.ts:112`
**Issue:** `` .or(`parent_sop_id.in.(${roots.join(',')}),id.in.(${roots.join(',')})`) `` — safe today because every `root` is a DB-sourced uuid column value, but the idiom has no guard if a future caller feeds it user input (PostgREST filter grammar injection).
**Fix:** One-line hardening: `const roots = [...].filter(r => /^[0-9a-f-]{36}$/i.test(r))` before joining, with a comment stating why.

---

## Fix Outcomes (2026-07-28)

All Critical and Warning findings fixed; Info findings deliberately not in scope. One atomic commit per finding. Verified: `npx tsc --noEmit` clean, `npm run build` clean (bundle gates OK), `npx playwright test --project=phase36 --project=phase35 --project=phase35-unit` — 179 passed (live probes included).

| Finding | Status | Commit | Notes |
|---------|--------|--------|-------|
| CR-01 | fixed | `017c256` | resolveLineage now derives currency + interval from the highest PUBLISHED lineage member per root (drafts excluded); live-probe regression added for the export-path shape (v1-only input → current=2, current interval) and draft exclusion. |
| WR-01 | fixed | `0b5f14d` | `currentSop` predicate now `superseded_by === null && status === 'published'` (matches the row badge); refresher control/clone/title/compare all target the live published current. |
| WR-02 | fixed | `2a189bf` | worker-library completion query explicitly `.eq('worker_id', user.id)` — corrects refresher chips AND the pre-existing Updated badge for supervisor/admin/safety_manager sessions. |
| WR-03 | fixed | `c05135c` | completion clock keyed by lineage root (`parent_sop_id ?? id`) via one extra column on the existing sops query — chip survives supersede; no server action added, no gating. |
| WR-04 | fixed | `86fc3d1` | new pure `isRefresherDue()` (14-day lead window, `REFRESHER_DUE_WINDOW_DAYS`) in refresher.ts, unit-tested; "Refresher due" label now reachable; overdue unchanged (strictly past). |
| WR-05 | fixed | `3933966` | SOP-filtered export resolves the filter SOP's lineage (org-verified) and widens the completion filter to `allSopIds`. |
| WR-06 | fixed | `308f929` | both guards share one corrected GATE_PATTERN (equality/relational/bare-ternary/if; passive `=`/`?:`/`??`/string-label-ternary excluded, ceiling documented); proven live by a temporary real gate turning both specs red; 36-08 spread/`??` call-site workarounds normalized to plain JSX props/defaults. |
| WR-07 | fixed | `15f4c27` | resolveLineage moved to `src/lib/competency/lineage.ts` (plain module); competency.ts imports it; both phase36 specs repointed in the same commit. |
| IN-01 | skipped | — | Info tier, out of fix scope (page derives currency itself; field still caller-relative). |
| IN-02 | skipped | — | Info tier, out of fix scope. |
| IN-03 | skipped | — | Info tier, out of fix scope. |
| IN-04 | skipped | — | Info tier, out of fix scope (roots remain DB-sourced uuids on every call path). |

_Reviewed: 2026-07-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-07-28 — Claude (gsd-code-fixer)_
