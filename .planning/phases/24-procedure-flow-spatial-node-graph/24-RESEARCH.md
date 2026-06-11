# Phase 24: Procedure Flow — Spatial Node Graph - Research

**Researched:** 2026-06-11
**Domain:** SVG graph rendering, PWA bundle isolation, Puck custom-field round-trip, SSR-safe viewport detection
**Confidence:** HIGH (all key findings verified against live source files in this repo; no external library additions required)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pure hand-rolled SVG — no graph library (dagre/elkjs/reactflow). Prototype proves depth-layer layout suffices at SOP scale.
- Bundle gate: FlowGraphCanvas statically imported into FlowTab on /sops/[sopId] — 1104 KB ±2 KB baseline. Dynamic-import export-PNG code if it pushes past tolerance.
- Visual language: paper/ink system (grid-paper bg, JetBrains Mono type labels, Inter node text, rounded-rect nodes with 4px left accent bar, bezier edges, red escalate).
- Colour tokens must be unified: FlowGraphCanvas currently hardcodes divergent hex fills; production version switches to --accent-* CSS-var token set matching FlowTab's TYPE_COLORS.
- FLOW-01: Auto-layout for derived/linear graphs AND honour explicit node positions from Puck FlowGraphField authoring (prototype header comment claims this but layout() never reads positions — UNIMPLEMENTED).
- FLOW-03: FIT = real zoom-to-fit (current button scrolls to top-left only). EXPORT-PNG downloads rendered graph as PNG.
- FLOW-04: Graph becomes desktop default view; list remains mobile default and always-available toggle. Remove PREVIEW pill and "(preview)" label.
- FLOW-05: Verify Puck FlowGraphField round-trip end-to-end. Known risk: FlowGraphSchema requires UUIDs on id/from/to but FlowGraphField's handleAddNode uses crypto.randomUUID() — those ARE UUIDs. Non-step derived nodes use junctionId/props.id which are NOT guaranteed UUIDs.

### Claude's Discretion
- Zoom/pan interaction details (wheel zoom, drag pan, pinch) — scope to what FIT/EXPORT need; full pan-zoom is optional polish.
- EXPORT-PNG implementation approach — pick lightest approach respecting bundle gate.
- Desktop-vs-mobile detection mechanism for default view.
- Node click behaviour in graph view (open corresponding step card / scroll list) — nice-to-have.

### Deferred Ideas (OUT OF SCOPE)
- Drag-to-reposition nodes directly on the Flow tab canvas
- Minimap / overview inset
- Animated walkthrough-progress highlighting on the graph
- Export formats beyond PNG (SVG/PDF)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLOW-01 | Spatial SVG renderer: auto-layout for derived graphs AND honour explicit node positions from Puck authoring | § Explicit-position detection rule; layout() rewrite spec |
| FLOW-02 | Branch-aware derivation — deriveFlowGraph emits yes/no/escalate edges (shipped b223786; verify coverage only) | § FLOW-02 coverage analysis — 7 tests, all coverage axes confirmed |
| FLOW-03 | FIT (zoom-to-fit) + EXPORT-PNG controls on canvas | § viewBox-based fit math; SVG→PNG export without new deps |
| FLOW-04 | Graph = desktop default, list = mobile/fallback; drop "preview" gating | § SSR-safe default view pattern; useViewport precedent |
| FLOW-05 | Puck FlowGraphField round-trip verified: author positions → sops.flow_graph → Flow tab | § Round-trip analysis; UUID conflict resolution |
</phase_requirements>

---

## Summary

Phase 24 productionises a spatial SVG node-graph Flow view that already exists as a prototype on master. The core deliverables are: (1) making `layout()` in `FlowGraphCanvas.tsx` actually honour authored node positions (the prototype header comment claims this but the code never reads `node.position`); (2) replacing the Fit button's `scrollTo` stub with real viewBox-based zoom-to-fit; (3) adding EXPORT-PNG via the standard `XMLSerializer → canvas → toBlob → download` technique without any new dependencies; (4) promoting the graph to desktop default (dropping the PREVIEW pill and the `useState('list')` initial value); and (5) verifying the Puck `FlowGraphField` round-trip end-to-end and resolving the UUID-id schema conflict that would cause any derived graph saved through `FlowGraphField` to fail Zod validation.

The UUID conflict is the most architecturally significant decision: `FlowGraphSchema` requires `z.string().uuid()` on node `id`, edge `from`, and edge `to`. `FlowGraphField.handleAddNode` correctly uses `crypto.randomUUID()`, so manually-authored nodes are fine. But `deriveFlowGraph` assigns non-step nodes `props.junctionId || props.id || section.id:index` — none of which are guaranteed UUIDs — and if a derived graph were ever serialised through `FlowGraphField`, it would fail `updateSopFlowGraph`'s Zod parse. The safest fix with zero downstream impact is to relax the schema to `z.string().min(1)` for all three id fields, which does not affect `stepId` (still `z.string().uuid().optional()`) and does not break the `FlowTab` `stepMap` lookup (which is keyed on `step.id`, unchanged).

