---
phase: 24-procedure-flow-spatial-node-graph
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
  - src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts
  - src/components/sop/flow/FlowGraphCanvas.tsx
  - src/components/sop/tabs/FlowTab.tsx
  - src/lib/journeys/journeys.ts
  - src/lib/sop/__tests__/flow-graph-derivation.test.ts
  - src/lib/validators/__tests__/flow-graph-schema.spec.ts
  - src/lib/validators/flow-graph.ts
  - tests/lint/no-preview-pill.spec.ts
findings:
  critical: 2
  warning: 9
  info: 4
  total: 15
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Phase 24 spatial node-graph flow view: schema relaxation, SVG canvas renderer (fit/export), desktop-default FlowTab, and the two builder header entry points, plus the test suite and journeys map.

**What checks out:**

- **Puck-hook safety (CLAUDE.md 2026-06-08):** `BuilderFlowEditButton` and the `FlowGraphEditor` it mounts call no Puck hook (`useGetPuck`/`usePuck` absent from `flow-graph-field.tsx`) — the portaled modal outside `<Puck>` is safe.
- **Hydration safety (CLAUDE.md 2026-06-08):** `FlowTab` seeds `useState('list')` and reconciles to `'graph'` via post-hydration `useViewport` effect; `useViewport` itself reads `window.matchMedia` only inside `useEffect`. No `navigator`/`window` at first render. The `dynamic(..., { ssr: false })` import keeps the canvas out of the SSR path and the First-Load-JS bundle.
- **Spec registration (CLAUDE.md 2026-05-25):** all four new test files are picked up — `flow-graph-derivation.test.ts` by project `phase24-unit` (playwright.config.ts:77-79), the other three by `phase24-stubs` regex `(no-preview-pill|flow-graph-canvas|flow-graph-schema)\.(test|spec)\.ts$` (playwright.config.ts:133-135).
- **Wiring-not-token specs (CLAUDE.md 2026-06-05):** `flow-graph-canvas.spec.ts` asserts the `onClick` handlers reference `fitToView`/`exportPng`, not just that the strings exist.
- **journeys.ts:** no new route was added (the flow modal lives inside the already-mapped `/admin/sops/builder/[sopId]`); the `find-follow-sop` detail text was updated for the desktop graph default. Coverage intact.
- **Schema relaxation:** `min(1)` ids with `stepId` kept as `.uuid()` matches the derivation's non-UUID junction ids; tests cover the contract including the empty-string rejection.

**Key concerns:** the Fit button's zoom math is quantitatively wrong (renders at scale² — the headline FLOW-03 feature, and a textbook instance of the 2026-06-05 trap: the source-contract spec proves it is *wired*, not that it is *correct*); and the edit-save-reopen loop silently re-seeds from stale server props, creating a save-clobber path. The `updateSopFlowGraph` write path (reached from a reviewed file, and whose security properties `BuilderFlowEditButton`'s header comment vouches for) gates on client-editable `user_metadata` and reports success on zero-row RLS-filtered updates.

## Critical Issues

### CR-01: `fitToView` double-scales — graph renders at scale² instead of scale

**File:** `src/components/sop/flow/FlowGraphCanvas.tsx:131-141`
**Issue:** The viewBox is computed from **content** dimensions divided by scale (`vw = width / scale`) instead of **container** dimensions. With svg `width` set to `container.clientWidth` and viewBox `0 0 ${width/scale} ${height/scale}`, the browser's effective render scale is `min(cw/vw, ch/vh) = scale × min(cw/W, ch/H) = scale²`. Example: a 2000px-wide graph in a 1000px container should fit at 50%; this code renders it at 25%. A 4000px graph renders at ~6% instead of 25%. The error is invisible for small graphs (scale = 1 ⇒ vw = width, correct) and worst exactly when Fit is needed — long SOPs at the 50-500-SOP target market. Note the source-contract test (`flow-graph-canvas.spec.ts` test (a)) passes because it only asserts wiring — this is the exact failure mode the CLAUDE.md 2026-06-05 learning warns about.
**Fix:**
```tsx
const fitToView = useCallback(() => {
  const svg = svgRef.current
  const container = scrollRef.current
  if (!svg || !container) return
  const scale = Math.min(container.clientWidth / width, container.clientHeight / height, 1)
  // viewBox must cover the CONTAINER extent in content units, not the content extent re-divided
  svg.setAttribute('viewBox', `0 0 ${container.clientWidth / scale} ${container.clientHeight / scale}`)
  svg.setAttribute('width', String(container.clientWidth))
  svg.setAttribute('height', String(container.clientHeight))
}, [width, height])
```
Better still: hold a `fitted` flag in React state and compute `width`/`height`/`viewBox` in JSX, because the current `setAttribute` calls mutate React-managed attributes — any re-render (and `graph` prop identity changes every parent render, see WR-09) silently reverts the fit.

