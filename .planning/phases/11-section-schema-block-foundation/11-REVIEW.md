---
status: issues
phase: 11-section-schema-block-foundation
reviewed: 2026-04-15
critical: 0
warnings: 4
info: 5
---

# Phase 11: Code Review — Section Schema & Block Foundation

**Status:** issues_found (advisory only)

## Summary

Phase 11 lands cleanly as an additive, backwards-compatible foundation: the new `section_kinds` catalog, `blocks` / `block_versions` / `sop_section_blocks` tables, the Zod discriminated union, and the `resolveRenderFamily` helper are all sound. The legacy regression guard is correctly preserved and the renderer refactor is faithful to the previous cascade.

The most material issue is a **wiring gap between the Dexie v3 schema bump and the offline sync engine** (WR-01): the cache schema indexes `section_kind_id`, but `sync-engine.ts` was not updated to fetch or denormalise `section_kinds` rows, so every assigned (offline-cached) SOP silently falls back to the legacy substring path. User-visible effect: `render_priority` sort, kind icons, and kind colors will only appear for non-assigned library SOPs.

A smaller security concern (WR-02): nothing at the DB layer prevents `sop_sections.section_kind_id` from pointing at another org's custom kind. `createSection` defends against this in the happy path, but direct Supabase writes are unguarded.

---

## Warnings

### WR-01: Offline sync engine never fetches `section_kinds` — Dexie path silently degrades v3.0 rendering
**Files:** `src/lib/offline/sync-engine.ts:98-128`, `src/lib/offline/db.ts:67-82`, `src/hooks/useSopDetail.ts:11-37`

The Dexie schema was bumped to v3 with `section_kind_id` indexed and a comment claims *"The joined `section_kind` object is denormalized onto each cached section by the sync layer"* — that denormalisation is not implemented. `syncAssignedSops` still selects `*, sop_sections(*, sop_steps(*), sop_images(*))` without `section_kind:section_kinds!section_kind_id(*)`. Every cached section therefore has `section_kind === undefined`, causing:
- `SopSectionTabs` falls through to `inferRenderFamilyFromType(section_type, 0)` for tab icons/colors (ignores `render_priority`).
- `SectionContent` falls through to the legacy substring path.
- `SectionEditor` shows lowercase render family (`content`, `hazard`) as the chip instead of the kind's `display_name`.

**Fix:** Add the section_kind join to `sync-engine.ts` select and extend `SopWithNested`/`SopSection` types to round-trip it.

### WR-02: `sop_sections.section_kind_id` has no DB-level cross-org integrity check
**File:** `supabase/migrations/00019_section_kinds_and_blocks.sql:66-70`

Advisory FK only checks kind existence — not that it's either global or same-org. `createSection` re-fetches via RLS before insert, but the pre-existing PATCH route and direct Supabase client writes bypass that guard. Fix with a `BEFORE INSERT OR UPDATE` trigger that asserts `kind.organisation_id IS NULL OR kind.organisation_id = sop.organisation_id`.

### WR-03: Unique-index sentinel UUID `00000000-...` can theoretically collide
**File:** `supabase/migrations/00019_section_kinds_and_blocks.sql:35-39`

`coalesce(organisation_id, '00000000-0000-0000-0000-000000000000'::uuid)` would collide if a real org ever had that UUID. Idiomatic fix: two partial unique indexes (`WHERE organisation_id IS NULL` and `WHERE organisation_id IS NOT NULL`).

### WR-04: Migration backfill is an unbounded UPDATE during migration
**File:** `supabase/migrations/00019_section_kinds_and_blocks.sql:74-87`

Single-statement substring backfill over the whole `sop_sections` table holds locks during migration. Functionally correct and idempotent (`where section_kind_id is null`), but a runtime concern at scale. Optional: split into a follow-up data migration.

---

## Info

### IN-01: Tab styling diverges from content rendering for legacy steps-by-shape sections
**Files:** `src/lib/sections/resolveRenderFamily.ts:52-81`, `src/components/sop/SectionContent.tsx:131`

`resolveTabStyling` always passes `stepCount: 0` — so legacy `procedure` sections with 5 steps render content as steps but show a `content` tab. Fix by threading `sop_steps?.length` through the helper signature.

### IN-02: `as any` cast in `createSection` insert is now unnecessary
**File:** `src/actions/sections.ts:82-85`

`database.types.ts` already has `section_kind_id?: string | null` on `sop_sections.Insert`. Drop the cast and the eslint-disable.

### IN-03: `SectionEditor` chip falls back to lowercase render family
**File:** `src/components/admin/SectionEditor.tsx:138-140`

For legacy sections (and every offline section until WR-01 fixed) the chip shows `content`/`hazard`/`ppe` instead of the title-cased `section_type`. Add a third fallback: `styling.displayName ?? toTitleCase(section.section_type)`.

### IN-04: `SectionKindPicker` uses `useEffect`+`mounted` instead of `useQuery`
**File:** `src/components/admin/SectionKindPicker.tsx:42-60`

Bypasses TanStack cache — reopening the picker refetches. Catalog is long-stale-time territory.

### IN-05: Server-action error messages echo the submitted UUID
**File:** `src/actions/sections.ts:48-51`

`throw new Error('Unknown section kind: ' + parsed.sectionKindId)` reflects the UUID in the route response. Swap for an opaque message; `console.error` keeps server-side context.

---

## Recommendations

- **Land before phase 12 wires block writes:** WR-01 and WR-02 (both compound badly once `sop_section_blocks` starts receiving writes).
- **Optional cleanup:** WR-03, WR-04, IN-02, IN-05 (low-risk nits).
- **UX polish (defer):** IN-01, IN-03, IN-04.

Run `/gsd-code-review-fix 11` to apply mechanical fixes.
