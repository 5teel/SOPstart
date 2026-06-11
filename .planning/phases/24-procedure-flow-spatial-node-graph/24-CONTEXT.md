# Phase 24: Procedure Flow — Spatial Node Graph - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning
**Source:** Synthesized from prototype commits on master (`c1440fc`, `9a395bd`, `b223786`), the ROADMAP backlog entry (Simon, 2026-06-09), and the validated blueprint sketch (`sketches/sop-blueprint/index.html` → FLOW tab). No discuss-phase session — the design decisions were made during the 2026-06-09/10 prototype sessions and are encoded in shipped code.

<domain>
## Phase Boundary

Productionise the spatial node-graph Flow view that already exists as a prototype on master. The Flow tab (worker-facing, `/sops/[sopId]`) currently defaults to a vertical list of expandable step cards with the graph hidden behind a "Graph (preview)" toggle; the admin builder has a read-only Flow preview button (`BuilderFlowButton`). This phase makes the graph the production desktop default, adds real FIT + EXPORT-PNG controls, honours explicitly-authored node positions, and verifies the Phase 12.5-carried Puck `FlowGraphField` round-trip.

**Already shipped (do NOT rebuild):**
- `src/components/sop/flow/FlowGraphCanvas.tsx` — pure-SVG renderer: longest-path depth layering with cycle guard, centered rows, bezier edges with arrowheads, yes/no/escalate edge labels (escalate red), colour-coded nodes with left accent bar + JetBrains Mono type label, 2-line label wrap, node/branch count pills.
- `src/lib/sop/flow-graph.ts` — branch-aware derivation from each section's Puck `layout_data.content[]` (NOT `sop_steps`): nodes from StepBlock/StepWithPhotosBlock/Measurement/Decision/Escalate/SignOff/Inspect/Zone blocks; step blocks zipped to `sop_steps` by index so step nodes keep real step UUIDs; DecisionBlock.options[] emit yes/no/escalate branch edges (suppressing the linear edge only when ≥1 option resolves to an explicit `nextStepId`); linear-step fallback when no node-worthy content exists.
- `src/components/sop/__tests__/flow-graph-derivation.test.ts` — 216-line derivation test suite, registered in `playwright.config.ts` (satisfies the 2026-05-25 lint-guard learning).
- `BuilderFlowButton.tsx` + `BuilderStageShell.tsx` wiring — admin builder Flow preview.
- `FlowTab.tsx` — list/graph ViewToggle (defaults to list), explicit `sop.flow_graph` Zod-validated with derived fallback.

</domain>

<decisions>
## Implementation Decisions

### Rendering approach (locked by prototype)
- Pure hand-rolled SVG — no graph library (dagre/elkjs/reactflow). The prototype proves depth-layer auto-layout suffices for SOP-scale graphs. Do not add a layout dependency unless research finds a hard blocker.
- **Bundle gate constraint:** `FlowGraphCanvas` is statically imported into `FlowTab` on the `/sops/[sopId]` route, which carries the 1104 KB ±2 KB First-Load-JS baseline gate (`.bundle-baseline.json`, `scripts/check-bundle-size.ts`). Any added weight (export-PNG code, new deps) must respect the gate — dynamic-import if needed.

### Visual language (locked by sketch + prototype)
- Paper/ink system per `sketch-findings-SOPstart`: grid-paper background (`bg-grid`), JetBrains Mono node-type labels, Inter node text, rounded-rect nodes with 4px left accent bar, curved bezier edges, escalate edges/arrowheads red.
- **Unify colour tokens:** `FlowGraphCanvas` hardcodes hex colours that DIVERGE from `FlowTab`'s `TYPE_COLORS` CSS vars (e.g. decision is pink `#db2777` in the canvas but amber `var(--accent-decision, #d97706)` in the list; measurement orange vs teal). Production version must use the single `--accent-*` CSS-var token set for both views.

