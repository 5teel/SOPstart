# Phase 24: Procedure Flow — Spatial Node Graph - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/sop/flow/FlowGraphCanvas.tsx` | component | transform (SVG layout + render) | self (prototype to productionise) | exact |
| `src/components/sop/tabs/FlowTab.tsx` | component | request-response (SSR-safe viewport default) | `src/hooks/useViewport.ts` + self | exact |
| `src/lib/validators/flow-graph.ts` | utility/config | transform (Zod schema) | self (3-line change) | exact |
| `src/lib/sop/flow-graph.ts` | utility | transform (graph derivation) | self (verify + extend test coverage) | exact |
| `tests/lint/no-preview-pill.spec.ts` (new) | test/lint-guard | — | `tests/lint/no-bulk-verify-ui.spec.ts` (pattern: grep-based absence guard) | role-match |
| `src/components/sop/flow/__tests__/flow-graph-canvas.spec.ts` (new) | test | — | `src/lib/sop/__tests__/flow-graph-derivation.test.ts` | role-match |
| `src/lib/validators/__tests__/flow-graph-schema.spec.ts` (new) | test | — | `src/lib/sop/__tests__/flow-graph-derivation.test.ts` | role-match |
| `playwright.config.ts` | config | — | existing `phase24-unit` / `phase21.6-stubs` project entries | exact |

---

## Pattern Assignments

### `src/components/sop/flow/FlowGraphCanvas.tsx` (component, transform)

**Analog:** self — prototype at lines 1–191. This is a productionisation, not a new file. All changes are within the existing module.

**Imports pattern** (lines 1–13 of current file):
```typescript
'use client'
import { useMemo, useRef } from 'react'
import type { FlowGraph } from '@/lib/validators/flow-graph'
```
For FLOW-03 (FIT + EXPORT-PNG), add `useCallback` to the import. No new npm imports.

**Current `layout()` shape to extend** (lines 41–85):
The function signature and return type that implementors must preserve:
```typescript
function layout(graph: FlowGraph): { placed: Map<string, Placed>; width: number; height: number }
```
Add `hasExplicitPositions()` check at the top of `layout()`, branch to `layoutFromPositions()`:
```typescript
function hasExplicitPositions(graph: FlowGraph): boolean {
  return graph.nodes.some((n) => n.position.x !== 0)
}

function layoutFromPositions(graph: FlowGraph): { placed: Map<string, Placed>; width: number; height: number } {
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

function layout(graph: FlowGraph): { placed: Map<string, Placed>; width: number; height: number } {
  if (hasExplicitPositions(graph)) return layoutFromPositions(graph)
  // ... existing auto-layout body (lines 42-84 unchanged) ...
}
```

**Colour token unification** — replace the hardcoded `NODE` map (lines 17–25) with CSS-var values that match `FlowTab.tsx`'s `TYPE_COLORS`. Current prototype diverges (decision is `#db2777` pink; FlowTab uses `var(--accent-decision, #d97706)` amber). The unified token set from `FlowTab.tsx` lines 31–39:
```typescript
// FlowTab.tsx lines 31-39 — these are the CANONICAL tokens; FlowGraphCanvas must match
const TYPE_COLORS = {
  step:        { accent: 'var(--accent-step, #1e40af)',     ... },
  measurement: { accent: 'var(--accent-measure, #0d9488)',  ... },
  decision:    { accent: 'var(--accent-decision, #d97706)', ... },
  escalate:    { accent: 'var(--accent-escalate, #dc2626)', ... },
  signoff:     { accent: 'var(--accent-signoff, #7c3aed)',  ... },
  inspect:     { accent: 'var(--accent-inspect, #0284c7)',  ... },
  zone:        { accent: 'var(--accent-zone, #16a34a)',     ... },
}
```
In `FlowGraphCanvas`, replace `NODE[type].fill` and `NODE[type].stroke` with `var(--accent-X)` fills/strokes matching these tokens.

