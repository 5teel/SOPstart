---
phase: 21-safety-critical-parsing
plan: 05
subsystem: parsing
tags: [parser, library, junctions, publish-gate, gap-closure, wave-5]
gap_closure: true
depends_on: [21-04]
requires: [21-01, 21-02, 21-03, 21-04, "migrations 00019-00032"]
provides:
  - "parser → sop_section_blocks junction rows per Puck item"
  - "props.junctionId stamped on every parser-emitted Puck item"
  - "category='parsed_inline' filter on library picker"
  - "BlockContentSchema covers all 17 Puck registry kinds"
affects:
  - "publish gate (Wave 4) — now non-no-op for parsed SOPs"
  - "verify checklist (Wave 4) — renders rows for parsed SOPs"
  - "reviewer-flags panel (Wave 3) — junctionId mapping now lands"
  - "library picker UI — hides parsed_inline by default"
tech-stack:
  added: []
  patterns:
    - "service-role escape hatch on server actions (parser context)"
    - "strict Puck-props → BlockContent adapter with Zod-validate-or-throw"
    - "sequential createBlock+addBlockToSection with throw-on-first-failure"
key-files:
  created:
    - supabase/migrations/00033_phase21_extend_block_kinds_for_parser.sql
    - src/lib/validators/__tests__/block-content-extended.test.ts
    - src/lib/parsers/__tests__/parser-creates-junctions.test.ts
  modified:
    - src/lib/validators/blocks.ts
    - src/lib/builder/diff-block-content.ts
    - src/actions/blocks.ts
    - src/actions/sop-section-blocks.ts
    - src/lib/parsers/parsed-sop-to-layout-data.ts
    - src/app/api/sops/parse/route.ts
    - src/types/database.types.ts
    - src/components/admin/blocks/BlockPickerPreview.tsx
    - "src/app/(protected)/admin/sops/new/blank/WizardClient.tsx"
    - src/lib/builder/puck-to-block-content.ts
    - tests/integration/scp-parse-pipeline.test.ts
    - playwright.config.ts
decisions:
  - "Sequential materialization (not Promise.all) — easier partial-failure detection AND avoids piling N service-role inserts in parallel from a worker."
  - "Adapter throws on shape mismatch (not silent skip) — parse_job marked failed at the route level rather than silently dropping items."
  - "Service-role escape hatch on createBlock / addBlockToSection is parser-only; refuses scope=global combo as defence-in-depth."
  - "category='parsed_inline' is the picker filter (per-item rows kept in DB so verify gate + reviewer flags can map back)."
  - "Layout_data is written AFTER junctions exist, so junctionIds are stamped into Puck props in a single round-trip per section."
metrics:
  duration: ~20m
  tasks_completed: 7/7
  commits: 6 (per-task) + this docs commit
  date_completed: 2026-05-26
---

# Phase 21 Plan 21-05: Parser → Library Junction Integration (Gap Closure) Summary

**One-liner:** Wired the parse pipeline to create one library block + one `sop_section_blocks` junction row per emitted Puck item (with `block_provenance` populated and `props.junctionId` stamped), so the Wave 4 verify checklist + publish gate are no longer a `0 === 0` no-op for parsed SOPs.

## What changed

The Phase 21 verifier (PASS-WITH-NOTES) and UAT discovery on 2026-05-25 surfaced a structural gap: the verify checklist iterates `sop_section_blocks` junction rows, but the parser only wrote Puck items into `sop_sections.layout_data`. The two paths never met. Every freshly parsed SOP had zero junctions, so `verifiedCount === totalCount` degenerated to `0 === 0 = true`.

Plan 21-05 closes that gap. Three deliverables:

1. **Library schema expansion** — `BlockContentSchema` extended from 12 → 19 discriminated-union members so all 17 Puck registry kinds can be saved as library blocks. The 7 new kinds: `text`, `heading`, `photo`, `callout`, `model`, `step_with_photos`, `photo_grid`.

2. **Parser materialization** — `materializeJunctionsForLayout()` in `src/lib/parsers/parsed-sop-to-layout-data.ts` runs sequentially per Puck item: creates an org-scoped library block (with `category='parsed_inline'`), then a `sop_section_blocks` junction (with `block_provenance` if the Puck item carries it from the Wave 4 provenance writer), then stamps `props.junctionId` on the Puck item in place. Throws on any failure so the parse job fails-fast (no orphan junctions, per T-21-05-02).