### CR-02: Saved flow layout silently reverted on modal reopen — stale-base overwrite path

**File:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx:56-62` (same pattern in `BuilderFlowButton.tsx:30-36`)
**Issue:** `initialGraph` is derived from `sop.flow_graph`, where `sop` is the server-fetched `initialSop` prop that is **never refreshed** after `FlowGraphEditor`'s "Save to SOP" succeeds (`handleSave` in `flow-graph-field.tsx:158-165` calls `updateSopFlowGraph` but never `router.refresh()` or any parent callback, and the modal unmounts on close). Sequence: open Edit flow → drag nodes → Save → close → reopen → editor re-seeds from the **pre-save** graph. The admin sees their saved layout "gone" (it isn't — it's in the DB), and if they tweak-and-save again from that stale base, the second save **overwrites the first save's layout**. This is the normal iterate loop for layout authoring, so the data-loss window is routine, not exotic. The "Flow" preview button exhibits the same staleness, reinforcing the false impression that the save failed.
**Fix:** Pass an `onSaved` callback from `BuilderFlowEditButton` into `FlowGraphEditor` and either (a) call `router.refresh()` so `initialSop` re-fetches, or (b) lift the last-saved graph into state in `BuilderStageShell`/`BuilderFlowEditButton` and prefer it over `sop.flow_graph` when seeding:
```tsx
// BuilderFlowEditButton
const [savedGraph, setSavedGraph] = useState<FlowGraph | null>(null)
const initialGraph = savedGraph ?? resolveFromSop(sop)
...
<FlowGraphEditor initialGraph={initialGraph} sopId={sopId} onSaved={setSavedGraph} />
```

## Warnings

### WR-01: `updateSopFlowGraph` reports success when the update wrote zero rows

**File:** `src/actions/flow-graph.ts:35-41` (write path of reviewed `BuilderFlowEditButton` → `FlowGraphEditor`)
**Issue:** `.update(...).eq('id', sopId)` without `.select()` returns no error when RLS filters out the row (wrong org, insufficient role per migration 00003's `admins_can_update_sops` policy) or when `sopId` doesn't exist — Supabase reports 0 affected rows as success. The action returns `{ success: true }`, the editor clears the error banner, and the admin believes the layout persisted when nothing was written.
**Fix:**
```ts
const { data, error } = await supabase
  .from('sops')
  .update({ flow_graph: ... })
  .eq('id', parsed.data.sopId)
  .select('id')