**FIT button — replace stub** (current line 118):
```typescript
// BEFORE (stub — line 118):
onClick={() => scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })}

// AFTER — real viewBox-based zoom-to-fit:
// Add svgRef: useRef<SVGSVGElement>(null) alongside existing scrollRef
// fitToView reads layout result already in useMemo:
const fitToView = useCallback(() => {
  const svg = svgRef.current
  const container = scrollRef.current
  if (!svg || !container) return
  const scale = Math.min(container.clientWidth / width, container.clientHeight / height, 1)
  const vw = width / scale
  const vh = height / scale
  svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`)
  svg.setAttribute('width', String(container.clientWidth))
  svg.setAttribute('height', String(container.clientHeight))
}, [width, height])
```

**EXPORT-PNG button** — add alongside FIT. Implementation follows `photo-compress.ts` canvas pattern (see Shared Patterns below):
```typescript
const exportPng = useCallback(async () => {
  const svg = svgRef.current
  if (!svg) return
  // 1. Clone and inline CSS variable computed values (vars don't resolve in serialised SVG)
  const clone = svg.cloneNode(true) as SVGSVGElement
  const liveEls = svg.querySelectorAll('*')
  const cloneEls = clone.querySelectorAll('*')
  liveEls.forEach((liveEl, i) => {
    const cloneEl = cloneEls[i] as SVGElement
    if (!cloneEl) return
    const cs = getComputedStyle(liveEl)
    if (cs.fill && cs.fill !== 'none') cloneEl.style.fill = cs.fill
    if (cs.stroke && cs.stroke !== 'none') cloneEl.style.stroke = cs.stroke
  })
  // 2. Serialise
  const svgStr = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }))
  // 3. Draw to canvas at devicePixelRatio
  const dpr = window.devicePixelRatio || 1
  const w = svg.width.baseVal.value || 800
  const h = svg.height.baseVal.value || 600
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
  // 4. Trigger download
  canvas.toBlob((b) => {
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = 'procedure-flow.png'
    a.click()
    URL.revokeObjectURL(a.href)
  }, 'image/png')
}, [])
```

**PREVIEW pill to remove** (line 115):
```typescript
// DELETE this line:
<span className="pill" style={{ opacity: 0.7 }}>PREVIEW</span>
```
Add Export PNG button to the toolbar alongside FIT:
```typescript
<button onClick={exportPng} className="evidence-btn !min-h-[30px] text-[11px]">Export PNG</button>
<button onClick={fitToView} className="evidence-btn !min-h-[30px] text-[11px]">Fit</button>
```

---

### `src/components/sop/tabs/FlowTab.tsx` (component, request-response)

**Analog:** `src/hooks/useViewport.ts` for the SSR-safe viewport pattern; self for all other logic.

**Import addition** (current line 2):
```typescript
// ADD to existing import block:
import { useEffect, useState } from 'react'  // already imported — add useEffect
import { useViewport } from '@/hooks/useViewport'
```

**Desktop-default state pattern** — copy directly from `useViewport.ts` lines 22–33 idiom, applied in `FlowTab`:
```typescript
// FlowTab.tsx — replace line 190:
// BEFORE:
const [view, setView] = useState<'list' | 'graph'>('list')

// AFTER — SSR-safe: seed 'list' (matches server render), reconcile in effect:
const [view, setView] = useState<'list' | 'graph'>('list')
const viewport = useViewport()
useEffect(() => {
  if (viewport === 'desktop') setView('graph')
}, [viewport])
// CRITICAL: Never seed with window.innerWidth — causes hydration mismatch #418
// per CLAUDE.md 2026-06-08 learning.
```

**ViewToggle label update** (line 24):
```typescript
// BEFORE:
{v === 'list' ? 'List' : 'Graph (preview)'}

// AFTER (remove "(preview)"):
{v === 'list' ? 'List' : 'Graph'}
```

**All other FlowTab logic is unchanged:** the `FlowGraphSchema.safeParse` / derived fallback block (lines 194–208), the `stepMap` / `entries` useMemo (lines 211–231), and the `StepCard` render tree are untouched. The `TYPE_COLORS` map (lines 31–39) is already correct — `FlowGraphCanvas` must align to it, not vice versa.

---

### `src/lib/validators/flow-graph.ts` (utility/config, transform)

**Analog:** self — 22-line file, 3 targeted line changes.

**Current schema** (full file, lines 1–22):
```typescript
import { z } from 'zod'

