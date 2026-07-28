/**
 * Canonical Zod schemas for sop_observations payloads (Phase 34).
 *
 * Feeds the `sop_observations` table (migration 00052) — the append-only,
 * org-scoped, role-checked supervisor observation record. VerdictSchema
 * mirrors the DB `check (verdict in (...))` constraint on that table as
 * V5 input validation (defense-in-depth, per 34-RESEARCH Security Domain V5).
 *
 * The server-action `recordObservation` in src/actions/observations.ts
 * imports RecordObservationSchema as its single source of truth.
 */
import { z } from 'zod'

export const VerdictSchema = z.enum(['performed_to_sop', 'needs_support'])
export type Verdict = z.infer<typeof VerdictSchema>

export const RecordObservationSchema = z.object({
  workerId: z.string().uuid(),
  sopId: z.string().uuid(),
  verdict: VerdictSchema,
  note: z.string().max(2000).optional(),
  completionId: z.string().uuid().optional(),
  // Phase 37 ASR-01/D-05: mandatory whenever the override path is taken (the
  // recorder is admin/safety_manager but not a signed-off assessor for this
  // SOP). Optional here because the field is only required on the override
  // branch — the server action (Plan 37-03) enforces presence when
  // is_assessor_override would be true, and the DB CHECK constraint
  // (migration 00056) is the third and final backstop. Layer 1 of 3
  // (Zod → server action → DB CHECK). Same 10-char floor as the existing
  // signOffCompletion rejection-reason threshold — one reason-quality bar,
  // not two.
  overrideReason: z.string().trim().min(10).max(500).optional(),
})
export type RecordObservationInput = z.infer<typeof RecordObservationSchema>

// WR-01: setObservationLabels payload — a malformed label (e.g. an
// oversized string) must not crash every worker's /profile render.
export const ObservationLabelsSchema = z.object({
  performed_to_sop: z.string().trim().min(1).max(80).optional(),
  needs_support: z.string().trim().min(1).max(80).optional(),
})
export type ObservationLabelsInput = z.infer<typeof ObservationLabelsSchema>
