import { z } from 'zod'

export const FlowGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['step', 'measurement', 'decision', 'escalate', 'signoff', 'inspect', 'zone']),
    label: z.string().min(1).max(200),
    position: z.object({ x: z.number(), y: z.number() }),
    stepId: z.string().uuid().optional(),
    blockProps: z.record(z.string(), z.unknown()).optional(),
  })),
  edges: z.array(z.object({
    from: z.string().uuid(),
    to: z.string().uuid(),
    kind: z.enum(['sequential', 'yes', 'no', 'escalate']),
    label: z.string().max(60).optional(),
  })),
})

export type FlowGraph = z.infer<typeof FlowGraphSchema>
