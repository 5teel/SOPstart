/**
 * Phase 21 (Plan 21-03 Task 1) — Source content builder for the reviewer
 * orchestrator.
 *
 * The reviewer's "source of truth" is the original document the SOP draft
 * was parsed from. We need ONE text block per parse-job that:
 *   1. Contains the entire extracted text (so Anthropic can audit
 *      everything from omissions to numeric values to terminology).
 *   2. Carries `[Page N]` markers for PDFs so flag `source_location_hint`
 *      values can reference exact pages (Spike 003 finding #5).
 *   3. Is reused VERBATIM across all five jobs (D-21-03) — the orchestrator
 *      wraps it in `cache_control: ephemeral` so calls 2-5 hit the prompt
 *      cache.
 *
 * Source resolution order:
 *   1. `parse_jobs.transcript_text` — populated for video / OCR sources.
 *   2. `parse_jobs.prompt_text` — populated for AI-prompt sources (CONV-12).
 *   3. Empty string fallback — reviewer just produces 0 flags (fail-safe;
 *      we never throw at this layer because the orchestrator persists
 *      `job_errors` if anything else fails).
 *
 * PDF page markers are only added when the parse_job's transcript already
 * embeds `[Page N]` lines (the existing extract-pdf pipeline writes them).
 * If a future parser variant stores extracted text without page markers,
 * the reviewer will still work — Jobs B/D will reference "section X" hints
 * derived from the structured draft instead of page numbers.
 *
 * D-21-09: this module is server-only (createAdminClient + Supabase). It is
 * NEVER imported from worker-side code; the orchestrator is the only caller.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type SourceContentBlock = {
  /** Plain-text source content ready to be sent to Anthropic. */
  text: string
  meta: {
    source_type: string
    /** Best-effort page count for PDFs (counted from `[Page N]` markers). */
    page_count: number
    /** Approximate paragraph count (split on blank lines). */
    paragraph_count: number
  }
}

/**
 * Resolve and shape the source content block for a single parse job.
 *
 * Pure read — never mutates the parse_jobs row. The orchestrator caches the
 * returned block in-memory for the duration of one HTTP session.
 */
export async function buildSourceContentBlock(
  parseJobId: string,
): Promise<SourceContentBlock> {
  if (!parseJobId) throw new Error('buildSourceContentBlock: parseJobId required')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('parse_jobs')
    .select('id, file_type, transcript_text, prompt_text')
    .eq('id', parseJobId)
    .maybeSingle()

  if (error || !data) {
    return {
      text: '',
      meta: { source_type: 'unknown', page_count: 0, paragraph_count: 0 },
    }
  }

  const sourceText =
    (data.transcript_text as string | null) ??
    (data.prompt_text as string | null) ??
    ''
  const sourceType = (data.file_type as string | null) ?? 'unknown'

  // Best-effort page count: every `[Page N]` marker is one boundary. The
  // extract-pdf pipeline writes `[Page 1]\n…\n[Page 2]\n…` so a unique
  // count gives the page total. For non-PDFs the marker is absent → 0.
  const pageMatches = sourceText.match(/\[Page\s+\d+\]/gi)
  const pageCount = pageMatches ? new Set(pageMatches).size : 0

  // Approximate paragraph count via double-newline split. The reviewer
  // never sees this number directly; it's purely for instrumentation /
  // tests.
  const paragraphCount = sourceText
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0).length

  return {
    text: sourceText,
    meta: {
      source_type: sourceType,
      page_count: pageCount,
      paragraph_count: paragraphCount,
    },
  }
}