3. **Library picker UX** — `listBlocks({ includeParsedInline: false })` (default) hides the parser-created single-use rows so a 50-block SOP doesn't bloat the picker. `BlockPickerPreview` gained preview branches for all 7 new kinds. `WizardClient.LIBRARY_SUPPORTED_SLUG_TO_KIND` extended so wizard step-2 offers "Pick from library" for the new kinds.

## Architecture notes

- **Parser invocation pattern** — `createBlock` and `addBlockToSection` both grew an optional `serviceRole` escape hatch. The parser runs in `src/app/api/sops/parse/route.ts` under an admin Supabase client with no user session, so the existing `requireAdmin()` gate would block it. The escape hatch bypasses auth, uses the service-role client directly, and (for `createBlock`) requires the caller to pass `organisationId` explicitly. Defence-in-depth: `serviceRole` cannot be combined with `scope: 'global'`.

- **Order of operations in the parse route** — Section row is now inserted FIRST (without `layout_data`) so we have the `section.id` to materialize junctions against. Junctions are created (mutating `puckItems[*].props.junctionId` in place). The section row is THEN updated with the now-stamped `layout_data`. This is a single round-trip per section and avoids any window where the section row exists with stale layout_data.

- **block_provenance flow** — Wave 4 already taught the converter to stamp `props.block_provenance` on every Puck item. Plan 21-05 reads that off the Puck item inside `materializeJunctionsForLayout` and forwards it into the new optional `blockProvenance` field on `addBlockToSection`, which writes it into the junction row's `block_provenance` JSONB column.

- **Strict adapter** — `puckPropsToBlockContent(itemType, props)` exhaustively switches on all 17 Puck types, builds the candidate BlockContent shape, then Zod-validates via `BlockContentSchema.safeParse`. Throws on any failure (no silent skip per T-21-05-03).

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 - Bug] diff-block-content.ts exhaustiveness guard tripped after schema extension**
- **Found during:** Task 2 (BlockContentSchema extension)
- **Issue:** `src/lib/builder/diff-block-content.ts` has a `default: { const _exhaustive: never = content }` at the bottom of its kind switch. Adding 7 new kinds to BlockContent broke the exhaustiveness check.
- **Fix:** Added 7 new case branches emitting the text-bearing fields for the side-by-side diff modal.
- **Files modified:** `src/lib/builder/diff-block-content.ts`
- **Commit:** `daf89cb`

**2. [Rule 2 - Critical] database.types.ts missing layout_data / layout_version**
- **Found during:** Task 4 (parse route restructure)
- **Issue:** `tsc --noEmit` failed because `sop_sections` Row/Insert/Update in `database.types.ts` was missing `layout_data` and `layout_version`. The columns have lived in `migration 00020_section_layout_data.sql` since Phase 12 but type regen is unavailable (CLAUDE.md learning).
- **Fix:** Manually extended `sop_sections` Row/Insert/Update with `layout_data: Json | null` and `layout_version: number | null`.
- **Files modified:** `src/types/database.types.ts`
- **Commit:** `5a90dce`

**3. [Rule 3 - Blocking] LayoutData → Json type cast in parse route UPDATE**
- **Found during:** Task 4 verification
- **Issue:** `LayoutData` (from parser) has typed PuckItem shapes that don't satisfy Supabase's `Json` type exactly. Compiled fine for the original `.insert()` because TS inferred via spread, but the new `.update()` form failed.
- **Fix:** `as unknown as object` + `as any` on the update payload, matching the pattern other files use for layout_data writes.
- **Files modified:** `src/app/api/sops/parse/route.ts`
- **Commit:** `5a90dce`

## Tasks executed

