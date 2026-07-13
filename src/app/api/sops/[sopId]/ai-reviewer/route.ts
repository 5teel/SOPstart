/**
 * Phase 21 (Plan 21-03 Task 2) — AI reviewer manual re-run + read endpoint.
 *
 * POST /api/sops/[sopId]/ai-reviewer
 *   Body: { jobs?: ReviewerJobId[] } — defaults to all five.
 *   Returns: ReviewerRunEnvelope
 *   Errors:
 *     401 unauthenticated
 *     403 forbidden (not admin / safety_manager for the SOP's org)
 *     404 sop not found OR no parse-job for sop
 *     429 per-day cap exhausted (`error: per_day_cap`)
 *     429 per-org Anthropic spend cap exhausted (`error: per_org_cap`)
 *     500 reviewer error
 *
 * GET /api/sops/[sopId]/ai-reviewer
 *   Returns: latest `parse_jobs.ai_review_results` envelope (read-only).
 *
 * Trust boundary: admin user → reviewer orchestrator. We Zod-validate the
 * `jobs` payload against the ReviewerJobId enum (T-21-03-02 mitigation).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  runReviewerJobs,
  OrgSpendCapExceededError,
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
  { kind: 'ok'; userId: string } | { kind: 'err'; status: number; body: { error: string } }
> {
  const { userId, role } = await getSessionContext()
  if (!userId) {
    return { kind: 'err', status: 401, body: { error: 'unauthenticated' } }
  }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { kind: 'err', status: 403, body: { error: 'forbidden' } }
  }
  return { kind: 'ok', userId }
}

async function loadLatestParseJobId(sopId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('parse_jobs')
    .select('id')
    .eq('sop_id', sopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.id as string | null) ?? null
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

  // Locate the parse-job to review.
  const parseJobId = await loadLatestParseJobId(sopId)
  if (!parseJobId) {
    return NextResponse.json({ error: 'no_parse_job' }, { status: 404 })
  }

  // Per-day cap (CONV-09 / D-21-13). Throws PerDayRunCapExceededError.
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
    envelope = await runReviewerJobs(parseJobId, jobs)
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
    // Non-fatal — envelope is already persisted.
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

  const auth = await assertAdminAuth()
  if (auth.kind === 'err') return NextResponse.json(auth.body, { status: auth.status })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('parse_jobs')
    .select('id, ai_review_results')
    .eq('sop_id', sopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'no_parse_job' }, { status: 404 })
  }

  // ai_review_results defaults to '{}' in the DB; treat empty object as
  // "never run" so the client can render the empty-state CTA.
  const envelope = data.ai_review_results
  if (
    !envelope ||
    (typeof envelope === 'object' &&
      !Array.isArray(envelope) &&
      Object.keys(envelope as object).length === 0)
  ) {
    return NextResponse.json({ error: 'never_run' }, { status: 404 })
  }

  return NextResponse.json(envelope, { status: 200 })
}
