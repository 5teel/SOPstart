---
phase: 12-builder-shell-blank-page-authoring
plan: 01
subsystem: builder-foundation
tags: [puck, migration, rpc, rsc, layout-renderer, worker-fallback]
requires:
  - supabase/migrations/00019_section_kinds_and_blocks.sql
  - src/components/sop/SectionContent.tsx (legacy switch)
  - src/lib/supabase/server.ts (createClient)
provides:
  - "@puckeditor/core@0.21.2 installed (exact pin)"
  - "Migration 00020: layout_data jsonb + layout_version int + sops.source_type + reorder_sections RPC"
  - "SourceType union + Sop.source_type + SopSection.layout_data + SopSection.layout_version types"
  - "src/lib/builder/supported-versions.ts (SUPPORTED_LAYOUT_VERSIONS)"
  - "src/lib/builder/layout-schema.ts (LayoutDataSchema)"
  - "/admin/sops/builder/[sopId] RSC route + ssr:false Puck BuilderClient"
  - "src/components/sop/LayoutRenderer.tsx (version + Zod guard, warn-once fallback)"
  - "SectionContent.tsx layout_data/layout_version branch + LegacyRenderer extraction"
affects:
  - src/components/sop/SectionContent.tsx (non-breaking: branch added above preserved switch)
  - src/lib/offline/sync-engine.ts (type refactor to extend Sop — future-proofs source_type)
tech-stack:
  added:
    - "@puckeditor/core@0.21.2"
  patterns:
    - "Next.js 16 App Router: import '@puckeditor/core/puck.css' in RSC page, dynamic({ ssr: false }) in 'use client' wrapper"
    - "Postgres RPC for atomic multi-row rewrite (supabase-js has no client transactions)"
    - "CHECK-string-enum for source_type (matches migration 00019 render_family precedent)"
    - "Warn-once module-level ref flags for D-13/D-14/D-15 once-per-page-load logging"
key-files:
  created:
    - supabase/migrations/00020_section_layout_data.sql
    - src/lib/builder/supported-versions.ts
    - src/lib/builder/layout-schema.ts
    - src/app/(protected)/admin/sops/builder/[sopId]/page.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
    - src/components/sop/LayoutRenderer.tsx
  modified:
    - package.json (add @puckeditor/core@0.21.2 exact pin)
    - package-lock.json (lockfile update)
    - src/types/sop.ts (SourceType union, Sop.source_type, SopSection.layout_data/layout_version)
    - src/components/sop/SectionContent.tsx (layout_data branch + LegacyRenderer)
    - src/lib/offline/sync-engine.ts (SopWithNested now extends Sop)
    - tests/sb-layout-editor.test.ts (flip SB-LAYOUT-06 fixme -> test)
    - tests/sb-builder-infrastructure.test.ts (add SB-INFRA-00 route-scaffold test)
decisions:
  - "Installed @puckeditor/core (not @measured/puck) — package renamed in Puck 0.21 (2026-01-14)"
  - "source_type uses CHECK-string-enum, not Postgres enum type — matches Phase 11 migration 00019 precedent"
  - "reorder_sections is NOT SECURITY DEFINER so RLS on sop_sections applies to caller"
  - "Placeholder Puck config { components: {} } — Plan 02 replaces with 7-block config"
  - "SopWithNested in sync-engine now extends Sop instead of hand-mirroring fields — prevents future drift"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-24T05:36:55Z"
  tasks_completed: 3
  commits: 2
requirements: [SB-LAYOUT-04, SB-LAYOUT-06, SB-AUTH-04]
---

# Phase 12 Plan 01: Builder Foundation — Puck + Migration + Route + Worker Fallback Summary

Phase 12 foundation landed: `@puckeditor/core@0.21.2` pinned, additive migration 00020 applied to the live Supabase (layout_data jsonb + layout_version int + sops.source_type + `reorder_sections` RPC), admin builder route mounts Puck client-only via `next/dynamic({ ssr:false })`, and worker `SectionContent.tsx` routes `layout_data`-backed sections through a guarded `LayoutRenderer` while preserving the legacy switch byte-identically in `LegacyRenderer`.

## Goal