| # | Task | Commit |
| --- | --- | --- |
| 1 | Migration 00033 — seed 7 new section_kinds | `97e2679` |
| 2 | Extend BlockContentSchema with 7 new kinds + unit tests (9 cases) | `daf89cb` |
| 3 | addBlockToSection + createBlock accept parser context (blockProvenance + serviceRole) | `cd902e0` |
| 4 | Parser integration: materializeJunctionsForLayout + parse-route wiring + 11 unit tests | `5a90dce` |
| 5 | Library picker filters parsed_inline; BlockPickerPreview + WizardClient extended | `0a0fbf0` |
| 6 | database.types.ts extension (folded into Task 4 for atomic compile-clean commit) | `5a90dce` |
| 7 | SCP-PARSE-05/06/07 integration contract tests | `c39160c` |

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean — zero errors |
| `npm run build` | Clean — all routes compile |
| `npx tsx scripts/check-bundle-size.ts` | `/sops/[sopId]/page` Δ = **0 KB** (1104 KB baseline maintained) |
| `npx playwright test --project=phase21-stubs` | 26/26 passing (8 SCP-PARSE — target was ≥5) |
| `npx playwright test --project=phase21-unit` | 20/20 passing (9 Zod schema + 11 adapter/contract) |
| `npx playwright test --project=phase15-stubs lint/no-bulk-verify-ui.spec.ts` | Passing |
| `BlockContentSchema.options.length` | 19 (12 existing + 7 new) |

### Junction-creation evidence

Live DB query requires Supabase push of migration 00033 + a fresh DOCX parse (Simon owns the push step — see Known Limitations). The contract tests in `tests/integration/scp-parse-pipeline.test.ts` (SCP-PARSE-05/06/07) and `src/lib/parsers/__tests__/parser-creates-junctions.test.ts` assert the materialization wiring against the source. Strict adapter tested directly:

```
parser-creates-junctions.test.ts — 11/11 passing
 ✓ source-contract: materializeJunctionsForLayout exists + is wired into parse route
 ✓ puckPropsToBlockContent: hazard — strips presentation, keeps content
 ✓ puckPropsToBlockContent: text / heading / callout
 ✓ puckPropsToBlockContent: step_with_photos coerces photos array
 ✓ puckPropsToBlockContent: photo_grid
 ✓ puckPropsToBlockContent: throws on unknown Puck type
 ✓ puckPropsToBlockContent: throws on shape mismatch (T-21-05-03)
 ✓ addBlockToSection signature accepts blockProvenance + serviceRole
 ✓ createBlock signature accepts serviceRole + category
 ✓ migration 00033 seeds 7 new section_kinds
 ✓ BlockContentSchema union has 19 members
```

## Known Limitations

### Legacy SOPs (pre-21-05 'uploaded' rows on master)

**9 pre-21-05 'uploaded' SOPs on master have `layout_data` but zero junction rows.** They will render in the builder normally (layout_data renders fine) but the verify checklist will be empty for them and the publish gate will report `total=0, bypassed=false, ready=true` — workers/admins won't be able to surface the per-block verify UX on those SOPs.

**Mitigation:** Re-parse via the admin "re-parse" affordance if a curator wants the verify gate to apply. Otherwise tolerate — they predate Plan 21-05 and are out of scope per the plan's explicit non-goal ("Bulk migration … out of scope" from `21-CONTEXT.md`). NEW parses from this commit forward will create junctions end-to-end.

### Supabase migration push required before UAT

`npx supabase db push --include-all` is required before UAT to apply migration 00033 (seeds the 7 new `section_kinds` rows). Simon owns the push step — local dev / preview will fail with "blocks.kind_slug 'text' not found" until the migration is applied because the `createBlock` validator inside `BlockContentSchema.parse` only checks the discriminator, but downstream RLS / catalog queries may surface the missing slug.

### Deferred (per plan §"Out of scope")

- Backfill script for the 9 existing SOPs
- UI for promoting a `parsed_inline` block to reusable (admins can edit `category` directly in Supabase if a pilot org wants to surface one)
- Re-architecting library RLS for cross-org parsed blocks (parsed blocks are always org-scoped; existing RLS already handles this)

## Self-Check: PASSED

Files asserted to exist:
- `supabase/migrations/00033_phase21_extend_block_kinds_for_parser.sql` — FOUND
- `src/lib/validators/__tests__/block-content-extended.test.ts` — FOUND
- `src/lib/parsers/__tests__/parser-creates-junctions.test.ts` — FOUND
- `src/lib/parsers/parsed-sop-to-layout-data.ts` (modified) — FOUND
- `src/actions/blocks.ts` (modified) — FOUND
- `src/actions/sop-section-blocks.ts` (modified) — FOUND

Commits asserted to exist (git log):
- `97e2679` — FOUND
- `daf89cb` — FOUND
- `cd902e0` — FOUND
- `5a90dce` — FOUND
- `0a0fbf0` — FOUND
- `c39160c` — FOUND
