/**
 * Canonical Zod schemas for sop_completions + completion_sign_offs payloads.
 *
 * These exist as a stable, externally-consumable surface for the AI
 * introspection endpoint (see src/actions/introspection.ts) and the sign-off
 * server actions in src/actions/completions.ts. `submitCompletion` takes only
 * `{ walkId }` and builds step_data itself from the server's walk row.
 *
 * step_data shape (StepDataSchema):
 *   Record<stepId, stepNumber> — maps each UUID step id to the step_number
 *   (integer from sop_steps.step_number). Written on send to persist
 *   "which steps were ticked off in what order" without duplicating step
 *   content.
 */
import { z } from 'zod'

/**
 * sop_completions.step_data column schema.
 *
 * Keys are sop_steps.id (uuid); values are sop_steps.step_number (positive int).
 * The record is append-only: once written on submit, the row is immutable
 * (sop_completions has no UPDATE policy — see migration 00010).
 */
export const StepDataSchema = z.record(z.string(), z.number())
export type StepData = z.infer<typeof StepDataSchema>

export const SignOffDecisionSchema = z.enum(['approved', 'rejected'])
export type SignOffDecision = z.infer<typeof SignOffDecisionSchema>

export const SignOffSchema = z.object({
  completionId: z.string().uuid(),
  decision: SignOffDecisionSchema,
  reason: z.string().optional(),
  // Phase 37 ASR-01/D-05: mandatory whenever the override path is taken (the
  // approver is admin/safety_manager but not a signed-off assessor for this
  // SOP). Optional here because the field is only required on the override
  // branch — the server action (Plan 37-04) enforces presence when
  // is_assessor_override would be true, and the DB CHECK constraint
  // (migration 00056) is the third and final backstop. Layer 1 of 3
  // (Zod → server action → DB CHECK). Same 10-char floor as the existing
  // rejection-reason threshold in signOffCompletion — one reason-quality
  // bar across the whole sign-off surface, not two.
  overrideReason: z.string().trim().min(10).max(500).optional(),
})
export type SignOffInput = z.infer<typeof SignOffSchema>

/**
 * Phase 23 AFL-VER-05: append-only sign-off chain for worker + supervisor signatures.
 * Inserts into sop_completion_signatures (no authenticated write policy — service-role only,
 * per CLAUDE.md 2026-06-15). The signer is the session user, never a client field.
 */
export const RecordSignatureSchema = z.object({
  completionId: z.string().uuid(),
  role: z.enum(['worker', 'supervisor']),
})
export type RecordSignatureInput = z.infer<typeof RecordSignatureSchema>