Stand up every structural piece Phase 12's later plans depend on — the package, the schema, the admin route shell, and the worker-side branch with linear fallback — so Plan 02 (blocks), Plan 03 (wizard), and Plan 04 (draft persistence + reorder) each have working substrate without re-doing foundation work.

## What Was Built

### Task 1 — Puck install + migration 00020 + type extensions (commit `390e411`)

- `npm install --save-exact @puckeditor/core@0.21.2` — exact pin confirmed by `npm ls` and literal `"@puckeditor/core": "0.21.2"` in `package.json`.
- `supabase/migrations/00020_section_layout_data.sql`:
  - Adds `sop_sections.layout_data jsonb` (nullable) and `sop_sections.layout_version int` (nullable) — additive, no backfill.
  - Adds `sops.source_type text` with CHECK constraint `source_type in ('uploaded','blank','ai','template')`, backfills existing rows to `'uploaded'`, then sets default `'uploaded'` + NOT NULL (Pitfall 9 mitigation).
  - Creates `public.reorder_sections(p_sop_id uuid, p_ordered_section_ids uuid[])` plpgsql function that atomically rewrites `sort_order` via `UPDATE ... FROM unnest(...) WITH ORDINALITY`. **Not SECURITY DEFINER** — RLS on `sop_sections` applies to the caller. `GRANT EXECUTE` to `authenticated` role.
- `src/types/sop.ts`:
  - `export type SourceType = 'uploaded' | 'blank' | 'ai' | 'template'`
  - `Sop.source_type: SourceType` (required)
  - `SopSection.layout_data: unknown | null` and `SopSection.layout_version: number | null`

### Task 2 — `npx supabase db push` (no file changes, infrastructure only)

- Linked worktree to Supabase project `gknxhqinzjvuupccyojv` (SOPstart).
- `npx supabase db push` applied migration `00020_section_layout_data.sql` to the live remote DB (also applied `00019_section_kinds_and_blocks.sql` which was missing from remote).
- `npx supabase db push --dry-run` subsequently reports "Remote database is up to date" — idempotency confirmed.
- Live DB verification via `npx supabase db query --linked`:
  - `sop_sections.layout_data` — jsonb, nullable, no default
  - `sop_sections.layout_version` — integer, nullable, no default
  - `sops.source_type` — text, NOT NULL, default `'uploaded'::text`
  - `pg_proc.proname = 'reorder_sections'` — 1 row (function exists)
  - `count(*) from public.sops where source_type is null` — 0 (backfill correct)

### Task 3 — Builder route + LayoutRenderer + worker branch (commit `d852ec3`)

