# Phase 26: SOP Builder Redesign - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** ~24 new/modified files (grouped by wave W0–W6)
**Analogs found:** 22 / 24 (2 net-new: Konva editor, `sop_image_annotations` migration — both have partial analogs)

> This is a FULL BESPOKE editor (D-01) replacing Puck over a FROZEN `layout_data` / junction / `block_provenance` contract. ~70% of the phase is re-wiring tested infra to a new UI shell (RESEARCH). Almost every new file copies an existing analog. Every RE-WIRE/RE-IMPLEMENT file needs a **behavioural** parity test, not source-contract (CLAUDE.md 2026-06-05).

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/builder/block-registry.tsx` (NEW) | config/registry | transform | `src/lib/builder/puck-config.tsx` `components:` map (L216–795) | exact (relocate) |
| `src/lib/builder/sanitize-layout.ts` (NEW) | utility | transform | `puck-config.tsx` `sanitizeLayoutContent`+`UnsupportedBlockPlaceholder` (L80–130) | exact (relocate) |
| `src/lib/builder/content-ops.ts` (NEW) | utility (pure, NOT `'use server'`) | transform | none direct — reducer helpers; shape from `layout_data` `{content[]}` | role-match |
| `src/components/sop/LayoutRenderer.tsx` (REWRITE) | component (worker read) | request-response | itself (L1–59, drop `<Render>`) + `block-registry` | exact |
| `src/components/admin/builder-v2/EditableDocument.tsx` (NEW) | component (edit host) | event-driven | `BuilderClient.tsx` `<Puck onChange>` wiring (L77, 533) | role-match |
| `src/components/admin/builder-v2/BlockEditShell.tsx` (NEW) | component | event-driven | `puck-config.tsx` `createPuckOverrides.componentOverlay` (L970–1063) | role-match |
| `src/components/admin/builder-v2/InlineText.tsx` (NEW) | component | event-driven | 21.6 contentEditable (`fields: contentEditable:true`, puck-config L219) | partial |
| `src/components/admin/builder-v2/inserter/*` (NEW) | component | event-driven | `AddMenu.tsx` (L94–269) + `BlockPicker`/`addBlockToSection` | role-match |
| `src/components/admin/builder-v2/ghosts/*` (NEW) | component | event-driven | `sketches/sop-builder-redesign/index.html` `injectGhosts`/`refreshGhosts` | sketch-only |
| `src/components/admin/builder-v2/fields/*` (16 panels, NEW) | component | CRUD (form) | `puck-config.tsx` per-block `fields:` + `blocks.ts` `*ContentSchema` | exact (shapes) |
| `src/components/admin/builder-v2/visual/AnnotationEditor.tsx` (NEW) | component (Konva, admin-only, dynamic) | file-I/O | `.planning/research/v3.0-image-annotation.md` + `image-uploader.ts` | research-spec |
| `src/components/admin/builder-v2/visual/VisualBlock.tsx` (NEW) | component | media-grid | `PhotoGridBlock.tsx` / `StepWithPhotosBlock.tsx` | role-match |
| `supabase/migrations/00039_sop_image_annotations.sql` (NEW) | migration | CRUD | `00038_phase23_schema.sql` (RLS + append-only pattern) | exact (pattern) |
| `src/lib/validators/blocks.ts` (MODIFY) | validator | transform | itself — add `VisualBlockContentSchema` to union (L193) | exact |
| `src/actions/introspection.ts` (MODIFY) | config | transform | itself — add `VisualBlock` to `BLOCK_REGISTRY` (L71) | exact |
| `src/lib/builder/block-type-labels.ts` (MODIFY) | config | transform | itself — add `VisualBlock` entry (L36) | exact |
| `scripts/contract-check.ts` (MODIFY) | config/build-gate | transform | itself — repoint `PUCK_CONFIG` → `block-registry.tsx` (L27, L113–117) | exact |
| `src/actions/annotations.ts` (NEW) | server action | CRUD | Phase 23 admin-client actions (org self-enforce pattern) | role-match |
| `next.config.ts` (MODIFY) | config | — | itself — append `'canvas'` to `serverExternalPackages` | exact |
| `scripts/check-bundle-size.ts` + `.bundle-baseline.json` (MODIFY) | build-gate | — | itself — re-capture after Puck leaves worker path | exact |
| `playwright.config.ts` (MODIFY) | config | — | existing per-phase project regexes (e.g. `phase15-stubs`) | exact |
| `package.json` (MODIFY) | config | — | itself — add @dnd-kit/*, konva, react-konva | exact |

---

## Pattern Assignments

### `src/lib/builder/block-registry.tsx` (NEW) — the renderer "place"
**Analog:** `src/lib/builder/puck-config.tsx` `components:` map, L216–795.
Each of the 18 block entries today is `{ fields, defaultProps, render }`. The bespoke registry keeps `defaultProps` and the `type → component` mapping, DROPS Puck `fields`/`render`. The per-block `SafeRender(<Schema>, <Component>, props, ...)` guard (L226–233) moves into `BlockEditShell`/`LayoutRenderer` unchanged.
```tsx
// puck-config.tsx L216–221 (the shape to distil):
components: {
  TextBlock: {
    fields: { content: { type: 'textarea', contentEditable: true } },
    defaultProps: { content: 'Text content…' } satisfies TextBlockProps,
    render: (rawProps) => { /* SafeRender(TextBlockPropsSchema, TextBlock, props, …) */ },
