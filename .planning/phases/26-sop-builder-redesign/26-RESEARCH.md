# Phase 26: SOP Builder Redesign — Research

**Researched:** 2026-07-03
**Domain:** Bespoke inline block-document editor (React 19 / Next.js 16) over a frozen `layout_data` JSON contract + Konva image annotation
**Confidence:** HIGH on the contract/re-wiring surface (verified in-repo); MEDIUM on new-dependency choices (dnd-kit) and Konva-in-Next-16 (carried from Phase 17 research, needs a day-1 spike)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Editing engine: FULL BESPOKE (Puck removed).** Build a bespoke inline canvas that renders blocks with the *same components as the worker view*, plus a bespoke editor for every one of the 16 block types' structured fields. No Puck field components retained. `layout_data` JSON / `sop_section_blocks` junctions / `block_provenance` are FROZEN — the bespoke editor reads/writes identical shapes. The 3-place AI contract survives (`BLOCK_REGISTRY` + Zod + `/api/schema`); only the "renderer" place moves off `puck-config.tsx`. Highest effort/risk chosen deliberately; planner MUST gate every RE-WIRE/RE-IMPLEMENT item on **behavioural parity tests** (not source-contract).
- **D-02 — Agent-metadata layer: SPLIT to Phase 26.5.** This phase ships R1–R6 + R8 (the builder) and exposes only the metadata **contract hooks**: the editor must not block per-SOP/per-block machine-readable access and must preserve/emit block type + medium tags (R5) + provenance. Memory/learning/review/embeddings/graph traversal + `⚇ Agent layer` surfacing → 26.5.
- **D-03 — Visual block: PULL PHASE 17 FORWARD (full Konva annotation).** Visual holds/tags/displays photo · diagram · video (each `visual:photo|diagram|video`), AND includes the full Konva diagram-annotation editor from the deferred Phase 17 plan. Absorb Phase 17's three slices verbatim (Konva foundation → primitives → bake-on-publish). **HARD CONSTRAINT: workers NEVER download Konva** — worker read path loads a baked flattened PNG via `<img>`; Konva is admin-only + dynamic-imported. `DiagramHotspotBlock` (numbered callouts at freeform x/y) is the only freeform-positioning exception. Reconcile with existing `ModelBlock` (3D) during planning; not blocking. Mark Phase 17 ABSORBED in ROADMAP.
- **D-04 — Milestone: OPEN v5.0.** Archive v4.0 first, then Phase 26 opens v5.0, followed by 26.5.

### Claude's Discretion
- Wave/slice breakdown of this (large) phase — expected shape: W0 bespoke render+edit of existing blocks; W1 tiered inserter + ghosts; W2 re-wire autosave/provenance-sync/AI-overlays/verify-UI with parity tests; W3 Visual + Konva; W4 convert-golden-path parity + publish-gate regression. (A concrete recommendation is in `## Wave Sequencing` below.)
- Exact bespoke field-editor UX per block type (inline vs anchored panel) — discretion, provided no field editable under Puck becomes unreachable.
- 3D `ModelBlock` disposition (keep separate vs fold into Visual as `visual:3d`).

### Deferred Ideas (OUT OF SCOPE)
- **Phase 26.5** — full agent-metadata layer (memory/learning/review/embeddings/cross-SOP traversal + surfacing). This phase wires contract hooks only.
- **3D `ModelBlock` disposition** — decide in planning, not blocking.
- **Full-bespoke migration cleanup** — remove the `@puckeditor/core` dependency entirely once all 16 field editors are re-implemented + parity-tested (may trail into a cleanup slice).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R1 | One surface, three on-ramps (create/convert/edit) | Single `BuilderClient` already reached by all three today; convert seeds from parse pipeline unchanged. On-ramps are routing, not editor variants — see `## Architecture Patterns → On-ramps`. |
| R2 | Inline WYSIWYG: edit == worker render | Build ONE `BlockRenderer` mapping `content[].type → src/components/sop/blocks/*`; worker read path uses `mode="read"`, edit canvas `mode="edit"`. Removes Puck from BOTH paths. See `## Architecture Patterns → The single renderer`. |
| R3 | Tiered, context-aware inserter | Sketch already encodes the full data model (`LANE`, `SMART`, `GROUPS`, `LIB`). Port to React + a headless command-menu pattern. See `## Architecture Patterns → Inserter`. |
| R4 | Smart-next auto-dismissing ghosts | Sketch encodes the exact suppress/dismiss rules (predicted-follows → quiet; scroll-past → gone; type-elsewhere → gone; one live near viewport). See `## Architecture Patterns → Ghosts`. |
| R5 | Unified Visual block (photo·diagram·video) | New block type = 3-place contract (renderer + `BLOCK_REGISTRY` + Zod) + label map + `contract-check.ts` update. Convert images map to `visual:photo` retaining `block_provenance`. See `## Visual + Konva`. |
| R6 | Pipeline spine preserved (P1–P18) | Frozen contract confirmed in-repo; every P-item dispositioned in `## Re-wiring the Spine`. Golden-path parity test defined in `## Validation Architecture`. |
| R7 | Agent-metadata contract hooks only | Editor must round-trip unknown `props` keys losslessly and keep emitting type + medium + provenance tags. Contract-only; surfacing is 26.5. See `## Re-wiring the Spine → P15/R7 hook`. |
| R8 | No regression to safety/autosave/offline/gates | Publish gate (server 400), no-bulk-verify lint guard, junctionId stamping, autosave/offline, AI overlays, append-only worker records all continue. See `## Validation Architecture` + `## Common Pitfalls`. |
</phase_requirements>

## Summary

The entire risk of this phase is concentrated in one fact that the codebase makes unusually favourable: **`layout_data` is a plain, framework-agnostic JSON shape** — `{ content: PuckItem[], root: { props } }` where each item is `{ type: string, props: { id, junctionId?, block_provenance?, ...fields } }`. Puck is not the data model; Puck is only a renderer+editor that happens to consume this shape. The parse pipeline, Zod validators, junction materialisation, AI reviewer, verify-checklist and publish gate all speak this JSON and **never import Puck**. That means "replace Puck" reduces to: (1) build a renderer that maps `type → component`, (2) build edit affordances that mutate the `content[]` array and emit change events, (3) re-wire four UI-level bindings Puck currently gives for free (autosave onChange, selection→source-viewer, AI-flag overlay, structured-field editors).

The decisive architectural move for R2 is to build **one renderer used by both the worker read path and the admin edit canvas** — `LayoutRenderer.tsx` today calls Puck's `<Render>`, so **workers currently download `@puckeditor/core`**. Replacing it with a bespoke `type→component` switch makes "edit == worker render" literally true (same code path, `mode` flag differs) AND removes Puck from the worker bundle — turning the SB-LINE bundle discipline from a constraint into a win. The 16 block components in `src/components/sop/blocks/*` are already pure presentational React (typed props in, JSX out); the bespoke renderer wraps each in an edit shell (hover tools, contentEditable text, anchored field panel for structured fields) without touching the components themselves.

