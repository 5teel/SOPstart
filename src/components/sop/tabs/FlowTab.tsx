'use client'
import { useRef, useMemo, useState } from 'react'
import { AlertTriangle, Zap, Lightbulb, Wrench, Clock, ChevronDown, Camera } from 'lucide-react'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import { FlowGraphSchema, type FlowGraph } from '@/lib/validators/flow-graph'
import { deriveFlowGraph } from '@/lib/sop/flow-graph'
import { FlowGraphCanvas } from '@/components/sop/flow/FlowGraphCanvas'
import type { SopStep, SopWithSections } from '@/types/sop'

function ViewToggle({ view, setView }: { view: 'list' | 'graph'; setView: (v: 'list' | 'graph') => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--ink-100)] overflow-hidden text-xs font-semibold">
      {(['list', 'graph'] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className="px-3 h-8 transition-colors"
          style={{
            background: view === v ? 'var(--ink-900)' : 'white',
            color: view === v ? 'white' : 'var(--ink-700)',
          }}
        >
          {v === 'list' ? 'List' : 'Graph (preview)'}
        </button>
      ))}
    </div>
  )
}

const TYPE_COLORS: Record<FlowGraph['nodes'][number]['type'], { accent: string; bg: string; label: string }> = {
  step:        { accent: 'var(--accent-step, #1e40af)',     bg: 'var(--accent-step, #1e40af)',     label: 'Step' },
  measurement: { accent: 'var(--accent-measure, #0d9488)',  bg: 'var(--accent-measure, #0d9488)',  label: 'Measurement' },
  decision:    { accent: 'var(--accent-decision, #d97706)', bg: 'var(--accent-decision, #d97706)', label: 'Decision' },
  escalate:    { accent: 'var(--accent-escalate, #dc2626)', bg: 'var(--accent-escalate, #dc2626)', label: 'Escalate' },
  signoff:     { accent: 'var(--accent-signoff, #7c3aed)',  bg: 'var(--accent-signoff, #7c3aed)',  label: 'Sign-off' },
  inspect:     { accent: 'var(--accent-inspect, #0284c7)',  bg: 'var(--accent-inspect, #0284c7)',  label: 'Inspect' },
  zone:        { accent: 'var(--accent-zone, #16a34a)',     bg: 'var(--accent-zone, #16a34a)',     label: 'Zone' },
}

type NodeWithStep = {
  node: FlowGraph['nodes'][number]
  step: SopStep | null
  stepNumber: number
  totalSteps: number
  sectionTitle: string | null
}

