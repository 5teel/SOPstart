'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { FlowGraphSchema } from '@/lib/validators/flow-graph'
import type { FlowGraph } from '@/lib/validators/flow-graph'
import { updateSopFlowGraph } from '@/actions/flow-graph'

// Accent colours per node type (mirrors blueprint-theme.css variables)
const NODE_ACCENTS: Record<string, string> = {
  step:        '#09090b',  // ink-900
  measurement: '#2563eb',  // accent-measure
  decision:    '#d97706',  // accent-decision
  escalate:    '#dc2626',  // accent-escalate
  signoff:     '#16a34a',  // accent-signoff
  inspect:     '#7c3aed',  // accent-inspect
  zone:        '#0891b2',  // accent-zone
}

const NODE_TYPES = ['step', 'measurement', 'decision', 'escalate', 'signoff', 'inspect', 'zone'] as const
type NodeType = typeof NODE_TYPES[number]

const NODE_W = 160
const NODE_H = 48

type FlowNode = FlowGraph['nodes'][number]
type FlowEdge = FlowGraph['edges'][number]

function snapToGrid(v: number): number {
  return Math.round(v / 20) * 20
}

interface FlowGraphEditorProps {
  initialGraph: FlowGraph
  sopId: string
}

export function FlowGraphEditor({ initialGraph, sopId }: FlowGraphEditorProps) {
  const [nodes, setNodes] = useState<FlowNode[]>(initialGraph.nodes)
  const [edges, setEdges] = useState<FlowEdge[]>(initialGraph.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null)
  const [edgeMode, setEdgeMode] = useState(false)
  const [edgeSrcId, setEdgeSrcId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  // Compute viewBox: min 800x600, expands with content
  const minX = Math.min(0, ...nodes.map((n) => n.position.x)) - 20
  const minY = Math.min(0, ...nodes.map((n) => n.position.y)) - 20
  const maxX = Math.max(800, ...nodes.map((n) => n.position.x + NODE_W)) + 20
  const maxY = Math.max(600, ...nodes.map((n) => n.position.y + NODE_H)) + 20
  const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`

  // Keyboard: Delete/Backspace removes selected node or edge
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      // Don't fire while an input is focused
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) return

      if (selectedNodeId) {
        setNodes((ns) => ns.filter((n) => n.id !== selectedNodeId))
        setEdges((es) => es.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId))
        setSelectedNodeId(null)
      } else if (selectedEdgeKey) {
        const [from, to] = selectedEdgeKey.split('::')
        setEdges((es) => es.filter((e) => !(e.from === from && e.to === to)))
        setSelectedEdgeKey(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedNodeId, selectedEdgeKey])

  // Drag tracking
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent<SVGRectElement>, nodeId: string) => {
      if (edgeMode) {
        // In edge mode: click selects as source or creates edge
        if (!edgeSrcId) {
          setEdgeSrcId(nodeId)
        } else if (edgeSrcId !== nodeId) {
          // Create edge
          setEdges((es) => [
            ...es,
            { from: edgeSrcId, to: nodeId, kind: 'sequential' as const },
          ])
          setEdgeSrcId(null)
          setEdgeMode(false)
        }
        return
      }
      e.stopPropagation()
      setSelectedNodeId(nodeId)
      setSelectedEdgeKey(null)

      const svg = svgRef.current
      if (!svg) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      dragging.current = {
        id: nodeId,
        offsetX: svgPt.x - node.position.x,
        offsetY: svgPt.y - node.position.y,
      }
    },
    [edgeMode, edgeSrcId, nodes]
  )

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragging.current) return
      const svg = svgRef.current
      if (!svg) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      const x = snapToGrid(svgPt.x - dragging.current.offsetX)
      const y = snapToGrid(svgPt.y - dragging.current.offsetY)
      const id = dragging.current.id
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, position: { x, y } } : n))
      )
    },
    []
  )

  const handleSvgMouseUp = useCallback(() => {
    dragging.current = null
  }, [])

  const handleAddNode = useCallback((type: NodeType) => {
    const id = crypto.randomUUID()
    setNodes((ns) => [
      ...ns,
      {
        id,
        type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        position: { x: 0, y: snapToGrid(ns.length * 100) },
      },
    ])
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    const localGraph: FlowGraph = { version: 1, nodes, edges }
    const result = await updateSopFlowGraph({ sopId, graph: localGraph })
    setSaving(false)
    if ('error' in result) setError(result.error ?? 'Unknown error')
    else setError(null)
  }, [sopId, nodes, edges])

  const handleEdgeKindChange = useCallback(
    (from: string, to: string, kind: FlowEdge['kind']) => {
      setEdges((es) =>
        es.map((e) => (e.from === from && e.to === to ? { ...e, kind } : e))
      )
    },
    []
  )

  return (
    <div className="flex border border-[#d4d4d8] rounded-xl overflow-hidden bg-white" style={{ height: 520 }}>
      {/* Left palette */}
      <div className="w-40 flex-shrink-0 border-r border-[#e4e4e7] bg-[#f4f4f5] flex flex-col gap-1 p-2 overflow-y-auto">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#71717a] px-1 mb-1">Node types</p>
        {NODE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleAddNode(type)}
            style={{ borderLeft: `4px solid ${NODE_ACCENTS[type] ?? '#09090b'}` }}
            className="text-xs text-left px-2 py-1.5 rounded bg-white hover:bg-[#e4e4e7] text-[#09090b] capitalize font-medium transition-colors"
          >
            {type === 'signoff' ? 'SignOff' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* SVG canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e4e4e7] bg-[#fafafa] flex-shrink-0">
          <button
            type="button"
            onClick={() => { setEdgeMode((v) => !v); setEdgeSrcId(null) }}
            className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
              edgeMode
                ? 'bg-[#09090b] text-white border-[#09090b]'
                : 'bg-white text-[#09090b] border-[#d4d4d8] hover:border-[#71717a]'
            }`}
          >
            {edgeMode ? (edgeSrcId ? 'Pick target…' : 'Pick source…') : 'Add Edge'}
          </button>
          {edgeMode && (
            <button
              type="button"
              onClick={() => { setEdgeMode(false); setEdgeSrcId(null) }}
              className="text-xs px-2 py-1 rounded border bg-white text-[#71717a] border-[#d4d4d8]"
            >
              Cancel
            </button>
          )}
          <div className="flex-1" />
          {error && (
            <span className="text-xs text-[#dc2626] font-mono">{error}</span>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="text-xs px-3 py-1 rounded bg-[#09090b] text-white font-medium disabled:opacity-50 hover:bg-[#27272a] transition-colors"
          >
            {saving ? 'Saving…' : 'Save to SOP'}
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="flex-1 bg-white cursor-default select-none"
            style={{ overflow: 'auto' }}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onClick={() => {
              if (!edgeMode) {
                setSelectedNodeId(null)
                setSelectedEdgeKey(null)
              }
            }}
          >
            {/* Edges */}
            {edges.map((edge) => {
              const srcNode = nodes.find((n) => n.id === edge.from)
              const dstNode = nodes.find((n) => n.id === edge.to)
              if (!srcNode || !dstNode) return null
              const x1 = srcNode.position.x + NODE_W / 2
              const y1 = srcNode.position.y + NODE_H
              const x2 = dstNode.position.x + NODE_W / 2
              const y2 = dstNode.position.y
              const edgeKey = `${edge.from}::${edge.to}`
              const isSelected = selectedEdgeKey === edgeKey
              const edgeColor =
                edge.kind === 'yes' ? '#16a34a' :
                edge.kind === 'no' ? '#dc2626' :
                edge.kind === 'escalate' ? '#d97706' :
                '#71717a'
              return (
                <g key={edgeKey}>
                  {/* Wide invisible hit target */}
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedEdgeKey(isSelected ? null : edgeKey)
                      setSelectedNodeId(null)
                    }}
                  />
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={edgeColor}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    markerEnd="url(#arrow)"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedEdgeKey(isSelected ? null : edgeKey)
                      setSelectedNodeId(null)
                    }}
                  />
                  {edge.label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill={edgeColor}
                      className="font-mono"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Arrow marker */}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#71717a" />
              </marker>
            </defs>

            {/* Nodes */}
            {nodes.map((node) => {
              const accent = NODE_ACCENTS[node.type] ?? '#09090b'
              const isSelected = selectedNodeId === node.id
              const isEdgeSrc = edgeSrcId === node.id
              return (
                <g key={node.id} style={{ cursor: edgeMode ? 'crosshair' : 'grab' }}>
                  <rect
                    x={node.position.x}
                    y={node.position.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    fill={`${accent}18`}
                    stroke={isSelected || isEdgeSrc ? accent : `${accent}66`}
                    strokeWidth={isSelected || isEdgeSrc ? 2 : 1}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!edgeMode) {
                        setSelectedNodeId(node.id)
                        setSelectedEdgeKey(null)
                      }
                    }}
                  />
                  <text
                    x={node.position.x + NODE_W / 2}
                    y={node.position.y + NODE_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fill={accent}
                    fontWeight="500"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.label.length > 22 ? node.label.slice(0, 21) + '…' : node.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Right props panel — visible when a node is selected */}
          {selectedNode && (
            <div className="w-48 flex-shrink-0 border-l border-[#e4e4e7] bg-[#f4f4f5] p-3 flex flex-col gap-3 overflow-y-auto text-xs">
              <p className="font-mono uppercase tracking-wider text-[#71717a]">Node props</p>
              <label className="flex flex-col gap-1">
                <span className="text-[#09090b] font-medium">Label</span>
                <input
                  type="text"
                  maxLength={200}
                  value={selectedNode.label}
                  onChange={(e) =>
                    setNodes((ns) =>
                      ns.map((n) =>
                        n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                      )
                    )
                  }
                  className="border border-[#d4d4d8] rounded px-2 py-1 bg-white text-[#09090b] focus:outline-none focus:border-[#09090b]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[#09090b] font-medium">Type</span>
                <select
                  value={selectedNode.type}
                  onChange={(e) =>
                    setNodes((ns) =>
                      ns.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, type: e.target.value as NodeType }
                          : n
                      )
                    )
                  }
                  className="border border-[#d4d4d8] rounded px-2 py-1 bg-white text-[#09090b] focus:outline-none"
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === 'signoff' ? 'SignOff' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[#09090b] font-medium">Linked Step ID</span>
                <input
                  type="text"
                  placeholder="UUID (optional)"
                  value={selectedNode.stepId ?? ''}
                  onChange={(e) =>
                    setNodes((ns) =>
                      ns.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, stepId: e.target.value || undefined }
                          : n
                      )
                    )
                  }
                  className="border border-[#d4d4d8] rounded px-2 py-1 bg-white text-[#09090b] font-mono text-[10px] focus:outline-none focus:border-[#09090b]"
                />
              </label>
            </div>
          )}

          {/* Right panel for selected edge kind */}
          {selectedEdgeKey && !selectedNode && (() => {
            const [from, to] = selectedEdgeKey.split('::')
            const edge = edges.find((e) => e.from === from && e.to === to)
            if (!edge) return null
            return (
              <div className="w-48 flex-shrink-0 border-l border-[#e4e4e7] bg-[#f4f4f5] p-3 flex flex-col gap-3 overflow-y-auto text-xs">
                <p className="font-mono uppercase tracking-wider text-[#71717a]">Edge props</p>
                <label className="flex flex-col gap-1">
                  <span className="text-[#09090b] font-medium">Kind</span>
                  <select
                    value={edge.kind}
                    onChange={(e) =>
                      handleEdgeKindChange(from, to, e.target.value as FlowEdge['kind'])
                    }
                    className="border border-[#d4d4d8] rounded px-2 py-1 bg-white text-[#09090b] focus:outline-none"
                  >
                    <option value="sequential">Sequential</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="escalate">Escalate</option>
                  </select>
                </label>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// FlowGraphField — Puck custom field wrapper
// sopId is read from Next.js URL params (the builder route is /admin/sops/builder/[sopId])
export function FlowGraphField({
  value,
  onChange: _onChange,
}: {
  value: unknown
  onChange: (v: unknown) => void
}) {
  const params = useParams<{ sopId: string }>()
  const sopId = params?.sopId

  const initialGraph: FlowGraph = (() => {
    const parsed = FlowGraphSchema.safeParse(value)
    return parsed.success ? parsed.data : { version: 1 as const, nodes: [], edges: [] }
  })()

  if (!sopId) {
    return <p className="text-sm text-[#71717a] p-4">SOP context not available.</p>
  }

  return <FlowGraphEditor initialGraph={initialGraph} sopId={sopId} />
}
