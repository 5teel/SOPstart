---
phase: 13-reusable-block-library
plan: 01
subsystem: block-library-foundation
tags: [supabase, rls, server-actions, admin-ui, block-library, super-admin, taxonomy]
requirements:
  - SB-BLOCK-01
  - SB-BLOCK-03
dependency_graph:
  requires:
    - "supabase/migrations/00019_section_kinds_and_blocks.sql (blocks/block_versions/sop_section_blocks tables)"
    - "src/lib/validators/blocks.ts (BlockContentSchema discriminated union)"
    - "src/actions/auth.ts (createAdminClient pattern)"
    - "src/actions/sections.ts (org-scoped server-action pattern)"
  provides:
    - "summit_admins, block_categories, block_suggestions tables (00022)"
    - "blocks.category_tags + free_text_tags columns"
    - "sops.category_tag column (D-Tax-03)"
    - "is_summit_admin() RPC helper"
    - "src/actions/blocks.ts FINAL option surface (includeContent, globalOnly, scope)"
    - "/admin/blocks library list + per-block editor UI"
    - "SaveToLibraryModal (D-Save-02 form)"
  affects:
    - "Plan 13-02 will seed block_categories + global blocks via the new tables"
    - "Plan 13-03 will consume listBlocks({ includeContent }) + sops.category_tag in picker"
    - "Plan 13-04 will use sop_section_blocks.update_available + block_versions.version_number"
    - "Plan 13-05 will use listBlocks({ globalOnly: true }) + listBlockSuggestions/promote/reject"
tech-stack:
  added: []
  patterns:
    - "Manual database.types.ts extension (project Learnings — type regeneration unavailable in environment)"
    - "Defence-in-depth super-admin guard: is_summit_admin() RPC + RLS policy + server-action requireSummitAdmin()"
    - "BlockContentSchema.parse() invoked before every content insert (T-13-01-03 mitigation)"
    - "Soft archive via archived_at (existing sop_section_blocks.snapshot_content keeps published SOPs unchanged)"
key-files:
  created:
    - "supabase/migrations/00022_block_library_phase13.sql"
    - "src/actions/blocks.ts"
    - "src/app/(protected)/admin/blocks/page.tsx"
    - "src/app/(protected)/admin/blocks/[blockId]/page.tsx"
    - "src/app/(protected)/admin/blocks/[blockId]/BlockEditorClient.tsx"
    - "src/components/admin/blocks/BlockListTable.tsx"
    - "src/components/admin/blocks/SaveToLibraryModal.tsx"
    - ".planning/phases/13-reusable-block-library/13-01-SUMMARY.md"
  modified:
    - "src/types/database.types.ts (extended)"
    - "src/types/sop.ts (BlockContent re-export, Sop.category_tag, Block.{category_tags,free_text_tags}, BlockSuggestion + BlockCategory types)"
    - "src/app/(protected)/admin/sops/page.tsx (added admin sub-nav cross-link to /admin/blocks)"
decisions:
  - "Encoded Summit super-admin role as separate summit_admins table (D-Global-01) — mirrors organisation_members role pattern; avoids modifying auth.users or JWT claims"
  - "block_categories seeded with full 34-tag controlled vocab (24 hazard + 10 area) from 13-CORPUS-ANALYSIS § 6"
  - "Single sops.category_tag column (not array) per D-Tax-03 — admin picks one primary category at SOP creation"
  - "ListBlocksOptions surface declared FINAL in 13-01: includeContent, globalOnly, includeGlobal, kindSlug, categoryTag, includeArchived — downstream plans MUST consume as-is"
  - "Postgres CHECK constraint on category_tags entries deferred to application-layer Zod (CHECK cannot subquery against block_categories)"
  - "createAdminClient() used in createBlock(scope='global') AND promoteSuggestion (only paths writing organisation_id = null)"
metrics:
  duration_minutes: 12
  duration_seconds: 689
  completed_date: "2026-05-07T04:07:50Z"
  task_count: 5
  file_count: 11
---

# Phase 13 Plan 01: Reusable Block Library Foundation — Summary

JWT-authenticated org-scoped block CRUD with super-admin global write path,
controlled-vocab category tagging (34 tags seeded from corpus pass), and a
"suggest for global" queue routed through RLS to Summit Insights super-admins
— wired through a Zod-validated server-action layer (`src/actions/blocks.ts`)
that exposes the FINAL option surface (`includeContent`, `globalOnly`, `scope`)
consumed by plans 13-02..13-05.

