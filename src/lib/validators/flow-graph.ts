import { z } from 'zod'

export const FlowGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(z.object({
    // min(1) not uuid — derived non-step nodes use junctionId/props.id which are not
    // guaranteed UUIDs (FLOW-05). stepId below still requires uuid (links to sop_steps.id).
    id: z.string().min(1),
    type: z.enum(['step', 'measurement', 'decision', 'escalate', 'signoff', 'inspect', 'zone']),
    label: z.string().min(1).max(200),
    position: z.object({ x: z.number(), y: z.number() }),
    stepId: z.string().uuid().optional(),
    blockProps: z.record(z.string(), z.unknown()).optional(),
  })),
  edges: z.array(z.object({
    from: z.string().min(1), // was .uuid() — relaxed for derived non-step node ids
    to: z.string().min(1),   // was .uuid() — relaxed for derived non-step node ids
    kind: z.enum(['sequential', 'yes', 'no', 'escalate']),
    label: z.string().max(60).optional(),
  })),
})

export type FlowGraph = z.infer<typeof FlowGraphSchema>