```
Distil to:
```tsx
// block-registry.tsx
import * as Blocks from '@/components/sop/blocks'
export const BLOCK_COMPONENTS = { TextBlock: Blocks.TextBlock, /* …18 total… */ } as const
export const BLOCK_DEFAULTS = { TextBlock: { content: 'Text content…' }, /* … */ } as const
```
`src/components/sop/blocks/index.ts` already barrel-exports all 18 components (verified). `contract-check.ts` MUST be repointed here (see below).

### `src/lib/builder/sanitize-layout.ts` (NEW) — P17 relocate
**Analog:** `puck-config.tsx` L80–130 — `UnsupportedBlockPlaceholder` (L82) + `sanitizeLayoutContent` (L106) which rewrites unknown types to `{ type: 'UnsupportedBlockPlaceholder' }` (L116). Move VERBATIM; swap the known-type check from the Puck components map to `BLOCK_COMPONENTS`. Both new read (`LayoutRenderer`) and edit (`EditableDocument`) paths import from here.

### `src/components/sop/LayoutRenderer.tsx` (REWRITE) — R2, worker read, drops Puck
**Analog:** itself, L1–59. Replace L2 `import { Render } from '@puckeditor/core'` and L58 `<Render config={puckConfig} data={…} />` with a `type→component` switch. KEEP the version gate (L25–34), `LayoutDataSchema.safeParse` (L36), warn-once flags (L9), and `sanitizeLayoutContent` call (L49–54) exactly.
```tsx
const items = sanitizeLayoutContent(parsed.data.content ?? [])
return items.map((it) => {
  const C = BLOCK_COMPONENTS[it.type as keyof typeof BLOCK_COMPONENTS]
  return C ? <C key={it.props.id} {...stripMeta(it.props)} /> : <UnsupportedBlockPlaceholder type={it.type} />
})
```
`stripMeta` drops `id`/`junctionId`/`block_provenance` before spread. **This removes `@puckeditor/core` from the worker bundle** → re-capture `.bundle-baseline.json`.

### `src/components/admin/builder-v2/EditableDocument.tsx` (NEW) — P11 autosave re-wire
**Analog:** `BuilderClient.tsx` L77 `const handleChange = useBuilderAutosave(activeSectionId, sopId)` and L533 `<Puck onChange={handleChange}>`. The reducer replaces `<Puck>`; on `content[]` change it calls the SAME hook:
```tsx
// useBuilderAutosave (unchanged) — takes any { content, root }, debounces 750ms → Dexie:
useEffect(() => { handleChange({ content, root }) }, [content])
```
`useBuilderAutosave.ts` (L14–36) types its arg as Puck `Data` but only reads `.content`/`.root` — the bespoke reducer produces the identical shape, hook UNCHANGED (RESEARCH A4). **Pitfall 7 (RESEARCH):** reducer `update` MUST be `{ ...prevProps, ...changedFields }` — never reconstruct props, or `junctionId`/`block_provenance` drop.

### `src/components/admin/builder-v2/BlockEditShell.tsx` (NEW) — P12/P13/P9 re-wire
**Analog:** `puck-config.tsx` `createPuckOverrides` (L874) / `componentOverlay` (L970–1063) + `BuilderClient.tsx` selection wiring L251–313.
- **P12 selection-sync:** shell fires on focus, resolving region from the existing `junctionMap` `useMemo`:
  ```tsx
  // BuilderClient L280 (portable): setActiveProvenance(region, junctionId)
  // reverse: registerBlockClickHandler → query [data-block-id="…"] (BuilderClient L289–313)
  ```
  `useSelectionSync` context (`src/components/admin/source-viewer/useSelectionSync.tsx`) is UNCHANGED — only the caller moves. Shell renders `data-block-id={item.props.id}`.
- **P13 AI-flag overlay:** REUSE `PuckItemBadgeOverlay` + `ReviewerFlagsPanel` as-is, keyed off the portable `componentIdToJunction` map (`BuilderClient.tsx` L203). `BuilderClient` L410–414 shows the inline panel render: `<ReviewerFlagsPanel sopId={sopId} blockId={junctionId} />`.
- **P9 orphan-image chip:** re-implement the `startsWith('Unanchored figures')` chip on Heading blocks (per `componentIdToProps`, BuilderClient L225).

### `src/components/admin/builder-v2/inserter/*` (NEW) — R3 tiered inserter
**Analog:** `AddMenu.tsx` (L94–269) for the humanised grouped menu + pill styling (`getPillStyle` L32, `humanizeBlockType` L200); reuse the `onInsert(componentType)` callback contract (L20–27). For the **Reuse tier**, reuse the existing `BlockPicker` + `addBlockToSection` path — `BuilderClient.tsx` L24–26, L329–351 (`handleLibraryAdd`) — do NOT rebuild. Tier-1 "Fits here" keys off `SECTION_RENDER_FAMILIES` (`introspection.ts` L60: `hazard|ppe|steps|content|signoff|emergency|custom`). Keyboard nav (↑↓/↵/esc) + `LANE`/`SMART`/`GROUPS`/`LIB` model come from `sketches/sop-builder-redesign/index.html` `renderPicker`/`filterPicker` (~120 lines, port verbatim, no library).

### `src/components/admin/builder-v2/ghosts/*` (NEW) — R4 smart ghosts
**Analog:** sketch `injectGhosts`/`refreshGhosts` only. Rules: ghost after block *i* iff `SMART[type(i)]` exists AND `type(i+1) !== predictedType`; one live near viewport, others `.dim`, scrolled-past `.gone`; Tab accepts; typing `.gone`s all but the next. **Anti-pattern (RESEARCH):** rAF-throttled class toggle on refs — NEVER re-render the document on scroll.

### `src/components/admin/builder-v2/fields/*` (16 panels, NEW) — P14 RE-IMPLEMENT
**Analog (shapes):** `puck-config.tsx` per-block `fields:` (the exact reachability checklist — e.g. HeadingBlock L239–247 `text` + `level` select) + `blocks.ts` `*ContentSchema` (the write-boundary validation — reuse as each panel's Zod). Map to UI-SPEC's 5 patterns (A inline-CE / B enum-chip / C anchored-panel / D inline-token / E media-grid). Field shapes verified in `blocks.ts`:
- Measurement `unit`+`tolerance{min,max,target}`+`voiceEnabled`+`hint` (L39–52) → D + C + B.
- Decision `options[]{label,nextStepId?,isEscalation?}` min 2 (L54–66) → C.
- Inspect `items[]{label,requirePhoto}` (L94–105) → C.
- Escalate `escalationMode`+`recipients[]` (L68–76) → B + C.
- SignOff `requiredRole` enum (L78–85) → B; Zone `zoneType` enum (L87–92) → B; VoiceNote `language`+`maxDurationSec` (L107–112) → B + D.
**Ponytail:** each panel = minimum inputs matching its Zod, NOT a mini-form-framework. Reuse react-hook-form only for the real array fields (Decision/Inspect). Parity acceptance: **0 unreachable fields per block** (P14).

### `src/components/admin/builder-v2/visual/*` (NEW) — R5 / D-03 Konva
**Analog:** `.planning/research/v3.0-image-annotation.md` + ROADMAP §Phase 17 (3 slices, reuse verbatim); `image-uploader.ts` + `sign-layout-data-images.ts` for storage/signing; `PhotoGridBlock.tsx`/`StepWithPhotosBlock.tsx` for the media-grid render. Rules: `dynamic(() => import('.../AnnotationEditor'), { ssr:false })`, `'use client'`, admin-only. Bake-on-publish: `stage.toDataURL()` → `sop-images/baked/{sop}/{image}.v{N}.png`. **HARD: Konva absent from `/sops/[sopId]` manifest** (bundle gate + no-static-import lint). **Day-1 spike** Konva-in-Next-16 (A2, MEDIUM confidence).
**Convert-safety (A3):** render legacy `PhotoBlock`/`PhotoGridBlock`/`StepWithPhotosBlock` *through* the Visual component; do NOT transform `layout_data` kinds at parse time (preserves R6 byte-equivalence).

### `supabase/migrations/00039_sop_image_annotations.sql` (NEW)
**Analog:** `00038_phase23_schema.sql` L48–80. Copy the append-only + RLS pattern EXACTLY:
```sql
alter table public.sop_image_annotations enable row level security;
create policy "sop_image_annotations_org_read" on public.sop_image_annotations
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
-- NO authenticated INSERT/UPDATE/DELETE — writes via createAdminClient() in server action.
-- CRITICAL: NO cross-table reference to public.sops → avoids 42P17 recursion (CLAUDE.md 2026-05-13).
```
Columns: `scene jsonb`, `natural_width/height int`, `baked_storage_path text`, `baked_at timestamptz`, `organisation_id uuid` FK, indexes on `organisation_id`.

### `src/actions/annotations.ts` (NEW) — save-annotation server action
**Analog:** Phase 23 admin-client actions (per 00038 header comment). Service-role write MUST self-enforce `row.organisation_id === caller.orgId` + `.eq('organisation_id', …)` (CLAUDE.md 2026-06-15/26). Read org from `parseJwtPayload` (`src/lib/supabase/jwt.ts`), NEVER `atob` (CLAUDE.md 2026-06-26). Must be `'use server'` async-only — no pure/sync exports (2026-06-27).

### `scripts/contract-check.ts` (MODIFY) — load-bearing repoint
**Analog:** itself. L27 `const PUCK_CONFIG = …puck-config.tsx` → point at `block-registry.tsx`; L113–117 `extractPuckComponentKeys` greps `components:\s*{` → adapt to the registry's `BLOCK_COMPONENTS` object. Add `VisualBlock` across all 3 places + `BLOCK_TYPE_LABELS`. **Pitfall 1 (RESEARCH):** if not repointed, the gate silently checks a dead file. Add a W0 test asserting the script's target file matches the live registry path.

### `src/lib/validators/blocks.ts` / `introspection.ts` / `block-type-labels.ts` (MODIFY) — VisualBlock 3-place + label
**Analogs:** each file itself. Add `VisualBlockContentSchema` (`kind: 'visual'`, `items[]{medium,src,alt,caption,annotationId?}`) to the discriminated union (`blocks.ts` L193); add `VisualBlock` entry to `BLOCK_REGISTRY` (`introspection.ts` L71, copy the `{ schema, description, example }` shape); add `VisualBlock` to `BLOCK_TYPE_LABELS` (`block-type-labels.ts` L36) + `SLUG_TO_KEY` (L61). This is the 5-edit contract (3-place + label + contract-check).

---

## Shared Patterns

### Autosave (P11) — the single change sink
**Source:** `src/hooks/useBuilderAutosave.ts` (L14–36) — debounced Dexie `draftLayouts.put`, `syncState:'dirty'`; `useDraftLayoutSync` flushes.
**Apply to:** `EditableDocument` (all edit affordances funnel through one `handleChange({content,root})`). No new persistence path (constraint).

### Frozen-contract stamping (P4/P15/R7)
**Source:** `layout_data` items = `{ type, props:{ id, junctionId?, block_provenance?, ...fields } }`; `blocks.ts` `*ContentSchema` at write boundary.
**Apply to:** every reducer op in `content-ops.ts` — spread-merge props, round-trip ALL unknown keys losslessly (R7 agent hook). Never drop `junctionId`/`block_provenance`.

### Humanised labels (P16)
**Source:** `block-type-labels.ts` `humanizeBlockType` (L96) — single label source, never echoes raw PascalCase.
**Apply to:** inserter, edit-shell type labels, field panels. (`AddMenu.tsx` L200 shows correct use.)

### Selection-sync context (P12)
**Source:** `useSelectionSync.tsx` — `setActiveProvenance` / `registerBlockClickHandler`; component UNCHANGED.
**Apply to:** `BlockEditShell` (forward on focus) + source `[data-block-id]` reverse binding.

### Service-role org-scope + JWT (security)
**Source:** 00038 header + `src/lib/supabase/jwt.ts` `parseJwtPayload`.
**Apply to:** `annotations.ts` and any new endpoint — self-enforce org on service-role writes; `parseJwtPayload` not `atob`.

### Test registration (all new specs)
**Source:** existing per-phase project regexes in `playwright.config.ts`.
**Apply to:** register a `phase26-stubs` (+ per-domain) project or specs never run (CLAUDE.md 2026-05-25). Every RE-WIRE/RE-IMPLEMENT gets a **behavioural** test (edit→Dexie row; select→setActiveProvenance fired; unverified→publish 400), not source-contract (2026-06-05).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `visual/AnnotationEditor.tsx` (Konva canvas + primitives + transformer/undo) | component | file-I/O | No canvas/Konva code in repo — spec'd fully by `.planning/research/v3.0-image-annotation.md` (carry verbatim); day-1 Next-16 spike (A2) |
| `ghosts/*` (smart-next prediction/dismiss) | component | event-driven | Novel interaction; encoded only in the validated sketch (`injectGhosts`/`refreshGhosts`) — port sketch JS, no code analog |

---

## Metadata

**Analog search scope:** `src/lib/builder/`, `src/components/sop/blocks/`, `src/components/admin/{builder,source-viewer,ai-reviewer,blocks}/`, `src/hooks/`, `src/actions/`, `src/lib/validators/`, `scripts/`, `supabase/migrations/`.
**Files scanned:** ~18 (LayoutRenderer, puck-config, block-type-labels, contract-check, useBuilderAutosave, blocks.ts, AddMenu, BuilderClient, introspection, 00038 migration, blocks dir listing, source-viewer dir).
**Pattern extraction date:** 2026-07-03

---

## PATTERN MAPPING COMPLETE

**Phase:** 26 - sop-builder-redesign
**Files classified:** 24
**Analogs found:** 22 / 24

### Coverage
- Files with exact/relocate analog: 14
- Files with role-match / shape analog: 8
- Files with no code analog (spec/sketch only): 2 (Konva editor, ghosts)

### Key Patterns Identified
- **`layout_data` is Puck-agnostic JSON** — replacing Puck = a `type→component` registry (`block-registry.tsx` from `puck-config.tsx` L216–795) + a `content[]` reducer feeding the UNCHANGED `useBuilderAutosave`.
- **Re-wire, don't rebuild** — `useSelectionSync`, `ReviewerFlagsPanel`, `PuckItemBadgeOverlay`, `VerifyChecklistGate`, `BlockPicker`/`addBlockToSection`, `humanizeBlockType`, `sanitizeLayoutContent` all reused as-is; only their caller moves off Puck.
- **16 field panels = existing Zod shapes** (`blocks.ts` `*ContentSchema`) rendered as 5 UI patterns; reachability checklist = `puck-config.tsx` `fields:` maps.
- **Konva/migration/annotation** carry Phase 17 research verbatim; `00039` migration copies the `00038` append-only + RLS (no cross-table, service-role write) pattern.
- **Load-bearing migration edit:** repoint `contract-check.ts` (L27) off `puck-config.tsx` or the build gate checks a dead file.

### File Created
`.planning/phases/26-sop-builder-redesign/26-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference analog file:line per new/modified file, gate each RE-WIRE/RE-IMPLEMENT on a behavioural parity test, and sequence W0–W6 per RESEARCH.
