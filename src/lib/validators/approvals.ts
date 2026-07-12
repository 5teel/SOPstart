import { z } from 'zod'

// Phase 29 D29-01/D29-04 — a chain step targets EITHER a role OR a named
// member, never both, never neither (Pitfall 3 scoping: role-based steps and
// the named-member picker are restricted to admin/safety_manager, since both
// approval surfaces already hard-redirect any other role away).
export const chainStepSchema = z
  .object({
    role: z.enum(['admin', 'safety_manager']).optional(),
    userId: z.string().uuid().optional(),
    label: z.string().min(1),
  })
  .refine((step) => (step.role ? 1 : 0) + (step.userId ? 1 : 0) === 1, {
    message: 'Each step must have exactly one of role or userId set',
  })

export const approvalChainSchema = z.object({
  category: z.string().min(1),
  steps: z.array(chainStepSchema).min(1).max(4),
})

export type ChainStepInput = z.infer<typeof chainStepSchema>
export type ApprovalChainInput = z.infer<typeof approvalChainSchema>