The bundle gate is not at risk: `FlowGraphCanvas.tsx` is ~6 KB of pure SVG logic with no external imports. The `XMLSerializer + canvas` export path adds only inline code; no npm package is needed and no dynamic import is required.

**Primary recommendation:** Implement FLOW-01 through FLOW-05 as a single-wave sequential plan. The explicit-position detection rule (any node with `position.x !== 0 || position.y !== 0` outside the derived defaults) is clear and unambiguous. The SVG→PNG export has two known gotchas documented below that must be handled at implementation time.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spatial SVG layout + rendering | Browser / Client | — | Pure client-side geometry; no server data needed beyond the FlowGraph object already in the SOP |
| Explicit-position authoring (FlowGraphField) | Browser / Client (Puck) | API / Backend (updateSopFlowGraph server action) | SVG drag canvas in the Puck root field; persistence via existing server action |
| Flow graph derivation (deriveFlowGraph) | Browser / Client | — | Pure function over SopWithSections; already runs client-side in useMemo |
| FIT / zoom-to-fit | Browser / Client | — | viewBox manipulation; no server involvement |
| EXPORT-PNG | Browser / Client | — | XMLSerializer → canvas → Blob; entirely client-side, offline-safe |
| Desktop vs mobile default view | Browser / Client | — | SSR-safe: initial state = 'mobile', reconcile in useEffect via window.matchMedia |
| Schema validation (FlowGraphSchema) | API / Backend + Browser | — | Used at both write time (updateSopFlowGraph) and read time (FlowTab safeParse) |

---

## Standard Stack

### Core (all already in repo — zero new dependencies for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (SVG JSX) | 19 (existing) | Render SVG node graph | Already in use in FlowGraphCanvas prototype |
| Zod | existing | FlowGraphSchema validation | Already validates flow_graph at read + write |
| Browser Canvas API | native | SVG→PNG rasterisation for EXPORT-PNG | No npm package needed; available in all modern browsers including PWA context |
| XMLSerializer | native | Serialise live SVG DOM to string for canvas drawImage | Standard browser API; no dependency |
| window.matchMedia | native | SSR-safe viewport detection | Already used in useViewport hook (src/hooks/useViewport.ts) |

**No new npm packages required for this phase.** [VERIFIED: live codebase inspection]

### Package Legitimacy Audit

No new packages are introduced in this phase. The audit section is N/A — all capabilities are delivered via existing dependencies and native browser APIs.

---

## Architecture Patterns

### System Architecture Diagram

```
Worker opens /sops/[sopId] → FlowTab renders
                                    │
                        ┌───────────┴───────────┐
                        │ sop.flow_graph?        │
                        │ (Supabase JSON col)    │
                        └───────────┬───────────┘
                    ┌───────────────┴───────────────┐
                    │ Explicit graph present?         │
                    │ FlowGraphSchema.safeParse(...)  │
                    └────────────┬──────────────────-┘
               parse succeeds ──┘    └── parse fails / null
              (use explicit)              (use derived)
                    │                           │
                    └──────────┬────────────────┘
                               ▼
                        FlowGraph object
                               │
                    ┌──────────┴──────────┐
                    │ layout(graph)        │
                    │  explicit positions? │
                    │  → honour them       │
                    │  else auto-layout    │
                    └──────────┬──────────┘
                               ▼
                    FlowGraphCanvas (SVG)
                    ┌──────────────────────┐
                    │ FIT btn → fitToView() │
                    │  (viewBox rescale)    │
                    │ EXPORT PNG → export() │
                    │  (XMLSerializer+canvas│
                    └──────────────────────┘

Admin Builder path:
  BuilderFlowButton → FlowGraphCanvas (read-only preview modal)
  FlowGraphField (Puck root.flowGraph) → FlowGraphEditor
    drag-position nodes → handleSave → updateSopFlowGraph server action
    → UPDATE sops SET flow_graph = $graph WHERE id = $sopId
```

### Recommended Project Structure

No new directories needed. All changes are within existing files:

```
src/
├── components/sop/flow/
│   └── FlowGraphCanvas.tsx     # PRIMARY: layout(), FIT, EXPORT-PNG
├── components/sop/tabs/
│   └── FlowTab.tsx             # desktop-default view toggle, drop PREVIEW
├── lib/validators/
│   └── flow-graph.ts           # relax UUID constraint → z.string().min(1)
├── lib/sop/
│   └── flow-graph.ts           # verify coverage only (FLOW-02)
└── lib/builder/
    └── flow-graph-field.tsx    # verify round-trip (FLOW-05)
```

### Pattern 1: Explicit-Position Detection Rule

**What:** `layout()` must distinguish "this graph has authored positions" from "derived graph with default positions" before deciding whether to honour or ignore `node.position`.

**Detection rule (VERIFIED by reading both derivation paths):**

`deriveFlowGraph` always emits `position: { x: 0, y: i * 100 }` — every node gets `x = 0`. `FlowGraphField.handleAddNode` starts nodes at `x: 0, y: snapToGrid(ns.length * 100)` too, but drag moves them to arbitrary x values snapped to 20px grid. So the discriminant is: **if any node has `position.x !== 0`** the graph has been explicitly positioned; otherwise auto-layout.