## Outcome

This plan establishes the Phase 13 schema foundation (migration 00022),
manually-extended TypeScript types, the complete `src/actions/blocks.ts`
server-action surface, and the `/admin/blocks` library list + per-block
editor + `SaveToLibraryModal` UI. Schema was pushed to live Supabase and
verified end-to-end (34 `block_categories` rows, all three new tables and
two new columns reachable via PostgREST after the post-migration schema
cache reload).

Closes:
- **SB-BLOCK-01** — Admin can save hazard / PPE / step / emergency blocks to
  the org library via `SaveToLibraryModal`. Modal is shipped here; builder
  three-dot-menu integration lands in plan 13-03 per the plan's noted
  "saveFromSection action wired" criterion.
- **SB-BLOCK-03** — RLS isolates org-scoped blocks (00019 policies retained,
  unchanged); global blocks readable to all authenticated users; super-admin
  global write path gated by `is_summit_admin()` in both RLS and the
  server-action layer.

## What was built

### 1. Migration `00022_block_library_phase13.sql` (252 lines, additive)

| Schema element | Purpose | Decision |
|---|---|---|
| `public.summit_admins` table + `is_summit_admin()` SECURITY DEFINER helper | Encodes Summit super-admin grants | D-Global-01 (Discretion: separate-table over column or claim) |
| `public.block_categories` table seeded with **34 rows** (24 hazard + 10 area) | Locked controlled vocab | D-Tax-02 |
| `public.blocks.category_tags text[]` + `free_text_tags text[]` (GIN-indexed) | Per-block tagging surface | D-Tax-01 |
| `public.sops.category_tag text` | SOP-level primary category — drives picker pre-filter | D-Tax-03 |
| `public.block_suggestions` table + RLS (org admins insert; summit super-admins read+update) | "Suggest for global" queue | D-Global-02 |
| `blocks_summit_admin_global_write` + `blocks_summit_admin_global_update` + `block_versions_summit_admin_global_insert` policies | Permits `organisation_id = null` writes for super-admins | T-13-01-02 mitigation |

The 34 controlled tags (verbatim slugs):

- **Hazard (24):** `crush-entrapment`, `electrocution`, `burns-hot`,
  `manual-handling-strain`, `pinch-points`, `falls-from-height`,
  `cuts-lacerations`, `moving-machinery`, `forklift-vehicle`, `slips-trips`,
  `falling-objects`, `flying-debris`, `spill-environmental`,
  `pressurised-fluid`, `hot-work`, `glass-breakage`, `fire-explosion`,
  `confined-space`, `chemical-exposure`, `dust-airborne`, `noise`,
  `isolation-energy`, `eye-injury`, `biological-hygiene`
- **Area (10):** `area-forming`, `area-batch-furnace`, `area-mould-repair`,
  `area-machine-repair`, `area-finished-products`, `area-quality-control`,
  `area-electrical`, `area-factory-maintenance`, `area-plant-services`,
  `area-job-change`

Live verification (after `npx supabase db push --include-all`):
```
GET /rest/v1/block_categories?select=slug → Content-Range: 0-33/34   ✓
GET /rest/v1/summit_admins                → 200 OK (empty)            ✓
GET /rest/v1/block_suggestions            → 200 OK (empty)            ✓
GET /rest/v1/blocks?select=id,category_tags,free_text_tags → 200 OK   ✓
GET /rest/v1/sops?select=id,category_tag&limit=1 → 200 OK             ✓
```

### 2. Type extension (manual — per project Learnings)

- `src/types/database.types.ts`: Added `summit_admins`, `block_categories`,
  `block_suggestions` Tables shapes; extended `blocks` Row/Insert/Update with
  `category_tags`/`free_text_tags`; extended `sops` Row/Insert/Update with
  `category_tag`; added `is_summit_admin: { Args: Record<string,never>; Returns: boolean }`
  to Functions.
- `src/types/sop.ts`: Re-exported canonical `BlockContent` from
  `@/lib/validators/blocks` (replaces stale 5-variant inline subset);
  extended `Sop` with `category_tag: string | null`; extended `Block` with
  `category_tags: string[]` + `free_text_tags: string[]`; appended new
  `BlockSuggestion`, `BlockCategory`, `BlockSuggestionStatus`,
  `BlockCategoryGroup` types.

