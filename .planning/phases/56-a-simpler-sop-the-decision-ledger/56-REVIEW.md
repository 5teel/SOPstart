---
phase: 56-a-simpler-sop-the-decision-ledger
reviewed: 2026-10-04T00:00:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - scripts/apply-phase56-migration.mjs
  - scripts/convert-sops-to-steps.ts
  - scripts/decision-writers.json
  - scripts/probe-decisions-immutable.mjs
  - scripts/reconcile-decisions.mjs
  - scripts/verify-gate-check.tsx
  - src/actions/ai-fields.ts
  - src/actions/approvals.ts
  - src/actions/assignments.ts
  - src/actions/completions.ts
  - src/actions/governance.ts
  - src/actions/observations.ts
  - src/actions/sop-section-blocks.ts
  - src/actions/standards.ts
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStandardsButton.tsx
  - src/app/(protected)/sops/[sopId]/page.tsx
  - src/app/api/ai-fields/write/route.ts
  - src/components/sop/StandardLabels.tsx
  - src/components/sop/tabs/ReadTab.tsx
  - src/components/sop/walkthrough/DesktopWalkthrough.tsx
  - src/components/sop/walkthrough/ImmersiveStepCard.tsx
  - src/hooks/useSopDetail.ts
  - src/lib/builder/block-findings.ts
  - src/lib/decisions/record.ts
  - src/lib/decisions/shape.ts
  - src/lib/governance/publish-core.ts
  - src/lib/sop/convert.ts
  - src/lib/sop/placement.ts
  - src/lib/validators/ai-fields.ts
  - src/lib/validators/standards.ts
  - src/types/sop.ts
  - supabase/migrations/00069_sop_kinds_placement_standards.sql
  - supabase/migrations/00070_decisions_ledger.sql
  - tests/evals/sop-ledger.eval.ts
findings:
  critical: 0
  warning: 4
  info: 9
  total: 13
status: issues_found
---

# Phase 56: Code Review Report

**Reviewed:** 2026-10-04
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

Reviewed the two migrations (placement/standards/focus-steps and the append-only decision ledger), the single ledger writer and its 16 hook sites across `src/actions/*` and `publish-core.ts`, the standards server actions and builder panel, the SOP converter plus its production runner, the three operational scripts, the worker-page changes (placement line + standards labels), and the deployed eval.

The hot bug classes from CLAUDE.md were checked explicitly and came back clean:

- **RLS.** Every new policy in 00069/00070 carries `organisation_id = current_organisation_id()` on every arm; the one `FOR ALL` policy (`admins_can_write_standards`) restates its USING in full in WITH CHECK; no table is left with RLS on and zero SELECT policies; the only new function (`sync_sop_placement`) runs as invoker, and the two orphan SECURITY DEFINER RPCs lose EXECUTE for every app role (no `src/` caller — confirmed by grep).
- **Ledger trust boundary.** `recordDecision()` takes org and actor only from `getSessionContext()`; `DecisionInput` has no org/actor field; the only client-reachable agent name (`agentName` on the write route) is a Zod enum over a one-entry allowlist; no code path in `src/` issues UPDATE/DELETE on `decisions` (grep: only the insert in `record.ts`). `'use server'` modules touched export only async functions and types.
- **Service-role writes** in the hook sites keep their pre-existing `organisation_id` self-enforcement; the ledger write itself happens after the primary write and is fail-soft with a distinct log tag, so a ledger failure can neither abort nor roll back the primary write.
- **Converter runner.** `--apply` refuses to run without `--sop`/`--org`/`--all`; writes only `sop_focus_steps` and `sop_conversion_runs` (no `.from('sop_sections')`/`.from('sop_steps')` write anywhere); the upsert on `(section_id, source_key)` preserves row ids so standards attached to a step survive a re-run; a run row is written only after all upserts and deletes for that SOP succeed, so a crash leaves a superset and no false `ok`.
- **UI.** Only token utilities / `var(--token)` with declared tokens (`--accent-hazard`, `--accent-inspect`, `--paper-2` all exist in `blueprint-theme.css`); worker-facing files import nothing admin-only; `step_number` is not rendered as a global id; section classification comes from `src/lib/sop/sections.ts` (the converter imports `isHazardSection`/`isPpeSection`, no private keyword list).

No Critical findings. Four Warnings are real correctness defects with traced paths; the rest are quality items.

## Warnings

### WR-01: An empty `layout_data.content` array shadows the section's step rows, so a hazard carried only on `sop_steps.warning` is dropped and the gate cannot see it