```typescript
// Source: derived from live inspection of flow-graph.ts and flow-graph-field.tsx
function hasExplicitPositions(graph: FlowGraph): boolean {
  return graph.nodes.some((n) => n.position.x !== 0)
}

function layout(graph: FlowGraph): LayoutResult {
  if (hasExplicitPositions(graph)) {
    // Honour authored positions verbatim — compute width/height from bounding box
    return layoutFromPositions(graph)
  }
  // Auto-layout: existing longest-path depth layering (unchanged)
  return autoLayout(graph)
}

function layoutFromPositions(graph: FlowGraph): LayoutResult {
  const placed = new Map<string, Placed>()
  for (const n of graph.nodes) {
    placed.set(n.id, { id: n.id, x: n.position.x, y: n.position.y, type: n.type, label: n.label })
  }
  const xs = graph.nodes.map((n) => n.position.x)
  const ys = graph.nodes.map((n) => n.position.y)
  const width = Math.max(...xs) + NW + PAD * 2
  const height = Math.max(...ys) + NH + PAD * 2
  return { placed, width, height }
}
```

### Pattern 2: ViewBox-Based Zoom-to-Fit

**What:** Scale the SVG viewBox so the full graph fits within the current container, replacing the current `scrollTo({ top:0, left:0 })` stub.

**Implementation (no new deps):**

```typescript
// Source: derived from existing FlowGraphCanvas structure + standard SVG API
function fitToView(svgEl: SVGSVGElement, containerEl: HTMLDivElement, graph: FlowGraph) {
  const { width: gw, height: gh } = layout(graph) // reuse layout result
  const cw = containerEl.clientWidth
  const ch = containerEl.clientHeight
  const scale = Math.min(cw / gw, ch / gh, 1) // never scale UP beyond 100%
  const vw = gw / scale
  const vh = gh / scale
  svgEl.setAttribute('viewBox', `0 0 ${vw} ${vh}`)
  svgEl.setAttribute('width', String(cw))
  svgEl.setAttribute('height', String(ch))
}
```

The SVG element already has a `viewBox` set from `layout()`. FIT just rescales it. This approach requires attaching a `ref` to both the SVG and the scroll container — both refs already exist in the prototype (`scrollRef` is the container; add `svgRef`).

