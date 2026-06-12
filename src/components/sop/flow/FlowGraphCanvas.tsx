'use client'

/**
 * Phase 24 — spatial node-graph view of an SOP's flow graph,
 * per the blueprint sketch's FLOW tab. Supports two layout modes:
 *  - Explicit positions: when the caller passes `authored` (i.e. the graph came
 *    from a successfully parsed sop.flow_graph, not derivation), nodes render
 *    at their authored coordinates (layoutFromPositions). Provenance is passed
 *    down rather than inferred from coordinates — an x!==0 heuristic
 *    misclassifies authored vertical stacks (24-REVIEW.md WR-03).
 *  - Auto-layout: derived graphs use the existing depth-layer
 *    column layout (longest-path layering, branch-aware columns).
 * Draws arrowed SVG edges (yes/no/escalate labelled, escalate red), and
 * colour-codes nodes using the --accent-* CSS-var token set matching FlowTab.
 */

import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import type { FlowGraph } from '@/lib/validators/flow-graph'

type NodeType = FlowGraph['nodes'][number]['type']

const NODE: Record<NodeType, { fill: string; stroke: string; label: string }> = {
  step:        { fill: 'color-mix(in srgb, var(--accent-step, #1e40af) 12%, transparent)',     stroke: 'var(--accent-step, #1e40af)',     label: 'Step' },
  measurement: { fill: 'color-mix(in srgb, var(--accent-measure, #0d9488) 12%, transparent)',  stroke: 'var(--accent-measure, #0d9488)',  label: 'Measurement' },
  decision:    { fill: 'color-mix(in srgb, var(--accent-decision, #d97706) 12%, transparent)', stroke: 'var(--accent-decision, #d97706)', label: 'Decision' },
  escalate:    { fill: 'color-mix(in srgb, var(--accent-escalate, #dc2626) 12%, transparent)', stroke: 'var(--accent-escalate, #dc2626)', label: 'Escalate' },
  signoff:     { fill: 'color-mix(in srgb, var(--accent-signoff, #7c3aed) 12%, transparent)',  stroke: 'var(--accent-signoff, #7c3aed)',  label: 'Sign-off' },
  inspect:     { fill: 'color-mix(in srgb, var(--accent-inspect, #0284c7) 12%, transparent)',  stroke: 'var(--accent-inspect, #0284c7)',  label: 'Inspect' },
  zone:        { fill: 'color-mix(in srgb, var(--accent-zone, #16a34a) 12%, transparent)',     stroke: 'var(--accent-zone, #16a34a)',     label: 'Zone' },
}

const NW = 168
const NH = 52
const COLW = 220
const ROWH = 104
const PAD = 40

interface Placed {
  id: string
  x: number
  y: number
  type: NodeType
  label: string
}

/**
 * Layout pass for authored graphs: place each node at its authored position,
 * offset by the bounding-box minimum so negative coordinates (which the editor
 * permits) are shifted into the visible 0-origin viewBox instead of clipped
 * (24-REVIEW.md WR-04).
 */
function layoutFromPositions(graph: FlowGraph): { placed: Map<string, Placed>; width: number; height: number } {
  const xs = graph.nodes.map((n) => n.position.x)
  const ys = graph.nodes.map((n) => n.position.y)
  const minX = Math.min(0, ...xs)
  const minY = Math.min(0, ...ys)
  const placed = new Map<string, Placed>()
  for (const n of graph.nodes) {
    placed.set(n.id, { id: n.id, x: n.position.x - minX + PAD, y: n.position.y - minY + PAD, type: n.type, label: n.label })
  }
  const width = Math.max(...xs) - minX + NW + PAD * 2
  const height = Math.max(...ys) - minY + NH + PAD * 2
  return { placed, width, height }
}

function layout(graph: FlowGraph, authored: boolean): { placed: Map<string, Placed>; width: number; height: number } {
  // Provenance decides the layout mode (24-REVIEW.md WR-03): a parsed
  // sop.flow_graph is authored even if every node sits at x = 0.
  if (authored && graph.nodes.length > 0) return layoutFromPositions(graph)

  const ids = graph.nodes.map((n) => n.id)
  const incoming = new Map<string, number>()
  ids.forEach((id) => incoming.set(id, 0))
  for (const e of graph.edges) incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1)

  // longest-path depth from roots, with a cycle guard
  const depth = new Map<string, number>()
  ids.forEach((id) => depth.set(id, 0))
  const adj = new Map<string, string[]>()
  for (const e of graph.edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to])
  let changed = true
  let guard = 0
  while (changed && guard++ < ids.length + 2) {
    changed = false
    for (const e of graph.edges) {
      const d = (depth.get(e.from) ?? 0) + 1
      if (d > (depth.get(e.to) ?? 0)) {
        depth.set(e.to, d)
        changed = true
      }
    }
  }

  // group by depth, preserve node order within a layer
  const byDepth = new Map<number, string[]>()
  for (const id of ids) {
    const d = depth.get(id) ?? 0
    byDepth.set(d, [...(byDepth.get(d) ?? []), id])
  }
  const maxCols = Math.max(1, ...Array.from(byDepth.values()).map((a) => a.length))
  const width = PAD * 2 + maxCols * COLW
  const placed = new Map<string, Placed>()
  for (const [d, layer] of byDepth) {
    const rowWidth = layer.length * COLW
    const startX = (width - rowWidth) / 2 + (COLW - NW) / 2
    layer.forEach((id, i) => {
      const node = graph.nodes.find((n) => n.id === id)!
      placed.set(id, { id, x: startX + i * COLW, y: PAD + d * ROWH, type: node.type, label: node.label })
    })
  }
  const maxDepth = Math.max(0, ...Array.from(depth.values()))
  const height = PAD * 2 + (maxDepth + 1) * ROWH
  return { placed, width, height }
}

