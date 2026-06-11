# FLOW-05 Round-Trip Investigation

**Investigated:** 2026-06-11 (Plan 01 execution)
**Status:** Code-confirmed findings — directs Plan 03 implementation

---

## Background

FLOW-05 covers the round-trip path between the admin builder and the stored `sops.flow_graph` column:
- How does the admin edit a flow graph in the builder?
- Can autosave clobber an explicitly-saved flow graph?
- Is the `hasExplicitPositions` discriminant (used to detect editor-authored vs derived layouts) sound?

---

## Finding 1: FlowGraphField is CURRENTLY UNREACHABLE in the 21.6 builder UI

**Code location:** `src/lib/builder/puck-config.tsx` lines 203–215

`FlowGraphField` is registered as a `root.fields.flowGraph` custom field:

```typescript
// puck-config.tsx line 206
flowGraph: {
  type: 'custom' as const,
  render: ({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) => (
    <FlowGraphField value={value} onChange={onChange} />
  ),
},
```

Puck renders `root.fields` inside its **right sidebar**. However, `BuilderClient.tsx` line 535 passes:

```typescript
ui={{ leftSideBarVisible: false, rightSideBarVisible: false }}
```

This suppresses the right sidebar entirely. The `FlowGraphField` editor is therefore **unreachable from the current builder UI** — there is no way for an admin to open or edit the flow graph from within the 21.6 Puck editor as it stands.

**Conclusion for Plan 03:** FLOW-05 implementation MUST re-surface the FlowGraphEditor via a builder entry point that does **not** rely on Puck's suppressed right sidebar. The recommended approach (from Plan 03 scope): a portaled modal/panel similar to `BuilderFlowButton.tsx`, mounting `FlowGraphEditor` with `initialGraph + sopId` directly. This component needs no Puck context — `updateSopFlowGraph` is a standalone server action.

---

## Finding 2: Autosave CANNOT clobber a saved flow graph (A2 resolved)

**Code location:** `src/hooks/useBuilderAutosave.ts`

`useBuilderAutosave` writes **only** `layout_data` to Dexie, keyed per `section_id`:

```typescript
// useBuilderAutosave.ts — the only write
await db.draftLayouts.put({
  section_id: sectionId,
  sop_id: sopId,
  layout_data: data,          // ← section layout_data only
  layout_version: CURRENT_LAYOUT_VERSION,
  updated_at: now,
  syncState: 'dirty',
  _cachedAt: now,
})
```

It **never serialises `root.props.flowGraph`** to `sops.flow_graph`. The sole writer of `sops.flow_graph` is `updateSopFlowGraph` (called by `FlowGraphEditor.handleSave`). The autosave path and the flow graph save path are **completely separate** — autosave operates on `section_layout_data` rows, not on the SOP-level `flow_graph` column.

**Conclusion:** A2 resolved. No defensive change needed. Plan 03 does NOT need to add guards against autosave clobbering the flow graph.

---

## Finding 3: `hasExplicitPositions` discriminant is sound (minor edge case noted)

**Code location:** `src/components/sop/flow/FlowGraphCanvas.tsx` (prototype, Plan 02/03 will productionise)

The discriminant `graph.nodes.some(n => n.position.x !== 0)` distinguishes:
- **Derived graphs:** all nodes have `x: 0` (position is ignored; auto-layout takes over)
- **Editor-authored graphs:** at least one node has `x !== 0` (drag has occurred in the editor)

`FlowGraphEditor.handleAddNode` seeds new nodes at `x: 0`, but dragging snaps `x` off zero. The only edge case is a single node that was added but never dragged — it remains at `x: 0` and therefore looks "derived". This is acceptable: a single un-dragged node in a flow graph with no explicit layout is indistinguishable from a derived initial position, and showing the auto-layout is the safer fallback.

**Conclusion:** The discriminant is sound for its purpose. No change needed.

---

## Directive for Plan 03

**Re-surface FlowGraphEditor via a builder entry point that does not rely on Puck's suppressed right sidebar.**

Concretely: mount `FlowGraphEditor` (with `initialGraph` seeded from `sop.flow_graph` and a `sopId` prop) inside a portaled modal or panel triggered from a builder chrome button (analogous to `BuilderFlowButton.tsx`). The editor calls `updateSopFlowGraph` directly and requires no Puck context.
