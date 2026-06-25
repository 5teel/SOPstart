/**
 * Canonical Zod schemas for AI field layer payloads + FieldDescriptor shape.
 *
 * These exist as a stable, externally-consumable surface for the v5.0
 * conversational agent and the AI field write API (AFL-AI-01/02/03).
 * Server actions in src/actions/ai-fields.ts import from here.
 *
 * Sources:
 *   - 23-CONTEXT.md D-01/D-02 — stake level tiers
 *   - 23-CONTEXT.md D-04 — backbone-only; v5.0-consumable
 *   - 23-RESEARCH.md Pattern 1 — FieldContext shape
 *   - 23-PATTERNS.md § validators/ai-fields.ts
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Stake level (D-01/D-02)
// ---------------------------------------------------------------------------

/**
 * low  — draft/title fields. Auto-applied immediately.
 * high — published SOP content/metadata/assignments + member roles. Routes to proposal.
 */
export const StakeLevelSchema = z.enum(['low', 'high'])
export type StakeLevel = z.infer<typeof StakeLevelSchema>

// ---------------------------------------------------------------------------
// Field context (passed from API route → descriptor.read / descriptor.write)
// ---------------------------------------------------------------------------

/**
 * Context object passed to every field descriptor's read() and write() callbacks.
 * organisationId is mandatory (RLS gate). All others are optional, used as needed
 * by the specific field.
 *
 * sopIsPublished — A6 mitigation flag: passed from the API route when the SOP's
 * publish status is already known, so the descriptor can gate high-stake writes
 * without an extra DB round-trip.
 */
export const FieldContextSchema = z.object({
  organisationId: z.string().uuid(),
  sopId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  /** Passed from the API route (RESEARCH.md A6 mitigation). */
  sopIsPublished: z.boolean().optional(),
})
export type FieldContext = z.infer<typeof FieldContextSchema>

// ---------------------------------------------------------------------------
// AI write request schema (AFL-AI-02)
// ---------------------------------------------------------------------------

export const AiWriteRequestSchema = z.object({
  fieldId: z.string().min(1),
  context: FieldContextSchema,
  newValue: z.unknown(),
})
export type AiWriteRequest = z.infer<typeof AiWriteRequestSchema>

// ---------------------------------------------------------------------------
// Proposal status (ai_field_proposals.status)
// ---------------------------------------------------------------------------

export const ProposalStatusSchema = z.enum(['pending', 'applied', 'rejected'])
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>