Two new dependency families are warranted and no more: **@dnd-kit** (sortable list reorder with keyboard + touch a11y) and **konva + react-konva** (diagram annotation, carried verbatim from Phase 17 research). The inserter, ghosts, and all 16 field editors are hand-built React over existing state — the sketch already proves the interaction model and encodes the data (`LANE`/`SMART`/`GROUPS`/`LIB`). No headless-menu library, no rich-text framework, no form library beyond the existing react-hook-form/Zod is needed.

**Primary recommendation:** Build a single `BlockRenderer(mode)` over `layout_data`; drive edits through a controlled `content[]` reducer whose changes feed the *existing* `useBuilderAutosave` hook; re-wire selection/overlay/verify off the reducer's selection + junction maps (all already computed in `BuilderClient`); add @dnd-kit for reorder and konva (admin-only, dynamic) for the Visual diagram medium. Gate every re-wired binding on a behavioural parity test and a byte-equivalent convert golden-path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Block render (read + edit) | Browser / Client (`'use client'` renderer) | — | Same components serve worker read + admin edit; must run client-side (contentEditable, dnd, konva) |
| Inline text edit | Browser / Client | — | contentEditable + local state; NEVER `router.push` on keystroke (CLAUDE.md 2026-05-13) |
| Structured-field edit (16 types) | Browser / Client | API (validate on autosave) | Bespoke panels mutate `content[]`; Zod re-validates at the write boundary |
| Autosave draft | Browser (Dexie) | API (`/api/sops/[sopId]/draft-layouts`) | Existing offline-first path; editor only feeds it change events |
| `layout_data` persistence + junctions | Database / Storage | API / Server actions | FROZEN; parser + `materializeJunctionsForLayout` own writes; editor never touches junction rows directly |
| Provenance highlight sync | Browser / Client | — | Pure client selection↔DOM binding; source-viewer already dynamic-imported admin-only |
| AI-flag overlay + verify UI | Browser / Client | API (flags/verify state) | Overlay reads junction rows fetched server-side; verify writes go through existing server gate |
| Publish gate | API / Backend | Database | Server 400 `unverified_blocks` is authoritative; UI only disables the button |
| Diagram annotation (Konva) | Browser / Client (admin-only, dynamic) | Storage (baked PNG) | Konva runs in admin browser; worker reads a baked `<img>` — Konva NEVER enters worker tier |
| Bake-on-publish PNG | Browser (client `toDataURL`) | Storage / API | Admin browser is on the page at publish; upload baked PNG to `sop-images/baked/...` |
| Schema introspection (`/api/schema`) | API / Backend | — | KEEP unchanged; `BLOCK_REGISTRY` is the AI-facing source of truth |

## Standard Stack

### Core (already installed — the editor sits on these)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.2.4 | Renderer + edit state | Project baseline |
| next | 16.2.1 (App Router, `--webpack`) | Routing, RSC boundaries | Project baseline |
| zod | ^4.3.6 | `BlockContentSchema`, `LayoutDataSchema`, `BlockProvenanceSchema` — the write-boundary guard | Already the validation contract; the bespoke editor writes the SAME validated shapes |
| dexie | ^4.3.0 | `db.draftLayouts` offline autosave store | Existing autosave path (P11) — do NOT add a new persistence path |
| zustand | ^5.0.12 | `network` store (online/offline pill) | Existing |
| react-hook-form + @hookform/resolvers | ^7.72 / ^5.2 | Optional for complex field panels (Decision/Inspect arrays) | Already present; reuse rather than hand-roll array-field state where it helps |
| lucide-react | ^1.0.1 | Icons for tools/inserter | Existing icon set |

### Supporting (NEW — justified additions)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | 6.3.1 | Pointer/keyboard drag sensors | Block reorder within a section + section reorder in the rail |
| @dnd-kit/sortable | 10.0.0 | Vertical sortable list preset | The block list is a single vertical sortable — this is its exact use case |
| @dnd-kit/modifiers | 9.0.0 | `restrictToVerticalAxis` | Keep reorder to a clean vertical axis (block reflow, no free drag) |
| konva | 10.3.0 | Canvas annotation primitives (Arrow/Rect/Ellipse/Text/Label/Line) | Visual → diagram medium editor ONLY (admin, dynamic import) |
| react-konva | 19.2.5 | React bindings for Konva (peer `react ^19.2.0` ✓ matches 19.2.4) | Same — admin-only, `dynamic(() => import(...), { ssr: false })` |

**Do NOT add:** any rich-text framework (Slate/Lexical/TipTap) — text blocks are single-field `contentEditable`, not documents; any headless-menu lib (cmdk/Downshift) — the inserter is ~120 lines of the sketch already; any new form lib — react-hook-form is present.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | Native HTML5 drag-and-drop (0 deps) | Native DnD has no keyboard a11y, janky touch, and no drop-animation; the admin builder is desktop-first but reorder-heavy — @dnd-kit (~12KB gz, admin-only) is the standard and gives keyboard reorder for free |
| @dnd-kit | Puck's drag (status quo) | Rejected by D-01; Puck is being removed |
| konva | Excalidraw / Fabric / custom SVG | Decided in Phase 17 research (`.planning/research/v3.0-image-annotation.md`): Konva is MIT, has every primitive, clean JSON scene, React bindings, stylus support; tldraw is license-blocked; Excalidraw aesthetic is wrong; custom SVG re-builds a transformer. **Carry forward, do not re-derive.** |
| Bespoke text edit | contentEditable + single field | Confirmed: block text is one field (`text`/`content`/`body`), not multi-paragraph rich text — plain contentEditable with on-blur commit is correct |

**Installation:**
```bash
npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/modifiers@9.0.0 konva@10.3.0 react-konva@19.2.5
```

## Package Legitimacy Audit

> slopcheck was not run in this session (Python tool unavailable in the Windows/Git-Bash environment). Per protocol, the NEW packages are tagged `[ASSUMED]` and the planner MUST gate each install behind a `checkpoint:human-verify` task. Registry existence + peer-dep sanity were verified via `npm view`.