### Behaviour (locked by roadmap scope)
- FLOW-01: Auto-layout for derived/linear graphs AND honour explicit node positions. **Known gap:** the prototype's header comment claims it honours `node.position` when x's are distinct, but `layout()` never reads positions — this is unimplemented. Implement it for real (explicit positions from Puck `FlowGraphField` authoring win; auto-layout otherwise).
- FLOW-03: FIT must be a real zoom-to-fit (the current button only scrolls to top-left). EXPORT-PNG downloads the rendered graph as a PNG.
- FLOW-04: Graph becomes the desktop default view; the step-card list remains as the mobile default and an always-available fallback toggle. Remove the "PREVIEW" pill and "(preview)" toggle label.
- FLOW-05: Verify the Puck `FlowGraphField` round-trip end-to-end: author positions in builder → persists to `sops.flow_graph` → explicit graph renders in Flow tab. **Known risk:** `FlowGraphSchema` requires `nodes[].id` and `edges[].from/to` to be UUIDs, but `deriveFlowGraph` assigns non-step nodes `props.junctionId || props.id || section.id:index` — Puck props ids are not guaranteed UUIDs. A derived graph saved verbatim through `FlowGraphField` may fail schema validation. Resolve (relax schema vs normalise ids) as part of FLOW-05.
- FLOW-02 (branch-aware derivation) shipped in `b223786` with tests — verify coverage against the requirement, no rework unless gaps found.

### Safety / regression fences
- The list view's node.id === step.id lookup contract (`FlowTab` `stepMap`) must keep working — step nodes must keep real step UUIDs.
- Walkthrough, completion, and offline behaviour are untouched — this phase is read-only presentation over existing data.
- `journeys.ts` standing rule: no new routes expected; if the Flow tab's default-view behaviour is considered a flow change, update `src/lib/journeys/journeys.ts` in the same commit per CLAUDE.md.

### Claude's Discretion
- Zoom/pan interaction details (wheel zoom, drag pan, pinch) — scope to what FIT/EXPORT need; full pan-zoom is optional polish.
- EXPORT-PNG implementation (SVG serialise → canvas rasterise vs other) — pick the lightest approach that works offline and respects the bundle gate.
- Desktop-vs-mobile detection mechanism for the default view (CSS breakpoint vs `useViewport`-style hook — note the [2026-05-13]/Phase 15 SSR-safety learnings: never derive first render from `window`).
- Node click behaviour in graph view (e.g. open the corresponding step card / scroll list) — nice-to-have, planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Validated design
- `sketches/sop-blueprint/index.html` (FLOW tab) — the spatial node-graph design this phase implements
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — paper/ink tokens, layout primitives, validated patterns

### Shipped prototype (the code being productionised)
- `src/components/sop/flow/FlowGraphCanvas.tsx` — SVG renderer prototype
- `src/lib/sop/flow-graph.ts` — branch-aware `deriveFlowGraph` (shipped, tested)
- `src/lib/validators/flow-graph.ts` — `FlowGraphSchema` (UUID id constraint — see FLOW-05 risk)
- `src/components/sop/tabs/FlowTab.tsx` — list/graph toggle, explicit-vs-derived graph resolution
- `src/components/sop/__tests__/flow-graph-derivation.test.ts` — derivation contract tests
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx` — builder preview entry
- Puck `FlowGraphField` (Phase 12.5; locate in builder puck-config/fields) — explicit-position authoring surface

### Gates and rules
- `.bundle-baseline.json` + `scripts/check-bundle-size.ts` — `/sops/[sopId]` First-Load-JS gate (1104 KB ±2 KB)
- `playwright.config.ts` — any new `tests/lint/` or spec file MUST be matched by a project regex (2026-05-25 learning)
- `CLAUDE.md` § Pathways Map Maintenance — journeys.ts same-commit rule

</canonical_refs>

<specifics>
## Specific Ideas

- The blueprint sketch's FLOW tab shows: FIT and EXPORT PNG buttons in the toolbar, node/branch count chips, colour-coded node columns for branches, yes/no labels on decision edges, red escalate path.
- Prototype's `wrap()` 2-line / 22-char label truncation with ellipsis is acceptable production behaviour.
- Edge labels prefer `edge.label` (DecisionBlock option label, ≤60 chars) over the generic Yes/No/Escalate.

</specifics>

<deferred>
## Deferred Ideas

- Drag-to-reposition nodes directly on the Flow tab canvas (authoring stays in the Puck builder via `FlowGraphField`)
- Minimap / overview inset for very large graphs
- Animated walkthrough-progress highlighting on the graph
- Export formats beyond PNG (SVG/PDF)

</deferred>

---

*Phase: 24-procedure-flow-spatial-node-graph*
*Context gathered: 2026-06-11 (synthesized from prototype + roadmap + sketch)*
