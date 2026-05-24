/**
 * Phase 21 (Plan 21-01 Task 3 + Plan 21-03 Task 1) — AI reviewer orchestrator.
 *
 * Runs the requested reviewer jobs (A/B/C/D/E) in ONE HTTP session per parse
 * so the shared source-content prompt cache is reused (D-21-03 /
 * Spike 003 — `cache_control: { type: 'ephemeral' }` on the source block).
 *
 *   - First job in the session populates the cache (cache_create_input_tokens).
 *   - Subsequent jobs hit the cache (cache_read_input_tokens) — Spike 003
 *     measured ~$0.06 per parse for B+C, ~$0.15 for all five at Sonnet.
 *
 * Cost guard (D-21-06): assertOrgCapNotExceeded(orgId) is called BEFORE any
 * dispatch. recordOrgSpend(orgId, totalCostUsd) is called AFTER persistence.
 *
 * Wave 3 (plan 21-03): Jobs B/C/D/E now live; the source content block is
 * built once per session via `buildSourceContentBlock` and Job E's system
 * prompt is rebuilt per run with the calling org's vocabulary.
 */

import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, VERIFY_MODEL } from '@/lib/parsers/verify-sop'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertOrgCapNotExceeded,
  recordOrgSpend,
} from './cost-guard'
import {
  NotImplementedError,
  OrgSpendCapExceededError,
  type ReviewerFlag,
  type ReviewerJobId,
  type ReviewerRunEnvelope,
  type ReviewerUsage,
} from './types'
import type { ReviewerJob } from './jobs/types'
import { JOB_A } from './jobs/job-a-hallucination'
import { JOB_B } from './jobs/job-b-omission'
import { JOB_C } from './jobs/job-c-anchoring'
import { JOB_D } from './jobs/job-d-table-fidelity'
import {
  JOB_E,
  buildJobESystemPrompt,
  fetchOrgVocabulary,
} from './jobs/job-e-terminology'
import { buildSourceContentBlock } from './source-content'

// Fixed canonical execution order (Spike 003 finding #1): A → B → C → D → E.
const JOB_ORDER: ReviewerJobId[] = ['A', 'B', 'C', 'D', 'E']

const JOB_REGISTRY: Record<ReviewerJobId, ReviewerJob> = {
  A: JOB_A,
  B: JOB_B,
  C: JOB_C,
  D: JOB_D,
  E: JOB_E,
}

// Spike 003 cost numbers — input $3/MTok, output $15/MTok at Sonnet 4.5;
// cache writes 1.25x input, cache reads 0.1x input. Numbers locked at
// Sonnet pricing per D-21-03; Haiku A/B is deferred to a follow-up.
const COST_PER_MTOK_INPUT_USD = 3
const COST_PER_MTOK_OUTPUT_USD = 15
const CACHE_WRITE_MULTIPLIER = 1.25
const CACHE_READ_MULTIPLIER = 0.1

function priceUsd(u: {
  input_tokens: number
  output_tokens: number
  cache_create_tokens: number
  cache_read_tokens: number
}): number {
  const inputUsd = (u.input_tokens / 1_000_000) * COST_PER_MTOK_INPUT_USD
  const outputUsd = (u.output_tokens / 1_000_000) * COST_PER_MTOK_OUTPUT_USD
  const cacheWriteUsd =
    (u.cache_create_tokens / 1_000_000) *
    COST_PER_MTOK_INPUT_USD *
    CACHE_WRITE_MULTIPLIER
  const cacheReadUsd =
    (u.cache_read_tokens / 1_000_000) *
    COST_PER_MTOK_INPUT_USD *
    CACHE_READ_MULTIPLIER
  return inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd
}

type ParseJobLoad = {
  parse_job_id: string
  organisation_id: string
  source_text: string
}

async function loadParseJob(parseJobId: string): Promise<ParseJobLoad | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('parse_jobs')
    .select('id, organisation_id, transcript_text, prompt_text')
    .eq('id', parseJobId)
    .maybeSingle()
  if (error || !data) {
    console.error('[orchestrator] loadParseJob error', error)
    return null
  }
  // Prefer transcript_text; fall back to prompt_text (AI-prompt mode);
  // empty string is also acceptable — the reviewer just produces 0 flags.
  const sourceText =
    (data.transcript_text as string | null) ??
    (data.prompt_text as string | null) ??
    ''
  return {
    parse_job_id: data.id as string,
    organisation_id: data.organisation_id as string,
    source_text: sourceText,
  }
}

