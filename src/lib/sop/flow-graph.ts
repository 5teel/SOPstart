import type { SopWithSections } from '@/types/sop'
import type { FlowGraph } from '@/lib/validators/flow-graph'

// Block type names that map 1:1 to FlowGraph node types.
const BLOCK_TYPE_TO_NODE: Record<string, FlowGraph['nodes'][number]['type']> = {
  MeasurementBlock: 'measurement',
  DecisionBlock: 'decision',
  EscalateBlock: 'escalate',
  SignOffBlock: 'signoff',
  InspectBlock: 'inspect',
  ZoneBlock: 'zone',
}

export function deriveFlowGraph(sop: SopWithSections): FlowGraph {
  const nodes: FlowGraph['nodes'] = []
  const edges: FlowGraph['edges'] = []

  const allSteps = sop.sop_sections.flatMap((section) => section.sop_steps)

  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i]

    // Detect block type from the parent section's layout_data.content[]
    // content entries look like { type: 'MeasurementBlock', props: {...} }
    let nodeType: FlowGraph['nodes'][number]['type'] = 'step'
    const section = sop.sop_sections.find((s) =>
      s.sop_steps.some((st) => st.id === step.id)
    )
    if (section?.layout_data && typeof section.layout_data === 'object') {
      const content = (section.layout_data as { content?: Array<{ type?: string }> }).content
      if (Array.isArray(content)) {
        for (const entry of content) {
          if (entry?.type && entry.type in BLOCK_TYPE_TO_NODE) {
            nodeType = BLOCK_TYPE_TO_NODE[entry.type]!
            break
          }
        }
      }
    }

    const nodeId = step.id // use step UUID as node ID for stable identity
    nodes.push({
      id: nodeId,
      type: nodeType,
      label: step.text.slice(0, 200),
      position: { x: 0, y: i * 100 },
      stepId: step.id,
    })

    if (i > 0) {
      edges.push({
        from: nodes[i - 1].id,
        to: nodeId,
        kind: 'sequential',
      })
    }
  }

  return { version: 1, nodes, edges }
}
