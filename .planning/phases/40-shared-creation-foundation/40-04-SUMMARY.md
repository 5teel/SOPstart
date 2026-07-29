---
phase: 40-shared-creation-foundation
plan: 04
subsystem: database
tags: [supabase, migration, sop-category, zod, next.js]

# Dependency graph
requires:
  - phase: 40
    provides: "40-01 (phase40 Playwright project + tests/phase40/ stubs)"
provides:
  - "SOP_CATEGORIES fixed-seed vocabulary + normaliseToCategorySlug (src/lib/sop-categories.ts)"
  - "migration 00058 (sops.category_slug column, index, deterministic backfill) -- APPLIED LIVE (backfilled=6, total=24)"
  - "scripts/survey-sop-categories.mjs read-only survey + verbatim output"
  - "All six SOP-creating write paths (5 API routes + createSopFromWizard) write category_slug; neither retired column is written anywhere"
affects: [40-05, 40-06, 40-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-seed vocabulary in code, not a DB table (D-03) -- same pattern as block_categories (00022) minus the table"
    - "Deterministic runtime normaliser (normaliseToCategorySlug) mirrors the migration's pass-1 SQL exact/label match -- one canonical mapping rule, expressed twice (SQL for backfill, TS for new writes)"

key-files:
  created:
    - scripts/survey-sop-categories.mjs
    - src/lib/sop-categories.ts
    - supabase/migrations/00058_sop_category_slug.sql
  modified:
    - src/lib/validators/sop.ts
    - src/app/api/sops/ai-prompt/route.ts
    - src/app/api/sops/parse/route.ts
    - src/app/api/sops/restructure/route.ts
    - src/app/api/sops/transcribe/route.ts
    - src/app/api/sops/youtube/route.ts
    - src/actions/sops.ts
    - src/types/sop.ts
    - src/types/database.types.ts
    - tests/phase40/dat01-category-column.spec.ts
    - "src/app/(protected)/admin/sops/new/blank/WizardClient.tsx (deviation, not in plan's file list)"
    - "src/app/(protected)/admin/sops/new/ai/PromptClient.tsx (deviation, not in plan's file list)"
    - "src/app/(protected)/admin/sops/new/ai/VoiceDraftClient.tsx (deviation, not in plan's file list)"

key-decisions:
  - "Added a 15th vocabulary entry, `manufacturing` (label Manufacturing), beyond the 14-entry baseline -- the real-data survey found `Manufacturing` as the most common non-null sops.category value (4 of 24 rows) with no baseline entry to represent it (D-01: vocabulary seeded from real values)."
  - "Not every real-data value gets an exact-match vocabulary entry. `Maintenance` and `Manufacturing` are exact matches (auto-backfilled by migration 00058's pass-1 SQL -- confirmed live: backfilled=6 of 24). `Manufacturing / Chemical Handling`, `Operation`, and category_tag `area-forming` are conceptually representable by existing entries (chemical-handling, machine-operation) but are NOT exact string/label matches, so pass-1 SQL did not touch them -- left for plan 40-06's AI-mapping pass, per the plan's explicit design (pass-1 exact match, then AI-map the rest)."
  - "Migration 00058 was applied via the Supabase Management API raw-SQL endpoint (no DB password available for non-interactive `supabase db push`), same fallback path as `scripts/apply-phase34-gap-migration.mjs`. Verified live: `to_regclass('public.sops')` present, `backfilled=6`, `total=24` (matches the survey's live row count) -- confirmed through the same Management API, so no PGRST205 schema-cache risk (CLAUDE.md 2026-06-15)."
  - "Removed the pre-existing block_categories.slug validate-and-400 check in createSopFromWizard (Rule 1 auto-fix): it validated the OLD categoryTag against block_categories, but categorySlug now belongs to the SOP_CATEGORIES vocab -- leaving it in place would 400 every wizard SOP creation that supplies a category. Replaced with the same write-site isValidCategorySlug gate used by every other write site (unknown slug degrades to null, never a hard error)."
  - "Deviation: WizardClient.tsx / PromptClient.tsx / VoiceDraftClient.tsx are not in this plan's file list, but the categoryTag -> categorySlug validator rename breaks their TypeScript call sites (RHF register() paths, object literal excess-property checks). Fixed by renaming only the payload KEY sent by each (Rule 3, blocking-issue fix) -- their category picker's OPTIONS source is untouched (still block_categories / a live DISTINCT sops.category read) since rewiring the picker itself is explicitly plan 40-08's job (SopMetadataFields) and out of this plan's scope. Values submitted through these 3 flows will mostly resolve to null via isValidCategorySlug/normaliseToCategorySlug until 40-08 lands -- this is the designed safe degrade (uncategorised), not a crash or a 400."

requirements-completed: [DAT-01]

# Metrics
duration: "~2h (includes a human-in-the-loop pause for the live DB push)"
completed: 2026-07-29
---

# Phase 40 Plan 04: Shared SOP-Category Vocabulary + Migration 00058 Summary

**One SOP_CATEGORIES vocabulary (15 slugs, seeded from live data), migration 00058 applied to production (category_slug column + deterministic backfill, 6/24 rows resolved), and all six SOP-creating write paths repointed off the two retiring columns (category, category_tag) onto category_slug.**

## Performance

- **Tasks:** 3/3 complete (Task 2 was a blocking human-verify checkpoint, resolved by the coordinator)
- **Files modified:** 17 (3 created in Task 1, 10 modified in Task 3 per the plan's file list, 3 additional deviation fixes, 1 SUMMARY)

## Task Commits

1. **Task 1: Survey real category values, author vocabulary, author migration 00058** - `66ec745` (feat)
2. **Checkpoint-state SUMMARY (pre-push)** - `4be9cd9` (docs)
3. **Task 2: [BLOCKING] Push migration 00058 to the live database** - resolved by coordinator via Management API raw-SQL endpoint (no separate commit -- DDL, not a repo change); verified live: `backfilled=6, total=24`
4. **Task 3: Repoint every SOP-creating write path onto category_slug** - `41f4eac` (feat)

## Task 1 -- Survey output (verbatim, 2026-07-29, against live Supabase project gknxhqinzjvuupccyojv)

```
=== sops.category (9 distinct) ===
      9  (null)
      4  Manufacturing
      3  Manufacturing / Chemical Handling
      2  Operation
      2  Maintenance
      1  Safety and Environment
      1  Information Technology / Office Safety
      1  Animal Care
      1  Vehicle Safety / Roadside Emergency

=== sops.category_tag (2 distinct) ===
     23  (null)
      1  area-forming

=== sop_review_cadences.category (0 distinct) ===

=== approval_chains.category (0 distinct) ===

=== collections.name (8 distinct) ===
      2  Manufacturing / Chemical Handling
      2  Maintenance
      2  Manufacturing
      1  Safety and Environment
      1  Information Technology / Office Safety
      1  Vehicle Safety / Roadside Emergency
      1  Operation
      1  Animal Care

Total sops rows: 24
```

`sop_review_cadences` and `approval_chains` are both empty tables in prod today -- no cadence or approval-chain rows are keyed on the retiring `category` value yet, so plan 40-06's remap of those two tables has zero live rows to touch.

## Explicit category mapping (D-01, acceptance criterion)

| Real value | Source | Count | Representable via | Exact match? | Pass-1 SQL backfill? |
|---|---|---|---|---|---|
| `Maintenance` | sops.category | 2 | `maintenance` (baseline) | yes (label match) | yes |
| `Manufacturing` | sops.category | 4 | `manufacturing` (NEW, added this plan) | yes (label match) | yes |
| `Manufacturing / Chemical Handling` | sops.category | 3 | `chemical-handling` (conceptually) | no | no -- deferred to 40-06 AI-mapping |
| `Operation` | sops.category | 2 | `machine-operation` (conceptually) | no | no -- deferred to 40-06 AI-mapping |
| `area-forming` | sops.category_tag | 1 | `machine-operation` (conceptually -- Forming Area is a production/manufacturing area, see 00022 line 114 `'area-forming', 'Forming Area'`) | no | no -- deferred to 40-06 AI-mapping |
| `Safety and Environment`, `Information Technology / Office Safety`, `Animal Care`, `Vehicle Safety / Roadside Emergency` | sops.category | 1 each | below the count>=2 threshold; not required to be representable by this plan's acceptance criteria | n/a | n/a (40-06 AI-mapping input) |

Per the plan's design, migration 00058's pass-1 SQL is exact-match only (D-02's "exact/slug match first" pass); everything not caught here is legitimate input to plan 40-06's AI-mapping backfill pass, not a gap in this plan.

## Task 2 -- Live database push (resolved checkpoint)

Migration `00058_sop_category_slug.sql` was applied to production via the Supabase Management API raw-SQL endpoint (no DB password available for non-interactive `supabase db push` in this environment -- same fallback path as `scripts/apply-phase34-gap-migration.mjs`). Verification, also via the Management API (bypassing PostgREST, so no PGRST205 schema-cache risk per CLAUDE.md [2026-06-15]):

```
backfilled = 6
total      = 24
```

This exactly matches the expected result from the mapping table above (2 `Maintenance` + 4 `Manufacturing` exact matches; independently re-confirmed by this executor via a direct supabase-js `select('category_slug')` count against the live table before proceeding to Task 3).

## Task 3 -- Repointed write sites

- **`src/lib/sop-categories.ts`** -- added `normaliseToCategorySlug(raw)`, the deterministic runtime twin of migration 00058's pass-1 SQL (exact slug or case-insensitive label match, else `null`).
- **`src/lib/validators/sop.ts`** -- `aiPromptSchema.categoryTag` renamed to `categorySlug`; added optional `title` (submitted by plan 40-08's shared metadata picker, not yet built).
- **`src/app/api/sops/ai-prompt/route.ts`** -- initial insert and post-parse update both write `category_slug`, gated by `isValidCategorySlug`; admin-supplied `categorySlug`/`title` win over the AI-derived guess (RESEARCH A2, decided in this plan); `ensureSopTitle` now only runs when the request supplied no title (`title?.trim() || await ensureSopTitle(...)`).
- **`parse` / `restructure` / `transcribe` / `youtube` routes** -- identical one-line swap: `category: parsed.category ?? null` -> `category_slug: normaliseToCategorySlug(parsed.category)`. The GPT parser's `category` output field is untouched (still free text); it is now normalised at the storage boundary instead of stored raw.
- **`src/actions/sops.ts` (`createSopFromWizard`)** -- wizard schema's `categoryTag` renamed to `categorySlug`; write is `category_slug: isValidCategorySlug(parsed.data.categorySlug) ? parsed.data.categorySlug : null`. The pre-existing `block_categories.slug` validate-and-400 check was removed (see Deviations) since it validated against the wrong vocabulary post-rename.
- **`src/types/sop.ts` / `src/types/database.types.ts`** -- `category_slug` added (optional+nullable on the `Sop` interface, matching the existing `pipeline_run_id`/`owner_user_id` additive-field convention so pre-existing partial `Sop` test fixtures need no changes); `category` and `category_tag` marked `@deprecated`.
- **`tests/phase40/dat01-category-column.spec.ts`** -- un-fixmed the 2 assertions this task satisfies (vocabulary exports; zero write-side `category:`/`category_tag:` payload keys in the 5 routes + `sops.ts`). The other 2 assertions (readers in `sop-collections.ts`/`governance.ts`, and the whole-`src/` `category_tag` sweep that includes those same readers) stay `test.fixme` -- explicitly plan 40-05's job.

## Verification

- `node scripts/survey-sop-categories.mjs` -- exit 0, 5 tables printed, output above
- `npx supabase db push` (via Management API fallback) -- applied, verified live `backfilled=6, total=24`
- `npx playwright test --project=phase40 --grep "category-column"` -- 2 passed, 2 skipped (fixme, deferred to 40-05)
- `npx playwright test --project=phase40` (full project, 27 tests) -- 5 passed, 22 skipped, 0 failed
- `npx tsc --noEmit` -- clean
- `npm run build` -- clean; bundle check: `/sops/[sopId]/page` = 1058 KB (baseline 1056 KB, delta +2 KB, within +/-2 KB tolerance)
- `npm run lint` -- no new errors introduced (pre-existing 62 errors/358 warnings in the wider repo, unrelated to this plan's files; 2 pre-existing `no-unused-vars` warnings on `WizardClient.tsx`'s `setCategoryTag`/`sopCategoryOptions` predate this change)
- `grep -rn "category_tag" src/ | grep -v category_tags | grep -v database.types.ts` -- only the deprecated declaration in `src/types/sop.ts`, a descriptive comment in `sop-categories.ts`, and the unrelated `voice/query/route.ts` select (plan 40-05 owns), matching the acceptance criterion exactly
- Zero `category:`/`category_tag:` write-payload keys remain in the 5 SOP-creating routes or `src/actions/sops.ts` (confirmed by grep and by the passing spec assertion)

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed stale block_categories validation in createSopFromWizard**
- **Found during:** Task 3 (`src/actions/sops.ts`)
- **Issue:** The pre-existing `categoryTag` field was validated against `block_categories.slug` before insert. After renaming the field to `categorySlug` (now belonging to the SOP_CATEGORIES vocab), that check would 400 every wizard SOP creation that supplies a category, since no SOP_CATEGORIES slug exists in `block_categories`.
- **Fix:** Removed the validate-and-400 block; the write now gates through `isValidCategorySlug(...)`, matching every other write site's degrade-to-null behaviour (per the plan's own instruction not to 400 on an unrecognised slug).
- **Files modified:** `src/actions/sops.ts`
- **Verification:** `npx tsc --noEmit` clean, `npm run build` clean, `dat01-category-column.spec.ts` passes.
- **Committed in:** `41f4eac`

**2. [Rule 3 - Blocking] Restored the accidentally-dropped `supabase` destructure in createSopFromWizard**
- **Found during:** Task 3, first `tsc --noEmit` pass
- **Issue:** While removing the stale `categoryTag` validation block (deviation 1), the `supabase` client from `getSessionContext()` was mistakenly dropped from the destructure, but it is still used later in the same function to fetch `section_kinds` (org-scoped, RLS-enforced -- T-12-03-02 mitigation).
- **Fix:** Restored `const { supabase, userId, role, organisationId } = await getSessionContext()`.
- **Files modified:** `src/actions/sops.ts`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `41f4eac`

**3. [Rule 3 - Blocking] Made `Sop.category_slug` optional to match the existing additive-field convention**
- **Found during:** Task 3, `tsc --noEmit`
- **Issue:** A required (non-optional) `category_slug: string | null` on the `Sop` interface broke two pre-existing test fixtures (`sop-pack.test.ts`, `voice-qa-cache.test.ts`) that construct partial `Sop` objects.
- **Fix:** Made the field `category_slug?: string | null`, following the same pattern already established for `pipeline_run_id`/`owner_user_id`/`review_due_at` (STATE.md: "additive, nullable, optional... so existing partial Sop fixtures/mocks... don't need updating").
- **Files modified:** `src/types/sop.ts`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `41f4eac`

**4. [Rule 3 - Blocking] Renamed the `categoryTag` payload key in 3 client components outside this plan's file list**
- **Found during:** Task 3, `tsc --noEmit`
- **Issue:** `WizardClient.tsx` (object literal passed to `createSopFromWizard`, TS excess-property check) and `PromptClient.tsx` (React Hook Form `register('categoryTag')`/`defaultValues` typed against the now-renamed `AiPromptInput`) failed to compile after the validator rename. `VoiceDraftClient.tsx`'s POST body key was also renamed for consistency, though it compiled either way (untyped `JSON.stringify` object).
- **Fix:** Renamed only the payload key sent by each component to `categorySlug` / the form field id+`register()` path to `categorySlug`. Did NOT rewire the picker's option source (still `block_categories` in `WizardClient`/`PromptClient`, still a live `DISTINCT sops.category` read in `new/ai/page.tsx`) -- that UI rewiring is explicitly plan 40-08's scope (`SopMetadataFields`).
- **Files modified:** `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx`, `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx`, `src/app/(protected)/admin/sops/new/ai/VoiceDraftClient.tsx`
- **Verification:** `npx tsc --noEmit` clean, `npm run build` clean.
- **Committed in:** `41f4eac`

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking-issue fixes)
**Impact on plan:** All four were necessary to keep `tsc`/`build` green after the plan's own `categoryTag` -> `categorySlug` rename; none expand scope beyond making the rename compile and behave safely (degrade-to-null, never a crash or a 400). The 3 client-component touches are a known, bounded gap: their category picker still shows the old vocabulary until plan 40-05/40-08 repoints them, so category selection through those 3 flows will largely resolve to `null` (uncategorised) in the interim -- a cosmetic/functional gap, not a data-integrity or security issue.

## Known Stubs / Gaps

- `WizardClient.tsx`, `PromptClient.tsx`, `VoiceDraftClient.tsx` still source their category picker's OPTIONS from the retiring vocabularies (`block_categories` / live `DISTINCT sops.category`). Values submitted are validated against the new `SOP_CATEGORIES` vocab at the write site and will mostly resolve to `null` until plan 40-08 (`SopMetadataFields`) repoints the picker itself. This is the intended transitional behaviour, not a defect to fix in this plan.
- `new/ai/page.tsx`'s categories prop still reads the retiring `sops.category` column directly (a READ, not a write) -- explicitly plan 40-05's scope ("plan 40-05 repoints the readers").

## Issues Encountered

None beyond the deviations documented above.

## Self-Check

- `scripts/survey-sop-categories.mjs` -- FOUND
- `src/lib/sop-categories.ts` -- FOUND, exports `SOP_CATEGORIES`, `SopCategorySlug`, `categoryLabel`, `isValidCategorySlug`, `normaliseToCategorySlug`
- `supabase/migrations/00058_sop_category_slug.sql` -- FOUND, applied live (verified via Management API)
- Commit `66ec745` -- FOUND
- Commit `4be9cd9` -- FOUND
- Commit `41f4eac` -- FOUND
- Live DB: `sops.category_slug` present, `backfilled=6`, `total=24` -- confirmed via direct supabase-js query

## Self-Check: PASSED

## Next Phase Readiness

Ready for plan 40-05 (repoint readers: `sop-collections.ts`, `governance.ts`, `new/ai/page.tsx`'s categories query, `BuilderClient.tsx`'s `category_tag` read, `voice/query/route.ts`'s select) and plan 40-06 (AI-mapping backfill pass + null-out of the two retired columns). No blockers. The 3 client-component picker rewirings noted above are explicitly plan 40-08's scope.

---
*Phase: 40-shared-creation-foundation*
*Completed: 2026-07-29*
