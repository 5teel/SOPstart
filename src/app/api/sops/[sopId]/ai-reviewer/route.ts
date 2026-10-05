/**
 * AI reviewer manual re-run + read endpoint.
 *
 * Phase 58 (58-06, D-02 / D-17): the check runs for ANY SOP of the caller's
 * organisation (a SOP with no source runs only the draft-only jobs) and its
 * findings are sop_ai_findings rows.
 *
 * POST /api/sops/[sopId]/ai-reviewer
 *   Body: { jobs?: ReviewerJobId[] } — defaults to all five.
 *   Admin / safety_manager only (each run spends money).
 *   Returns: ReviewerRunEnvelope
 *   Errors:
 *     401 unauthenticated
 *     403 forbidden (not admin / safety_manager)
 *     404 sop not found in the session organisation
 *     422 nothing_to_review (no steps and no source)
 *     429 per-day cap exhausted (`error: per_day_cap`)
 *     429 per-org Anthropic spend cap exhausted (`error: per_org_cap`)
 *     500 reviewer error
 *
 * GET /api/sops/[sopId]/ai-reviewer
 *   Anyone with edit access to the SOP (admin, safety manager, or a sign-off
 *   approver) — resolved by requireSopEditAccess.
 *   Returns: { findings, lastRunAt, hasSource, flags }
 *     findings   rows of the latest run plus every still-open row
 *     lastRunAt  null means the check has never run
 *     hasSource  false => "wording and clarity only" (D-17)
 *     flags      the latest parse job's envelope flags; read only by the old
 *                builder's flag panel until 58-16 deletes it
 *
 * Trust boundary: every admin-client query below carries the SESSION
 * organisation, never a value read off a fetched row (CLAUDE.md 2026-07-28).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { requireSopEditAccess } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  runReviewerForSop,
  NothingToReviewError,
  OrgSpendCapExceededError,
  pickSourceText,
  type ReviewerJobId,
  type ReviewerRunEnvelope,
} from '@/lib/parsers/ai-reviewer'
import {
  assertWithinPerDayRunCap,
  incrementPerDayRunCounter,
  PerDayRunCapExceededError,
} from './rate-limit'

const ReviewerJobIdSchema = z.enum(['A', 'B', 'C', 'D', 'E'])
const PostBodySchema = z.object({
  jobs: z.array(ReviewerJobIdSchema).optional(),
})

const ALL_JOBS: ReviewerJobId[] = ['A', 'B', 'C', 'D', 'E']

async function assertAdminAuth(): Promise<
  | { kind: 'ok'; userId: string; organisationId: string }
  | { kind: 'err'; status: number; body: { error: string } }
> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) {
    return { kind: 'err', status: 401, body: { error: 'unauthenticated' } }
  }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { kind: 'err', status: 403, body: { error: 'forbidden' } }
  }
  if (!organisationId) {
    return { kind: 'err', status: 403, body: { error: 'forbidden' } }
  }
  return { kind: 'ok', userId, organisationId }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> },
): Promise<NextResponse> {
  const { sopId } = await params
  if (!sopId) {
    return NextResponse.json({ error: 'sopId required' }, { status: 400 })
  }

  const auth = await assertAdminAuth()
  if (auth.kind === 'err') return NextResponse.json(auth.body, { status: auth.status })

  // T-21-03-02 — Zod-validate body before passing into orchestrator.
  let jobs: ReviewerJobId[] = ALL_JOBS
  try {
    const raw = await request.json().catch(() => ({}))
    const parsed = PostBodySchema.parse(raw)
    if (parsed.jobs && parsed.jobs.length > 0) jobs = parsed.jobs
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_body', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    )
  }

  // T-58-11: the SOP must be in the SESSION organisation.
  const admin = createAdminClient()
  const { data: sop } = await admin
    .from('sops')
    .select('id')
    .eq('id', sopId)
    .eq('organisation_id', auth.organisationId)
    .maybeSingle()
  if (!sop) {
    return NextResponse.json({ error: 'sop_not_found' }, { status: 404 })
  }

  // Per-day cap (CONV-09 / D-21-13), keyed on sop_id so a blank SOP is capped
  // the same as a parsed one. Throws PerDayRunCapExceededError.
  try {
    await assertWithinPerDayRunCap(sopId)
  } catch (err) {
    if (err instanceof PerDayRunCapExceededError) {
      return NextResponse.json(
        {
          error: 'per_day_cap',
          runs_today: err.runsToday,
          reset_at: err.resetAt,
        },
        { status: 429 },
      )
    }
    throw err
  }

  // Dispatch. OrgSpendCapExceededError → 429 per_org_cap.
  let envelope: ReviewerRunEnvelope
  try {
    envelope = await runReviewerForSop({
      sopId,
      organisationId: auth.organisationId,
      jobs,
    })
  } catch (err) {
    if (err instanceof OrgSpendCapExceededError) {
      return NextResponse.json(
        {
          error: 'per_org_cap',
          spend_cents: err.spendCents,
          cap_cents: err.capCents,
        },
        { status: 429 },
      )
    }
    if (err instanceof NothingToReviewError) {
      return NextResponse.json({ error: 'nothing_to_review' }, { status: 422 })
    }
    console.error('[ai-reviewer POST] orchestrator error', err)
    return NextResponse.json(
      { error: 'reviewer_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  // Increment counter AFTER successful dispatch (don't burn budget on
  // failed runs — admin can retry).
  try {
    await incrementPerDayRunCounter(sopId)
  } catch (err) {
    console.error('[ai-reviewer POST] counter increment error', err)
    // Non-fatal — findings are already persisted.
  }

  return NextResponse.json(envelope, { status: 200 })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> },
): Promise<NextResponse> {
  const { sopId } = await params
  if (!sopId) {
    return NextResponse.json({ error: 'sopId required' }, { status: 400 })
  }

  const ctx = await requireSopEditAccess({ sopId })
  if ('error' in ctx) {
    const status = ctx.error === 'Not authenticated' ? 401 : /not found/i.test(ctx.error) ? 404 : 403
    return NextResponse.json({ error: ctx.error }, { status })
  }
  const orgId = ctx.organisationId

  const admin = createAdminClient()

  const { data: latest } = await admin
    .from('sop_ai_findings')
    .select('run_id, created_at')
    .eq('sop_id', sopId)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastRunAt = (latest?.created_at as string | null) ?? null
  const lastRunId = (latest?.run_id as string | null) ?? null

  let q = admin
    .from('sop_ai_findings')
    .select('id, run_id, job, kind, severity, step_id, description, extras, cleared_by, cleared_at, created_at')
    .eq('sop_id', sopId)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: true })
  // Latest run's rows plus every row still open (an open row always belongs to
  // the latest run, except rows older than run ids).
  q = lastRunId ? q.or(`run_id.eq.${lastRunId},cleared_at.is.null`) : q.is('cleared_at', null)
  const { data: findings, error } = await q
  if (error) {
    console.error('[ai-reviewer GET] findings read error', error)
    return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  }

  const { data: job } = await admin
    .from('parse_jobs')
    .select('transcript_text, prompt_text, ai_review_results')
    .eq('sop_id', sopId)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const hasSource = job ? pickSourceText(job as { transcript_text: string | null; prompt_text: string | null }).trim().length > 0 : false
  const envelope = (job?.ai_review_results ?? null) as { flags?: unknown[] } | null

  return NextResponse.json(
    { findings: findings ?? [], lastRunAt, hasSource, flags: envelope?.flags ?? [] },
    { status: 200 },
  )
}
