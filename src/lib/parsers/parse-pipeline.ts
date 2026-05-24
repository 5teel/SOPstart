/**
 * Phase 21 (Plan 21-03 Task 2) — Parse-pipeline auto-trigger for the AI
 * reviewer.
 *
 * Background: the parse-job completion code path lives in several places
 * (parse / restructure / youtube / transcribe / ai-prompt route handlers).
 * This module consolidates the "after parse completes, run the reviewer"
 * side-effect into ONE place so each route only needs a single line:
 *   `void triggerReviewerOnParseCompletion(parseJobId)`
 *
 * Contract:
 *  - Fire-and-forget. Caller MUST NOT await — the parse-completion HTTP
 *    response should not block on Anthropic latency.
 *  - Silent on success; logs failures to `console.error` with `parseJobId`
 *    so debugging surfaces in production logs.
 *  - Skips reviewer when:
 *     (a) The parse_job's input_type is `ai_prompt` (CONV-12) — those SOPs
 *         get Jobs D+E only via a separate path (TBD in future plan); for
 *         Phase 21 we just skip entirely to avoid running A/B/C against an
 *         empty source.
 *     (b) `process.env.AI_REVIEWER_AUTO_TRIGGER === 'false'` — environment
 *         escape hatch for local dev / debugging.
 *
 * Threat model:
 *  - T-21-03-03 (Repudiation — fire-and-forget reviewer fails silently):
 *    mitigated by structured `console.error` logging. The orchestrator also
 *    persists `job_errors` to `parse_jobs.ai_review_results.job_errors` so
 *    a follow-up GET surfaces what went wrong.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { runReviewerJobs } from './ai-reviewer'
import type { ReviewerJobId } from './ai-reviewer'

const AUTO_JOBS: ReviewerJobId[] = ['A', 'B', 'C', 'D', 'E']

/**
 * Fire-and-forget reviewer trigger. Returns a Promise but callers MUST
 * NOT await — use `void triggerReviewerOnParseCompletion(parseJobId)`.
 *
 * The Promise resolves to `void` after the reviewer either completes or
 * is skipped; rejections are caught internally and logged.
 */
export async function triggerReviewerOnParseCompletion(
  parseJobId: string,
): Promise<void> {
  if (!parseJobId) return

  if (process.env.AI_REVIEWER_AUTO_TRIGGER === 'false') {
    return
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('parse_jobs')
      .select('id, input_type')
      .eq('id', parseJobId)
      .maybeSingle()

    if (error || !data) {
      console.error(
        `[parse-pipeline] reviewer auto-trigger: parse_jobs ${parseJobId} not found`,
        error,
      )
      return
    }

    // CONV-12 — AI-prompt SOPs skip the reviewer entirely in Phase 21. The
    // verify checklist gate also skips for ai_prompt sources (D-CV2-04
    // carve-out); a future plan can wire Jobs D+E for these SOPs.
    const inputType = (data.input_type as string | null) ?? ''
    if (inputType === 'ai_prompt') return

    await runReviewerJobs(parseJobId, AUTO_JOBS)
  } catch (err) {
    // Fail-safe: log with parseJobId for triage, but never re-throw —
    // the parse pipeline must not regress on reviewer failures.
    console.error(
      `[parse-pipeline] reviewer auto-trigger failed for parse-job ${parseJobId}`,
      err,
    )
  }
}
