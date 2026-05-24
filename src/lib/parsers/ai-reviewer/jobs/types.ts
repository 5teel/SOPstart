/**
 * Phase 21 (Plan 21-01 Task 3) — per-job interface shared by all 5 reviewer
 * jobs.
 *
 * Each job module exports a const implementing this contract. The orchestrator
 * iterates ['A','B','C','D','E'], calls Anthropic once per job sharing the
 * source-content cache, and feeds the raw response text to `parseResponse`.
 */

import type { ReviewerFlag, ReviewerJobId } from '../types'

export type ReviewerJob = {
  id: ReviewerJobId
  /** Anthropic system prompt for this job. */
  systemPrompt: string
  /** max_tokens for this job's HTTP call. Spike 003 baseline 1500-2000. */
  maxTokens: number
  /**
   * Parse the model's raw response text into ReviewerFlag[]. Robust to
   * markdown fences around JSON (the existing verify-sop.ts strips ```json).
   * Should NEVER throw — return [] on unparseable.
   */
  parseResponse: (raw: string) => ReviewerFlag[]
}