**File:** `src/lib/sop/convert.ts:327-328`
**Issue:** `const layout = (section.layout_data as { content?: unknown } | null)?.content` followed by `Array.isArray(layout) ? fromLayout(...) : fromRows(...)`. `Array.isArray([])` is `true`, so a section whose `layout_data` is `{ content: [] }` takes the layout path, produces zero slots, and **never calls `fromRows`**. `before.hazardSources` is only incremented inside `fromRows` for row-level `warning`/`caution`, so a section with an emptied canvas but populated `sop_steps` rows (the worker page still renders those rows today) yields zero focus steps, zero hazard sources, and `checkGate` passes with `ok: true`. The SOP-01 "nothing hazard or PPE may be lost" gate is blind to exactly this case. Concrete path: an admin deletes every block from a section in the builder (autosave writes `content: []`), the parser-era rows remain, `--apply` runs, the run row says `ok` and the worker's hazard text has no focus step.
**Fix:**
```ts
const layout = (section.layout_data as { content?: unknown } | null)?.content
const useLayout = Array.isArray(layout) && layout.length > 0
const slots = useLayout ? fromLayout(section, layout, before) : fromRows(section, before)
// and at line 334: if (slots.length && useLayout) layoutSections++
```
Add a converter unit case: section with `layout_data: { content: [] }` and one row carrying `warning` must produce one `hazard` step.

### WR-02: Worker sign-off / counter-sign ledger rows have `sop_id: null` even though the SOP id is one column away, while every other completion decision (and the backfill of this very table) carries it

