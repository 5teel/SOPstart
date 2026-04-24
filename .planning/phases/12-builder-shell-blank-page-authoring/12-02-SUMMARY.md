---
phase: 12-builder-shell-blank-page-authoring
plan: 02
subsystem: builder-blocks-and-config
tags: [puck, blocks, zod, shared-component-tree, d-13, d-14, d-16, tailwind-reflow]
requires:
  - src/lib/builder/supported-versions.ts (Plan 01 — version gate upstream of LayoutRenderer)
  - src/lib/builder/layout-schema.ts (Plan 01 — permissive outer shape)
  - src/components/sop/SectionContent.tsx (Plan 01 — layout_data/layout_version branch upstream)
  - src/components/sop/SopTable.tsx (existing — markdown table rendering)
  - src/components/sop/SopImageInline.tsx (existing — lightbox-wrapped image)
provides:
  - "7 shared block components (TextBlock, HeadingBlock, PhotoBlock, CalloutBlock, StepBlock, HazardCardBlock, PPECardBlock) with co-located Zod prop schemas (D-09)"
  - "src/components/sop/blocks/index.ts barrel re-export of all 7 blocks + schemas + prop types"
  - "src/lib/builder/puck-config.tsx: single Config used by BOTH <Puck> (admin) and <Render> (worker)"
  - "sanitizeLayoutContent helper (D-13) — rewrites unknown-type entries to UnsupportedBlockPlaceholder before Puck iterates children"
  - "SafeRender helper (D-14/D-16) — Zod-parses block props; admin context gets red-outline + 'Missing: <field>' hint; worker gets plain dashed empty-state"
  - "puckOverrides.componentItem with data-testid='puck-palette-{name}' for stable Playwright selectors (info #9)"
  - "Section-level toast in BuilderClient when activeSection.layout_data fails LayoutDataSchema.safeParse (D-16)"
affects:
  - src/components/sop/LayoutRenderer.tsx (placeholder config → real puckConfig + sanitize step)
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx (placeholder config → real puckConfig + overrides + sanitize + error toast)
  - tests/sb-layout-editor.test.ts (flipped SB-LAYOUT-01/02/03 from fixme to live tests; added SB-LAYOUT-13-unknown + SB-LAYOUT-16-red-outline)
tech-stack:
  added: []
  patterns:
    - "Co-located Zod schema + inferred type + component in one file per block (D-09)"
    - "Module-level warn-once flags for D-13/D-14 once-per-page-load logging"
    - "Puck ComponentConfig render(props): `puck` arrives INSIDE props (WithPuckProps), not as a second arg — extracted via destructuring per render"
    - "Forward-declared registry mirror (puckConfigComponentsRegistry) so sanitizeLayoutContent can consult component names at module load"
    - "PPECardBlock coercion: Puck array fields yield `{ item: string }[]`; coerced to `string[]` before Zod-parse so the block stays POJO-friendly"
    - "SafeRender isAdmin branch via puck?.isEditing === true — no environment-detection inside blocks themselves (D-10)"
key-files:
  created:
    - src/components/sop/blocks/TextBlock.tsx
    - src/components/sop/blocks/HeadingBlock.tsx
    - src/components/sop/blocks/PhotoBlock.tsx
    - src/components/sop/blocks/CalloutBlock.tsx
    - src/components/sop/blocks/StepBlock.tsx
    - src/components/sop/blocks/HazardCardBlock.tsx
    - src/components/sop/blocks/PPECardBlock.tsx
    - src/components/sop/blocks/index.ts
    - src/lib/builder/puck-config.tsx
  modified:
    - src/components/sop/LayoutRenderer.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx
    - tests/sb-layout-editor.test.ts