async function persistEnvelope(
  parseJobId: string,
  envelope: ReviewerRunEnvelope,
): Promise<void> {
  const admin = createAdminClient()
  // Cast through JSON serialisation to satisfy the Database type for the jsonb
  // column (Json union from database.types.ts disallows custom interfaces).
  const jsonSafe = JSON.parse(JSON.stringify(envelope)) as unknown
  const { error } = await admin
    .from('parse_jobs')
    .update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ai_review_results: jsonSafe as any,
    })
    .eq('id', parseJobId)
  if (error) {
    console.error('[orchestrator] persistEnvelope error', error)
  }
}

// Internal: type for one Anthropic response's `usage` field. The SDK exposes
// these fields but the older `Usage` typing doesn't include cache fields, so
// we accept partial shapes and treat missing fields as 0.
type AnthropicUsageLike = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

function readUsage(u: AnthropicUsageLike | undefined | null): {
  input_tokens: number
  output_tokens: number
  cache_create_tokens: number
  cache_read_tokens: number
} {
  return {
    input_tokens: u?.input_tokens ?? 0,
    output_tokens: u?.output_tokens ?? 0,
    cache_create_tokens: u?.cache_creation_input_tokens ?? 0,
    cache_read_tokens: u?.cache_read_input_tokens ?? 0,
  }
}

/**
 * Fail-safe synthetic flag — per threat T-21-03-06 / CLAUDE.md voice-qa
 * precedent. When a job throws (verifier-unavailable, JSON parse failure,
 * timeout, etc.) we MUST NOT return [] silently — that masks a verifier
 * failure as "no flags found" which is a safety regression. Instead we add
 * a synthetic warning flag so admins see the yellow "verification
 * unavailable" banner inline.
 */
function syntheticErrorFlag(jobId: ReviewerJobId, errMsg: string): ReviewerFlag {
  return {
    job: jobId,
    severity: 'warning',
    kind:
      jobId === 'B'
        ? 'omission'
        : jobId === 'C'
          ? 'anchoring'
          : jobId === 'D'
            ? 'table_fidelity'
            : jobId === 'E'
              ? 'terminology'
              : 'hallucination',
    description: `Reviewer job ${jobId} unavailable — re-run from the builder to verify.`,
    extras: {
      synthetic: true,
      error: errMsg.slice(0, 200),
    },
  }
}

/**
 * Run the requested reviewer jobs in a single HTTP session, persist the
 * envelope to `parse_jobs.ai_review_results`, and record the spend.
 *
 * @param parseJobId  parse_jobs.id to review
 * @param jobs        subset of ['A','B','C','D','E'] — always executed in
 *                    the canonical A→B→C→D→E order regardless of input order
 *
 * @throws OrgSpendCapExceededError when the per-org cap is exhausted (NO
 *         dispatch occurs in that case; persistence is also skipped)
 */