| Package | Registry | Latest | Peer sanity | Provenance | Disposition |
|---------|----------|--------|-------------|-----------|-------------|
| @dnd-kit/core | npm | 6.3.1 | react >=16.8 ✓ | [ASSUMED] — known via training, registry-confirmed | Approved pending checkpoint |
| @dnd-kit/sortable | npm | 10.0.0 | @dnd-kit/core ^6.3 ✓ | [ASSUMED] | Approved pending checkpoint |
| @dnd-kit/modifiers | npm | 9.0.0 | @dnd-kit/core ^6.3 ✓ | [ASSUMED] | Approved pending checkpoint |
| konva | npm | 10.3.0 | standalone | [CITED: `.planning/research/v3.0-image-annotation.md`] | Approved (carried from Phase 17) |
| react-konva | npm | 19.2.5 | react ^19.2.0 ✓ (project 19.2.4) | [CITED: Phase 17 research] | Approved (carried from Phase 17) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged [SUS]:** none — all five are high-download, established, MIT. Planner should still insert one `checkpoint:human-verify` before the install task per the graceful-degradation rule.
**Postinstall check (Node):** none of the five declare a network/filesystem `postinstall` (dnd-kit and konva are build-free libs); verify with `npm view <pkg> scripts.postinstall` at install time.

## Architecture Patterns

### System Architecture Diagram

```
                 ┌─────────────────────────────────────────────────────────┐
  three on-ramps │  /admin/sops/new  ─┐                                     │
  (R1 = routing) │  /admin/sops/parse ─┼──►  seed layout_data in sop_sections│
                 │  /admin/sops/builder/[sopId] (edit) ─┘   (parser UNCHANGED)│
                 └───────────────────────────────┬─────────────────────────┘
                                                 │ reads layout_data JSON
                                                 ▼
                          ┌──────────────────────────────────────────┐
                          │  BlockRenderer(content, mode)             │  ◄── ONE renderer
                          │  type → src/components/sop/blocks/*       │      (R2)
                          └───────┬───────────────────────┬──────────┘
                    mode="read"   │                        │  mode="edit"
                          ▼        │                        ▼
             worker walkthrough    │          ┌──────────────────────────────┐
             (baked <img>, NO      │          │ EditShell per block:         │
              Puck, NO Konva)      │          │  • hover tools (dup/delete)   │
                                   │          │  • contentEditable text       │
                                   │          │  • FieldPanel (16 types)      │
                                   │          │  • dnd-kit grip (reorder)     │
                                   │          │  • Visual→Konva (dynamic)     │
                                   │          └───────┬──────────────────────┘
                                   │                  │ mutate content[] (reducer)
                                   │                  ▼
    ┌───────────── change event ──┴───────────────────────────────┐
    ▼                    ▼                     ▼                    ▼
 useBuilderAutosave  useSelectionSync   AI-flag overlay      per-block verify UI
 (P11 RE-WIRE)       (P12 RE-WIRE)      (P13 RE-IMPLEMENT)   (P8 RE-IMPLEMENT)
    │                    │                     │                    │
    ▼                    ▼                     ▼                    ▼
 Dexie→Supabase     SourceViewerPane   junction rows        server publish gate
 (UNCHANGED)        (UNCHANGED)        (UNCHANGED)          (400 unverified_blocks, KEEP)
```

### Recommended Project Structure
```
src/
├── components/sop/
│   ├── LayoutRenderer.tsx           # REWRITE: type→component switch, mode="read" (worker) — drops <Render>
│   └── blocks/*                     # UNCHANGED presentational components (the shared surface)
├── components/admin/builder-v2/     # NEW bespoke edit surface (admin-only, isolated for bundle discipline)
│   ├── EditableDocument.tsx         # controlled content[] host; owns the reducer + dnd context
│   ├── BlockEditShell.tsx           # per-block hover tools + selection + grip
│   ├── InlineText.tsx               # contentEditable field, commit-on-blur, NO router.push
│   ├── inserter/                    # tiered command menu (R3): LANE/SMART/GROUPS/LIB ported from sketch
│   ├── ghosts/                      # smart-next predictions (R4)
│   ├── fields/                      # 16 structured field panels (P14 RE-IMPLEMENT)
│   └── visual/                      # Visual block + Konva editor (dynamic, admin-only) (R5/D-03)
├── lib/builder/
│   ├── block-registry.tsx           # NEW single source: type → { component, defaultProps, editSchema } (replaces puckConfig.components)
│   ├── sanitize-layout.ts           # MOVE sanitizeLayoutContent + UnsupportedBlockPlaceholder off puck-config (P17)
│   └── content-ops.ts               # pure insert/duplicate/delete/reorder/stampProvenance helpers (non-'use server')
```

