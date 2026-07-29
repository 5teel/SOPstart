---
phase: 40-shared-creation-foundation
plan: 04
subsystem: database
tags: [supabase, migration, sop-category, zod]

# Dependency graph
requires:
  - phase: 40
    provides: "40-01 (phase40 Playwright project + tests/phase40/ stubs)"
provides:
  - "SOP_CATEGORIES fixed-seed vocabulary (src/lib/sop-categories.ts)"
  - "migration 00058 (sops.category_slug column, index, deterministic backfill) -- AUTHORED, NOT YET APPLIED TO LIVE DB"
  - "scripts/survey-sop-categories.mjs read-only survey + verbatim output"
affects: [40-05, 40-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-seed vocabulary in code, not a DB table (D-03) -- same pattern as block_categories (00022) minus the table"

key-files:
  created:
    - scripts/survey-sop-categories.mjs
    - src/lib/sop-categories.ts
    - supabase/migrations/00058_sop_category_slug.sql
  modified: []

key-decisions:
  - "Added a 15th vocabulary entry, `manufacturing` (label Manufacturing), beyond the 14-entry baseline -- the real-data survey found `Manufacturing` as the most common non-null sops.category value (4 of 24 rows) with no baseline entry to represent it (D-01: vocabulary seeded from real values)."
  - "Not every real-data value gets an exact-match vocabulary entry. `Maintenance` and `Manufacturing` are exact matches (auto-backfill in migration 00058's pass-1 SQL). `Manufacturing / Chemical Handling`, `Operation`, and category_tag `area-forming` are conceptually representable by existing entries (chemical-handling, machine-operation) but are NOT exact string/label matches, so pass-1 SQL will not touch them -- they are left for plan 40-06's AI-mapping pass, per the plan's explicit design (pass-1 exact match, then AI-map the rest)."

requirements-completed: []  # DAT-01 not yet complete -- blocked on Task 2 (this plan's checkpoint) + Task 3

# Metrics
duration: "(partial -- Task 1 only; timer continues on resume)"
completed: "IN PROGRESS -- stopped at blocking checkpoint"
---

# Phase 40 Plan 04: Shared SOP-Category Vocabulary + Migration 00058 (PARTIAL -- STOPPED AT BLOCKING CHECKPOINT)

**Task 1 complete: one vocabulary file + migration 00058 authored (not yet pushed). Tasks 2 (DB push, blocking human checkpoint) and 3 (repoint six write sites) remain.**

## Performance

- **Started:** 2026-07-29 (see STATE.md session timestamp)
- **Tasks:** 1/3 completed (Task 2 is a blocking checkpoint; Task 3 not started)
- **Files modified:** 3

## Task Commits

1. **Task 1: Survey the real category values, author the vocabulary, author migration 00058** - `66ec745` (feat)

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

## Files Created

- `scripts/survey-sop-categories.mjs` -- read-only survey (no `.insert(`/`.update(`/`.upsert(`/`.delete(` calls, confirmed by grep)
- `src/lib/sop-categories.ts` -- exports `SOP_CATEGORIES` (15 entries: 14-entry baseline + `manufacturing`), `SopCategorySlug`, `categoryLabel`, `isValidCategorySlug`. `normaliseToCategorySlug` is Task 3's addition, not yet present.
- `supabase/migrations/00058_sop_category_slug.sql` -- additive only (`add column if not exists`, `create index if not exists`, two `where category_slug is null`-guarded updates); no `create table`, no `check (`, no `security definer`. Verified by eye that the inlined vocab CTE slug list (15 entries, both updates) exactly matches `SOP_CATEGORIES`'s slug set and order.

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

None — Task 1 executed exactly as written, including the `manufacturing` vocabulary extension explicitly called for by the plan's D-01 instruction ("EXTEND it so that every distinct value... with a count of 2 or more... is representable").

## Self-Check

- `scripts/survey-sop-categories.mjs` — FOUND
- `src/lib/sop-categories.ts` — FOUND
- `supabase/migrations/00058_sop_category_slug.sql` — FOUND
- Commit `66ec745` — FOUND (`git log --oneline -1` on this branch)

## Self-Check: PASSED

---

## STOPPED AT BLOCKING CHECKPOINT -- Task 2

Task 2 (`[BLOCKING] Push migration 00058 to the live database`) requires running `npx supabase db push` against the live production database. Per the executor's operating rules, this executor does NOT run that command itself — it is a `checkpoint:human-verify` with `gate="blocking"` on live infrastructure. See the orchestrator-facing CHECKPOINT REACHED message returned alongside this SUMMARY for the exact commands and expected results.

Task 3 (repoint six write sites onto `category_slug`) has **not started** — it depends on Task 2's column existing on the live database (its own acceptance criteria requires `npx playwright test` and `npm run build` to pass against real types, and the plan explicitly orders Task 3 after the push: "This push MUST happen before Task 3, because Task 3 ships code that writes category_slug").

## Next Phase Readiness

Not ready — this plan is incomplete. A continuation agent resumes at Task 2's `how-to-verify` steps once the human confirms the push, then executes Task 3, then replaces this file with the final SUMMARY.

---
*Phase: 40-shared-creation-foundation*
*Status: PARTIAL -- blocked on live-database checkpoint*