export const FlowGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(z.object({
    id: z.string().uuid(),          // LINE 6 — change to z.string().min(1)
    type: z.enum(['step', 'measurement', 'decision', 'escalate', 'signoff', 'inspect', 'zone']),
    label: z.string().min(1).max(200),
    position: z.object({ x: z.number(), y: z.number() }),
    stepId: z.string().uuid().optional(),  // KEEP uuid — always links to sop_steps.id
    blockProps: z.record(z.string(), z.unknown()).optional(),
  })),
  edges: z.array(z.object({
    from: z.string().uuid(),        // LINE 13 — change to z.string().min(1)
    to: z.string().uuid(),          // LINE 14 — change to z.string().min(1)
    kind: z.enum(['sequential', 'yes', 'no', 'escalate']),
    label: z.string().max(60).optional(),
  })),
})
```

**After change:**
```typescript
id: z.string().min(1),   // was .uuid() — relaxed for derived non-step node ids
from: z.string().min(1), // was .uuid()
to: z.string().min(1),   // was .uuid()
// stepId: z.string().uuid().optional() — UNCHANGED, always links to sop_steps.id
```

**Rationale:** `deriveFlowGraph` assigns `props.junctionId || props.id || section.id:index` to non-step nodes — not guaranteed UUIDs. Relaxing to `min(1)` unblocks `FlowGraphSchema.safeParse` for derived graphs without breaking the `FlowTab` `stepMap` lookup (which keys on `step.id`, still UUID via `stepId` field).

---

### `src/lib/sop/__tests__/flow-graph-derivation.test.ts` (test, verify + extend)

**Analog:** self — append new test cases to the existing file. Do not restructure.

**Existing file structure** (lines 1–40 — pattern to follow for new test cases):
```typescript
import { test, expect } from '@playwright/test'
import { deriveFlowGraph } from '../flow-graph'
import type { SopWithSections, SopStep } from '@/types/sop'

let uid = 0
const U = () => `00000000-0000-0000-0000-${String(++uid).padStart(12, '0')}`

function step(id: string, text: string, n: number): SopStep { ... }
function sop(sections: SopWithSections['sop_sections']): SopWithSections { ... }
```
New test cases for InspectBlock, ZoneBlock, cross-section branch, and edge-label truncation follow this exact structure — use the `U()` factory, `step()` helper, and `sop()` wrapper. Do not add new helper files.

---

### New test files (test, lint-guard / source-contract)

**Analog for lint-guard (grep-absence pattern):** `tests/lint/no-bulk-verify-ui.spec.ts` — grep that a string is ABSENT from source files.

Pattern to copy (reconstruct from the CLAUDE.md 2026-05-25 learning — the file structure is a standard Playwright test asserting `grep` output is empty):
```typescript
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