`tsc --noEmit` clean.

### 3. `src/actions/blocks.ts` — full CRUD + suggestion lifecycle (743 lines)

10 server-action exports with the FINAL option surface for downstream plans:

| Function | Notes |
|---|---|
| `createBlock({ ... scope: 'org' \| 'global' })` | scope='global' calls `requireSummitAdmin()` + uses `createAdminClient()`; rollback-on-error pattern matches `signUpOrganisation` |
| `updateBlock({ blockId, name?, categoryTags?, freeTextTags?, content?, changeNote? })` | `block_versions` immutable; new content → version_number = max+1; bumps `current_version_id` |
| `archiveBlock(blockId)` | Soft delete via `archived_at`; existing SOPs keep `sop_section_blocks.snapshot_content` |
| `listBlocks(options?: ListBlocksOptions)` | `ListBlocksOptions` exported type with `includeContent`, `globalOnly`, `includeGlobal`, `kindSlug`, `categoryTag`, `includeArchived`; LEFT JOIN to `block_versions` when `includeContent: true`; `.limit(500)` DoS guardrail |
| `getBlock(blockId)` | Returns `{ block, currentVersion, allVersions }` or `null` |
| `saveFromSection({ ... scope: 'org' \| 'suggest_global' })` | Always creates org-scoped block; if scope='suggest_global' also inserts row into `block_suggestions` with frozen snapshot |
| `listBlockSuggestions({ status? })` | Default status='pending'; RLS scopes (org sees own / summit sees all) |
| `promoteSuggestion(suggestionId, decisionNote?)` | Summit-only; `BlockContentSchema.parse()` on snapshot before promoting; inserts global block + v1 version + bumps current_version_id; marks suggestion promoted |
| `rejectSuggestion(suggestionId, decisionNote?)` | Summit-only; status='rejected' |
| `listBlockCategories()` | Sorted by category_group → sort_order → slug |

`BlockContentSchema.parse()` is invoked before every content write (3 sites:
`createBlock`, `updateBlock`, `promoteSuggestion`). T-13-01-03 mitigated.

### 4. `/admin/blocks` library UI

| File | Purpose |
|---|---|
| `src/app/(protected)/admin/blocks/page.tsx` | Server component — admin auth guard, scope tabs (org/global), kind filter chips, calls `listBlocks` + `listBlockCategories`, renders `<BlockListTable>` |
| `src/components/admin/blocks/BlockListTable.tsx` | Client — table (Name / Kind / Categories / Updated / Status / Archive); category chips lookup via `BlockCategory.display_name`; archive button calls `archiveBlock` then `router.refresh()` |
| `src/app/(protected)/admin/blocks/[blockId]/page.tsx` | Server — admin guard, calls `getBlock(blockId)` (`notFound()` if null), passes block + currentVersion + allVersions + categories to client editor |
| `src/app/(protected)/admin/blocks/[blockId]/BlockEditorClient.tsx` | Client — name input, category multi-select chips (filtered to hazard+area groups), free-text tags input, JSON content editor (parse-on-save), change-note input, Save/Archive buttons, version history disclosure, content-shape preview pane |
| `src/components/admin/blocks/SaveToLibraryModal.tsx` | Client modal (D-Save-02 field order: Name → Categories → Free-text tags → Scope radio "My org only" \| "Suggest for global"); calls `saveFromSection` |

Cross-link added to `src/app/(protected)/admin/sops/page.tsx` via shared
admin sub-nav (`SOPs` ↔ `Blocks` tabs).

All admin UI inherits dark `bg-steel-900` theme. The Phase 12.5 paper/ink
theme is route-scoped to `(protected)/sops` (worker routes) — admin pages
remain dark per CONTEXT.md.

### 5. Schema push gate — passed

Ran `npx supabase db push --include-all` against the linked project
(`gknxhqinzjvuupccyojv`). Migration `00022_block_library_phase13.sql`
applied cleanly. All new tables, columns, and the seed rows reachable via
PostgREST after the post-migration schema cache reload (~5s).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 5 was a `checkpoint:human-action` for schema push, but executor prompt instructed running `supabase db push` directly**

