/**
 * Phase 21 (Plan 21-01 Task 3) — AI reviewer types.
 *
 * The reviewer runs five specialised jobs (D-CV2-05):
 *   A: hallucination       — reuses Phase 6 ADVERSARIAL_SYSTEM prompt
 *   B: omission            — Wave 3 (stub here)
 *   C: anchoring + step-image alignment (D-21-11 single call)
 *   D: table fidelity / safety completeness — Wave 3 (stub here)
 *   E: terminology / clarity — Wave 3 (stub here)
 *
 * All five jobs run in ONE HTTP session per parse (D-21-03) so the shared
 * source-content prompt cache is reused (cache_control: { type: 'ephemeral' }
 * on the source block).
 */

export type ReviewerJobId = 'A' | 'B' | 'C' | 'D' | 'E'

export type ReviewerFlagKind =
  | 'hallucination'
  | 'omission'
  | 'anchoring'
  | 'table_fidelity'
  | 'terminology'

export type ReviewerFlag = {
  job: ReviewerJobId
  severity: 'critical' | 'warning'
  kind: ReviewerFlagKind
  /** null => SOP-level flag (no specific block) */
  block_id?: string
  /** free-form hint like "page 3 step 7" or "section 2.1" */
  source_location_hint?: string
  description: string
  /** Per-job extras. Anchoring uses { photo_id, suggested_step_id, alignment_concern } per D-21-11. */
  extras?: Record<string, unknown>
}

export type ReviewerUsage = {
  input_tokens: number
  output_tokens: number
  cache_create_tokens: number
  cache_read_tokens: number
  cost_usd: number
}

export type ReviewerRunEnvelope = {
  parse_job_id: string
  ran_at: string // ISO
  model: string
  jobs_run: ReviewerJobId[]
  flags: ReviewerFlag[]
  usage: ReviewerUsage
  /** Per-job execution diagnostics. Job-A might run while Job-B fails as NotImplementedError. */
  job_status?: Partial<Record<ReviewerJobId, 'ok' | 'not_implemented' | 'error'>>
  job_errors?: Partial<Record<ReviewerJobId, string>>
}

/**
 * Thrown by cost-guard.ts when the per-org rolling-month Anthropic spend
 * cap is exhausted. Surfaced to admin UI as a 429 / retry-after.
 */
export class OrgSpendCapExceededError extends Error {
  readonly code = 'ORG_SPEND_CAP_EXCEEDED'
  constructor(
    public readonly orgId: string,
    public readonly spendCents: number,
    public readonly capCents: number,
  ) {
    super(
      `Anthropic monthly spend cap exhausted for org ${orgId}: ${spendCents}c / ${capCents}c`,
    )
    this.name = 'OrgSpendCapExceededError'
  }
}

/**
 * Thrown by Wave-3 stub jobs (B, C, D, E) when invoked before they're wired.
 * The orchestrator catches this and produces a partial envelope.
 */
export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED'
  constructor(jobId: ReviewerJobId) {
    super(`Reviewer job ${jobId} is not implemented yet (Wave 3 plan 21-03)`)
    this.name = 'NotImplementedError'
  }
}