function wrap(label: string): string[] {
  const words = label.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 22) {
      if (cur) lines.push(cur)
      cur = w
    } else cur = (cur + ' ' + w).trim()
    if (lines.length === 2) break
  }
  if (cur && lines.length < 2) lines.push(cur)
  if (lines.length === 2 && words.join(' ').length > lines.join(' ').length) lines[1] = lines[1].replace(/.{1}$/, '…')
  return lines.slice(0, 2)
}

export function FlowGraphCanvas({ graph, authored = false }: { graph: FlowGraph; authored?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const { placed, width, height } = useMemo(() => layout(graph, authored), [graph, authored])
  const branchCount = graph.edges.filter((e) => e.kind === 'yes' || e.kind === 'no' || e.kind === 'escalate').length

  // Fit lives in React state (not setAttribute) so re-renders restore it instead
  // of silently reverting it — the SVG width/height/viewBox are React-managed.
  const [fit, setFit] = useState<{ vw: number; vh: number; cw: number; ch: number } | null>(null)

  // A different graph has a different content extent — invalidate any prior fit.
  useEffect(() => setFit(null), [graph])

  const fitToView = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const scale = Math.min(cw / width, ch / height, 1)
    // The viewBox must cover the CONTAINER extent in content units (cw / scale).
    // Dividing the CONTENT extent by scale compounds the zoom to scale²
    // (24-REVIEW.md CR-01) — wrong exactly when graphs are big enough to need Fit.
    setFit({ vw: cw / scale, vh: ch / scale, cw, ch })
  }, [width, height])

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
    // try/finally so a failed SVG load neither escapes as an unhandled
    // rejection nor leaks the object URL (24-REVIEW.md WR-05).
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => { ctx.drawImage(img, 0, 0, w, h); resolve() }
        img.onerror = () => reject(new Error('SVG image failed to load'))
        img.src = url
      })
    } catch (err) {
      console.error('[flow] PNG export failed', err)
      return
    } finally {
      URL.revokeObjectURL(url)
    }
    // 4. Trigger download
    canvas.toBlob((b) => {
      if (!b) {
        console.error('[flow] PNG export failed — canvas.toBlob returned null')
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = 'procedure-flow.png'
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }, [])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--ink-100)] bg-[var(--paper)]">
        <div className="flex items-center gap-2">
          <span className="mono text-[10px] tracking-widest text-[var(--ink-500)]">PROCEDURE FLOW</span>
          <span className="pill">{graph.nodes.length} NODES</span>
          <span className="pill">{branchCount} {branchCount === 1 ? 'BRANCH' : 'BRANCHES'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void exportPng()}
            className="evidence-btn !min-h-[30px] text-[11px]"
          >
            Export PNG
          </button>
          <button
            onClick={fitToView}
            className="evidence-btn !min-h-[30px] text-[11px]"
          >
            Fit
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto bg-grid scroll-thin" style={{ minHeight: 360 }}>
        <svg
          ref={svgRef}
          width={fit ? fit.cw : width}
          height={fit ? fit.ch : height}
          viewBox={fit ? `0 0 ${fit.vw} ${fit.vh}` : `0 0 ${width} ${height}`}
          style={{ display: 'block' }}
        >
          <defs>
            <marker id="fg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="#52525b" />
            </marker>
            <marker id="fg-arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="#dc2626" />
            </marker>
          </defs>

          {/* edges */}
          {graph.edges.map((e, i) => {
            const a = placed.get(e.from)
            const b = placed.get(e.to)
            if (!a || !b) return null
            const x1 = a.x + NW / 2
            const y1 = a.y + NH
            const x2 = b.x + NW / 2
            const y2 = b.y
            const my = (y1 + y2) / 2
            const red = e.kind === 'escalate'
            const lbl = e.label ?? (e.kind === 'yes' ? 'Yes' : e.kind === 'no' ? 'No' : e.kind === 'escalate' ? 'Escalate' : '')
            return (
              <g key={i}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2 - 2}`}
                  stroke={red ? '#dc2626' : '#a1a1aa'}
                  strokeWidth={1.5}
                  fill="none"
                  markerEnd={`url(#${red ? 'fg-arrow-red' : 'fg-arrow'})`}
                />
                {lbl && (
                  <text x={(x1 + x2) / 2 + 6} y={my - 2} fontSize={10} fill={red ? '#dc2626' : '#71717a'} fontFamily="JetBrains Mono, monospace">
                    {lbl}
                  </text>
                )}
              </g>
            )
          })}

          {/* nodes */}
          {graph.nodes.map((n) => {
            const p = placed.get(n.id)
            if (!p) return null
            const c = NODE[n.type]
            const lines = wrap(n.label)
            return (
              <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
                <rect width={NW} height={NH} rx={9} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                <rect width={4} height={NH} rx={2} fill={c.stroke} />
                <text x={12} y={16} fontSize={8.5} fontFamily="JetBrains Mono, monospace" fill={c.stroke} letterSpacing={0.5}>
                  {c.label.toUpperCase()}
                </text>
                {lines.map((ln, i) => (
                  <text key={i} x={12} y={31 + i * 12} fontSize={11} fill="#1c1b19" fontFamily="Inter, sans-serif" fontWeight={500}>
                    {ln}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