export async function runReviewerJobs(
  parseJobId: string,
  jobs: ReviewerJobId[],
): Promise<ReviewerRunEnvelope> {
  if (!parseJobId) throw new Error('runReviewerJobs: parseJobId required')
  const requested = new Set<ReviewerJobId>(jobs)
  if (requested.size === 0) {
    throw new Error('runReviewerJobs: at least one job required')
  }

  const load = await loadParseJob(parseJobId)
  if (!load) {
    throw new Error(`runReviewerJobs: parse_jobs ${parseJobId} not found`)
  }

  // Cost guard — throws OrgSpendCapExceededError. Caught by the caller and
  // surfaced as a 429 in the API layer. recordOrgSpend is NOT called in this
  // path (correct: nothing was dispatched).
  await assertOrgCapNotExceeded(load.organisation_id)

  // Build the shared source-content block via the canonical helper. This
  // also reads parse_jobs (a second time) to pick up file_type / page
  // markers; the orchestrator could fold these into loadParseJob() later
  // but the separation keeps the source-content concern testable in isolation.
  let sourceText = load.source_text
  try {
    const sourceBlock = await buildSourceContentBlock(parseJobId)
    if (sourceBlock.text) sourceText = sourceBlock.text
  } catch (err) {
    console.error('[orchestrator] buildSourceContentBlock failed', err)
  }

  // Job E needs the org's vocabulary injected into its system prompt. Build
  // the per-run JOB_E shape once, BEFORE the loop. fetchOrgVocabulary is
  // best-effort — on failure we use the empty-vocabulary baseline.
  let jobERuntime = JOB_E
  if (requested.has('E')) {
    try {
      const vocab = await fetchOrgVocabulary(load.organisation_id)
      jobERuntime = {
        ...JOB_E,
        systemPrompt: buildJobESystemPrompt(vocab),
      }
    } catch (err) {
      console.error('[orchestrator] fetchOrgVocabulary failed', err)
    }
  }

  const runRegistry: Record<ReviewerJobId, ReviewerJob> = {
    ...JOB_REGISTRY,
    E: jobERuntime,
  }

  const anthropic = getAnthropic()
  const flags: ReviewerFlag[] = []
  const aggUsage: ReviewerUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_create_tokens: 0,
    cache_read_tokens: 0,
    cost_usd: 0,
  }
  const jobsRun: ReviewerJobId[] = []
  const jobStatus: Partial<Record<ReviewerJobId, 'ok' | 'not_implemented' | 'error'>> = {}
  const jobErrors: Partial<Record<ReviewerJobId, string>> = {}

  const cachedSourceBlock = {
    type: 'text' as const,
    text: `SOURCE CONTENT:\n${sourceText}`,
    cache_control: { type: 'ephemeral' as const },
  }

  for (const jobId of JOB_ORDER) {
    if (!requested.has(jobId)) continue

    const job = runRegistry[jobId]

    try {
      // Cast: the SDK doesn't expose cache_control in the public Message type
      // for content-block arrays in older typings, but the API accepts it.
      // We also cast the response to the non-streaming Message shape since we
      // never pass `stream: true`.
      const response = (await anthropic.messages.create({
        model: VERIFY_MODEL,
        max_tokens: job.maxTokens,
        system: [{ type: 'text', text: job.systemPrompt }],
        messages: [
          {
            role: 'user',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: [cachedSourceBlock as any],
          },
        ],
      } as Parameters<Anthropic['messages']['create']>[0])) as {
        content: Array<{ type: string; text?: string }>
        usage?: AnthropicUsageLike
      }

      const usage = readUsage(response.usage)
      aggUsage.input_tokens += usage.input_tokens
      aggUsage.output_tokens += usage.output_tokens
      aggUsage.cache_create_tokens += usage.cache_create_tokens
      aggUsage.cache_read_tokens += usage.cache_read_tokens

      const firstBlock = response.content[0]
      const text =
        firstBlock && firstBlock.type === 'text' && typeof firstBlock.text === 'string'
          ? firstBlock.text
          : '[]'
      const parsedFlags = job.parseResponse(text)
      flags.push(...parsedFlags)
      jobsRun.push(jobId)
      jobStatus[jobId] = 'ok'
    } catch (err) {
      console.error(`[orchestrator] job ${jobId} failed`, err)
      jobStatus[jobId] = 'error'
      jobErrors[jobId] = err instanceof Error ? err.message : String(err)
      // T-21-03-06 mitigation: NEVER let a job error silently surface as
      // "no flags" — push a synthetic warning flag so the admin sees the
      // verification-unavailable signal.
      flags.push(
        syntheticErrorFlag(jobId, err instanceof Error ? err.message : String(err)),
      )
      // Continue to next job — partial envelope is more useful than total
      // failure when one job errors transiently.
    }
  }

  aggUsage.cost_usd = priceUsd(aggUsage)

  const envelope: ReviewerRunEnvelope = {
    parse_job_id: parseJobId,
    ran_at: new Date().toISOString(),
    model: VERIFY_MODEL,
    jobs_run: jobsRun,
    flags,
    usage: aggUsage,
    job_status: jobStatus,
    job_errors: Object.keys(jobErrors).length > 0 ? jobErrors : undefined,
  }

  await persistEnvelope(parseJobId, envelope)
  await recordOrgSpend(load.organisation_id, aggUsage.cost_usd)

  return envelope
}

// Re-export for callers that want to catch the cap-exceeded path explicitly
// without importing the types module.
export { OrgSpendCapExceededError, NotImplementedError }
