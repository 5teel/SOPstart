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

/**
 * Phase 15 D-21: append-only evidence of sequential reading.
 * One entry per "I've done this — Next" click on a step. Mirrors the
 * AckTraceEntry shape from `@/types/sop`. Persisted to
 * `sop_completions.step_ack_trace` (jsonb) on submission.
 */
export const StepAckEntrySchema = z.object({
  stepId: z.string().uuid(),
  timestamp: z.number().int().positive(),
})
export type StepAckEntry = z.infer<typeof StepAckEntrySchema>

export const SubmitCompletionSchema = z.object({
  localId: z.string().uuid(),
  sopId: z.string().uuid(),
  sopVersion: z.number().int().positive(),
  contentHash: z.string().min(1).max(64),
  stepData: StepDataSchema,
  photoStoragePaths: z.array(PhotoStoragePathSchema),
  // Phase 15 D-21: optional for back-compat with Phase 12.5 completions
  // (older mobile clients won't send this). When present, server persists
  // to sop_completions.step_ack_trace.
  stepAckTrace: z.array(StepAckEntrySchema).optional(),
  // Phase 23 D-11: optional for back-compat with non-kiosk clients.
  // When present on a kiosk session, the server validates this user belongs
  // to the same org before writing to sop_completions.roster_worker_id.
  // worker_id (the kiosk account uid used for RLS) is NEVER replaced by this.
  rosterWorkerId: z.string().uuid().optional(),
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

/**
 * Phase 23 AFL-VER-05: append-only sign-off chain for worker + supervisor signatures.
 * Inserts into sop_completion_signatures (no authenticated write policy — service-role only,
 * per CLAUDE.md 2026-06-15).
 */
export const RecordSignatureSchema = z.object({
  completionId: z.string().uuid(),
  role: z.enum(['worker', 'supervisor']),
  rosterUserId: z.string().uuid(),
})
export type RecordSignatureInput = z.infer<typeof RecordSignatureSchema>