test('no PREVIEW pill in flow components', () => {
  const files = [
    'src/components/sop/flow/FlowGraphCanvas.tsx',
    'src/components/sop/tabs/FlowTab.tsx',
    'src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx',
  ]
  for (const f of files) {
    const content = readFileSync(join(process.cwd(), f), 'utf8')
    expect(content, `${f} must not contain PREVIEW pill`).not.toMatch(/PREVIEW/)
  }
})
```

**Analog for source-contract (token presence + wiring) pattern:** `src/lib/sop/__tests__/flow-graph-derivation.test.ts` + Phase 21.6 source-contract pattern (CLAUDE.md 2026-06-05 learning: assert handler IS WIRED, not just that a token exists).

For `flow-graph-canvas.spec.ts`:
```typescript
// Assert fitToView and exportPng are both DEFINED AND wired to onClick
// Assert useViewport is imported in FlowTab and initial state is 'list'
// Use readFileSync + regex, not just includes() — check the call-site wiring
```

---

### `playwright.config.ts` (config)

**Analog:** existing `phase21.6-stubs` block (lines 119–126) — the most recent stubs project registration.

**Pattern to copy** (lines 119–126):
```typescript
{
  // Phase 21.6 — source-contract + lint guard stubs
  name: 'phase21.6-stubs',
  testDir: '.',
  testMatch: /(no-raw-block-types-in-build|builder-edit-stage)\.(test|spec)\.ts$/,
},
```

**New block to add** (append before the closing `]`):
```typescript
{
  // Phase 24 — source-contract + lint guard stubs:
  //   no-preview-pill.spec.ts   — PREVIEW string absent from flow components
  //   flow-graph-canvas.spec.ts — fitToView + exportPng wired; useViewport imported
  //   flow-graph-schema.spec.ts — schema accepts min(1) ids, stepId still uuid
  // CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
  name: 'phase24-stubs',
  testDir: '.',
  testMatch: /(no-preview-pill|flow-graph-canvas|flow-graph-schema)\.(test|spec)\.ts$/,
},
```

**Validation command** (run after adding, per CLAUDE.md 2026-05-25 learning):
```
npx playwright test --list --project=phase24-stubs | grep flow-graph-canvas
```

---

## Shared Patterns

### Canvas API rasterisation (EXPORT-PNG)
**Source:** `src/lib/offline/photo-compress.ts` lines 18–42
**Apply to:** `FlowGraphCanvas.tsx` exportPng function

The canonical project pattern for canvas operations:
```typescript
// photo-compress.ts lines 48-55 — loadImage helper (reuse this pattern in exportPng)
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// photo-compress.ts lines 72-83 — canvas.toBlob pattern
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob returned null'))
      },
      'image/jpeg',
      quality
    )
  })
}
```
For exportPng, use `'image/png'` instead of `'image/jpeg'` and skip the quality parameter.

### SSR-safe viewport detection
**Source:** `src/hooks/useViewport.ts` lines 22–34
**Apply to:** `FlowTab.tsx` desktop-default view state

```typescript
// src/hooks/useViewport.ts lines 22-34 — full implementation
export function useViewport(): 'mobile' | 'desktop' {
  const [variant, setVariant] = useState<'mobile' | 'desktop'>('mobile')
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const update = () => setVariant(mql.matches ? 'desktop' : 'mobile')
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  return variant
}
```
Import path: `import { useViewport } from '@/hooks/useViewport'`
Never read `window.innerWidth` at render time or in `useState` initialiser — SSR throws.

### Paper/ink CSS token conventions
**Source:** `FlowTab.tsx` lines 31–39 (`TYPE_COLORS`) and `FlowGraphCanvas.tsx` line 110 (`var(--ink-100)`, `var(--paper)`, etc.)
**Apply to:** `FlowGraphCanvas.tsx` NODE colour map unification

The project uses `var(--accent-step)`, `var(--accent-measure)`, `var(--accent-decision)`, `var(--accent-escalate)`, `var(--accent-signoff)`, `var(--accent-inspect)`, `var(--accent-zone)` as the canonical node-type colour tokens. `var(--paper)` for backgrounds, `var(--ink-*)` scale for borders/text. Never introduce new hardcoded hex colours for node types.

### Playwright project registration (lint-guard / spec)
**Source:** `playwright.config.ts` lines 119–126 (`phase21.6-stubs` block)
**Apply to:** new `phase24-stubs` project entry

Pattern: `testDir: '.'`, `testMatch` regex covering all new spec file names, comment citing CLAUDE.md 2026-05-25 learning. Always validate with `npx playwright test --list --project=<name> | grep <filename>` after adding.

---

## No Analog Found

All files in this phase have strong analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `src/components/sop/flow/`, `src/components/sop/tabs/`, `src/lib/validators/`, `src/lib/sop/`, `src/hooks/`, `src/lib/offline/`, `playwright.config.ts`, `tests/lint/`
**Files scanned:** 8
**Pattern extraction date:** 2026-06-11
