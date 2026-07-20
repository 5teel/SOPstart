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
})
export type RecordObservationInput = z.infer<typeof RecordObservationSchema>

// WR-01: setObservationLabels payload — a malformed label (e.g. an
// oversized string) must not crash every worker's /profile render.
export const ObservationLabelsSchema = z.object({
  performed_to_sop: z.string().trim().min(1).max(80).optional(),
  needs_support: z.string().trim().min(1).max(80).optional(),
})
export type ObservationLabelsInput = z.infer<typeof ObservationLabelsSchema>
