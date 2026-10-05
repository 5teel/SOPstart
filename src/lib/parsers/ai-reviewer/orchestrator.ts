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
 *
 * Phase 58 (58-06, D-02 / D-17): the reviewer reads the draft's focus steps.
 * Each user turn is the cached SOURCE CONTENT block (when a source exists) plus
 * a second, NON-cached DRAFT STEPS block of { step_id, section, kind, text }.
 * Every finding names a step_id from that block (anything else is nulled) and
 * is stored as a sop_ai_findings row. A SOP with no source runs only the
 * draft-only jobs (D clarity-of-numbers, E terminology).
 */

import { randomUUID } from 'node:crypto'
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
import { buildSourceContentBlock, pickSourceText } from './source-content'

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
  sop_id: string | null
  source_text: string
}

type ParseJobRow = {
  id: string
  organisation_id: string
  sop_id: string | null
  transcript_text: string | null
  prompt_text: string | null
}

const PARSE_JOB_COLS = 'id, organisation_id, sop_id, transcript_text, prompt_text'

function toLoad(data: ParseJobRow): ParseJobLoad {
  return {
    parse_job_id: data.id,
    organisation_id: data.organisation_id,
    sop_id: data.sop_id ?? null,
    source_text: pickSourceText(data),
  }
}

async function loadParseJob(parseJobId: string): Promise<ParseJobLoad | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('parse_jobs')
    .select(PARSE_JOB_COLS)
    .eq('id', parseJobId)
    .maybeSingle()
  if (error || !data) {
    console.error('[orchestrator] loadParseJob error', error)
    return null
  }
  return toLoad(data as unknown as ParseJobRow)
}

/** The SOP's latest parse job, scoped to the caller's organisation. */
async function loadLatestParseJobForSop(
  sopId: string,
  organisationId: string,
): Promise<ParseJobLoad | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('parse_jobs')
    .select(PARSE_JOB_COLS)
    .eq('sop_id', sopId)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`parse_jobs read failed: ${error.message}`)
  return data ? toLoad(data as unknown as ParseJobRow) : null
}

type DraftStep = { step_id: string; section: string; kind: string; text: string }

async function loadDraftSteps(sopId: string, organisationId: string): Promise<DraftStep[]> {
  const admin = createAdminClient()
  const [stepRes, secRes] = await Promise.all([
    admin
      .from('sop_focus_steps')
      .select('id, section_id, kind, text, sort_order')
      .eq('sop_id', sopId)
      .eq('organisation_id', organisationId)
      .order('sort_order', { ascending: true }),
    admin
      .from('sop_sections')
      .select('id, title, sort_order')
      .eq('sop_id', sopId)
      .order('sort_order', { ascending: true }),
  ])
  // A failed read must stop the run: reviewing an empty draft would write an
  // "all clear" for a SOP nobody looked at.
  if (stepRes.error) throw new Error(`sop_focus_steps read failed: ${stepRes.error.message}`)
  if (secRes.error) throw new Error(`sop_sections read failed: ${secRes.error.message}`)
  const sections = (secRes.data ?? []) as Array<{ id: string; title: string | null }>
  const rank = new Map(sections.map((x, i) => [x.id, i]))
  const title = new Map(sections.map((x) => [x.id, x.title ?? '']))
  const steps = (stepRes.data ?? []) as Array<{
    id: string
    section_id: string
    kind: string
    text: string
    sort_order: number
  }>
  steps.sort(
    (a, b) => (rank.get(a.section_id) ?? 0) - (rank.get(b.section_id) ?? 0) || a.sort_order - b.sort_order,
  )
  return steps.map((x) => ({
    step_id: x.id,
    section: title.get(x.section_id) ?? '',
    kind: x.kind,
    text: x.text,
  }))
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
const JOB_NAMES: Record<ReviewerJobId, string> = {
  A: 'invented-content',
  B: 'missing-content',
  C: 'photo-placement',
  D: 'numbers',
  E: 'terminology',
}

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
    description: `The ${JOB_NAMES[jobId]} check didn't run — clear it once you've looked over the steps yourself.`,
    extras: {
      synthetic: true,
      error: errMsg.slice(0, 200),
    },
  }
}

/** Thrown when there is neither a source nor any draft steps to review. */
export class NothingToReviewError extends Error {
  readonly code = 'NOTHING_TO_REVIEW'
  constructor() {
    super('This SOP has no steps and no source document yet, so there is nothing to check.')
    this.name = 'NothingToReviewError'
  }
}

