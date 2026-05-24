/**
 * Phase 21 (Plan 21-01 Task 3) — AI reviewer barrel export.
 *
 * Public surface for Wave 3 (reviewer jobs B/C/D/E) and the parse-pipeline
 * trigger that invokes `runReviewerJobs` after a parse completes.
 */

export type {
  ReviewerJobId,
  ReviewerFlag,
  ReviewerFlagKind,
  ReviewerUsage,
  ReviewerRunEnvelope,
} from './types'

export { NotImplementedError, OrgSpendCapExceededError } from './types'
export { runReviewerJobs } from './orchestrator'
export { assertOrgCapNotExceeded, recordOrgSpend } from './cost-guard'
