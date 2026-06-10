import type { SopWithSections, SopStep } from '@/types/sop'
import type { FlowGraph } from '@/lib/validators/flow-graph'

type NodeType = FlowGraph['nodes'][number]['type']
type Edge = FlowGraph['edges'][number]

// ---------------------------------------------------------------------------
// Phase 24 — branch-aware derivation.
//
// The flow graph is derived from each section's Puck `layout_data.content[]`,
// NOT from `sop_steps`. Decision / Escalate / Measurement / SignOff / Inspect /
// Zone blocks live in content[] as authored Puck items — they are not steps —
// so a step-only walk can never see a branch. We walk content blocks in
// document order (sections by sort_order, items in array order) and emit:
//   - a node per "node-worthy" block type
//   - sequential edges down the chain
//   - branch edges (yes / no / escalate) from DecisionBlock.options[]
//
// Step-type blocks are zipped to the section's sop_steps by index so step
// nodes keep their real step UUID (stable identity + FlowTab list-view lookup
// keyed on node.id === step.id). Non-step blocks use their Puck junctionId /
// props.id for identity.
//
// Backward-compat: a SOP with steps but no node-worthy content blocks falls
// back to the pre-Phase-24 linear step derivation so the graph never regresses
// to empty.
// ---------------------------------------------------------------------------

// Puck registry type name → FlowGraph node type. Only these block types become
// flow nodes; pure-presentation blocks (Text/Heading/Photo/Callout/Hazard/PPE/
// PhotoGrid/Model/VoiceNote) are skipped.
const PUCK_TYPE_TO_NODE: Record<string, NodeType> = {
  StepBlock: 'step',
  StepWithPhotosBlock: 'step',
  MeasurementBlock: 'measurement',
  DecisionBlock: 'decision',
  EscalateBlock: 'escalate',
  SignOffBlock: 'signoff',
  InspectBlock: 'inspect',
  ZoneBlock: 'zone',
}

interface PuckItem {
  type?: string
  props?: Record<string, unknown> & { id?: string; junctionId?: string }
}

interface DecisionOption {
  label?: string
  nextStepId?: string
  isEscalation?: boolean
}

function contentOf(layout: unknown): PuckItem[] {
  if (layout && typeof layout === 'object') {
    const content = (layout as { content?: unknown }).content
    if (Array.isArray(content)) return content as PuckItem[]
  }
  return []
}

function labelFor(type: NodeType, props: Record<string, unknown>, step: SopStep | null): string {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = props[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return ''
  }
  let raw: string
  switch (type) {
    case 'step':
      raw = step?.text || pick('text')
      break
    case 'measurement': {
      const lbl = pick('label')
      const unit = pick('unit')
      raw = unit ? `${lbl} (${unit})` : lbl
      break
    }
    case 'decision':
      raw = pick('question')
      break
    case 'escalate':
    case 'signoff':
    case 'inspect':
      raw = pick('title')
      break
    case 'zone':
      raw = pick('label')
      break
    default:
      raw = pick('text', 'title', 'label')
  }
  return (raw || 'Untitled').slice(0, 200)
}

/** Pre-Phase-24 linear derivation — one 'step' node per sop_step, sequential
 *  edges only. Used as the no-content-blocks fallback. */
function deriveLinearFromSteps(sop: SopWithSections): FlowGraph {
  const nodes: FlowGraph['nodes'] = []
  const edges: Edge[] = []
  const allSteps = sortedSections(sop).flatMap((s) => s.sop_steps ?? [])
  allSteps.forEach((step, i) => {
    nodes.push({
      id: step.id,
      type: 'step',
      label: step.text.slice(0, 200),
      position: { x: 0, y: i * 100 },
      stepId: step.id,
    })
    if (i > 0) edges.push({ from: nodes[i - 1].id, to: step.id, kind: 'sequential' })
  })
  return { version: 1, nodes, edges }
}

function sortedSections(sop: SopWithSections) {
  return [...sop.sop_sections].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export function deriveFlowGraph(sop: SopWithSections): FlowGraph {
  const nodes: FlowGraph['nodes'] = []
  const edges: Edge[] = []

  // Map step.id → node.id so decision options (which reference a sop_step via
  // nextStepId) can resolve their branch target to a real node.
  const stepIdToNodeId = new Map<string, string>()
  // Per node, remember whether it is a decision that emitted explicit branches
  // (so we suppress its linear successor edge) and the raw decision options.
  interface Placed {
    nodeId: string
    type: NodeType
    decisionOptions: DecisionOption[] | null
  }
  const order: Placed[] = []
  let y = 0

  for (const section of sortedSections(sop)) {
    const items = contentOf(section.layout_data)
    const sectionSteps = section.sop_steps ?? []
    let stepCursor = 0

    for (const item of items) {
      const type = item.type ? PUCK_TYPE_TO_NODE[item.type] : undefined
      if (!type) continue
      const props = item.props ?? {}

      // Resolve identity. Step blocks zip to the section's sop_steps by index
      // so they carry the real step UUID; others use junctionId / props.id.
      let nodeId: string
      let stepRef: SopStep | null = null
      if (type === 'step' && stepCursor < sectionSteps.length) {
        stepRef = sectionSteps[stepCursor++]
        nodeId = stepRef.id
        stepIdToNodeId.set(stepRef.id, nodeId)
      } else {
        nodeId = props.junctionId || props.id || `${section.id}:${order.length}`
      }

      const decisionOptions =
        type === 'decision' && Array.isArray(props.options)
          ? (props.options as DecisionOption[])
          : null

      nodes.push({
        id: nodeId,
        type,
        label: labelFor(type, props, stepRef),
        position: { x: 0, y },
        ...(stepRef ? { stepId: stepRef.id } : {}),
      })
      order.push({ nodeId, type, decisionOptions })
      y += 100
    }
  }

  // No node-worthy content anywhere → fall back to linear step derivation.
  if (nodes.length === 0) return deriveLinearFromSteps(sop)

  // Edges. Walk the document-ordered node list. Each node links to its
  // successor (sequential) unless it is a decision that emits real branch
  // edges, in which case the branches replace the linear edge.
  for (let i = 0; i < order.length; i++) {
    const cur = order[i]
    const next = order[i + 1]

    if (cur.type === 'decision' && cur.decisionOptions && cur.decisionOptions.length > 0) {
      const branches: Edge[] = []
      let yesNo = 0
      let resolvedAny = false
      for (const opt of cur.decisionOptions) {
        const target =
          opt.nextStepId && stepIdToNodeId.has(opt.nextStepId)
            ? stepIdToNodeId.get(opt.nextStepId)!
            : next?.nodeId
        if (!target) continue
        if (opt.nextStepId && stepIdToNodeId.has(opt.nextStepId)) resolvedAny = true
        const kind: Edge['kind'] = opt.isEscalation
          ? 'escalate'
          : yesNo++ === 0
            ? 'yes'
            : 'no'
        branches.push({
          from: cur.nodeId,
          to: target,
          kind,
          ...(opt.label ? { label: opt.label.slice(0, 60) } : {}),
        })
      }
      // Only treat as a real branch (suppress linear edge) when at least one
      // option resolved to an explicit target. Otherwise every option points
      // at `next` — collapse to a single sequential edge to avoid N parallel
      // duplicate arrows.
      if (resolvedAny) {
        edges.push(...branches)
        continue
      }
    }

    if (next) edges.push({ from: cur.nodeId, to: next.nodeId, kind: 'sequential' })
  }

  return { version: 1, nodes, edges }
}