// Jobs that only need the draft (D-17). A/B/C compare against a source.
const DRAFT_ONLY_JOBS: ReviewerJobId[] = ['D', 'E']

const STEP_ID_NOTE = `

The draft is given as DRAFT STEPS: a JSON array of { step_id, section, kind, text }. When a finding is about one step, set "step_id" to that step's step_id copied exactly from DRAFT STEPS. For a finding about the SOP as a whole, set "step_id" to null. Never invent a step_id.`

const NO_SOURCE_NOTE = `

There is NO source document for this SOP: it was written directly. Ignore every instruction above that compares the draft to a source. Judge the draft steps on their own, for the check named above (internal consistency of numbers and units across steps; wording that differs between steps for the same thing).`

async function persistFindings(
  sopId: string,
  organisationId: string,
  runId: string,
  flags: ReviewerFlag[],
  stepIds: Set<string>,
): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const rows: Array<Record<string, unknown>> = flags.map((f) => ({
    organisation_id: organisationId,
    sop_id: sopId,
    run_id: runId,
    job: f.job,
    kind: f.extras?.synthetic === true ? 'job_error' : f.kind,
    severity: f.severity,
    step_id: f.step_id && stepIds.has(f.step_id) ? f.step_id : null,
    description: f.description.slice(0, 1000),
    extras: JSON.parse(JSON.stringify(f.extras ?? {})),
  }))
  if (rows.length === 0) {
    // Marker so the editor can tell "never run" from "nothing found". The
    // table only allows critical/warning, so it is a warning born cleared
    // (cleared_by stays null: the system cleared it); the gate counts open
    // rows only.
    rows.push({
      organisation_id: organisationId,
      sop_id: sopId,
      run_id: runId,
      job: 'all',
      kind: 'all_clear',
      severity: 'warning',
      step_id: null,
      description: 'The AI check found nothing to flag.',
      extras: {},
      cleared_at: now,
    })
  }
  // Insert first, then retire the previous run's OPEN rows: a failed insert
  // must leave the old findings (and so the gate) in place. Cleared rows stay.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await admin.from('sop_ai_findings').insert(rows as any)
  if (insErr) throw new Error(`sop_ai_findings insert failed: ${insErr.message}`)
  const { error: delErr } = await admin
    .from('sop_ai_findings')
    .delete()
    .eq('sop_id', sopId)
    .eq('organisation_id', organisationId)
    .is('cleared_at', null)
    .neq('run_id', runId)
  if (delErr) console.error('[orchestrator] retire previous open findings failed', delErr)
}