### Pattern 1: The single renderer (R2)
**What:** Replace Puck's `<Render>`/`<Puck>` with a `type→component` switch driven by a plain registry.
**Why it's safe:** `layout_data.content[]` items already carry `{ type, props }`; the 16 components already accept exactly those props. `LayoutRenderer.tsx` is 59 lines and the only worker consumer (`SectionContent.tsx`).
```tsx
// src/lib/builder/block-registry.tsx  — the renderer "place" (was puckConfig.components)
import * as Blocks from '@/components/sop/blocks'
export const BLOCK_COMPONENTS = {
  StepBlock: Blocks.StepBlock, HazardCardBlock: Blocks.HazardCardBlock, /* …16 total… */
} as const
// Source: derived from src/lib/builder/puck-config.tsx components map (verified in-repo)

// LayoutRenderer read path — no Puck, worker-safe
export function LayoutRenderer({ layoutData, ... }) {
  const parsed = LayoutDataSchema.safeParse(layoutData)
  if (!parsed.success) return <>{fallback}</>
  const items = sanitizeLayoutContent(parsed.data.content ?? [])
  return items.map((it) => {
    const C = BLOCK_COMPONENTS[it.type as keyof typeof BLOCK_COMPONENTS]
    return C ? <C key={it.props.id} {...stripMeta(it.props)} /> : <UnsupportedBlockPlaceholder type={it.type} />
  })
}
```
**Note:** `stripMeta` drops `id`/`junctionId`/`block_provenance` before spreading (they aren't component props). The same `SafeRender` Zod-guard logic in `puck-config.tsx` (per-block `safeParse` → empty state) moves into the shell unchanged.

### Pattern 2: Controlled `content[]` reducer feeding the existing autosave (P11)
**What:** Edit affordances dispatch `insert/update/delete/reorder` against the active section's `content[]`; a single effect emits `{ content, root }` into the *existing* `useBuilderAutosave(sectionId, sopId)` callback.
**Why:** `useBuilderAutosave` takes a Puck `Data` object and debounces to Dexie. Its input is just `{ content, root }` — the bespoke reducer produces the identical shape, so the hook is unchanged (only its caller changes from `<Puck onChange>` to the reducer effect).
```tsx
// content-ops.ts (pure, NOT 'use server')
export function insertBlock(content, type, afterIndex, defaults) { /* splice a fresh {type, props:{id:uuid(), ...defaults}} */ }
export function stampProvenance(props, region, runId, ver) { return { ...props, block_provenance: { region, parser_run_id: runId, parser_version: ver } } }
// EditableDocument dispatches these, then:
useEffect(() => { handleChange({ content, root }) }, [content])  // handleChange = useBuilderAutosave(...)
```

### Pattern 3: Tiered context-aware inserter (R3)
The sketch already encodes the complete model — port it verbatim to React:
- `LANE[sectionType] → blockTypes[]` (Tier-1 "Fits here"), keyed by section render-family (`hazard|ppe|steps|content|signoff|emergency|custom` — the existing `SECTION_RENDER_FAMILIES` enum in `introspection.ts`).
- `SMART[prevBlockType] → { predictedType, why }` (Tier-0 smart row + ghost source).
- `GROUPS` (Tier-2 full catalog) and `LIB`/`SNIP` (Tier-3 reuse) — reuse the existing **Phase 13 `BlockPicker`** + `addBlockToSection` path for department-scoped library reuse (already wired in `BuilderClient`), so the "Reuse" tier is not rebuilt.
- Keyboard nav (`↑↓/↵/esc`) + type-to-filter are ~30 lines (sketch `renderPicker`/`filterPicker`/keydown). No library.
**Real-code hooks:** section type comes from `activeSection` (render family); "preceding block" is the item at `insertAfterIndex` in `content[]`; department scope comes from `initialSop.category_tag` + the org, exactly as `BlockPicker` already consumes.

### Pattern 4: Smart-next ghosts (R4)
Port the sketch's `injectGhosts`/`refreshGhosts` rules into a React hook driven by `content[]` + a scroll listener (rAF-throttled):
- A ghost renders after block *i* iff `SMART[type(i)]` exists AND `type(i+1) !== predictedType` (self-suppress when redundant).
- Exactly one ghost is "live" (nearest viewport center); others `dim`; ghosts scrolled above `bottom < 64px` become `gone` permanently.
- `Tab` accepts the live ghost; typing inside a block marks all ghosts except the one immediately after it `gone`.
**Anti-pattern warning:** do NOT reconcile ghost visibility through React state on every scroll frame — use a rAF-throttled class toggle on refs (sketch does exactly this) to avoid re-rendering the document on scroll.

### Anti-Patterns to Avoid
- **`router.push('?step=…')` / search-param writes on any hot edit path** — CLAUDE.md 2026-05-13: use `useState` + `window.history.replaceState`. The editor's selection/active-section state must be local, not URL-routed.
- **Deriving first render from `navigator`/`window`/`Date.now()`** — CLAUDE.md 2026-06-08 (#418 hydration). Seed SSR-safe constants, reconcile in effects. The bespoke renderer runs in RSC-adjacent trees; keep it `'use client'` and hydration-clean.
- **A pure/sync `export` in a `'use server'` file** — CLAUDE.md 2026-06-27. `content-ops.ts` helpers are pure → keep them OUT of `src/actions/*`. Only async server actions live in action files.
- **Static-importing the Visual/Konva editor or the source-viewer from any shared layout** — leaks Konva/admin code into the worker bundle (CLAUDE.md D-21-09 lineage). Always `dynamic(..., { ssr: false })` from admin routes only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block/section reorder | Custom mouse-drag + reflow math | @dnd-kit/sortable + `restrictToVerticalAxis` | Keyboard a11y, touch, drop animation, collision detection all solved; ~12KB admin-only |
| Diagram annotation primitives + transformer + serialization | SVG overlay from scratch | konva + react-konva | Phase 17 research already rejected custom SVG (rebuilds transformer/undo); Konva ships every primitive + clean scene JSON |
| Department-scoped library reuse | New picker | Existing `BlockPicker` + `addBlockToSection` (Phase 13) | Already wired in `BuilderClient`, junction-linked, org-scoped |
| Draft persistence / offline queue | New Supabase write path | Existing `useBuilderAutosave` → Dexie `draftLayouts` → `useDraftLayoutSync` | P11 constraint: no new persistence path |
| Selection↔source highlight plumbing | New context | Existing `useSelectionSync` (`setActiveProvenance` / `registerBlockClickHandler`) | P12: KEEP component, only change who calls `setActiveProvenance` |
| Unknown-block safety | New guard | Move existing `sanitizeLayoutContent` + `UnsupportedBlockPlaceholder` off `puck-config` into `sanitize-layout.ts` | P17: same logic, new home — both read/edit paths call it |
| Humanised labels | New label map | `humanizeBlockType` / `BLOCK_TYPE_LABELS` | P16 constraint: single label source |
| AI-facing schema | New endpoint | `BLOCK_REGISTRY` + `/api/schema` (`introspection.ts`) | P15: KEEP; add Visual entry only |
| EXIF/HEIC image normalisation for annotation | New pipeline | Existing upload pipeline + `sharp().rotate().toColorspace('srgb')` | Phase 17 pitfall #1/#3; coordinates drift if EXIF not baked |

**Key insight:** roughly 70% of this phase is *re-wiring existing, tested infrastructure to a new UI shell*, not new logic. The genuinely new code is: the renderer switch, the edit shell, 16 field panels, the inserter/ghosts UI, and the Konva editor. Everything downstream of a change event is unchanged.

## Re-wiring the Spine (Preservation Checklist — concrete integration points)

Each non-KEEP item, its exact current binding, and the bespoke re-wire. **Every row needs a behavioural parity test (not source-contract) — CLAUDE.md 2026-06-05.**

| P# | Item | Current binding (verified in-repo) | Bespoke re-wire | Disposition |
|----|------|-----------------------------------|-----------------|-------------|
| P11 | Autosave | `<Puck onChange={handleChange}>`; `handleChange = useBuilderAutosave(activeSectionId, sopId)` → Dexie → `useDraftLayoutSync` | Reducer effect calls the same `handleChange({content, root})`. Hook + Dexie + sync UNCHANGED. | RE-WIRE |
| P12 | Source-viewer selection sync | `createPuckOverrides.componentOverlay` mounts `<SelectionSyncTap>` firing `onItemSelected({componentId, junctionId})` → `setActiveProvenance(region, junctionId)`; reverse via `registerBlockClickHandler` → `document.querySelector('[data-puck-item-id=…]')` | EditShell fires `onItemSelected` on block focus/select; reverse handler queries a new stable `[data-block-id]` attr the shell renders. `useSelectionSync` context UNCHANGED. | RE-WIRE |
| P13 | AI-flag overlays / update badges | `componentOverlay` renders `<PuckItemBadgeOverlay>` + inline `<ReviewerFlagsPanel sopId blockId={junctionId}>`; junction lookups via `componentIdToJunction` map (already built in `BuilderClient` by walking `layout_data` props.junctionId) | Render the SAME `PuckItemBadgeOverlay`/`ReviewerFlagsPanel` inside `BlockEditShell`, keyed off the same `componentIdToJunction` map (the map-building `useMemo` is portable as-is). | RE-IMPLEMENT (thin — components reused) |
| P8 | Per-block verify UI + publish gate | Server gate `/api/sops/[sopId]/publish` (400 `unverified_blocks` when any `sop_section_blocks.verified_by_admin_id IS NULL`); UI via `useVerifyChecklist` + `VerifyChecklistGate` | Server gate KEEP untouched. Re-mount `VerifyChecklistGate` in the new shell; per-block "verify" affordance writes through the existing verify action. | KEEP server · RE-IMPLEMENT UI |
| P14 | 16 structured-field editors | Puck `fields` config per block in `puck-config.tsx` (text/textarea/select/array/number) | Bespoke `fields/` panels, one per structured type (Measurement unit+tolerance, Decision options[], Inspect items[], SignOff role, HazardCard severity, PPE items[], Escalate mode, Zone type, VoiceNote lang, etc.). Field shapes are fully specified by the block `*PropsSchema` Zod (reuse as the panel's validation). **No field editable under Puck may become unreachable** (SPEC acceptance). | RE-IMPLEMENT |
| P17 | Unknown-block guard | `sanitizeLayoutContent` + `UnsupportedBlockPlaceholder` in `puck-config.tsx`; called by both `BuilderClient` and `LayoutRenderer` | Move both to `src/lib/builder/sanitize-layout.ts`; both new read + edit paths import from there. Registry-membership check now uses `BLOCK_COMPONENTS`. | RE-IMPLEMENT (relocate) |
| P15 / R7 | 3-place AI contract + agent hooks | `BLOCK_REGISTRY` + Zod + `/api/schema`; `contract-check.ts` reads `puck-config.tsx` source for the registered set | KEEP registry/Zod/endpoint. **Repoint `scripts/contract-check.ts`** to read `block-registry.tsx` instead of `puck-config.tsx` (it greps the components map by filename — this is a required migration edit). R7 hook: reducer must round-trip ALL `props` keys losslessly (never drop unknown keys) so 26.5 agent metadata can ride on `props`. | KEEP + repoint contract-check |
| P4 | Provenance data + highlight | `block_provenance` on props (data KEEP); highlight binding = P12 | Data untouched; highlight re-wired with P12. | KEEP data · RE-WIRE |
| P9 | Orphan-image capture | Parser emits `HeadingBlock` "Unanchored figures…"; `componentOverlay` shows a "Reference images" chip | Re-implement the chip in `BlockEditShell` (same `startsWith('Unanchored figures')` check on props.text). | RE-IMPLEMENT (thin) |

**Contract-check migration is load-bearing:** `scripts/contract-check.ts` (run in `prebuild`) currently parses `src/lib/builder/puck-config.tsx` to enforce that every block type appears in all three places. When the renderer moves, this script MUST be repointed or the build's contract gate silently checks a dead file. Add the Visual block to `EXCLUDED_FROM_VALIDATORS` handling appropriately (Visual IS stored in junctions → needs a `BlockContentSchema` kind).

## Visual Block + Konva (R5 / D-03)

### Visual block = one new 3-place block + a medium sub-type
- **New type `VisualBlock`** with items `[{ medium: 'photo'|'diagram'|'video', src, alt, caption, annotationId? }]`. Add to: (1) `BLOCK_COMPONENTS` renderer, (2) `BLOCK_REGISTRY` in `introspection.ts`, (3) `BlockContentSchema` discriminated union (`kind: 'visual'`), (4) `BLOCK_TYPE_LABELS`, (5) `contract-check.ts`. This is the 5-edit contract (3-place + label + build gate).
- **Convert mapping (R5 acceptance):** the parser's image blocks (`PhotoBlock`/`PhotoGridBlock`/`StepWithPhotosBlock` photos) map into `VisualBlock` items with `medium:'photo'`, **retaining `block_provenance`** (page+bbox / paragraph). Decide in planning whether to (a) transform at parse time (changes golden-path output — risky for the byte-equivalence test) or (b) render legacy photo kinds *through* the Visual component while leaving `layout_data` photo kinds intact (SAFER — preserves golden-path parity; recommended). Option (b) keeps R6 byte-equivalence while giving R5's unified UI.
- **3D `ModelBlock`:** currently a feature-flagged placeholder (`NEXT_PUBLIC_MODEL_BLOCK_ENABLED`); the three.js viewer was never built (`ModelBlock.tsx` comment: "Phase 12.6 will replace this branch"). So folding it into Visual as `visual:3d` is low-risk — but it is **discretion + non-blocking** (D-03). Recommend: leave `ModelBlock` as a separate type this phase; add `visual:3d` only if trivial.

### Konva absorption — the three Phase-17 slices (reuse verbatim)
Carry `.planning/research/v3.0-image-annotation.md` and ROADMAP §Phase 17 as the spec. Confirmed technical shape:
1. **Foundation:** `konva` + `react-konva`, add `'canvas'` to `next.config.ts` `serverExternalPackages` (currently `['officeparser','file-type','sharp','@anthropic-ai/sdk','ffmpeg-static']` — append `'canvas'`). New migration `sop_image_annotations` (scene jsonb + `natural_width/height` + `baked_storage_path` + `baked_at` + org_id + RLS copied from `sop_images`). Editor `dynamic(() => import('./visual/AnnotationEditor'), { ssr: false })`, component starts `'use client'`.
2. **Primitives:** Arrow/Rect/Ellipse/Text/numbered-callout (`Konva.Label`)/freehand (`Konva.Line`), `Konva.Transformer`, undo/redo via scene snapshots, stylus palm-rejection (`pointerType === 'pen'` filter). Text edit = `<textarea>` overlay. `DiagramHotspotBlock` = numbered callouts at freeform x/y (the ONLY freeform surface).
3. **Bake-on-publish:** client `stage.toDataURL()` → PNG → `sop-images/baked/{sop}/{image}.v{N}.png` (content-versioned to beat CDN cache); write `baked_storage_path`. **Worker read path serves the baked `<img>` only — never imports Konva.**

### The bundle-isolation hard line (D-03 + SB-LINE)
- **Bundle gate exists and hard-fails:** `scripts/check-bundle-size.ts` (postbuild) enforces First Load JS for `/sops/[sopId]/page` within `baseline + 2KB` from `.bundle-baseline.json`, and asserts specific dynamic chunks exist.
- **This phase should REDUCE the worker bundle:** removing Puck's `<Render>` from `LayoutRenderer.tsx` (the worker path) drops `@puckeditor/core` from `/sops/[sopId]`. That's a decrease (fine vs a max-tolerance gate) but **will require re-capturing `.bundle-baseline.json`** (`scripts/capture-bundle-baseline.ts`) once the worker path is Puck-free, and possibly updating the chunk-existence assertions. Plan a task for baseline re-capture.
- **Konva must never appear in the `/sops/[sopId]` (worker) manifest.** Add a lint/CI assertion mirroring the existing `no-static-desktop-import` guard: no static import of the annotation editor outside admin routes. Register any such spec in a `playwright.config.ts` project regex (CLAUDE.md 2026-05-25) or it never runs.

## Common Pitfalls

### Pitfall 1: Silent contract-check bypass after moving the renderer
**What goes wrong:** `contract-check.ts` keeps parsing `puck-config.tsx` after the registry moves; the build gate passes while checking a stale/dead file, so a Visual-block 3-place mismatch ships green.
**How to avoid:** Repoint `contract-check.ts` to `block-registry.tsx` as a W0 task; add a test that the script's target file matches the live registry location.
**Warning sign:** adding a block to the new registry but the prebuild contract-check still passes without the other two edits.

### Pitfall 2: Bespoke tests assert presence, not behaviour (the recurring blind spot)
**What goes wrong:** CLAUDE.md 2026-06-05 — a source-contract test asserts a handler string exists while the handler is dead (empty `onClick`). Every P-item re-wire is exactly this shape.
**How to avoid:** For each RE-WIRE/RE-IMPLEMENT: a behavioural test that (edit text → assert Dexie `draftLayouts` row written), (select block → assert `setActiveProvenance` fired with the right region), (click AI flag → assert overlay renders), (leave a block unverified → assert publish POST returns 400). Not "the file contains `useBuilderAutosave`".

### Pitfall 3: `'use server'` sync-export build break (ships green under tsc)
**What goes wrong:** CLAUDE.md 2026-06-27 — a pure helper exported from an action file passes `tsc` + unit tests but fails `next build`.
**How to avoid:** All `content-ops.ts` pure helpers live in `src/lib/builder/`, never `src/actions/`. Run a real `npm run build` (not just `tsc`) as the final gate — the project's `build` is `next build --webpack` with `prebuild` contract-check + `postbuild` bundle-size, so "green build" means all three pass.

### Pitfall 4: contentEditable hydration + caret/IME loss
**What goes wrong:** Controlling `contentEditable` from React state on every keystroke resets the caret and breaks IME; seeding initial HTML from a non-deterministic source triggers #418.
**How to avoid:** Uncontrolled contentEditable — set `dangerouslySetInnerHTML`/`defaultValue` once, read `textContent` on blur/debounced-input, commit to the reducer then. Never re-write the node's content from state while focused.

### Pitfall 5: Konva `canvas` module + StrictMode leaks (Next 16)
**What goes wrong:** `Module not found: Can't resolve 'canvas'`; Stage instances leak on StrictMode remount.
**How to avoid:** `serverExternalPackages: ['canvas']`; `dynamic({ ssr: false })`; `stage.destroy()` in effect cleanup. **Spike this on day 1** — Phase 17 research verified Next 15, Next 16 is unverified (MEDIUM confidence).

### Pitfall 6: Worker bundle regression via a shared import
**What goes wrong:** A shared layout/provider statically imports the edit shell or Konva → workers download admin/Konva code → bundle gate hard-fails (or worse, passes if baseline was captured wrong).
**How to avoid:** `builder-v2/` and `visual/` imported ONLY from `/admin/sops/*`; verify with `ANALYZE`/manifest inspection; keep the worker `LayoutRenderer` free of any `builder-v2` import.

### Pitfall 7: Provenance/junction stamping dropped on edit
**What goes wrong:** The reducer spreads only known props on update and drops `junctionId`/`block_provenance` → verify gate sees unverifiable blocks, source highlight breaks, R7 agent hooks lose tags.
**How to avoid:** Reducer updates MUST be `{ ...prevProps, ...changedFields }` — never reconstruct props from scratch. A parity test: edit a converted block's text, assert `props.junctionId` and `props.block_provenance` survive the round-trip to Dexie and Supabase.

## Code Examples

### dnd-kit vertical sortable for block reorder
```tsx
// Source: @dnd-kit/sortable (v10) + @dnd-kit/modifiers restrictToVerticalAxis — pattern verified via npm peer deps
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'

<DndContext collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]}
  onDragEnd={({active, over}) => over && dispatch({type:'reorder', content: arrayMove(content, idxOf(active.id), idxOf(over.id))})}>
  <SortableContext items={content.map(c => c.props.id)} strategy={verticalListSortingStrategy}>
    {content.map(item => <SortableBlock key={item.props.id} item={item} />)}
  </SortableContext>
</DndContext>
// SortableBlock uses useSortable({id}) → {attributes, listeners, setNodeRef, transform} on the grip handle
```

### Konva admin-only dynamic import (worker never loads it)
```tsx
// Source: .planning/research/v3.0-image-annotation.md (Phase 17) — Next dynamic ssr:false
const AnnotationEditor = dynamic(() => import('@/components/admin/builder-v2/visual/AnnotationEditor'), {
  ssr: false, loading: () => <div>Loading annotator…</div>,
})
// AnnotationEditor.tsx starts with 'use client'; imports react-konva; renders <Stage><Layer>…</Layer></Stage>
// next.config.ts: serverExternalPackages: [...existing, 'canvas']
```

### Selection re-wire (P12) — same context, new caller
```tsx
// EditShell (mode="edit") on block focus:
onFocus={() => onItemSelected({ componentId: item.props.id, junctionId: item.props.junctionId ?? null })}
// onItemSelected resolves region from junctionMap (existing useMemo) → setActiveProvenance(region, junctionId)
// Reverse: shell renders data-block-id={item.props.id}; registerBlockClickHandler queries [data-block-id="…"]
// Source: src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx (existing wiring, portable)
```

## Wave Sequencing (recommended — Claude's Discretion per D-04)

Matches the CONTEXT-expected shape; ordered so the FROZEN contract is proven early and behavioural parity gates each wave.

- **W0 — Foundation + read path (de-risk the contract).** New `block-registry.tsx`; move `sanitizeLayoutContent`+`UnsupportedBlockPlaceholder` to `sanitize-layout.ts`; rewrite `LayoutRenderer.tsx` to the bespoke switch (`mode="read"`) — this alone drops Puck from the worker path. Repoint `contract-check.ts`. Re-capture `.bundle-baseline.json`. **Gate:** worker walkthrough renders byte-identically; bundle gate green (decreased).
- **W1 — Edit canvas for existing blocks (R2).** `EditableDocument` reducer + `BlockEditShell` (hover tools, contentEditable text, @dnd-kit reorder). Re-wire autosave (P11) off the reducer. **Gate:** edit text → Dexie row written → reload persists (behavioural).
- **W2 — 16 structured field panels (P14 R2).** One panel per structured type, Zod-validated by the block's `*PropsSchema`. **Gate:** every field editable under Puck is reachable + writes valid `layout_data` (parity test per block).
- **W3 — Tiered inserter + smart ghosts (R3/R4).** Port `LANE/SMART/GROUPS/LIB`; reuse `BlockPicker` for the Reuse tier. **Gate:** context-varying "Fits here"; keyboard nav; ghost appears/accepts/dismisses per rules.
- **W4 — Re-wire spine bindings (P12/P13/P8/P9).** Selection-sync, AI-flag overlay, per-block verify UI, orphan-image chip — all off the reducer's junction map. **Gate:** behavioural parity test each; publish gate still 400s on unverified.
- **W5 — Visual block + Konva (R5/D-03).** New `VisualBlock` (5-edit contract); render legacy photo kinds through it (preserve golden-path); Konva foundation → primitives → bake-on-publish; worker serves baked PNG. **Gate:** Konva absent from `/sops/[sopId]` manifest; annotation round-trips; baked PNG on worker read.
- **W6 — Convert golden-path parity + regression (R6/R8).** Byte-equivalent `layout_data`+junctions+provenance vs a captured pre-phase fixture; no-bulk-verify lint guard + publish gate + junction stamping intact. **Gate:** golden-file diff empty; full suite green; real `npm run build` clean.

**Ponytail note:** W2 (16 field panels) is the single largest chunk of genuinely-new code and the place to resist over-building — each panel is the minimum inputs matching its Zod schema, not a mini-form-framework. Reuse react-hook-form only where an array field (Decision options, Inspect items) actually benefits.

## Validation Architecture (Nyquist)

> `.planning/config.json` was not read as JSON here; nyquist treated as ENABLED (default). Framework = **Playwright** (`npx playwright test`), per-phase projects with `testMatch` regexes. **Any new spec MUST be registered in a `playwright.config.ts` project regex or it never runs** (CLAUDE.md 2026-05-25).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright ^1.58.2 (integration + component-ish specs) + tsx unit tests under `testDir`-scoped projects |
| Config file | `playwright.config.ts` (per-phase projects) |
| Quick run | `npx playwright test --project=phase26-stubs` (after registering the project) |
| Full suite | `npm run test` |
| Build gate | `npm run build` = `prebuild` (contract-check) + `next build --webpack` + `postbuild` (bundle-size) |

### Phase Requirements → Test Map (behavioural, not source-contract — CLAUDE.md 2026-06-05)
| Req | Behaviour to prove | Type | Command (register first) |
|-----|--------------------|------|--------------------------|
| R2 | Worker read + edit canvas render the SAME components for a given `layout_data` | integration | `--project=phase26-stubs` (render-parity spec) |
| R2/P11 | Edit text → `db.draftLayouts` row written → reload persists | behavioural | phase26 autosave spec |
| P12 | Select block → `setActiveProvenance(region, junctionId)` fired; source click → canvas scroll | behavioural | phase26 selection-sync spec |
| P13 | Block with an open AI flag renders overlay/panel; verified block renders nothing | behavioural | phase26 ai-overlay spec |
| P8/R8 | Any `verified_by_admin_id IS NULL` → publish POST returns 400 `unverified_blocks` | integration | reuse existing publish-gate spec + phase26 verify-UI spec |
| P14 | For each of 16 types, every Puck-editable field is reachable + writes valid `layout_data` | unit+behavioural | phase26 field-panel specs (one per type) |
| R3 | `LANE` differs for hazards vs steps; `↑↓/↵` nav; Reuse dept-scoped toggle | behavioural | phase26 inserter spec |
| R4 | Ghost appears after qualifying block; absent when predicted follows; Tab accepts; scroll/type dismiss | behavioural | phase26 ghost spec |
| R5 | Insert Visual offers photo/diagram/video; item carries medium tag; converted image → `visual:photo` retains provenance | behavioural | phase26 visual spec |
| P17 | Unknown block type → `UnsupportedBlockPlaceholder` in BOTH read + edit | unit | phase26 sanitize spec |
| P15/R7 | Reducer round-trips unknown `props` keys losslessly; `junctionId`+`block_provenance` survive edit | unit | phase26 props-roundtrip spec |
| R6 | Convert golden-path: `layout_data`+junctions+provenance byte-equivalent to pre-phase fixture | golden-file | phase26 convert-parity spec |
| D-03 | Konva absent from `/sops/[sopId]` First Load manifest | build/lint | extend `check-bundle-size.ts` + a no-static-import lint spec |

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase26-stubs` + `npx tsc --noEmit`.
- **Per wave merge:** `npm run test` (full) + `npm run build` (real `next build` — contract-check + bundle-size gates included).
- **Phase gate:** golden-path parity spec green + full suite + clean `npm run build` before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Register a `phase26-stubs` (and per-domain) project in `playwright.config.ts` — else specs never run.
- [ ] Capture the **pre-phase convert golden fixture** (a real DOCX + PDF → `layout_data`+junctions+provenance snapshot) BEFORE any editor change, for the R6 byte-equivalence diff.
- [ ] Re-point + test `scripts/contract-check.ts` at `block-registry.tsx`.
- [ ] Extend `check-bundle-size.ts` / add a lint spec asserting Konva + edit-shell absent from the worker manifest.
- [ ] Re-capture `.bundle-baseline.json` after the worker path goes Puck-free.

## Security Domain

> `security_enforcement` not explicitly false → included. This phase is admin-surface UI over an existing data contract; the security-relevant surface is narrow but real.

### Applicable ASVS Categories
| ASVS | Applies | Standard control (existing pattern to preserve) |
|------|---------|--------------------------------------------------|
| V4 Access Control | yes | Publish gate + all writes org-scoped via RLS; any NEW server action (e.g. save annotation) uses the user-scoped client OR service-role with self-enforced `organisation_id` check (CLAUDE.md 2026-06-15/26) |
| V5 Input Validation | yes | Zod at every write boundary — `BlockContentSchema`/`LayoutDataSchema`/`BlockProvenanceSchema`; the bespoke editor writes the SAME validated shapes (P5) |
| V6 Cryptography | no | n/a |
| — JWT claim parsing | yes | Any new endpoint reading `organisation_id` MUST use `parseJwtPayload` (`src/lib/supabase/jwt.ts`), NOT `atob` (CLAUDE.md 2026-06-26). NB: existing `publish/route.ts` still uses `atob` — do not copy that pattern into new code. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Cross-org write via service-role annotation save | Elevation/Tampering | Service-role writes self-enforce `row.organisation_id === caller.orgId` + `.eq('organisation_id', …)` on the write (recurring bug family — CLAUDE.md 2026-06-15/26) |
| Malformed `layout_data` injected via editor | Tampering | `LayoutDataSchema` + per-block `*PropsSchema.safeParse` before persist; `sanitizeLayoutContent` guards render |
| XSS via contentEditable/annotation text | Tampering | Commit `textContent` (not innerHTML) to the reducer; never render user text as raw HTML; Konva text is canvas-rendered (no DOM injection) |
| Konva leaking to worker (availability/perf) | DoS-adjacent | Bundle gate + no-static-import lint; baked `<img>` on worker path |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | @dnd-kit/{core,sortable,modifiers} at 6.3.1/10.0.0/9.0.0 are the right reorder lib (React 19 ok) | Standard Stack | Low — registry+peer verified; if rejected, native HTML5 DnD is the fallback (loses keyboard a11y) |
| A2 | Konva + react-konva work in **Next 16** with `serverExternalPackages:['canvas']` + `ssr:false` | Visual+Konva / Pitfall 5 | Medium — Phase 17 verified Next 15 only; **day-1 spike required**; fallback Excalidraw/custom-SVG per Phase 17 research |
| A3 | Rendering legacy photo kinds *through* a Visual component (not transforming layout_data) preserves R6 golden-path byte-equivalence | Visual+Konva | Medium — if planning chooses parse-time transform instead, the golden fixture must be re-based and R6 acceptance re-interpreted |
| A4 | `useBuilderAutosave` accepts any `{content, root}` object unchanged (not Puck-type-coupled) | Re-wiring P11 | Low — verified: it types the arg as Puck `Data` but only reads `.content`/`.root` for the Dexie put |
| A5 | contentEditable single-field-per-block is sufficient (no rich-text framework) | Standard Stack | Low — verified: block text is one string field per `*PropsSchema` |
| A6 | Bundle gate tolerates a decrease when Puck leaves the worker path (it's baseline+2KB max) | Bundle risks | Low — but baseline re-capture is required regardless |

## Open Questions (RESOLVED)

1. **Konva in Next 16 — verified?**
   - Known: works in Next 15 (Phase 17 research), `canvas` externalization + `ssr:false` pattern.
   - Unclear: Next 16 `--webpack` behaviour with `react-konva@19.2.5`.
   - **RESOLVED:** adopted in plan **26-05** — Wave-5 opens with a day-1 throwaway Konva-in-Next-16 spike, STOP/escalate on failure, fallback chain (Excalidraw → custom SVG) documented. Genuine external unknown, correctly gated at execution time.
2. **Convert-parity vs Visual unification — which wins if they conflict?**
   - **RESOLVED:** adopted in plan **26-09** (A3) — render legacy photo kinds *through* the Visual UI, never rewrite `layout_data`, preserving golden-path byte-equivalence (R6 hard acceptance, asserted in 26-14).
3. **3D ModelBlock disposition** — keep separate (recommended, it's an unbuilt placeholder) vs `visual:3d`.
   - **RESOLVED:** keep separate; non-blocking planner discretion (D-03).
4. **When to actually remove `@puckeditor/core` from package.json**
   - **RESOLVED:** plan **26-14** — removal happens only after all field panels + both render paths are Puck-free and parity-tested; dep stays installed until then so a partial wave can't half-break the build.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | >=20 (engines) | — |
| npm registry (dnd-kit, konva) | install | ✓ | verified via `npm view` | native DnD / Excalidraw |
| `canvas` externalization (Konva) | Visual editor | config change | add to `serverExternalPackages` | Excalidraw / custom SVG |
| Supabase Storage `sop-images/baked/` | bake-on-publish | ✓ (bucket exists) | — | — |
| slopcheck (package legitimacy) | audit | ✗ | — | `npm view` + `checkpoint:human-verify` gate (used here) |

## Sources

### Primary (HIGH confidence — verified in-repo this session)
- `src/lib/builder/puck-config.tsx` — 16 block defs, `sanitizeLayoutContent`, `UnsupportedBlockPlaceholder`, `createPuckOverrides` (componentOverlay = selection/flag binding)
- `src/components/sop/LayoutRenderer.tsx` — worker render path uses Puck `<Render>` (workers currently ship Puck)
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx` — autosave/selection/junction-map/overrides wiring
- `src/hooks/useBuilderAutosave.ts`, `useDraftLayoutSync.ts` — P11 path (Dexie → Supabase)
- `src/components/admin/source-viewer/useSelectionSync.tsx` — P12 context (unchanged)
- `src/lib/validators/blocks.ts`, `src/lib/builder/layout-schema.ts`, `src/lib/validators/sop.ts` (`BlockProvenanceSchema`) — the frozen Zod contract
- `src/actions/introspection.ts` — `BLOCK_REGISTRY` + `/api/schema` (P15)
- `src/lib/builder/block-type-labels.ts` — `humanizeBlockType` (P16)
- `src/app/api/sops/[sopId]/publish/route.ts` — server 400 `unverified_blocks` gate (P8)
- `scripts/contract-check.ts` (prebuild), `scripts/check-bundle-size.ts` (postbuild) — 3-place + bundle gates
- `sketches/sop-builder-redesign/index.html` — validated inserter (`LANE/SMART/GROUPS/LIB`) + ghost rules (design target for R3/R4)
- `next.config.ts`, `package.json`, `playwright.config.ts` — deps, serverExternalPackages, per-phase test projects
- `npm view` — @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0, @dnd-kit/modifiers 9.0.0, konva 10.3.0, react-konva 19.2.5 (peer react ^19.2.0)

### Secondary (carried forward — Phase 17 research)
- `.planning/research/v3.0-image-annotation.md` — Konva selection, dual-store, bake-on-publish, EXIF/stylus pitfalls (CITED, do not re-derive)

### Constraints applied (CLAUDE.md `## Learnings`)
- 2026-06-05 (source-contract ≠ behavioural), 2026-05-25 (register specs in a playwright project regex), 2026-06-27 (`'use server'` async-only + real `next build`), 2026-05-13 (no `router.push` on hot paths), 2026-06-08 (#418 hydration), 2026-06-15/26 (service-role org-scope + `parseJwtPayload` not `atob`)

## Metadata

**Confidence breakdown:**
- Frozen contract + re-wiring surface: HIGH — every P-item binding read directly from source
- Standard stack (dnd-kit): MEDIUM — registry-verified, established, but new to this repo (checkpoint-gated)
- Konva-in-Next-16: MEDIUM — Phase 17 verified Next 15 only; day-1 spike required
- Inserter/ghosts/field-panel patterns: HIGH — sketch encodes the full model; components already pure
- Bundle direction (Puck leaves worker path): HIGH — worker path confirmed to import Puck today

**Research date:** 2026-07-03
**Valid until:** ~2026-08-03 (30 days; re-verify Konva/Next-16 + dnd-kit versions at plan time)

## RESEARCH COMPLETE