decisions:
  - "puck-config is .tsx not .ts — plan frontmatter listed .ts but the file contains JSX. Import path (@/lib/builder/puck-config) resolves both extensions; no call-site change."
  - "Puck render signature: puck context arrives INSIDE props (WithPuckProps), not as a second render argument. Plan's `render: (props, ctx) => ...` was corrected to `render: (rawProps) => { const { puck, ...props } = rawProps; ... }` (Rule 1: plan-API mismatch)."
  - "Overrides typing: the Overrides export requires ALL keys. Used `Partial<Overrides>` for puckOverrides so only componentItem is defined (Rule 3: TS compile gate)."
  - "UnsupportedBlockPlaceholder registered as a real puckConfig component entry — not just a fallback renderer — so sanitizeLayoutContent's rewritten entries resolve through the same <Render> pipeline."
  - "PPECardBlock: Puck array fields emit `{ item: string }[]` even when the authored shape is `string[]`. Block keeps a `string[]` schema; the config-level render coerces before Zod-parse. Keeps block API POJO-friendly for non-Puck consumers (e.g. Plan 04 autosave sends the coerced shape to Supabase)."
  - "SB-LAYOUT-01/02/03 flipped to structural-assertion tests (not live Playwright DOM tests) — matches Plan 01 SB-INFRA-00 / SB-LAYOUT-06 precedent. Live DOM tests with DB seeding need autosave (Plan 04) + dev server + fixture harness that don't exist yet."
metrics:
  duration: "~25 minutes"
  completed: "2026-04-24T16:05:00Z"
  tasks_completed: 2
  commits: 2
requirements: [SB-LAYOUT-01, SB-LAYOUT-02, SB-LAYOUT-03]
---

# Phase 12 Plan 02: 7 Shared Blocks + Single Puck Config Summary

Extracted 7 shared block components from `SectionContent.tsx`'s linear helpers into `src/components/sop/blocks/*.tsx` with co-located Zod schemas (D-09), wired them into a single Puck `Config` at `src/lib/builder/puck-config.tsx`, and replaced Plan 01's placeholder config in BOTH `BuilderClient.tsx` (admin `<Puck>`) and `LayoutRenderer.tsx` (worker `<Render>`) — the literal SPEC guarantee of a single component tree across admin and worker render paths.

## Goal

Land the core of SB-LAYOUT-01 (7-block palette, no DiagramHotspotBlock), SB-LAYOUT-02 (single component tree), and SB-LAYOUT-03 (Tailwind-only reflow, zero JS-based viewport branching) — so Plan 03 (blank-page authoring wizard) can drag blocks onto a canvas and Plan 04 (draft persistence) can round-trip layout_data through the same component tree Phase 16 will extend.

## What Was Built

### Task 1 — 7 shared block components + barrel (commit `27fb663`)

Each file exports `{Name}Block` (named function component), `{Name}BlockPropsSchema` (Zod schema), and `{Name}BlockProps` (inferred type). No `'use client'`, no `@puckeditor/core` imports, no `className` prop (D-12), no JS viewport branching.

- **TextBlock** (`src/components/sop/blocks/TextBlock.tsx`) — DefaultContent analog; `bg-steel-800 border border-steel-700 rounded-xl p-5`. SopTable if the content is a markdown table, otherwise whitespace-preserving `<p>`.
- **HeadingBlock** (`src/components/sop/blocks/HeadingBlock.tsx`) — `level: 'h2' | 'h3'`. h2: `text-2xl font-bold text-steel-100`; h3: `text-xl font-semibold text-steel-100`.
- **PhotoBlock** (`src/components/sop/blocks/PhotoBlock.tsx`) — wraps `SopImageInline`. When `src` is null/empty, renders a dashed `Photo missing` placeholder (D-14 empty-state).
- **CalloutBlock** (`src/components/sop/blocks/CalloutBlock.tsx`) — amber palette (`bg-amber-500/10 border border-amber-500/30 rounded-xl p-4`) derived from the hazard red pattern. Lucide `Info` icon.
- **StepBlock** (`src/components/sop/blocks/StepBlock.tsx`) — single step row (one block per step, not the legacy StepsContent list) lifted from `SectionContent.tsx` StepsContent inner row. `text-[13px] font-bold text-steel-400 w-6 flex-shrink-0 pt-0.5 tabular-nums` number pill.
- **HazardCardBlock** (`src/components/sop/blocks/HazardCardBlock.tsx`) — lifted from HazardContent. `severity: 'critical' | 'warning' | 'notice'` with Lucide `Siren` (critical) / `AlertTriangle` (warning/notice). Multi-line body renders as bulleted `<ul>`; single-line renders as plain `<p>`.
- **PPECardBlock** (`src/components/sop/blocks/PPECardBlock.tsx`) — lifted from PpeContent blue palette (`bg-blue-500/10 border border-blue-500/30`). `items: string[]` rendered as wrappable chips (`inline-flex ... bg-blue-500/15 text-blue-300 ... border border-blue-500/30`).
- **`index.ts`** — `export * from './{BlockName}'` × 7 so `@/components/sop/blocks` is a single import site.