function StepCard({
  entry,
  isOpen,
  onToggle,
}: {
  entry: NodeWithStep
  isOpen: boolean
  onToggle: () => void
}) {
  const colors = TYPE_COLORS[entry.node.type]
  const { step } = entry
  const hasExtras = !!(
    step &&
    (step.warning || step.caution || step.tip || step.photo_required ||
      (step.required_tools && step.required_tools.length > 0) ||
      step.time_estimate_minutes != null)
  )

  return (
    <li className="flow-card-li">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`flow-step-detail-${entry.node.id}`}
        className="w-full text-left bg-[var(--paper)] border rounded-xl px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[var(--ink-50)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ink-900)]"
        style={{
          borderColor: isOpen ? colors.accent : 'var(--ink-100)',
          borderLeftWidth: 4,
          borderLeftColor: colors.accent,
        }}
        data-flow-card
        data-flow-open={isOpen ? 'true' : 'false'}
      >
        <span
          className="mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: colors.accent, backgroundColor: `color-mix(in srgb, ${colors.bg} 12%, transparent)` }}
        >
          {colors.label}
        </span>
        <span className="mono text-[11px] text-[var(--ink-500)] flex-shrink-0">
          {entry.stepNumber}/{entry.totalSteps}
        </span>
        <span className="text-base font-medium text-[var(--ink-900)] flex-1 truncate">
          {entry.node.label}
        </span>
        <ChevronDown
          className="h-5 w-5 text-[var(--ink-500)] flex-shrink-0 transition-transform duration-300"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        />
      </button>

      {/* Inline expandable region — grid-rows trick for smooth content-driven height animation */}
      <div
        id={`flow-step-detail-${entry.node.id}`}
        className="flow-card-expand"
        data-open={isOpen ? 'true' : 'false'}
        aria-hidden={!isOpen}
      >
        <div className="flow-card-expand-inner">
          {step ? (
            <article className="px-5 pt-4 pb-5 border-l-4 ml-0 mt-1 rounded-b-xl bg-[var(--paper)] border border-[var(--ink-100)]"
              style={{ borderLeftColor: colors.accent }}
            >
              <h3 className="text-2xl md:text-3xl font-semibold text-[var(--ink-900)] leading-tight mb-4">
                {step.text}
              </h3>

              {step.warning && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-lg bg-[var(--accent-escalate)]/10 border border-[var(--accent-escalate)]/30">
                  <AlertTriangle className="h-5 w-5 text-[var(--accent-escalate)] flex-shrink-0 mt-0.5" />
                  <p className="text-base text-[var(--accent-escalate)]">{step.warning}</p>
                </div>
              )}
              {step.caution && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-lg bg-[var(--accent-decision)]/10 border border-[var(--accent-decision)]/30">
                  <Zap className="h-5 w-5 text-[var(--accent-decision)] flex-shrink-0 mt-0.5" />
                  <p className="text-base text-[var(--accent-decision)]">{step.caution}</p>
                </div>
              )}
              {step.tip && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)]">
                  <Lightbulb className="h-5 w-5 text-[var(--ink-500)] flex-shrink-0 mt-0.5" />
                  <p className="text-base text-[var(--ink-700)]">{step.tip}</p>
                </div>
              )}

              {step.required_tools && step.required_tools.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Wrench className="h-4 w-4 text-[var(--ink-500)]" />
                    <span className="mono text-xs uppercase tracking-wider text-[var(--ink-500)]">
                      Tools required
                    </span>
                  </div>
                  <ul className="space-y-0.5 ml-6">
                    {step.required_tools.map((tool, i) => (
                      <li key={i} className="text-base text-[var(--ink-700)]">
                        • {tool}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--ink-500)]">
                {step.time_estimate_minutes != null && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {step.time_estimate_minutes} min
                  </span>
                )}
                {step.photo_required && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--accent-decision)]/10 text-[var(--accent-decision)] border border-[var(--accent-decision)]/30 text-xs uppercase tracking-wider font-medium">
                    <Camera className="h-3.5 w-3.5" />
                    Photo required
                  </span>
                )}
                {entry.sectionTitle && (
                  <span className="mono text-xs uppercase tracking-wider">{entry.sectionTitle}</span>
                )}
                {!hasExtras && (
                  <span className="text-[var(--ink-400)] italic">No additional details on this step.</span>
                )}
              </div>
            </article>
          ) : (
            <p className="px-5 py-3 text-sm text-[var(--ink-500)] italic">
              No step detail available for this node.
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

export function FlowTab({ sop }: { sop: SopWithSections }) {
  const warnedRef = useRef(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'graph'>('list')

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

  // Step lookup keyed by node id (which deriveFlowGraph sets to step.id).
  const entries: NodeWithStep[] = useMemo(() => {
    const stepMap = new Map<string, { step: SopStep; sectionTitle: string | null; index: number }>()
    const allSteps = sop.sop_sections.flatMap((s) => s.sop_steps ?? [])
    const total = allSteps.length
    let i = 0
    for (const section of sop.sop_sections) {
      for (const step of section.sop_steps ?? []) {
        stepMap.set(step.id, { step, sectionTitle: section.title ?? null, index: ++i })
      }
    }
    return graph.nodes.map((node) => {
      const matched = stepMap.get(node.id)
      return {
        node,
        step: matched?.step ?? null,
        stepNumber: matched?.index ?? 0,
        totalSteps: total,
        sectionTitle: matched?.sectionTitle ?? null,
      }
    })
  }, [graph, sop])

  if (entries.length === 0) {
    return (
      <BlueprintCanvas fullBleed>
        <BlueprintFrame>
          <h2 className="text-lg font-semibold mb-2">Flow</h2>
          <p className="text-sm text-[var(--ink-500)]">
            No steps found — add steps to sections to generate a flow graph.
          </p>
        </BlueprintFrame>
      </BlueprintCanvas>
    )
  }

  if (view === 'graph') {
    return (
      <BlueprintCanvas fullBleed>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-end px-4 pt-3">
            <ViewToggle view={view} setView={setView} />
          </div>
          <div className="flex-1 min-h-0">
            <FlowGraphCanvas graph={graph} />
          </div>
        </div>
      </BlueprintCanvas>
    )
  }

  return (
    <BlueprintCanvas fullBleed>
      <BlueprintFrame>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Flow</h2>
          <ViewToggle view={view} setView={setView} />
        </div>
        <p className="text-xs text-[var(--ink-500)] mb-4">
          Tap any step to expand it. Tap again to collapse.
        </p>

        {/* Inline expand-in-place animation:
            We use the grid-template-rows 0fr → 1fr trick so the panel
            animates to its natural content height without measuring the DOM. */}
        <style>{`
          .flow-card-expand {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 280ms cubic-bezier(0.16, 1, 0.3, 1),
                        margin-top 280ms cubic-bezier(0.16, 1, 0.3, 1);
            margin-top: 0;
          }
          .flow-card-expand[data-open="true"] {
            grid-template-rows: 1fr;
            margin-top: 6px;
          }
          .flow-card-expand-inner {
            overflow: hidden;
          }
          .flow-card-li + .flow-card-li { margin-top: 8px; }
        `}</style>

        <ol role="list">
          {entries.map((entry) => (
            <StepCard
              key={entry.node.id}
              entry={entry}
              isOpen={openId === entry.node.id}
              onToggle={() =>
                setOpenId((prev) => (prev === entry.node.id ? null : entry.node.id))
              }
            />
          ))}
        </ol>
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
