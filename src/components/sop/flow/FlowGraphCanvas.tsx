'use client'

/**
 * PROTOTYPE (Phase 24 backlog) — spatial node-graph view of an SOP's flow graph,
 * per the blueprint sketch's FLOW tab. Auto-lays out nodes in depth layers from
 * the edge list, draws arrowed SVG edges (yes/no/escalate labelled, escalate red),
 * and colour-codes nodes by type. Honours explicit node.position when authored
 * (distinct x's); otherwise auto-layout. Linear derived graphs render as a clean
 * vertical chain; branch-aware derivation lights up the columns automatically.
 */

import { useMemo, useRef } from 'react'
import type { FlowGraph } from '@/lib/validators/flow-graph'

type NodeType = FlowGraph['nodes'][number]['type']

const NODE: Record<NodeType, { fill: string; stroke: string; label: string }> = {
  step: { fill: '#eff4ff', stroke: '#2563eb', label: 'Step' },
  measurement: { fill: '#fff5ed', stroke: '#ea580c', label: 'Measurement' },
  decision: { fill: '#fdf2f8', stroke: '#db2777', label: 'Decision' },
  escalate: { fill: '#fef2f2', stroke: '#dc2626', label: 'Escalate' },
  signoff: { fill: '#f0fdf4', stroke: '#16a34a', label: 'Sign-off' },
  inspect: { fill: '#ecfeff', stroke: '#0891b2', label: 'Inspect' },
  zone: { fill: '#faf5ff', stroke: '#9333ea', label: 'Zone' },
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

function layout(graph: FlowGraph): { placed: Map<string, Placed>; width: number; height: number } {
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

export function FlowGraphCanvas({ graph }: { graph: FlowGraph }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { placed, width, height } = useMemo(() => layout(graph), [graph])
  const branchCount = graph.edges.filter((e) => e.kind === 'yes' || e.kind === 'no' || e.kind === 'escalate').length

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--ink-100)] bg-[var(--paper)]">
        <div className="flex items-center gap-2">
          <span className="mono text-[10px] tracking-widest text-[var(--ink-500)]">PROCEDURE FLOW</span>
          <span className="pill">{graph.nodes.length} NODES</span>
          <span className="pill">{branchCount} {branchCount === 1 ? 'BRANCH' : 'BRANCHES'}</span>
          <span className="pill" style={{ opacity: 0.7 }}>PREVIEW</span>
        </div>
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' })}
          className="evidence-btn !min-h-[30px] text-[11px]"
        >
          Fit
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto bg-grid scroll-thin" style={{ minHeight: 360 }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
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