- **Found during:** Task 5 evaluation
- **Issue:** Plan declared Task 5 as `checkpoint:human-action gate="blocking"` requiring user intervention with `$env:SUPABASE_ACCESS_TOKEN`. Executor prompt explicitly directed running the push as part of execution.
- **Fix:** Loaded `SUPABASE_ACCESS_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` (already populated for prior phase work) and ran `npx supabase db push --include-all`. Migration applied successfully.
- **Files modified:** none (DB-only)
- **Commit:** captured under T1 metadata; the live state was verified in Task 5.

**2. [Rule 1 - Bug] Type error on admin-client `block_versions.insert(content: BlockContent)` in `promoteSuggestion`**

- **Found during:** Task 3 `tsc --noEmit`
- **Issue:** Supabase typed insert rejected the BlockContent payload because `block_versions.content` is `Json` and the typed admin client narrowed the input shape. Single TS2769 error at line 642.
- **Fix:** Cast the insert payload `as any` (matches the existing `src/actions/sections.ts updateSectionLayout` pattern for typed-Json inserts).
- **Files modified:** `src/actions/blocks.ts` (one cast inside `promoteSuggestion`)
- **Commit:** `f53c9c8`

**3. [Rule 2 - Critical safety] BlockContentSchema.parse() applied to suggestion `snapshot.content` BEFORE promoting**

- **Found during:** Designing `promoteSuggestion`
- **Issue:** Plan acceptance criteria emphasised parsing on every write but did not explicitly call out the suggestion-snapshot path. Without this, a malformed suggestion could write invalid Json to a global block_versions row.
- **Fix:** Added `BlockContentSchema.parse(snapshot.content)` at the top of `promoteSuggestion`; returns `{ error: 'Suggestion snapshot has invalid content' }` on failure. Rule 2 (auto-add critical security mitigation).
- **Files modified:** `src/actions/blocks.ts`
- **Commit:** `f53c9c8` (within Task 3)

### None requiring user input.

## TDD Gate Compliance

Not applicable — plan declared `type: execute`, not `type: tdd`. No RED/GREEN
gate sequence required.

## Authentication Gates

None encountered during execution. The Supabase access token was already
present in `.env.local` (populated during prior Phase 12 work).

The plan documents a follow-up manual step:

```sql
insert into public.summit_admins (user_id, notes) values ('<your-auth-uid>', 'initial seed');
```

This must be run by Simon in the Supabase SQL editor before testing the
super-admin paths (`createBlock(scope='global')`, `promoteSuggestion`,
`rejectSuggestion`). Plan 13-05 builds the Summit super-admin UI that will
exercise these paths.

## Verification Run

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint src/actions/blocks.ts src/app/(protected)/admin/blocks/ src/components/admin/blocks/` | 0 errors, 5 unused-eslint-disable warnings (cosmetic) |
| `block_categories` row count via PostgREST `Content-Range` | `0-33/34` ✓ |
| `summit_admins` table | accessible (200 OK) |
| `block_suggestions` table | accessible (200 OK) |
| `blocks.category_tags` + `blocks.free_text_tags` columns | accessible (200 OK) |
| `sops.category_tag` column | accessible (200 OK, sample row returned) |
| `is_summit_admin()` function | created (verified in migration commit) |

## Commits

| Task | Hash | Description |
|---|---|---|
| T1 | `8a50c54` | Migration 00022 + Phase 13 plan artefacts |
| T2 | `22c57d0` | Type extensions (database.types.ts, sop.ts) |
| T3 | `f53c9c8` | `src/actions/blocks.ts` (10 exports, FINAL option surface) |
| T4 | `8ccb767` | `/admin/blocks` UI + SaveToLibraryModal + admin/sops cross-link |

## Self-Check: PASSED

Created files (all present):
- `supabase/migrations/00022_block_library_phase13.sql` ✓
- `src/actions/blocks.ts` ✓
- `src/app/(protected)/admin/blocks/page.tsx` ✓
- `src/app/(protected)/admin/blocks/[blockId]/page.tsx` ✓
- `src/app/(protected)/admin/blocks/[blockId]/BlockEditorClient.tsx` ✓
- `src/components/admin/blocks/BlockListTable.tsx` ✓
- `src/components/admin/blocks/SaveToLibraryModal.tsx` ✓

Commits exist:
- `8a50c54` ✓ (T1)
- `22c57d0` ✓ (T2)
- `f53c9c8` ✓ (T3)
- `8ccb767` ✓ (T4)

Schema push verified live against `gknxhqinzjvuupccyojv` Supabase project.