**Optional wheel-zoom (Claude's discretion):** Update `viewBox` on `wheel` events — scale by `Math.exp(-e.deltaY * 0.001)` clamped to [0.1, 4]. If included, add a `currentViewBox` ref rather than reading from the DOM attribute each time. Not required for FLOW-03.

### Pattern 3: SVG → PNG Export (Zero Dependencies)

**What:** Serialise the live SVG DOM to a blob, draw it onto an off-screen canvas, export as PNG, trigger a download link.

**Implementation:**

```typescript
// Source: standard browser API pattern — no library required
async function exportPng(svgEl: SVGSVGElement, filename = 'procedure-flow.png') {
  // 1. Inline computed CSS variable values — vars do NOT resolve in a
  //    serialized standalone SVG (see Pitfall 2 below).
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  inlineCssVars(clone, svgEl) // see implementation note below

  // 2. Serialise
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(clone)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  // 3. Draw to canvas at devicePixelRatio for crisp output
  const dpr = window.devicePixelRatio || 1
  const w = svgEl.width.baseVal.value || 800
  const h = svgEl.height.baseVal.value || 600
  const canvas = document.createElement('canvas')
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve() }
    img.onerror = reject
    img.src = url
  })
  URL.revokeObjectURL(url)

  // 4. Download
  canvas.toBlob((b) => {
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  }, 'image/png')
}
```

**CSS variable inlining (critical):** The production canvas uses `var(--accent-step)` etc. as fill/stroke values. A serialised SVG is a standalone document — browser will not resolve CSS variables from the host page's stylesheet. Before serialising, clone the SVG and walk all elements, replacing `fill: var(--x)` / `stroke: var(--x)` with `getComputedStyle(el).fill` / `.stroke` computed against the live element in the DOM.

```typescript
function inlineCssVars(clone: SVGSVGElement, live: SVGSVGElement) {
  const liveEls = live.querySelectorAll('*')
  const cloneEls = clone.querySelectorAll('*')
  liveEls.forEach((liveEl, i) => {
    const cloneEl = cloneEls[i] as SVGElement
    if (!cloneEl) return
    const cs = getComputedStyle(liveEl)
    const fill = cs.fill
    const stroke = cs.stroke
    if (fill && fill !== 'none') cloneEl.style.fill = fill
    if (stroke && stroke !== 'none') cloneEl.style.stroke = stroke
  })
}
```

**Font embedding:** JetBrains Mono and Inter referenced in SVG `fontFamily` will NOT render in the exported PNG unless the fonts are available as data URIs embedded in the SVG `<defs>`. For v1, acceptable to accept system-fallback rendering. If crisp mono font is required: embed a subset WOFF2 as a base64 `@font-face` in a `<style>` element inside the SVG before serialising. This is a Claude's-discretion polish item.

### Pattern 4: SSR-Safe Desktop Default View

**What:** FlowTab's `useState('list')` initial value must become `useState('list')` on server (SSR) and on mobile, and switch to `'graph'` on desktop after hydration.

**Existing pattern to follow (Phase 15, `useViewport` hook):** [VERIFIED: src/hooks/useViewport.ts]

```typescript
// Already ships in src/hooks/useViewport.ts — reuse directly
// Returns 'mobile' on first render (SSR-safe), 'desktop' after mount on ≥1024px
import { useViewport } from '@/hooks/useViewport'

// In FlowTab:
const viewport = useViewport()
const [view, setView] = useState<'list' | 'graph'>(() => 'list') // always 'list' on SSR
// After hydration, sync to desktop default:
useEffect(() => {
  if (viewport === 'desktop') setView('graph')
}, [viewport])
```

This matches the project's established SSR-safety rule exactly: "never derive first-render output from navigator/window/Date.now() at module-load or in render — seed a stable SSR-safe constant and reconcile in an effect." [VERIFIED: CLAUDE.md 2026-06-08 learning]

The `useEffect` fires only after hydration, so SSR HTML always has list view (no hydration mismatch), and desktop users see graph on first interaction without any flicker beyond the standard Phase 15 documented "brief mobile-render flash" (acceptable for v1).

### Anti-Patterns to Avoid

- **`window.innerWidth` at render time or module load:** Throws on SSR / causes hydration mismatch. Use `useViewport()` (useEffect + matchMedia) per the CLAUDE.md 2026-06-08 learning.
- **Serialising live SVG without inlining CSS vars:** All `var(--accent-*)` fills will resolve to `rgb(0,0,0)` in the exported PNG. Must call `inlineCssVars()` on the clone before `XMLSerializer`.
- **Reusing the same node positions for both explicit and auto-layout paths:** Auto-layout must ignore `node.position` for derived graphs (all x=0). Using positions blindly stacks all nodes in a vertical column at x=0.
- **Saving a derived graph verbatim through FlowGraphField before relaxing the UUID constraint:** `updateSopFlowGraph` runs `FlowGraphSchema.safeParse()` which requires UUIDs on id/from/to. Derived non-step nodes will fail validation until the schema is relaxed.
- **Adding EXPORT-PNG code as a static top-level import:** Keep the canvas/blob logic co-located in `FlowGraphCanvas.tsx` as an async function called on button click. No dynamic import needed (it uses only browser-native APIs).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph auto-layout | Custom force-directed algorithm | Existing longest-path depth layering (already in layout()) | SOP graphs are shallow DAGs (≤3 branch depth in practice); force-directed is overkill and adds bundle weight |
| Zoom/pan gestures | Custom touch event handler | `viewBox` attribute update on `wheel` + `pointer` events | SVG viewBox is the canonical scaling primitive; no gesture library needed for this scope |
| Export-PNG | `html2canvas`, `dom-to-image`, `canvg` | `XMLSerializer` + native Canvas API | These libraries are 50–200 KB; native approach is ~15 lines of code |
| Viewport detection | `react-responsive`, `usehooks-ts` | Existing `useViewport` hook (`src/hooks/useViewport.ts`) | Already ships in the repo; same SSR-safety guarantees already proven in Phase 15 |
| CSS variable resolution in exported SVG | External SVG-to-canvas library | `getComputedStyle` inline scan before serialisation | Total implementation is ~10 lines; avoids any new bundle weight |

**Key insight:** This phase is productionisation of existing code, not new infrastructure. Every technical problem has a native or in-repo solution. The bundle gate constraint reinforces this: any library addition risks blowing the ±2 KB tolerance, so zero-dep approaches are not just acceptable — they are required.

---

## FLOW-02 Coverage Analysis

The 7 existing tests in `src/lib/sop/__tests__/flow-graph-derivation.test.ts` cover:

| Test | Requirement axis | Status |
|------|-----------------|--------|
| linear step chain → sequential edges only | basic derivation, sequential kind | PASS |
| typed blocks become typed nodes | MeasurementBlock, DecisionBlock, EscalateBlock, SignOffBlock | PASS |
| decision with resolved nextStepId → yes/no + suppressed linear | branch edges, label propagation | PASS |
| decision option flagged isEscalation → escalate edge | escalate kind | PASS |
| decision with no resolvable targets → collapses to sequential | unresolved-branch collapse | PASS |
| no node-worthy content blocks → linear fallback from sop_steps | backward-compat fallback | PASS |
| sections honour sort_order | multi-section ordering | PASS |

**Missing coverage axes (minor):**
- InspectBlock and ZoneBlock nodes (mapped in `PUCK_TYPE_TO_NODE` but no dedicated test)
- Edge label truncation (60-char cap on `opt.label`)
- Multi-section branch: decision in section A with `nextStepId` targeting a step in section B

These are low-risk: InspectBlock/ZoneBlock paths are structurally identical to EscalateBlock. The planner should add 1–2 tests for these axes in the Wave-0 spec task but no rework of `flow-graph.ts` is needed.

**Conclusion:** FLOW-02 is confirmed shipped and well-covered. No code changes needed unless the coverage gap tests reveal a bug.

---

## FLOW-05 Round-Trip Analysis

### What the FlowGraphField currently does [VERIFIED: src/lib/builder/flow-graph-field.tsx]

1. `FlowGraphField` is a Puck `root.fields.flowGraph` custom field rendered inside the right-rail panel in the Puck builder.
2. It receives `value` (the current `sops.flow_graph` JSON, pre-loaded from `initialSop.flow_graph` in `BuilderClient.tsx`) and `onChange` (Puck's state updater for root props).
3. `FlowGraphEditor` manages local node/edge state. The **Save to SOP** button calls `updateSopFlowGraph({ sopId, graph: localGraph })` — a direct server action that writes to `sops.flow_graph`, bypassing Puck's `onChange`.
4. `handleAddNode` generates nodes with `crypto.randomUUID()` — these are valid UUIDs. Edges are created between node ids, so they are also UUIDs. ✓

### UUID conflict: where it actually matters [VERIFIED]

The conflict is **not** between FlowGraphField-authored graphs and the schema — those are fine (crypto.randomUUID). The conflict is between the schema and `deriveFlowGraph` output:

| Node type | id assigned by | UUID? |
|-----------|---------------|-------|
| step | `step.id` (from `sop_steps.id`, a Postgres-generated UUID) | YES |
| non-step (measurement/decision/etc.) | `props.junctionId \|\| props.id \|\| section.id:index` | NOT GUARANTEED |

If an admin opens `FlowGraphField` and the `initialGraph` comes from a derived graph (via `FlowGraphSchema.safeParse` which would fail for non-UUID ids), the editor starts empty (`{ version:1, nodes:[], edges:[] }`). So in practice, the existing code already partially protects against the problem: a derived graph with non-UUID ids fails to load into the editor, so the author always starts fresh.

**However**, the `FlowTab` read path uses `FlowGraphSchema.safeParse` too. If a derived graph were somehow stored (e.g. via a future API or direct Supabase write), it would also fail to display as an explicit graph. The cleaner fix is to relax the schema.

### Resolution: Relax to `z.string().min(1)`

```typescript
// src/lib/validators/flow-graph.ts — BEFORE
id: z.string().uuid(),

// AFTER
id: z.string().min(1),
// edge from/to: same change
from: z.string().min(1),
to: z.string().min(1),
// stepId stays uuid() — it references sop_steps.id which is always UUID
stepId: z.string().uuid().optional(),
```

**Consequences:**
- `FlowTab.stepMap` lookup (`stepMap.get(node.id)`) keeps working — step nodes still get `step.id` (UUID) as their id; the map still finds them.
- `updateSopFlowGraph` server action: the relaxed schema still validates shape/length; the 256KB size gate remains.
- `FlowGraphField` editor: `handleAddNode` still uses `crypto.randomUUID()` — explicitly authored nodes remain UUIDs. No change to editor behaviour.
- No migration needed: `sops.flow_graph` is a JSONB column; no schema constraint on UUID format at the DB level.

### Round-trip verification steps for FLOW-05

The Phase 12.5 FlowGraphField round-trip is a carried human-UAT item because it was never browser-verified. The planner should include these as a human-UAT checklist:

1. Open the builder for any SOP that has Puck layout_data with Decision/Measurement blocks.
2. Click "Flow" in the builder header → modal shows FlowGraphCanvas with derived graph (may be empty if current schema fails — confirms the UUID bug).
3. In the right-rail, the Flow Graph field shows the editor. Add nodes, drag to position, Save.
4. Reload the builder page. Confirm `flow_graph` persisted (check Network tab or Supabase Studio).
5. Open the worker Flow tab (`/sops/[sopId]`). Confirm graph shows explicit positions (nodes are not auto-laid-out in depth columns).
6. Confirm `ViewToggle` switch between List and Graph works with explicit graph.

---

## Common Pitfalls

### Pitfall 1: CSS Variables Don't Resolve in Serialised SVG

**What goes wrong:** After switching FlowGraphCanvas from hardcoded hex to `var(--accent-*)` fills, `XMLSerializer` produces SVG where fill attributes are the literal string `var(--accent-step, #1e40af)`. A standalone SVG document has no access to the host page's CSS — so the canvas `drawImage` renders all fills as black.

**Why it happens:** `XMLSerializer` serialises DOM attributes, not computed styles. CSS variables are resolved at paint time by the browser layout engine, not stored in the DOM.

**How to avoid:** Clone the SVG before serialisation. Walk all elements. For each element, read `getComputedStyle(liveEl).fill` and `getComputedStyle(liveEl).stroke` from the **live** DOM element (where CSS vars have been resolved), then write those concrete colour values onto the **clone** element's `style` attribute before serialising.

**Warning signs:** Exported PNG shows all nodes as dark/black rectangles with no colour differentiation.

### Pitfall 2: Hydration Mismatch on Viewport-Based Default View

**What goes wrong:** Using `useState(() => window.innerWidth >= 1024 ? 'graph' : 'list')` causes a React hydration error (#418) because the server renders with no `window` (defaults to true or throws), while the client has the real window width.

**Why it happens:** State initialiser functions run on both server and client. `window` is not defined on the server.

**How to avoid:** Always seed `useState<'list' | 'graph'>('list')` (SSR-safe constant). Reconcile in `useEffect` using `useViewport()`. This is the exact pattern established in Phase 15 and documented in CLAUDE.md 2026-06-08.

**Warning signs:** `Minified React error #418` in production console; `Server: List Client: Graph` diff in `next dev` non-minified warning output.

### Pitfall 3: layout() Called with Explicitly-Positioned Graph Stacks All Nodes at X=0

**What goes wrong:** The current auto-layout path computes `startX` from the number of nodes in a depth layer and `COLW`. If explicit positions are passed through auto-layout instead of the `layoutFromPositions` path, all nodes get x-positions calculated from their depth layer widths, ignoring the authored x. The result visually drops all manual positioning.

**Why it happens:** The prototype `layout()` function does not read `node.position` at all.

**How to avoid:** Check `hasExplicitPositions()` at the top of `layout()` and branch.

**Warning signs:** After saving positions in FlowGraphField and reopening the Flow tab, all nodes appear in centred depth-layer columns rather than their dragged positions.

### Pitfall 4: PREVIEW Pill and Toggle Label in Multiple Places

**What goes wrong:** FLOW-04 requires removing the PREVIEW label. The prototype has it in two places: (1) `FlowGraphCanvas.tsx` line 115 — `<span className="pill" style={{ opacity: 0.7 }}>PREVIEW</span>` in the canvas toolbar; (2) `FlowTab.tsx` line 24 — `'Graph (preview)'` text in `ViewToggle`. The `BuilderFlowButton.tsx` also has a PREVIEW pill in the modal header (line 76). All three need updating.

**How to avoid:** Grep for `PREVIEW` and `preview` in the flow-related files before marking FLOW-04 done.

### Pitfall 5: FlowGraphField's `onChange` Prop Is Wired but Not Used

**What goes wrong:** `FlowGraphField` receives `onChange` from Puck (for updating root props) but `handleSave` in `FlowGraphEditor` calls `updateSopFlowGraph` directly (bypassing Puck's change system). This means Puck's in-memory state (`data.root.props.flowGraph`) is NOT updated when a graph is saved — it retains the initial value loaded at builder open time.

**Why it matters:** If the admin edits the flow graph and then triggers an autosave of the section layout (which serialises `data.root.props`), the stale `flowGraph` in Puck's root props will NOT overwrite the persisted value (because `updateSopFlowGraph` wrote directly to Supabase and autosave doesn't re-save root props separately). In practice this is fine — the flow graph is persisted correctly by the server action — but calling `onChange(localGraph)` after save would keep Puck in sync and avoid any future confusion.

**How to avoid:** Call `_onChange(localGraph)` inside `handleSave` after a successful server action response. This is a polish fix, not a blocker.

---

## Code Examples

### Verified: existing `layout()` function shape to extend

The existing auto-layout function in `FlowGraphCanvas.tsx` (lines 41–85) takes a `FlowGraph` and returns `{ placed: Map<string, Placed>, width: number, height: number }`. The `Placed` interface is local. The extension strategy is to add `hasExplicitPositions()` check at line 42 and branch to `layoutFromPositions()` which constructs the same return shape from `node.position` values.

### Verified: `useViewport` import path

```typescript
import { useViewport } from '@/hooks/useViewport'
```

Returns `'mobile' | 'desktop'`, starts as `'mobile'`, updates after mount. No SSR risk.

### Verified: FlowGraphSchema relaxation

Current `src/lib/validators/flow-graph.ts` (22 lines total):
- Line 6: `id: z.string().uuid()` → change to `z.string().min(1)`
- Line 13: `from: z.string().uuid()` → change to `z.string().min(1)`
- Line 13: `to: z.string().uuid()` → change to `z.string().min(1)`
- Line 15: `stepId: z.string().uuid().optional()` → KEEP as uuid (stepId always links to sop_steps.id)

### Verified: PREVIEW locations to remove

```
src/components/sop/flow/FlowGraphCanvas.tsx:115  <span className="pill" ...>PREVIEW</span>
src/components/sop/tabs/FlowTab.tsx:24            'Graph (preview)'
src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx:76  <span className="pill">PREVIEW</span>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| list-only Flow tab | list + graph toggle ("Graph (preview)") | b223786 / c1440fc (2026-06-09/10) | Graph exists but hidden; Phase 24 makes it the default |
| Sequential-edge-only derivation | Branch-aware derivation (yes/no/escalate from DecisionBlock) | b223786 | Now reflects real SOP decision logic |
| Scrolls-to-top-left "Fit" button | (Phase 24) Real viewBox-based zoom-to-fit | This phase | Users can orient a large graph in one click |

**Deprecated/outdated:**
- `FlowGraphCanvas` hardcoded hex colour palette: diverges from `FlowTab` TYPE_COLORS CSS vars. Must be unified in this phase per CONTEXT.md locked decision.
- `useState<'list' | 'graph'>('list')` in `FlowTab`: becomes `useState('list')` with a `useEffect` that upgrades to `'graph'` on desktop.

---

## Environment Availability

Step 2.6: SKIPPED — this phase makes no external tool, service, runtime, or CLI utility calls. All changes are to TypeScript/React source files using existing dependencies and native browser APIs.

---

## Runtime State Inventory

Step 2.5: Not a rename/refactor/migration phase. No runtime state inventory required.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.x (existing) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase24-unit` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| FLOW-01a | `hasExplicitPositions()` returns true when any node.x !== 0 | unit | `npx playwright test --project=phase24-unit -g "explicit positions"` | ❌ Wave 0 |
| FLOW-01b | `layout()` honours authored positions (placed map = node.position values) | unit | `npx playwright test --project=phase24-unit -g "layout honours"` | ❌ Wave 0 |
| FLOW-01c | `layout()` auto-layouts when all x=0 (existing auto-layout behaviour unchanged) | unit | `npx playwright test --project=phase24-unit -g "auto layout"` | ✅ (implicit — existing tests pass through layout) |
| FLOW-02 | All 7 existing derivation tests pass | unit | `npx playwright test --project=phase24-unit` | ✅ Exists (`flow-graph-derivation.test.ts`) |
| FLOW-02a | InspectBlock / ZoneBlock → correct node types | unit | `npx playwright test --project=phase24-unit -g "inspect zone"` | ❌ Wave 0 |
| FLOW-03a | fitToView() produces a viewBox covering all nodes | unit/source-contract | `npx playwright test --project=phase24-unit -g "fit"` | ❌ Wave 0 |
| FLOW-03b | exportPng() calls canvas.toBlob (source-contract: function exists and calls canvas API) | source-contract | `npx playwright test --project=phase24-stubs -g "export png"` | ❌ Wave 0 |
| FLOW-04a | FlowTab default view = 'graph' on desktop (source-contract: useViewport used, initial state = 'list') | source-contract/lint | `npx playwright test --project=phase24-stubs -g "desktop default"` | ❌ Wave 0 |
| FLOW-04b | PREVIEW pill/label absent from all three locations | lint guard | `npx playwright test --project=phase24-stubs -g "no preview"` | ❌ Wave 0 |
| FLOW-05a | FlowGraphSchema accepts non-UUID node ids (z.string().min(1)) | unit | `npx playwright test --project=phase24-unit -g "schema"` | ❌ Wave 0 |
| FLOW-05b | FlowGraphField round-trip: save positions → persists to sops.flow_graph → renders explicit in FlowTab | **human-UAT** | Manual — see FLOW-05 round-trip checklist above | N/A |

### Test Project Registration

The existing `phase24-unit` project in `playwright.config.ts` already targets `src/lib/sop/__tests__/flow-graph-derivation.test.ts`. A second project `phase24-stubs` must be added for source-contract/lint tests that live in `tests/` or `src/components/sop/flow/__tests__/`:

```typescript
// playwright.config.ts addition — Wave 0 task
{
  name: 'phase24-stubs',
  testDir: '.',
  testMatch: /(flow-graph-canvas|no-preview-pill)\.spec\.ts$/,
},
```

Per the 2026-05-25 CLAUDE.md learning: any new spec file not matched by a project regex NEVER runs. Validate with `npx playwright test --list --project=phase24-stubs | grep flow-graph-canvas` after adding.

### Sampling Rate

- **Per task commit:** `npx playwright test --project=phase24-unit`
- **Per wave merge:** `npx playwright test --project=phase24-unit && npx playwright test --project=phase24-stubs`
- **Phase gate:** Full suite + `npx tsx scripts/check-bundle-size.ts` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/sop/__tests__/flow-graph-derivation.test.ts` — add: inspect/zone node tests, cross-section branch target test (append to existing file)
- [ ] `tests/lint/no-preview-pill.spec.ts` — grep that "PREVIEW" string absent from FlowGraphCanvas.tsx, FlowTab.tsx, BuilderFlowButton.tsx
- [ ] `src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts` — source-contract: fitToView ref + exportPng function present; useViewport imported in FlowTab; initial state = 'list'
- [ ] `playwright.config.ts` — add `phase24-stubs` project matching the two new spec filenames
- [ ] `src/lib/validators/__tests__/flow-graph-schema.spec.ts` — schema accepts `z.string().min(1)` ids, rejects empty string, stepId still requires UUID

---

## Security Domain

No new attack surfaces introduced. The only write path is the existing `updateSopFlowGraph` server action (already ships admin/safety_manager role gate + Zod validation + 256KB size cap). EXPORT-PNG is a pure client-side operation generating a local download with no network call. No new API routes.

ASVS V5 (Input Validation) is already handled: `FlowGraphSchema` validates all graph input at the server action boundary.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `FlowGraphField` is mounted and the Flow Graph field visible in the Puck right-rail during builder sessions — never verified by human-UAT (carried Phase 12.5 item) | FLOW-05 Round-Trip Analysis | If the field is not surfaced (e.g. root fields are hidden by the Phase 21.6 sidebar suppression), the round-trip cannot be completed. Planner must include a human-UAT step to verify the field is reachable in the current builder UI before writing FLOW-05 implementation tasks. |
| A2 | `FlowGraphField` onChange path through Puck root props is not used for autosave (autosave writes section layout_data, not root props) | FLOW-05 Pitfall 5 | If autosave does serialise root props and send them to Supabase, stale flowGraph could overwrite a freshly saved explicit graph. Inspect BuilderClient autosave flow to confirm. |
| A3 | `hasExplicitPositions()` discriminant (any node.x !== 0) correctly distinguishes derived from explicit graphs | FLOW-01 Pattern | If FlowGraphField ever places a node at x=0 (initial position for first node added), and no other node is moved, the graph would be treated as auto-layout. Low risk: first node starts at x=0 but `snapToGrid(ns.length * 100)` is for y; subsequent nodes and any drag move x off 0. |

**If this table is empty for A2:** Planner should add a verification step to read BuilderClient autosave code and confirm root props are not included in the autosave payload.

---

## Open Questions

1. **Is FlowGraphField visible in the current Phase 21.6 builder UI?**
   - What we know: Phase 21.6 suppressed the Puck palette and outline; it moved content editing into the canvas. The `FlowGraphField` is a `root.fields` field, which renders in the Puck right-rail (not the component palette). Phase 21.6's changes targeted the component palette/outline, not root fields.
   - What's unclear: Whether the Phase 21.6 `BuilderClient` / sidebar changes inadvertently hide root fields entirely.
   - Recommendation: Planner adds a human-UAT checkpoint as the first task of FLOW-05 wave: "Open any SOP in the builder, confirm the Flow Graph field appears in the right panel."

2. **Should EXPORT-PNG embed fonts?**
   - What we know: JetBrains Mono and Inter are loaded via `@font-face` in the app but as web fonts from Google Fonts / local. A serialised SVG cannot reference external URLs for fonts.
   - What's unclear: Whether Puck's engineering-drawing aesthetic requires pixel-perfect JetBrains Mono in the export, or whether system monospace is acceptable for v1.
   - Recommendation: Use system fallback for v1 (no font embedding). Document the gap in the verification checklist. Font embedding is deferred to post-v1 polish.

3. **Does autosave overwrite flow_graph?**
   - What we know: `BuilderClient` autosave debounces section `layout_data` writes via `updateSectionLayout`. `flow_graph` is a top-level SOP column, not inside any section.
   - What's unclear: Whether any code path serialises `data.root.props.flowGraph` from Puck state and writes it to the SOP. If it does, and Puck's in-memory root props contain a stale graph (A2), a section autosave could clobber a manually saved flow graph.
   - Recommendation: Grep `updateSop` and the autosave actions for `flow_graph` before writing FLOW-05 tasks.

---

## Sources

### Primary (HIGH confidence)

- `src/components/sop/flow/FlowGraphCanvas.tsx` — live prototype code; all layout/rendering findings verified against actual implementation
- `src/lib/sop/flow-graph.ts` — live derivation logic; node id assignment and branch edge logic confirmed
- `src/lib/validators/flow-graph.ts` — live schema; UUID constraints confirmed
- `src/components/sop/tabs/FlowTab.tsx` — live tab; explicit/derived resolution, TYPE_COLORS vars, stepMap lookup confirmed
- `src/lib/builder/flow-graph-field.tsx` — live FlowGraphField + FlowGraphEditor; UUID vs non-UUID node id confirmed
- `src/actions/flow-graph.ts` — live server action; role gate + Zod validation + 256KB cap confirmed
- `src/hooks/useViewport.ts` — live SSR-safe viewport hook; 'mobile' initial state confirmed
- `playwright.config.ts` — live test config; phase24-unit project registration confirmed
- `.bundle-baseline.json` — live baseline; 1104 KB confirmed
- `sketches/sop-blueprint/index.html` — FLOW tab design reference; FIT + EXPORT PNG button labels, SVG node structure, edge colours confirmed

### Secondary (MEDIUM confidence)

- `CLAUDE.md` § Learnings 2026-06-08 — SSR navigator/window-at-module-load pitfall and hydration mismatch diagnosis pattern [CITED: project file]
- `CLAUDE.md` § Learnings 2026-05-25 — unregistered Playwright spec files never run [CITED: project file]

### Tertiary (LOW confidence — none in this research)

All claims in this document are HIGH or MEDIUM confidence. No WebSearch-only sources used.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all capabilities verified in existing codebase
- Architecture (FLOW-01, layout): HIGH — live code confirms prototype gap; fix pattern is unambiguous
- Architecture (FLOW-03, export-PNG): HIGH — standard browser API; gotchas (CSS vars, font) are well-understood
- Architecture (FLOW-04, viewport): HIGH — useViewport hook ships and follows the established Phase 15 pattern exactly
- Architecture (FLOW-05, round-trip): MEDIUM — code paths verified; whether FlowGraphField is surfaced in Phase 21.6 builder UI unverified (A1)
- Pitfalls: HIGH — each pitfall derived from direct code inspection

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable codebase; no fast-moving external dependencies)