### Task 2 — Puck config + BuilderClient + LayoutRenderer wiring + tests (commit `517e887`)

- **`src/lib/builder/puck-config.tsx`** — single `puckConfig: Config` with 7 component entries (+ `UnsupportedBlockPlaceholder` so sanitizer rewrites round-trip through `<Render>`). Each entry: `fields` (Puck side-panel), `defaultProps` (seeded from the block's Zod defaults via `satisfies`), and `render(rawProps)` that destructures `puck` from props and delegates to `SafeRender`.
  - **`SafeRender<P>`** — Zod-parses; on failure, `warnPropFailOnce` and returns an empty-state. `puck?.isEditing === true` branches to the admin red-outline container with `data-layout-error="true"` / `data-block="{name}"` / header text `{blockName} - Missing: {field}`; otherwise returns the worker dashed amber empty-state.
  - **`UnsupportedBlockPlaceholder`** — grey dashed container with `data-layout-placeholder="unsupported-block"` + `This block isn't supported in your app version - update required` text.
  - **`sanitizeLayoutContent(content)`** — rewrites any entry whose `type` is not in `puckConfig.components` to `{ type: 'UnsupportedBlockPlaceholder', props: { type, id } }` and `warnUnsupportedBlockOnce`. Called BEFORE `<Puck>`/`<Render>` iterates children in BOTH admin and worker paths.
  - **`firstMissingField(err)`** — extracts the first `invalid_type` / `too_small` field name from a Zod error for the admin `Missing: <field>` hint.
  - **`puckOverrides: Partial<Overrides>`** — `componentItem` wraps palette tiles in `<div data-testid="puck-palette-{name}">` for stable Playwright selectors across Puck versions (info #9).
- **`src/components/sop/LayoutRenderer.tsx`** — imports `puckConfig, sanitizeLayoutContent`; removes `placeholderConfig`; after `LayoutDataSchema.safeParse` succeeds, runs `sanitizeLayoutContent(parsed.data.content)` then renders `<Render config={puckConfig} data={sanitized as any as Data} />`.
- **`src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`** — imports `puckConfig, puckOverrides, sanitizeLayoutContent`, `LayoutDataSchema`; removes `placeholderConfig`; `useEffect` sets `layoutErrorToast` whenever `activeSection.layout_data` fails `LayoutDataSchema.safeParse`; `useMemo` computes `sanitizedInitial: Data` by running safeParse + sanitize (fallback to `emptyData` on parse failure so the editor still mounts). `<Puck>` now receives `config={puckConfig} overrides={puckOverrides} data={sanitizedInitial}` and `onChange` logs `[builder] onChange` (Plan 04 replaces this with `useBuilderAutosave`).
- **Tests (`tests/sb-layout-editor.test.ts`):**
  - `SB-LAYOUT-01` flipped to live: asserts puckConfig contains all 7 block entries, `DiagramHotspotBlock` is absent, `puckOverrides` exposes `data-testid="puck-palette-"`, and the block directory contains exactly the 7 expected `.tsx` files (no `DiagramHotspotBlock.tsx`).
  - `SB-LAYOUT-02` flipped to live: asserts BuilderClient AND LayoutRenderer both import from `@/lib/builder/puck-config`, both reference `puckConfig`, neither references `placeholderConfig`; every block file imports nothing from `@puckeditor/core` and declares no `className?: string` prop.
  - `SB-LAYOUT-03` flipped to live: walks every `.tsx` in `src/components/sop/blocks/` and asserts zero matches for `isMobile`, `useMediaQuery`, `navigator.userAgent`; cross-checks via a shell `grep -rE` so CI fails loud on regressions.
  - `SB-LAYOUT-13-unknown` (new): asserts `UnsupportedBlockPlaceholder` is registered as a puckConfig component, `data-layout-placeholder="unsupported-block"` attribute is present, warn-once machinery (`warnedUnsupportedBlock`, `[layout] unsupported block type`) exists, and both admin/worker entry points invoke `sanitizeLayoutContent`.
  - `SB-LAYOUT-16-red-outline` (new): asserts `data-layout-error="true"`, `data-block={blockName}`, `border-2 border-red-500/70`, `puck?.isEditing === true` branch, `firstMissingField` + `Missing:` hint plumbing exist in puck-config.tsx; asserts BuilderClient has `layoutErrorToast` + `LayoutDataSchema.safeParse` + `has broken layout data` toast copy.
  - `SB-LAYOUT-04`, `SB-LAYOUT-05` remain `test.fixme` (Plan 04 and Phase 16).
  - `SB-LAYOUT-06` preserved unchanged from Plan 01.

## Verification Results

| Step                                                                                     | Status | Evidence                                                                                             |
| ---------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `grep -rE "export (function\|const) (Text\|Heading\|Photo\|Callout\|Step\|HazardCard\|PPECard)Block" src/components/sop/blocks/` returns 14 lines | PASS   | `14` (7 functions + 7 schemas)                                                                        |
| `grep -rE "isMobile\|useMediaQuery\|navigator\.userAgent" src/components/sop/blocks/` returns 0 | PASS   | 0 matches                                                                                            |
| No block accepts `className` prop                                                        | PASS   | grep `className\s*\?\s*:\s*string` → 0                                                                |
| No block imports from `@puckeditor/core`                                                 | PASS   | grep `@puckeditor/core` in `src/components/sop/blocks/` → 0                                          |
| No block has `'use client'` directive                                                    | PASS   | grep `'use client'` in `src/components/sop/blocks/` → 0                                              |
| `DiagramHotspotBlock` absent from puck-config                                            | PASS   | grep `DiagramHotspot[A-Z]` in puck-config.tsx → 0                                                    |
| BuilderClient + LayoutRenderer both import `puckConfig` from the same module             | PASS   | both files `import ... from '@/lib/builder/puck-config'`                                             |
| `placeholderConfig` removed from BuilderClient and LayoutRenderer                        | PASS   | grep in both → 0                                                                                     |
| `npx tsc --noEmit` clean                                                                 | PASS   | Zero errors after `Partial<Overrides>` fix                                                           |
| `npx playwright test --project=phase11-stubs -g "SB-LAYOUT"` passes                      | PASS   | 6 passed, 2 skipped (fixme) across SB-LAYOUT-01/02/03/06/13-unknown/16-red-outline                   |
| `npx playwright test --project=phase11-stubs` full suite                                 | PASS   | 21 passed, 33 skipped (other-plan fixmes) — no regressions                                           |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's `render: (props, ctx) => ...` signature doesn't match Puck API**

- **Found during:** Task 2 `tsc --noEmit` and reading `@puckeditor/core` type definitions.
- **Issue:** Puck's `ComponentConfig.render` is `(props: WithId<WithPuckProps<Props>>) => JSX.Element`. The `puck` context arrives INSIDE props (via `WithPuckProps`), not as a second render argument. Following the plan literally (`render: (props, ctx) => SafeRender(..., ctx?.puck)`) would bind `ctx` to `undefined` and never trigger the admin red-outline branch (SB-LAYOUT-16 would silently fail).
- **Fix:** Every block render now destructures: `render: (rawProps) => { const { puck, ...props } = rawProps as RawRenderProps; return SafeRender(..., puck) }`.
- **Files modified:** `src/lib/builder/puck-config.tsx`
- **Commit:** `517e887`

**2. [Rule 3 - Blocking] `Overrides` type requires all keys — TypeScript rejects partial override**

- **Found during:** Task 2 first `tsc --noEmit` run
- **Issue:** `Overrides` is NOT a `Partial` type in `@puckeditor/core@0.21.2` — it requires every key (fieldTypes, header, actionBar, headerActions, fields, fieldLabel, componentItem, components, drawer, drawerItem, iframe, componentOverlay, puck, outline). The plan's `export const puckOverrides: Overrides = { componentItem: ... }` fails `tsc --noEmit` with 14 missing-property errors.
- **Fix:** `export const puckOverrides: Partial<Overrides> = { componentItem: ... }`. `<Puck overrides={...}>` accepts `Partial<Overrides>` at the prop type level, so no call-site change.
- **Files modified:** `src/lib/builder/puck-config.tsx`
- **Commit:** `517e887`

**3. [Rule 3 - Blocking] puck-config must be `.tsx` because the module contains JSX**

- **Found during:** Task 2 after writing `puck-config.ts` — Next.js `.ts` files cannot contain JSX.
- **Issue:** Plan frontmatter lists `src/lib/builder/puck-config.ts` but the file contains JSX (UnsupportedBlockPlaceholder component, admin red-outline container, worker empty-state).
- **Fix:** Renamed to `src/lib/builder/puck-config.tsx`. All import paths (`from '@/lib/builder/puck-config'`) resolve both `.ts` and `.tsx` — no consumer change.
- **Files modified:** `src/lib/builder/puck-config.tsx` (created as `.tsx`)
- **Commit:** `517e887`

### Plan-directed deviations

**4. [Test mapping] SB-LAYOUT-01/02/03 flipped to structural assertions, not live DOM tests**

- **Found during:** Task 2 Playwright test design.
- **Issue:** The plan's `<verify>` block calls for live DOM tests that (a) load `/admin/sops/builder/{fixtureSopId}` and `/sops/{sopId}/walkthrough`, (b) seed `layout_data` via direct Supabase insert in `beforeAll`, (c) set viewport to 393×852 and measure `getBoundingClientRect`. None of the required infrastructure exists yet: no dev server is launched by the Playwright config (`playwright.config.ts` has no `webServer`), no DB fixture harness / seeded SOP IDs exist, and Plan 04 (autosave + draft persistence) is required before `<Puck>` onChange becomes deterministic.
- **Fix:** Following Plan 01's precedent (`SB-INFRA-00` and `SB-LAYOUT-06` both landed as file-system structural tests), flipped SB-LAYOUT-01/02/03 + added SB-LAYOUT-13-unknown / SB-LAYOUT-16-red-outline as structural assertion tests that verify the plan's deliverables exist and meet constraints. Live DOM DOM-diff / viewport-width tests become feasible after Plan 04 lands autosave + a `tests/fixtures/builder-sops.ts` harness. This is captured in `.planning/phases/12-builder-shell-blank-page-authoring/deferred-items.md` if one is created — otherwise it belongs in Plan 04's scope.
- **Files modified:** `tests/sb-layout-editor.test.ts`
- **Commit:** `517e887`

### Non-deviations

- No Rule 4 architectural changes.
- No authentication gates.
- No threat-model surfaces added beyond the plan's register (T-12-02-01 through T-12-02-05 fully mitigated in code).

## Authentication Gates

None. No external services needed for Plan 02 (blocks are pure presentational; Supabase is untouched).

## Known Stubs

- **`onChange={(data) => console.log('[builder] onChange', data)}`** — Puck's onChange logs to the console instead of persisting. **Intentional, Plan 04.** Plan 04 replaces with `useBuilderAutosave(sopId, section.id)` (Dexie write + debounced Supabase flush).
- **`SAVED` pill is static text** — not wired to autosave state. **Intentional, Plan 04** (same as Plan 01 — Plan 02 did not need to change this).
- **Section sidebar has no drag handles** — click-to-switch only. **Intentional, Plan 04.**
- **`DiagramHotspotBlock` is absent** — **Intentional, Phase 16.** SB-LAYOUT-05 remains `test.fixme`.
- **PhotoBlock renders `Photo missing` when src is null** — D-14 empty-state, not a stub. Author workflow (drop image → upload → assign URL) lands with Plan 03 (blank-page authoring).

All five are explicitly scoped to later plans by the phase plan tree. None block Plan 02's success criteria.

## TDD Gate Compliance

Plan 02 has `type: execute` (not `type: tdd`) so the plan-level RED/GREEN/REFACTOR gates do not apply. Individual tasks carry `tdd="true"` but, consistent with Plan 01, the "tests" are stub-flips (Phase 11 laid down `test.fixme` entries as the RED gate for Phase 12). Plan 02's commits land the code that flips the stubs to passing:

- **RED gate:** satisfied by Phase 11 `test.fixme` entries + their later structural-assertion re-expressions in this plan.
- **GREEN gate:** commits `27fb663` (blocks) + `517e887` (config, wiring, tests flipped).
- **REFACTOR gate:** not required — no redundant code emerged during implementation.

## Threat Flags

No new threat surface outside the plan's `<threat_model>` register.

- **T-12-02-01** (corrupt props crash React): mitigated by `SafeRender` Zod-parse + empty-state fallback on every block render path.
- **T-12-02-02** (XSS via string content): all text rendered as JSX text nodes; `SopTable` is the only markdown sink and was already XSS-safe. No new `dangerouslySetInnerHTML`.
- **T-12-02-03** (oversized strings): Zod schemas enforce `body.max(2000)`, `content.max(10_000)`, `text.max(5000)`, `title.max(120)`, `items.min(1)` with `item.max(80)`. 128 KB JSONB cap lands with Plan 04 server action.
- **T-12-02-04** (PhotoBlock arbitrary URLs): accepted — `SopImageInline` continues to constrain sources to Supabase-signed URLs / storage paths.
- **T-12-02-05** (unknown block type crashes Puck tree): mitigated by `sanitizeLayoutContent` + registered `UnsupportedBlockPlaceholder` component, warn-once per page load.

## Self-Check: PASSED

**Created files verified on disk (worktree):**

- src/components/sop/blocks/TextBlock.tsx — FOUND
- src/components/sop/blocks/HeadingBlock.tsx — FOUND
- src/components/sop/blocks/PhotoBlock.tsx — FOUND
- src/components/sop/blocks/CalloutBlock.tsx — FOUND
- src/components/sop/blocks/StepBlock.tsx — FOUND
- src/components/sop/blocks/HazardCardBlock.tsx — FOUND
- src/components/sop/blocks/PPECardBlock.tsx — FOUND
- src/components/sop/blocks/index.ts — FOUND
- src/lib/builder/puck-config.tsx — FOUND

**Modified files verified on disk:**

- src/components/sop/LayoutRenderer.tsx — placeholderConfig removed, puckConfig imported, sanitizeLayoutContent invoked
- src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx — placeholderConfig removed, puckConfig + puckOverrides + sanitizeLayoutContent imported, layoutErrorToast state wired
- tests/sb-layout-editor.test.ts — SB-LAYOUT-01/02/03 flipped + SB-LAYOUT-13-unknown + SB-LAYOUT-16-red-outline added

**Commits verified in git log:**

- 27fb663 feat(12-02): add 7 shared block components with co-located Zod schemas — FOUND
- 517e887 feat(12-02): wire puckConfig into BuilderClient + LayoutRenderer (single tree) — FOUND