async function runReview(args: {
  sopId: string
  organisationId: string
  load: ParseJobLoad | null
  jobs: ReviewerJobId[]
}): Promise<ReviewerRunEnvelope> {
  const { sopId, organisationId, load } = args
  const requested = new Set<ReviewerJobId>(args.jobs)
  if (requested.size === 0) {
    throw new Error('runReviewerJobs: at least one job required')
  }

  // Cost guard — throws OrgSpendCapExceededError. Caught by the caller and
  // surfaced as a 429 in the API layer. recordOrgSpend is NOT called in this
  // path (correct: nothing was dispatched).
  await assertOrgCapNotExceeded(organisationId)

  // Source: the shared cached block (D-21-03). buildSourceContentBlock adds
  // page markers; fall back to the raw text on failure.
  let sourceText = load?.source_text ?? ''
  if (load) {
    try {
      const sourceBlock = await buildSourceContentBlock(load.parse_job_id)
      if (sourceBlock.text) sourceText = sourceBlock.text
    } catch (err) {
      console.error('[orchestrator] buildSourceContentBlock failed', err)
    }
  }
  const hasSource = sourceText.trim().length > 0

  const draft = await loadDraftSteps(sopId, organisationId)
  if (!hasSource && draft.length === 0) throw new NothingToReviewError()
  const stepIds = new Set(draft.map((d) => d.step_id))

  // No source => only the draft-only jobs (D-17).
  if (!hasSource) {
    requested.clear()
    for (const j of DRAFT_ONLY_JOBS) requested.add(j)
  }

  // Job E needs the org's vocabulary injected into its system prompt. Build
  // the per-run JOB_E shape once, BEFORE the loop. fetchOrgVocabulary is
  // best-effort — on failure we use the empty-vocabulary baseline.
  let jobERuntime = JOB_E
  if (requested.has('E')) {
    try {
      const vocab = await fetchOrgVocabulary(organisationId)
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
  // Second block, deliberately NOT cached: the draft changes between runs.
  const draftBlock = {
    type: 'text' as const,
    text: `DRAFT STEPS:\n${JSON.stringify(draft)}`,
  }
  const content = hasSource ? [cachedSourceBlock, draftBlock] : [draftBlock]

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
        system: [
          {
            type: 'text',
            text: job.systemPrompt + STEP_ID_NOTE + (hasSource ? '' : NO_SOURCE_NOTE),
          },
        ],
        messages: [
          {
            role: 'user',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: content as any,
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
      // T-58-reviewer: model output is untrusted. A step_id that is not in the
      // draft never targets a step, and descriptions are length-capped.
      const parsedFlags = job.parseResponse(text).map((f) => ({
        ...f,
        step_id: f.step_id && stepIds.has(f.step_id) ? f.step_id : undefined,
        description: f.description.slice(0, 1000),
      }))
      flags.push(...parsedFlags)
      jobsRun.push(jobId)
      jobStatus[jobId] = 'ok'
    } catch (err) {
      console.error(`[orchestrator] job ${jobId} failed`, err)
      jobStatus[jobId] = 'error'
      jobErrors[jobId] = err instanceof Error ? err.message : String(err)
      // T-21-03-06 / T-58-13: NEVER let a job error silently surface as
      // "no flags" — push a synthetic flag; it is stored as an open SOP-level
      // finding the admin must clear.
      flags.push(
        syntheticErrorFlag(jobId, err instanceof Error ? err.message : String(err)),
      )
      // Continue to next job — partial envelope is more useful than total
      // failure when one job errors transiently.
    }
  }

  aggUsage.cost_usd = priceUsd(aggUsage)

  const runId = randomUUID()
  const envelope: ReviewerRunEnvelope = {
    parse_job_id: load?.parse_job_id ?? null,
    run_id: runId,
    ran_at: new Date().toISOString(),
    model: VERIFY_MODEL,
    jobs_run: jobsRun,
    flags,
    usage: aggUsage,
    job_status: jobStatus,
    job_errors: Object.keys(jobErrors).length > 0 ? jobErrors : undefined,
  }

  // The spend is real whether or not persistence succeeds.
  try {
    await persistFindings(sopId, organisationId, runId, flags, stepIds)
    if (load) await persistEnvelope(load.parse_job_id, envelope)
  } finally {
    await recordOrgSpend(organisationId, aggUsage.cost_usd)
  }

  return envelope
}

/**
 * Run the requested reviewer jobs against a parse job's SOP in a single HTTP
 * session. Signature unchanged since Phase 21 (parse routes call it through
 * triggerReviewerOnParseCompletion).
 *
 * @param jobs  subset of ['A','B','C','D','E'] — always executed in the
 *              canonical A→B→C→D→E order regardless of input order
 * @throws OrgSpendCapExceededError when the per-org cap is exhausted (NO
 *         dispatch occurs in that case; persistence is also skipped)
 */
export async function runReviewerJobs(
  parseJobId: string,
  jobs: ReviewerJobId[],
): Promise<ReviewerRunEnvelope> {
  if (!parseJobId) throw new Error('runReviewerJobs: parseJobId required')
  const load = await loadParseJob(parseJobId)
  if (!load) {
    throw new Error(`runReviewerJobs: parse_jobs ${parseJobId} not found`)
  }
  if (!load.sop_id) {
    throw new Error(`runReviewerJobs: parse_jobs ${parseJobId} has no sop`)
  }
  return runReview({ sopId: load.sop_id, organisationId: load.organisation_id, load, jobs })
}

/**
 * Run the reviewer for any SOP of `organisationId` (D-17): with a parse job
 * every requested job runs; without one (a blank SOP) only the draft-only jobs.
 * The caller has already authorised the SOP in the session organisation.
 */
export async function runReviewerForSop(args: {
  sopId: string
  organisationId: string
  jobs: ReviewerJobId[]
}): Promise<ReviewerRunEnvelope> {
  const load = await loadLatestParseJobForSop(args.sopId, args.organisationId)
  return runReview({ ...args, load })
}

// Re-export for callers that want to catch the cap-exceeded path explicitly
// without importing the types module.
export { OrgSpendCapExceededError, NotImplementedError }
