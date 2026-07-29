---
phase: 40-shared-creation-foundation
plan: 06
subsystem: database
tags: [supabase, migration, backfill, sop-category, ai-mapping]

# Dependency graph
requires:
  - phase: 40-04
    provides: "sops.category_slug column (migration 00058, applied live), src/lib/sop-categories.ts (SOP_CATEGORIES, isValidCategorySlug, normaliseToCategorySlug)"
  - phase: 40-05
    provides: "every reader repointed onto category_slug (governance, collections, display/filter surfaces)"
provides:
  - "scripts/apply-phase40-migration.mjs -- ordered migration applier with four clause-pinning assertions"
  - "scripts/backfill-sop-category.mjs -- three-pass, null-clobber-safe, org-scoped category backfill + settings-table remap"
  - "scripts/verify-category-backfill.mjs -- the SC-5 live production proof"
  - "tests/phase40/dat01-migration.spec.ts fully live (zero test.fixme)"
affects: [41-one-sop-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Model id is a named constant with an env override (CATEGORY_MAP_MODEL, default claude-haiku-4-5-20251001), never a bare literal (CLAUDE.md 2026-06-02)"
    - "AI-mapping is per DISTINCT VALUE, not per row -- cheap, deterministic to review, recorded in the audit file"
    - "Settings-table remap collision rule: cadences keep the SHORTER months (more frequent = safer), chains keep MORE steps (stricter) -- never silently drop a chain"

key-files:
  created:
    - scripts/apply-phase40-migration.mjs
    - scripts/backfill-sop-category.mjs
    - scripts/verify-category-backfill.mjs
  modified:
    - tests/phase40/dat01-migration.spec.ts

key-decisions:
  - "Task 2 (the live production --apply run) is a [BLOCKING] human-verify checkpoint per the plan's own frontmatter (autonomous: false). This executor authored, dry-ran (read-only), and confirmed all three scripts work end-to-end against the live project, but did NOT run --apply -- that is reserved for the orchestrator per this plan's explicit instruction."
  - "Both scripts/backfill-sop-category.mjs and scripts/verify-category-backfill.mjs require `npx tsx`, not plain `node` -- they dynamically import src/lib/sop-categories.ts and src/lib/ai/llm.ts (TypeScript source), same requirement as the existing scripts/backfill-agent-metadata.mjs analog. Documented in each script's own header; the plan's literal `node ... --dry-run` verify line undershoots this -- treated as a Rule 1 deviation (see below)."

requirements-completed: []
# DAT-01 is NOT marked complete here -- SC-5 (the live production proof) is
# the checkpoint in Task 2, not yet run. Do not mark DAT-01 complete until
# the orchestrator confirms the live --apply + verify-category-backfill.mjs
# output.

# Metrics
duration: "~45min (Tasks 1 + 3; Task 2 blocked pending orchestrator action)"
completed: "in progress -- blocked at Task 2 checkpoint"
---

# Phase 40 Plan 06: Backfill SOP Category + Retire Old Columns (partial -- Task 2 blocking checkpoint)

**Three operator scripts authored and verified read-only against live production (an ordered migration applier with four clause-pinning assertions, a three-pass null-clobber-safe backfill with settings-table remap, and the SC-5 zero-rows proof) plus a fully-live migration-integrity spec; the live `--apply` run and SC-5 proof are a [BLOCKING] checkpoint reserved for the orchestrator.**

## Status

- **Task 1 (author the scripts):** COMPLETE — commit `eb0ec19`
- **Task 2 (run the backfill against production, prove SC-5):** BLOCKED — [BLOCKING] checkpoint, requires orchestrator/human action (see below)
- **Task 3 (activate the migration spec):** COMPLETE — commit `00a11d8`

## Task Commits

1. **Task 1: Author the applier, the three-pass backfill, and the production proof** — `eb0ec19` (feat)
2. **Task 3: Activate the migration spec with every clause pinned** — `00a11d8` (test)

## Accomplishments (Tasks 1 + 3)

- `scripts/apply-phase40-migration.mjs` — declares `MIGRATIONS = ['00058_sop_category_slug.sql']` as an ordered array (header comment states the CLAUDE.md [2026-07-28] rule for any future corrective migration); fallback iterates every entry via `MIGRATION_FILES`, never a single hard-coded path. Four post-apply assertions via the Management API (raw SQL, bypassing PostgREST): (1) `public.sops` exists + `category_slug` column present, (2) `sops_category_slug_idx` index exists, (3) BOTH retirement `comment on column` strings present, (4) `count(*) filter (where category_slug is not null) > 0`. Each assertion retries once after `NOTIFY pgrst, 'reload schema'` if the failure looks like `PGRST205` (stale schema cache), never confusing that with a genuinely-missing object (`42P01`).
- `scripts/backfill-sop-category.mjs` — `--dry-run` default, `--apply` required for any write. Step 0 writes the audit JSON (`id, organisation_id, category, category_tag, category_slug` for every row) before any write, and refuses to continue if it cannot be written. Step 1 deterministic pass mirrors migration 00058's SQL (`normaliseToCategorySlug`), guarded by `.is('category_slug', null)` so re-runs never touch an already-resolved row. Step 2 collects distinct unresolved `category`/`category_tag` values, sends them in ONE `llmToolCall` (model `CATEGORY_MAP_MODEL`, default `claude-haiku-4-5-20251001`, env-overridable) asking for a slug-or-null mapping validated against `isValidCategorySlug`, then writes via a conditional-spread payload (`{ ...(w.slug ? { category_slug: w.slug } : {}) }`) — a failed call marks the run `partial`, never a blanket null. Step 3 remaps `sop_review_cadences`/`approval_chains` using the combined deterministic+AI dictionary, every write scoped by `.eq('organisation_id', row.organisation_id)` in addition to the `(organisation_id, category)` key; collisions keep the shorter-months cadence / more-steps chain and log every one; a read-only report lists `collections` names matching no vocabulary label (collections are never renamed, per the 40-05 decision). Step 4 nulls both retired columns in org-scoped batches, refusing to run if the audit file is absent or the run status is `partial`. Step 5 prints a JSON summary and never reports `status: "ok"` when any step failed.
- `scripts/verify-category-backfill.mjs` — read-only, no flags. Pins BOTH `category is not null` and `category_tag is not null` (must both be 0), reports `category_slug is null` (legitimate uncategorised count) and both settings tables' non-vocabulary-key counts, exits 1 if either retired-column count is non-zero.
- `tests/phase40/dat01-migration.spec.ts` — all `test.fixme` removed. Seven assertions: MIGRATIONS array matches on-disk phase-40 migrations index-by-index; the fallback iterates every entry; migration clause pinning (column, index, both comments, two null-guarded backfill passes, no drop/create table/security definer — SQL comments stripped before the check so the migration's own explanatory prose isn't misread as the clause); vocabulary-parity drift guard (migration's inlined slugs, deduped across its two backfill passes, equal `SOP_CATEGORIES`); backfill safety pinning (dry-run default, conditional-spread payload, audit-file + partial-status step-4 guards, org-scope, named model constant); verify-script both-column pinning; and a `src/`-wide sweep for any `.insert`/`.update`/`.upsert` on `sops` writing `category:`/`category_tag:` (zero found).

## Verification (Tasks 1 + 3)

- `node scripts/apply-phase40-migration.mjs` (read-only re-run against live prod — migration is idempotent, already applied by plan 40-04): **all 4 assertions PASS** — `backfilled=6, total=24` (unchanged from 40-04, confirming this run performed no new writes beyond the idempotent guarded updates).
- `npx tsx scripts/backfill-sop-category.mjs --dry-run` (read-only + one real AI mapping call, live prod data, no writes): exit 0, step-5 summary printed (see full output below).
- `npx tsx scripts/verify-category-backfill.mjs` (read-only): exit 1 as EXPECTED — the live `--apply` has not run yet, so `category is not null` = 15 and `category_tag is not null` = 1 still. This is the correct pre-checkpoint state, not a bug.
- `npx playwright test --project=phase40 --reporter=line` — 40 passed, 4 skipped (`test.fixme`, owned by other 40-0x plans — the `dat01-category-column.spec.ts` `BuilderClient.tsx` gap and unrelated DUP-02 conditional skips), 0 failed.
- `npx tsc --noEmit` — clean.

### Dry-run summary (captured during authoring, read-only against live prod)

```json
{
  "rowsTotal": 24,
  "resolvedByPass1": 0,
  "resolvedByPass2": 9,
  "leftUncategorised": 9,
  "cadenceRowsRemapped": 0,
  "cadenceCollisions": 0,
  "chainRowsRemapped": 0,
  "chainCollisions": 0,
  "retiredColumnRowsNulled": 0,
  "status": "ok"
}
```

AI mapping dictionary (printed in full during the dry run — 7 distinct residual values, all valid vocabulary slugs or an explicit `null`):

```
"Operation" -> machine-operation
"area-forming" -> manufacturing
"Manufacturing / Chemical Handling" -> manufacturing
"Safety and Environment" -> safety
"Information Technology / Office Safety" -> admin-office
"Animal Care" -> null (no reasonable match)
"Vehicle Safety / Roadside Emergency" -> forklift-vehicles
```

`sop_review_cadences` and `approval_chains` are both empty in prod (confirmed in 40-04's survey) so Step 3 has zero rows to remap either way — expected, not a gap. 7 `collections` rows were reported as non-vocabulary-label names (read-only info, no write) — consistent with the 40-05 decision that collections are never renamed.

### `verify-category-backfill.mjs` pre-checkpoint output (expected FAIL — apply has not run)

```
category is not null (must be 0)        -> count = 15
category_tag is not null (must be 0)     -> count = 1
category_slug is null (reported)         -> count = 18
sop_review_cadences non-vocab (reported) -> count = 0
approval_chains non-vocab (reported)     -> count = 0
=== SC-5 FAILED — one or both retired columns still carry data ===
```

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoidance] `--dry-run`/`--apply` scripts require `npx tsx`, not plain `node`, corrected in each script's own usage header**
- **Found during:** Task 1, first attempt to run the plan's literal verify command
- **Issue:** The plan's Task 1 `<verify><automated>` line reads `node scripts/backfill-sop-category.mjs --dry-run`. Both `backfill-sop-category.mjs` and `verify-category-backfill.mjs` dynamically import TypeScript source (`src/lib/sop-categories.ts`, `src/lib/ai/llm.ts`) per the plan's own instruction ("import the vocabulary ... via a `tsx` dynamic import, the pattern `backfill-agent-metadata.mjs` uses") — plain `node` cannot load a `.ts` file (`ERR_UNKNOWN_FILE_EXTENSION`).
- **Fix:** Documented `npx tsx scripts/<name>.mjs [--flag]` as the required invocation in each script's own header comment, exactly matching the established precedent in `scripts/backfill-agent-metadata.mjs` (whose own header states the identical requirement despite also having a `.mjs` extension). `apply-phase40-migration.mjs` does NOT import any TypeScript module, so plain `node` is correct and unchanged for that script.
- **Files modified:** none beyond the authored scripts' own doc comments
- **Verification:** `npx tsx scripts/backfill-sop-category.mjs --dry-run` and `npx tsx scripts/verify-category-backfill.mjs` both ran successfully read-only against live prod (see outputs above); `node scripts/apply-phase40-migration.mjs` ran successfully as plain `node`.
- **Committed in:** `eb0ec19`

**2. [Rule 3 - Blocking] Migration clause-pinning test needed SQL-comment stripping**
- **Found during:** Task 3, first spec run
- **Issue:** `00058_sop_category_slug.sql`'s own header PROSE explains what it deliberately does NOT add ("No table, CHECK constraint, trigger, or SECURITY DEFINER function is added") — a naive lowercase substring check for `security definer` matched this explanatory comment, not an actual clause, and would have failed a correct migration.
- **Fix:** Strip lines starting with `--` before running the forbidden-clause checks (`drop column`, `create table`, `security definer`).
- **Files modified:** `tests/phase40/dat01-migration.spec.ts`
- **Verification:** `npx playwright test --project=phase40 --grep dat01-migration` — 7/7 passed
- **Committed in:** `00a11d8`

**3. [Rule 3 - Blocking] Vocabulary-parity assertion needed deduping**
- **Found during:** Task 3, first spec run
- **Issue:** Migration 00058 inlines the SAME 15-entry vocab `values (...)` list TWICE (once per backfill pass — the `category_tag` exact match, then the `category` label/slug match). A naive regex collected each slug twice, so the array-length comparison against `SOP_CATEGORIES` (15 entries) failed even though the vocabularies matched.
- **Fix:** Dedupe the migration-parsed slugs via `[...new Set(...)]` before sorting/comparing.
- **Files modified:** `tests/phase40/dat01-migration.spec.ts`
- **Verification:** same spec run as above, passed.
- **Committed in:** `00a11d8`

---

**Total deviations:** 3 auto-fixed (1 doc/usage clarification, 2 test-authoring blocking fixes). None expand scope beyond making the scripts and spec behave correctly as specified.

## Known Stubs / Gaps

None introduced by this plan's Tasks 1/3. The pre-existing gap flagged by 40-05 (`BuilderClient.tsx`'s `category_tag` read feeds a DIFFERENT vocabulary — block-library category tags, not `SOP_CATEGORIES`) remains untouched by this plan's scripts, as instructed: the backfill nulls `sops.category`/`sops.category_tag` on the `sops` table only, and does not touch `block_categories` or any block-library-tag read path. `BuilderClient.tsx` will read `null` from `category_tag` after Task 2's live `--apply` runs (same as any other row with no `category_tag` today) — this degrades soft-filtering in the block picker to "no category hint," not a crash, matching the existing designed-safe-degrade behaviour for that surface. This is the phase orchestrator's flagged decision to resolve in a follow-up, per 40-05's SUMMARY; Tasks 1/3 of this plan do not change that state.

## Issues Encountered

None beyond the deviations documented above.

## Self-Check

- `scripts/apply-phase40-migration.mjs` — FOUND, ran successfully against live prod (4/4 assertions PASS)
- `scripts/backfill-sop-category.mjs` — FOUND, dry-run ran successfully against live prod (read-only)
- `scripts/verify-category-backfill.mjs` — FOUND, ran successfully against live prod (read-only), correctly reports pre-checkpoint FAIL state
- `tests/phase40/dat01-migration.spec.ts` — FOUND, zero `test.fixme` remaining, 7/7 passing
- Commit `eb0ec19` — FOUND
- Commit `00a11d8` — FOUND
- `npx tsc --noEmit` — clean
- `npx playwright test --project=phase40` — 40 passed, 4 skipped (owned by other plans), 0 failed

## Self-Check: PASSED (for Tasks 1 + 3; Task 2 is an intentional, not-yet-run checkpoint)

## User Setup Required

**[BLOCKING] Task 2 must be run by the orchestrator/human, against the LIVE production database, from `C:\Development\SOPstart` (not this worktree).** See the CHECKPOINT section of this executor's return message for the exact commands and what to paste back into this SUMMARY once run.

## Next Phase Readiness

Not yet ready to close this plan — Task 2's live proof is outstanding. Once the orchestrator runs the sequence in the checkpoint and confirms `verify-category-backfill.mjs` exits 0 with both retired-column counts at 0, this SUMMARY should be updated (or a follow-up SUMMARY appended) with the live output, and `requirements-completed: [DAT-01]` set.

---
*Phase: 40-shared-creation-foundation*
*Status: IN PROGRESS — blocked at Task 2 [BLOCKING] checkpoint*
