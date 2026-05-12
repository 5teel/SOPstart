import { z } from 'zod'
import type { VerificationFlag } from '@/types/sop'

/**
 * Phase 15 — voice Q&A request schema for POST /api/voice/query.
 *
 * - sopId: must be a valid uuid; RLS will gate cross-org access server-side.
 * - question: trimmed text bounded by [5, 500] chars per D-08 cost/latency budget.
 *   Below 5 chars is too thin to ground; above 500 chars wastes Anthropic tokens.
 */
export const voiceQuerySchema = z.object({
  sopId: z.string().uuid(),
  question: z
    .string()
    .min(5, 'Question must be at least 5 characters')
    .max(500, 'Question must be under 500 characters'),
})

export type VoiceQueryInput = z.infer<typeof voiceQuerySchema>

/**
 * Phase 15 — response shape returned by POST /api/voice/query.
 *
 * Re-exported here (alongside the canonical declaration in `@/types/sop`)
 * so callers that consume the validator can also import the response type
 * from the same module.
 */
export type VoiceQueryResponse = {
  answer: string
  citations: string[]
  verifier_flags: VerificationFlag[]
}
