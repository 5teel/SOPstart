'use client'
import { useRef } from 'react'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import { FlowGraphSchema, type FlowGraph } from '@/lib/validators/flow-graph'
import { deriveFlowGraph } from '@/lib/sop/flow-graph'
import type { SopWithSections } from '@/types/sop'

const NODE_COLORS: Record<FlowGraph['nodes'][number]['type'], string> = {
  step:        'var(--accent-step, #1e40af)',
  measurement: 'var(--accent-measure, #0d9488)',
  decision:    'var(--accent-decision, #d97706)',
  escalate:    'var(--accent-escalate, #dc2626)',
  signoff:     'var(--accent-signoff, #7c3aed)',
  inspect:     'var(--accent-inspect, #0284c7)',
  zone:        'var(--accent-zone, #16a34a)',
}

const EDGE_COLORS: Record<FlowGraph['edges'][number]['kind'], string> = {
  sequential: 'var(--ink-300, #d1d5db)',
  yes:        'var(--accent-zone, #16a34a)',
  no:         'var(--accent-escalate, #dc2626)',
  escalate:   'var(--accent-escalate, #dc2626)',
}

const NODE_W = 160
const NODE_H = 48

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function FlowCanvas({ graph }: { graph: FlowGraph }) {
  if (graph.nodes.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
        No steps found — add steps to sections to generate a flow graph.
      </p>
    )
  }

  const xs = graph.nodes.map((n) => n.position.x)
  const ys = graph.nodes.map((n) => n.position.y)
  const minX = Math.min(...xs) - 20
  const minY = -20
  const svgWidth = Math.max(...xs.map((x) => x + NODE_W)) - minX + 40
  const svgHeight = Math.max(...ys.map((y) => y + NODE_H)) - minY + 40
  const cappedHeight = Math.min(svgHeight, 800)

  // Build position lookup for edge drawing
  const posMap = new Map<string, { x: number; y: number }>()
  for (const node of graph.nodes) {
    posMap.set(node.id, node.position)
  }

  return (
    <div style={{ overflowY: svgHeight > 800 ? 'scroll' : 'visible', maxHeight: 800 }}>
      <svg
        width="100%"
        height={cappedHeight}
        viewBox={`${minX} ${minY} ${svgWidth} ${svgHeight}`}
        aria-label="SOP flow graph"
      >
        {/* Edges rendered first (below nodes) */}
        {graph.edges.map((edge, i) => {
          const fromPos = posMap.get(edge.from)
          const toPos = posMap.get(edge.to)
          if (!fromPos || !toPos) return null
          // bottom-centre of from, top-centre of to
          const x1 = fromPos.x + NODE_W / 2
          const y1 = fromPos.y + NODE_H
          const x2 = toPos.x + NODE_W / 2
          const y2 = toPos.y
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const color = EDGE_COLORS[edge.kind]
          return (
            <g key={`edge-${i}`}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color}
                strokeWidth={1.5}
              />
              {edge.label && (
                <text
                  x={mx} y={my}
                  fontSize={10}
                  fill="var(--ink-500, #6b7280)"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {edge.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          const color = NODE_COLORS[node.type]
          return (
            <g key={node.id} transform={`translate(${node.position.x},${node.position.y})`}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={6}
                ry={6}
                fill={color}
                opacity={0.15}
                stroke={color}
                strokeWidth={1.5}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2}
                fontSize={11}
                fill={color}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight={600}
              >
                {truncate(node.label, 28)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function FlowTab({ sop }: { sop: SopWithSections }) {
  const warnedRef = useRef(false)

  let graph: FlowGraph
  if (sop.flow_graph != null) {
    const parsed = FlowGraphSchema.safeParse(sop.flow_graph)
    if (parsed.success) {
      graph = parsed.data
    } else {
      if (!warnedRef.current) {
        console.warn('[flow] explicit graph invalid, using derived', parsed.error)
        warnedRef.current = true
      }
      graph = deriveFlowGraph(sop)
    }
  } else {
    graph = deriveFlowGraph(sop)
  }

  return (
    <BlueprintCanvas fullBleed>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold mb-4">Flow</h2>
        <FlowCanvas graph={graph} />
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