**File:** `src/actions/completions.ts:362-366, 391-397`
**Issue:** `recordSignature` fetches the completion with `.select('id, organisation_id')` and then records the decision with `sopId: null, // not in scope here`. The backfill for the same table in `00070_decisions_ledger.sql:162-177` LEFT JOINs `sop_completions` to populate `sop_id`, and `signOffCompletion` (same file, line 240) sets `sopId: completion.sop_id`. Result: for the same subject kind (`completion`) the ledger has backfill rows with `sop_id` set and live rows without it, so any per-SOP read of the ledger (the `decisions_sop_id_idx` exists for this; Phase 59's Office view) will silently omit every worker self-sign and supervisor counter-sign made after go-live.
**Fix:**
```ts
const { data: completion, error: fetchError } = await admin
  .from('sop_completions')
  .select('id, organisation_id, sop_id')
  .eq('id', completionId)
  .single()
// ...
await recordDecision({
  kind: role === 'supervisor' ? 'countersign' : 'sign_off',
  subject: { kind: 'completion', id: completionId },
  sopId: completion.sop_id,
  ...
})
```

### WR-03: The reconcile report lists every `sop_review_cadences` row as unmatched, forever

**File:** `scripts/reconcile-decisions.mjs:81-82, 107`
**Issue:** The cadence source row is emitted with `null` for both `sop_id` and `subj` (`select 'sop_review_cadences', null, organisation_id, updated_at, updated_by, null, null, ...`). The match predicate is `(d.subject_id = src.subj or (src.sop_id is not null and d.sop_id = src.sop_id))`. With `src.subj` NULL, `d.subject_id = NULL` evaluates to NULL and the right arm is false, so `NOT EXISTS` is always true and every cadence row written since the cutoff is reported as a missing decision even though `setReviewCadence` (`governance.ts:328-334`) logged it with `subject: { kind: 'category', id: null }`. The one tool meant to surface real ledger gaps produces a guaranteed false positive per cadence change, which trains the operator to ignore it.
**Fix:** match cadence rows on `details->>'category'` instead of subject:
```sql
-- in SOURCES, carry the category as text in the subj slot:
union all select 'sop_review_cadences', null, organisation_id, updated_at, updated_by, null,
       category::text, array['cadence_change'], null from public.sop_review_cadences
-- in the predicate:
and (
  d.subject_id::text = src.subj
  or (src.src = 'sop_review_cadences' and d.details->>'category' = src.subj)
  or (src.sop_id is not null and d.sop_id = src.sop_id)
)
```
(`subj` becomes `text` for the union; cast the uuid sources with `::text`.)

### WR-04: `getSopStandardsPanel` builds one GET filter containing every section and focus-step UUID of the SOP

**File:** `src/actions/standards.ts:210-222`
**Issue:** The attachments read is `.or('sop_id.eq.X,section_id.in.(...all section ids...),focus_step_id.in.(...all step ids...)')`. supabase-js sends this as a query string; each UUID adds 37 bytes, so a converted SOP with ~200 focus steps (the research census counts 322 StepBlocks + 164 HazardCards across ~30 SOPs, so 100-200 per large SOP is realistic after Phase 58 reads this table for every SOP) produces an 8-10 KB URL. PostgREST/Kong reject or truncate long URLs (HTTP 414 or a parse error) and the panel shows `attachments error` for exactly the SOPs with the most to label. Every row already carries `organisation_id`, and the panel already knows the SOP's section and step ids, so the filter is unnecessary.
**Fix:** read all attachments for the org (already scoped by `organisation_id`) and filter in memory against the two id sets you already hold — or, simpler and bounded, two short queries:
```ts
const [{ data: a1 }, { data: a2 }] = await Promise.all([
  db.from('standard_attachments').select('standard_id, sop_id, section_id, focus_step_id')
    .eq('organisation_id', orgId).eq('sop_id', sopId),
  db.from('standard_attachments').select('standard_id, sop_id, section_id, focus_step_id')
    .eq('organisation_id', orgId).is('sop_id', null),  // then filter by sectionIds/stepIds sets in JS
])
```

## Info

### IN-01: `supersedes` is accepted by `DecisionInput` but never validated in-org and never passed by any caller

**File:** `src/lib/decisions/shape.ts:32, 95`
**Issue:** `supersedes_decision_id` is written straight through. No caller in `src/` passes `supersedes` (grep), so today it is dead. The day a caller appears it must check the referenced decision belongs to `session.organisationId`, otherwise a server bug could chain a correction onto another tenant's row.
**Fix:** either drop the field until Phase 59 needs it, or have `recordDecision` verify `select id from decisions where id = supersedes and organisation_id = s.organisationId` before insert.

### IN-02: `record.ts` casts the admin client to `any` although `decisions` is already in `database.types.ts`

**File:** `src/lib/decisions/record.ts:36`
**Issue:** `database.types.ts:1881-1923` carries the `decisions` row/insert types, so the cast only hides a type mismatch if `DecisionRow` drifts from the generated insert shape.
**Fix:** `const admin = createAdminClient()` and let `.insert(built.row)` type-check.

### IN-03: Converter hash excludes `sopImagePaths`, so an image added to a step after conversion never triggers a re-run

**File:** `src/lib/sop/convert.ts:549-574`
**Issue:** `conversionHash` covers sections, layout and rows but not the `sop_images` set, while `fromRows` reads `section.sop_images` for `imagePaths`. A later image upload on a rows-path SOP leaves `layout_hash` unchanged and the runner reports `unchanged`.
**Fix:** include a sorted list of `sop_images.storage_path` (per section, step-tagged) in the hashed body.

### IN-04: Runner reads at most 1000 SOPs and does not page

**File:** `scripts/convert-sops-to-steps.ts:55-59`
**Issue:** supabase-js applies PostgREST's default 1000-row cap. With `--all` on a DB above that, the tail is silently skipped; the report prints `count in scope` separately, so the discrepancy is visible but only to a careful reader.
**Fix:** loop with `.range(from, from + 999)` until a short page, or fail if `rows.length !== count`.

### IN-05: Runner's env loader gives `.env` precedence over `.env.local`

**File:** `scripts/convert-sops-to-steps.ts:31-37`
**Issue:** Files are read `.env` then `.env.local` with first-wins, the inverse of the Next.js convention and of the sibling scripts (`apply-phase56-migration.mjs`, `reconcile-decisions.mjs`) which read only `.env.local`. Today `.env` carries no Supabase values, so no misfire, but an `--apply --all` runner that can be pointed at a different project by a stray `.env` line deserves the same single source as its siblings.
**Fix:** read `.env.local` only, or iterate `['.env.local', '.env']`.

### IN-06: Standards seed is one-shot; an organisation created after 00069 starts with zero standards

**File:** `supabase/migrations/00069_sop_kinds_placement_standards.sql:258-269`
**Issue:** The seed is a cross join over `organisations` at migration time. No `src/` path creates organisations today (single-org MVP), so this is latent, but D-11 says "the starter list, for every organisation".
**Fix:** when org creation returns, seed in the same server action, or add an `AFTER INSERT ON organisations` trigger that inserts the six names.

### IN-07: `standard_attachments` SELECT is org-wide, so a worker can read labels on SOPs their department cannot see

**File:** `supabase/migrations/00069_sop_kinds_placement_standards.sql:205-207`
**Issue:** `sop_focus_steps` inherits SOP visibility through an `exists (select 1 from sops ...)`, but `standard_attachments` does not — a worker scoped out of SOP X can still read rows `(standard_id, sop_id = X)` and resolve the name via `standards`. The disclosure is a label such as "Confined Space" plus a UUID; low sensitivity, but it is the one new tenant table whose read does not follow the SOP's own visibility.
**Fix:** if parity matters, add `and (sop_id is null or exists (select 1 from public.sops s where s.id = standard_attachments.sop_id))` (and the section/step equivalents) to the SELECT policy, mirroring `org_members_can_view_sop_focus_steps`.

### IN-08: Inner truncating header in the immersive step card is missing `min-w-0`

**File:** `src/components/sop/walkthrough/ImmersiveStepCard.tsx:81-85`
**Issue:** The new wrapper `div.flex.min-w-0` is right, but its child `div.truncate` is now a flex item whose min-width is `auto`, so a long section title will not truncate; it pushes the standards labels and the right-hand controls off the row on narrow phones.
**Fix:** `<div className="mono text-meta uppercase tracking-wider text-[var(--ink-500)] truncate min-w-0">`.

### IN-09: Re-verifying an already-verified junction logs a second `verify` decision and re-stamps the verifier

**File:** `src/actions/sop-section-blocks.ts:87-114`
**Issue:** The UPDATE has no `.is('verified_by_admin_id', null)` guard, so a second `verifyBlock` call on a verified row still returns a row and writes another ledger entry. Both current callers toggle (`isVerified ? unverify : verify`), so this needs a double-submit or a stale UI to happen; the ledger would then show two "Checked a section" rows for one check.
**Fix:** add `.is('verified_by_admin_id', null)` to the update and treat zero rows as already-verified (`return { ok: true }` without a ledger row).

---

_Reviewed: 2026-10-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
