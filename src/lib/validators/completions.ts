/**
 * Canonical Zod schemas for sop_completions + completion_sign_offs payloads.
 *
 * These exist as a stable, externally-consumable surface for the AI
 * introspection endpoint (see src/actions/introspection.ts). The server-
 * action `submitCompletion` in src/actions/completions.ts imports from here
 * as its single source of truth.
 *
 * step_data shape (StepDataSchema):
 *   Record<stepId, stepNumber> — maps each UUID step id to the step_number
 *   (integer from sop_steps.step_number). Used by walkthroughs to persist
 *   "which steps were ticked off in what order" without duplicating step
 *   content.
 */
import { z } from 'zod'

export const PhotoStoragePathSchema = z.object({
  localId: z.string().uuid(),
  stepId: z.string().uuid(),
  storagePath: z.string().min(1),
  contentType: z.string().min(1),
})
export type PhotoStoragePath = z.infer<typeof PhotoStoragePathSchema>

/**
 * sop_completions.step_data column schema.
 *
 * Keys are sop_steps.id (uuid); values are sop_steps.step_number (positive int).
 * The record is append-only: once written on submit, the row is immutable
 * (sop_completions has no UPDATE policy — see migration 00010).
 */
export const StepDataSchema = z.record(z.string(), z.number())
export type StepData = z.infer<typeof StepDataSchema>

export const SubmitCompletionSchema = z.object({
  localId: z.string().uuid(),
  sopId: z.string().uuid(),
  sopVersion: z.number().int().positive(),
  contentHash: z.string().min(1).max(64),
  stepData: StepDataSchema,
  photoStoragePaths: z.array(PhotoStoragePathSchema),
})
export type SubmitCompletionInput = z.infer<typeof SubmitCompletionSchema>

export const SignOffDecisionSchema = z.enum(['approved', 'rejected'])
export type SignOffDecision = z.infer<typeof SignOffDecisionSchema>

export const SignOffSchema = z.object({
  completionId: z.string().uuid(),
  decision: SignOffDecisionSchema,
  reason: z.string().optional(),
})
export type SignOffInput = z.infer<typeof SignOffSchema>
