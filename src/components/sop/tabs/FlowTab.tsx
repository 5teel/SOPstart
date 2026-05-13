'use client'
import { useRef, useMemo, useState, useEffect } from 'react'
import { AlertTriangle, Zap, Lightbulb, Wrench, Clock, X } from 'lucide-react'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import { FlowGraphSchema, type FlowGraph } from '@/lib/validators/flow-graph'
import { deriveFlowGraph } from '@/lib/sop/flow-graph'
import type { SopStep, SopWithSections } from '@/types/sop'

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

function FlowCanvas({
  graph,
  onNodeClick,
}: {
  graph: FlowGraph
  onNodeClick: (stepId: string) => void
}) {
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
        {graph.edges.map((edge, i) => {
          const fromPos = posMap.get(edge.from)
          const toPos = posMap.get(edge.to)
          if (!fromPos || !toPos) return null
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

        {graph.nodes.map((node) => {
          const color = NODE_COLORS[node.type]
          return (
            <g
              key={node.id}
              transform={`translate(${node.position.x},${node.position.y})`}
              role="button"
              tabIndex={0}
              aria-label={`Open step: ${node.label}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onNodeClick(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onNodeClick(node.id)
                }
              }}
            >
              <title>{node.label}</title>
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
                style={{ pointerEvents: 'none' }}
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

function StepDetailModal({
  step,
  stepNumber,
  totalSteps,
  sectionTitle,
  onClose,
}: {
  step: SopStep
  stepNumber: number
  totalSteps: number
  sectionTitle: string | null
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Lock body scroll while modal open
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flow-step-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close step details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      {/* Card — mirrors DesktopWalkthrough big-text treatment */}
      <article
        className="relative max-w-3xl w-full max-h-[85vh] overflow-y-auto bg-[var(--paper)] border border-[var(--ink-100)] rounded-xl shadow-2xl p-8 md:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <span className="mono text-base uppercase tracking-wider text-[var(--ink-500)]">
            Step {stepNumber} of {totalSteps}
            {sectionTitle ? ` · ${sectionTitle}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-[var(--ink-50)] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2
          id="flow-step-title"
          className="text-3xl md:text-4xl font-semibold text-[var(--ink-900)] leading-tight mb-6"
        >
          {step.text}
        </h2>

        {step.warning && (
          <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-[var(--accent-escalate)]/10 border border-[var(--accent-escalate)]/30">
            <AlertTriangle className="h-6 w-6 text-[var(--accent-escalate)] flex-shrink-0 mt-0.5" />
            <p className="text-lg text-[var(--accent-escalate)]">{step.warning}</p>
          </div>
        )}
        {step.caution && (
          <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-[var(--accent-decision)]/10 border border-[var(--accent-decision)]/30">
            <Zap className="h-6 w-6 text-[var(--accent-decision)] flex-shrink-0 mt-0.5" />
            <p className="text-lg text-[var(--accent-decision)]">{step.caution}</p>
          </div>
        )}
        {step.tip && (
          <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)]">
            <Lightbulb className="h-6 w-6 text-[var(--ink-500)] flex-shrink-0 mt-0.5" />
            <p className="text-lg text-[var(--ink-500)]">{step.tip}</p>
          </div>
        )}

        {step.required_tools && step.required_tools.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-5 w-5 text-[var(--ink-500)]" />
              <span className="mono text-sm uppercase tracking-wider text-[var(--ink-500)]">
                Tools required
              </span>
            </div>
            <ul className="space-y-1 ml-7">
              {step.required_tools.map((tool, i) => (
                <li key={i} className="text-lg text-[var(--ink-700)]">
                  • {tool}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step.time_estimate_minutes != null && (
          <div className="mt-6 flex items-center gap-2 text-lg text-[var(--ink-500)]">
            <Clock className="h-5 w-5" />
            Estimated: {step.time_estimate_minutes} min
          </div>
        )}

        {step.photo_required && (
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs uppercase tracking-wider font-medium bg-[var(--accent-decision)]/10 text-[var(--accent-decision)] border border-[var(--accent-decision)]/30">
            Photo required during walkthrough
          </div>
        )}
      </article>
    </div>
  )
}

export function FlowTab({ sop }: { sop: SopWithSections }) {
  const warnedRef = useRef(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  const derivedGraph = useMemo(() => deriveFlowGraph(sop), [sop.id, sop.updated_at])

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
      graph = derivedGraph
    }
  } else {
    graph = derivedGraph
  }

  // Build step lookup + section + step-number indices for the modal
  const { stepMap, stepIndex } = useMemo(() => {
    const map = new Map<string, { step: SopStep; sectionTitle: string | null; index: number; total: number }>()
    const allSteps = sop.sop_sections.flatMap((s) => s.sop_steps ?? [])
    const total = allSteps.length
    let globalIdx = 0
    for (const section of sop.sop_sections) {
      for (const step of section.sop_steps ?? []) {
        map.set(step.id, {
          step,
          sectionTitle: section.title ?? null,
          index: globalIdx + 1,
          total,
        })
        globalIdx += 1
      }
    }
    return { stepMap: map, stepIndex: total }
  }, [sop])

  void stepIndex // satisfy lint when only used as memo dep witness

  const selected = selectedStepId ? stepMap.get(selectedStepId) ?? null : null

  return (
    <BlueprintCanvas fullBleed>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold mb-2">Flow</h2>
        <p className="text-xs text-[var(--ink-500)] mb-4">
          Tap any step to see the full detail.
        </p>
        <FlowCanvas graph={graph} onNodeClick={setSelectedStepId} />
      </BlueprintFrame>
      {selected && (
        <StepDetailModal
          step={selected.step}
          stepNumber={selected.index}
          totalSteps={selected.total}
          sectionTitle={selected.sectionTitle}
          onClose={() => setSelectedStepId(null)}
        />
      )}
    </BlueprintCanvas>
  )
}