- `src/lib/builder/supported-versions.ts` — exports `SUPPORTED_LAYOUT_VERSIONS = [1] as const` and `CURRENT_LAYOUT_VERSION = 1 as const`.
- `src/lib/builder/layout-schema.ts` — exports permissive `LayoutDataSchema` (`{ content: unknown[], root?: { props?: Record<string,unknown> } }`). Block-prop schemas stay co-located with blocks in Plan 02 per D-09.
- `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx` — async RSC that imports `@puckeditor/core/puck.css`, awaits `params`, runs the Phase 2 admin auth + role guard pattern (redirects `/login` | `/dashboard` | `/admin/sops`), fetches SOP with nested `sop_sections(*, sop_steps(*), sop_images(*))` ordered by `sort_order`, and renders `<Suspense><BuilderClient /></Suspense>`.
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx` — `'use client'` wrapper using `dynamic(() => import('@puckeditor/core').then(m => m.Puck), { ssr: false, loading: ... })`. Renders builder chrome: back-to-library link, SOP title, `SAVED` mono pill, `SEND TO REVIEW` link to the existing `/admin/sops/[sopId]/review` page (per D-04), left sidebar with section list (click-to-switch), canvas that remounts Puck per active section via `key={activeSection.id}` (resolves Research Open Question 2). Placeholder config `{ components: {} }` — Plan 02 replaces with the real 7-block config.
- `src/components/sop/LayoutRenderer.tsx` — `'use client'` component: checks `SUPPORTED_LAYOUT_VERSIONS.includes(layoutVersion)` (warn-once + fallback if not), runs `LayoutDataSchema.safeParse(layoutData)` (warn-once + fallback if not), then renders `<Render config={placeholderConfig} data={parsed.data} />`. Warn-once flags are module-level refs, matching D-13/D-14/D-15 once-per-page-load intent.
- `src/components/sop/SectionContent.tsx` — adds a single `if (section.layout_data != null && section.layout_version != null)` branch at the top of `SectionContent` that delegates to `LayoutRenderer` with `<LegacyRenderer section={section} />` as the `fallback`. The existing 6-case switch is moved verbatim (byte-identical JSX) into a local `function LegacyRenderer({ section }: SectionContentProps)` at the bottom of the file — SB-LAYOUT-06 byte-identical guarantee preserved.
- `tests/sb-layout-editor.test.ts` — `SB-LAYOUT-06` flipped from `test.fixme` to live `test` that asserts: `SectionContent.tsx` imports `LayoutRenderer`, contains the `layout_data != null` + `layout_version != null` branch, preserves `function LegacyRenderer`; `supported-versions.ts` exports `SUPPORTED_LAYOUT_VERSIONS = [1]`; `LayoutRenderer.tsx` imports from `@puckeditor/core` and logs `[layout] unsupported version`. SB-LAYOUT-01..04 stay `fixme` (Plan 02 + 04). SB-LAYOUT-05 stays `fixme` (Phase 16).
- `tests/sb-builder-infrastructure.test.ts` — added `SB-INFRA-00` live test that asserts the route scaffold structurally (Puck CSS import, auth guards, `ssr: false` dynamic load). SB-INFRA-01..04 stay `fixme` for later plans.

## Verification Results

| Step                                                | Status | Evidence                                                                                      |
| --------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `npm ls @puckeditor/core` == `@puckeditor/core@0.21.2` | ✅     | `└── @puckeditor/core@0.21.2`                                                                 |
| `package.json` literal `"@puckeditor/core": "0.21.2"` | ✅     | grep count = 1                                                                                |
| Migration applied to remote                         | ✅     | `supabase db push` applied 00019 + 00020; dry-run now reports "up to date"                    |
| `sop_sections.layout_data` jsonb nullable           | ✅     | information_schema row confirms                                                               |
| `sop_sections.layout_version` integer nullable      | ✅     | information_schema row confirms                                                               |
| `sops.source_type` text NOT NULL default 'uploaded' | ✅     | information_schema row confirms                                                               |
| `reorder_sections` function exists                  | ✅     | `pg_proc` row returned                                                                        |
| No NULL source_type rows                            | ✅     | `count = 0`                                                                                   |
| Builder route files present                         | ✅     | `page.tsx`, `BuilderClient.tsx` in `src/app/(protected)/admin/sops/builder/[sopId]/`          |
| `import '@puckeditor/core/puck.css'` in page.tsx    | ✅     | grep match                                                                                    |
| `ssr: false` in BuilderClient.tsx                   | ✅     | grep match                                                                                    |
| LayoutRenderer imports from `@puckeditor/core`      | ✅     | grep match                                                                                    |
| SectionContent imports LayoutRenderer + LegacyRenderer exists | ✅ | grep match                                                                                    |
| `npx tsc --noEmit` clean                            | ✅     | Zero errors after sync-engine SopWithNested refactor                                          |
| `npx playwright test -g "SB-LAYOUT-06\|SB-INFRA-00"` | ✅    | 2 passed                                                                                      |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sync-engine.ts SopWithNested missed required `source_type`**
- **Found during:** Task 3 `npx tsc --noEmit`
- **Issue:** Extending `Sop` with required `source_type: SourceType` surfaced a latent hand-mirrored duplicate interface `SopWithNested` in `src/lib/offline/sync-engine.ts` that was missing `source_type`. `db.sops.put({ ...sopData })` failed because `CachedSop` extends `Sop` (now includes `source_type`), so spreading `SopWithNested` (which omitted it) violated the table row type.
- **Fix:** Replaced the hand-mirrored `interface SopWithNested {...}` with `type SopWithNested = Sop & { sop_sections: (...)[] }`. Now inherits every `Sop` field automatically — prevents future drift when more `sops` columns are added (e.g. Phase 14 AI fields).
- **Files modified:** `src/lib/offline/sync-engine.ts`
- **Commit:** `d852ec3` (Task 3)

### Plan-directed deviations

**2. [Test mapping] SB-INFRA-00 new test instead of flipping an existing fixme**
- **Found during:** Task 3 step 7 (flip Playwright stubs)
- **Issue:** The plan instructed "flip the test asserting `/admin/sops/builder/[sopId]` returns 200 for admin" but none of the four existing `SB-INFRA-01..04` fixmes in `sb-builder-infrastructure.test.ts` target builder-route load — they target Phase 9 pipeline wiring, Dexie persistence, bundle splitting, and AI verification (all later-plan concerns).
- **Fix:** Added a new `SB-INFRA-00` live test that structurally verifies the Plan 01 scaffold (Puck CSS import, auth guards, `ssr: false` dynamic load) without claiming coverage of SB-INFRA-01..04. Preserves the plan's intent (a live test that the builder route scaffolding exists) without fabricating coverage of later-plan requirements.
- **Files modified:** `tests/sb-builder-infrastructure.test.ts`

### Non-deviations

No Rule 4 architectural changes. No authentication gates. Supabase linking + push worked first try after `npx supabase link --project-ref gknxhqinzjvuupccyojv`.

## Authentication Gates

None. Supabase CLI was already authenticated (visible from `projects list`). Linking + push ran non-interactively.

## Known Stubs

- **Placeholder Puck config** — `BuilderClient.tsx` and `LayoutRenderer.tsx` both use `{ components: {} }` as the Puck `Config`. **Intentional** — Plan 02 replaces both with the real 7-block config imported from `@/components/sop/blocks/puckConfig`. The placeholder lets the route mount today without half-built block components.
- **`SAVED` pill is static text** — not wired to autosave state. **Intentional** — Plan 04 wires the real `SAVED 2s AGO / SAVING… / OFFLINE · QUEUED` state machine via the sync-engine extension.
- **`onChange` is a no-op** — Puck emits changes that go nowhere. **Intentional** — Plan 04 wires `useBuilderAutosave` (Dexie write + debounced Supabase flush).
- **Section sidebar has no drag handles** — click-to-switch only. **Intentional** — Plan 04 wires drag handles to the `reorderSections` server action.

All four stubs are explicitly scoped to later plans by the phase plan tree. None block Plan 01's success criteria.

## TDD Gate Compliance

Plan 01 has `type: execute` (not `type: tdd`), so the plan-level RED/GREEN/REFACTOR gates do not apply. Individual tasks 1 and 3 carry `tdd="true"` but in this plan the "tests" are stub-flips (going from `test.fixme` to live `test`) rather than new RED tests written before GREEN — the Playwright stubs were laid down in Phase 11 as the RED gate for Phase 12 requirements. Plan 01's GREEN commits (`390e411`, `d852ec3`) land the code that flips the stubs to passing. No RED commit for this plan because the RED tests already existed.

## Threat Surface Scan

No new threat surface outside the plan's `<threat_model>` register. The builder route (T-12-01-04) is protected by the standard admin auth + role guard (redirect `/login` | `/dashboard` | `/admin/sops`). The new `sop_sections.layout_data` column (T-12-01-01) inherits existing RLS on `sop_sections`. The `reorder_sections` RPC (T-12-01-02) is **not** SECURITY DEFINER so RLS still applies; `authenticated` role has EXECUTE, defence-in-depth admin check will be added by the Plan 04 server-action wrapper. `LayoutRenderer` Zod-parses (T-12-01-03) and version-checks (T-12-01-05) before rendering. No new surfaces introduced.

## Self-Check: PASSED

**Created files verified on disk:**
- ✅ `supabase/migrations/00020_section_layout_data.sql`
- ✅ `src/lib/builder/supported-versions.ts`
- ✅ `src/lib/builder/layout-schema.ts`
- ✅ `src/app/(protected)/admin/sops/builder/[sopId]/page.tsx`
- ✅ `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`
- ✅ `src/components/sop/LayoutRenderer.tsx`

**Commits verified in git log:**
- ✅ `390e411` — feat(12-01): install Puck + add migration 00020 and layout types
- ✅ `d852ec3` — feat(12-01): scaffold admin builder route and worker LayoutRenderer branch