if (error) return { error: error.message }
if (!data || data.length === 0) return { error: 'SOP not found or you do not have permission to edit it' }
return { success: true as const }
```

### WR-02: Role gate built on client-editable `user_metadata` — diverges from canonical JWT-claims pattern

**File:** `src/actions/flow-graph.ts:26-33`
**Issue:** The gate reads `user.user_metadata['user_role']` **first** (line 27), falling back to `app_metadata`. Supabase `user_metadata` is end-user-writable via `supabase.auth.updateUser({ data: { user_role: 'admin' } })` — any authenticated worker can self-grant a passing role for this check, and the user-controlled value even takes precedence over the server-controlled `app_metadata`. The canonical pattern in this codebase (`src/actions/sops.ts:22-31`) decodes `user_role` from JWT claims. The exploit is backstopped end-to-end by the `sops` RLS UPDATE policy (`current_user_role() in ('admin','safety_manager')`, migration 00003:100-105), so this is not a live privilege escalation for the write itself — but the action-level gate is decorative, the action also omits the canonical `organisation_id` scoping, and `BuilderFlowEditButton.tsx:17-19`'s header comment overstates the guarantee ("existing admin/safety_manager role gate... T-24-05 mitigated").
**Fix:** Replace the metadata read with the JWT-claims pattern from `sops.ts`:
```ts
const { data: { session } } = await supabase.auth.getSession()
const jwtClaims = session?.access_token ? JSON.parse(atob(session.access_token.split('.')[1])) : {}
const role = jwtClaims['user_role']
if (!role || !['admin', 'safety_manager'].includes(role)) return { error: 'Admin access required' }
```

### WR-03: `hasExplicitPositions` heuristic discards authored layouts where every node has x = 0

**File:** `src/components/sop/flow/FlowGraphCanvas.tsx:44-46, 62`
**Issue:** Authored-vs-derived is inferred from "any node has `position.x !== 0`". The editor's `handleAddNode` places every new node at `x: 0` (`flow-graph-field.tsx:153`), and grid-snapped drags can legitimately land on x = 0 — so an admin who arranges nodes vertically (the editor's default stacking) saves a valid explicit graph that the canvas then misclassifies as derived and **silently re-lays-out**, discarding their authored y positions. The likely-confused admin re-edits and re-saves, compounding CR-02.
**Fix:** Don't infer from coordinates. The caller already knows the provenance (explicit `sop.flow_graph` parsed successfully vs `deriveFlowGraph` fallback) — pass it down: `<FlowGraphCanvas graph={graph} authored={isExplicit} />`, or persist a `layout: 'authored'` marker in the graph when saved from the editor.

### WR-04: Authored nodes at negative coordinates are clipped out of the canvas

**File:** `src/components/sop/flow/FlowGraphCanvas.tsx:49-58`
**Issue:** The editor allows dragging nodes to negative x/y (its own viewBox expands via `Math.min(0, ...)`, `flow-graph-field.tsx:53-54`), and the schema imposes no bound (`z.number()`). `layoutFromPositions` computes `width`/`height` from the max only and the SVG viewBox starts at `0 0` — any node with a negative coordinate renders partially or fully outside the visible area, invisible and unreachable by scroll.
**Fix:** Compute the bounding box including minima and offset:
```ts
const minX = Math.min(0, ...xs), minY = Math.min(0, ...ys)
for (const n of graph.nodes) placed.set(n.id, { ..., x: n.position.x - minX + PAD, y: n.position.y - minY + PAD })
const width = Math.max(...xs) - minX + NW + PAD * 2
const height = Math.max(...ys) - minY + NH + PAD * 2
```

### WR-05: `exportPng` has no error handling and leaks the object URL on failure

**File:** `src/components/sop/flow/FlowGraphCanvas.tsx:143-185, 197`
**Issue:** If the SVG image fails to load (`img.onerror`), the awaited promise rejects, the rejection escapes through `onClick={() => void exportPng()}` as an unhandled rejection, the user gets zero feedback, and `URL.revokeObjectURL(url)` on line 175 is never reached (leak). `canvas.toBlob` returning `null` (line 178) is also silently swallowed.
**Fix:** Wrap the body in `try/finally` (revoke in `finally`), and surface failure:
```ts
try {
  await new Promise<void>((resolve, reject) => { ... })
} catch {
  // toast / console.error('Flow export failed')
  return
} finally {
  URL.revokeObjectURL(url)
}
```

### WR-06: List view renders "0/N" step counter for non-step nodes

**File:** `src/components/sop/tabs/FlowTab.tsx:250-258` (rendered at 110-112)
**Issue:** `stepMap` is keyed by step UUID only; decision/measurement/escalate/signoff/inspect/zone nodes (junction ids) miss the lookup and get `stepNumber: 0`, so the list view prints `0/12` next to every non-step card — visibly wrong on any branch-bearing SOP, which is the core Phase 24 case.
**Fix:** Hide the counter when no step matched: `{entry.stepNumber > 0 && (<span ...>{entry.stepNumber}/{entry.totalSteps}</span>)}` — or number entries by their position in `entries`.

### WR-07: List view ignores `node.stepId` linkage — authored nodes lose step detail

**File:** `src/components/sop/tabs/FlowTab.tsx:251`
**Issue:** `stepMap.get(node.id)` only. Editor-authored nodes have `id = crypto.randomUUID()` with the linked step recorded in `stepId` (the editor exposes a dedicated "Linked Step ID" field whose sole purpose is this association, `flow-graph-field.tsx:395-412`). For any explicit graph, the list view fails the lookup and shows "No step detail available for this node" for every node — the linkage field is dead on the consumer side.
**Fix:** `const matched = stepMap.get(node.id) ?? (node.stepId ? stepMap.get(node.stepId) : undefined)`

### WR-08: Backdrop click / Escape discards unsaved flow edits without confirmation

**File:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx:91-94, 45-52`
**Issue:** A single stray click on the dark backdrop (which surrounds the modal on all sides) or an Escape press unmounts `FlowGraphEditor`, destroying all un-saved node positions/edges from what can be a long drag-editing session. No dirty check, no confirm.
**Fix:** Track dirtiness (compare editor state to `initialGraph`, or have `FlowGraphEditor` expose an `isDirty` callback) and gate close: `if (dirty && !window.confirm('Discard unsaved flow changes?')) return`. At minimum, drop backdrop-click-to-close for the editor modal (keep it on the read-only preview modal).

### WR-09: Unstable `graph` identity + stale `derivedGraph` deps defeat memoization and revert Fit

**File:** `src/components/sop/tabs/FlowTab.tsx:221-237`
**Issue:** Two related defects: (1) `derivedGraph`'s deps `[sop.id, sop.updated_at]` omit `sop` — if section/step content changes client-side without `updated_at` changing, the derived graph is stale. (2) On the explicit-graph path, `FlowGraphSchema.safeParse(sop.flow_graph)` runs on **every render** and `parsed.data` is a fresh object each time, so `graph` has a new identity per render — `entries`' memo and `FlowGraphCanvas`'s `useMemo(() => layout(graph), [graph])` recompute every render, and any FlowTab re-render passes a "new" graph that re-renders the canvas, restoring the React-managed `width/height/viewBox` attributes and **undoing a Fit the user just clicked** (interacts with CR-01's `setAttribute` approach).
**Fix:** Memoize the resolution:
```ts
const graph = useMemo(() => {
  if (sop.flow_graph != null) {
    const parsed = FlowGraphSchema.safeParse(sop.flow_graph)
    if (parsed.success) return parsed.data
    if (!warnedRef.current) { console.warn('[flow] explicit graph invalid, using derived', parsed.error); warnedRef.current = true }
  }
  return deriveFlowGraph(sop)
}, [sop])
```

## Info

### IN-01: Graph-resolution logic duplicated three times

**File:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx:30-36`, `BuilderFlowEditButton.tsx:56-62`, `src/components/sop/tabs/FlowTab.tsx:223-237`
**Issue:** The "explicit if valid, else derived" IIFE is copy-pasted in three files (the two builder buttons also re-run it on every `BuilderStageShell` render even while their modals are closed). A future schema change must be fixed in three places.
**Fix:** Extract `resolveFlowGraph(sop): FlowGraph` into `src/lib/sop/flow-graph.ts` and consume it everywhere (also resolves WR-09's memo shape cleanly).

### IN-02: `wrap()` does not truncate single words longer than 22 chars

**File:** `src/components/sop/flow/FlowGraphCanvas.tsx:109-123`
**Issue:** A single token > 22 chars (part numbers, chemical names — realistic in this domain) becomes an untruncated line that overflows the 168px node rect; the >2-line ellipsis heuristic (`words.join(' ').length > lines.join(' ').length`) is also length-approximate.
**Fix:** After building each line, hard-cap: `if (line.length > 22) line = line.slice(0, 21) + '…'`.

### IN-03: Breakpoint crossing re-forces graph view over an explicit user choice

**File:** `src/components/sop/tabs/FlowTab.tsx:217-219`
**Issue:** A desktop user who explicitly toggles to List gets force-switched back to Graph whenever the viewport re-crosses 1024px (window resize, tablet rotation), because the effect runs on every `viewport` change, not just the first desktop detection.
**Fix:** Guard with a one-shot ref: `if (viewport === 'desktop' && !userToggledRef.current) setView('graph')`, setting the ref in `ViewToggle`'s `setView`.

### IN-04: Exported PNG has a transparent background; object URL revoked synchronously after click

**File:** `src/components/sop/flow/FlowGraphCanvas.tsx:169-184`
**Issue:** No background fill is drawn before `drawImage`, so the PNG is transparent — near-black node labels (`#1c1b19`) are unreadable when the file is viewed on a dark surface (this app defaults to dark theme). Also `URL.revokeObjectURL(a.href)` immediately after `a.click()` can race the download start in some browsers.
**Fix:** `ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)` before drawing; defer revocation with `setTimeout(() => URL.revokeObjectURL(a.href), 1000)`.

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
