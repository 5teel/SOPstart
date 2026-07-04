import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { synthesizeSop } from '@/lib/agent-layer/synthesis'

/**
 * Phase 26.5 D-14 — scheduled synthesis catch-up sweep.
 *
 * This is a MACHINE endpoint invoked by a Railway Cron job (a separate
 * one-shot process — never an in-process setInterval, which would violate
 * the single-process Railway deploy constraint, CLAUDE.md PM2/Railway
 * learnings). It authenticates a shared bearer secret (CRON_SECRET), NOT
 * the session-cookie pattern used by user-facing routes — there is no
 * user. Missing/mismatched secret -> 401. Unset CRON_SECRET fails CLOSED
 * (401), not open.
 *
 * The publish hook (src/app/api/sops/[sopId]/publish/route.ts step 5) only
 * regenerates metadata on publish; completions/voice/reviewer signals
 * accrue continuously between publishes, so this sweep periodically
 * catches up SOPs whose signals changed since their last synthesis run.
 *
 * VOYAGE_API_KEY has no fallback and has bitten this project twice before
 * for a different key (Deepgram precedent, CLAUDE.md 2026-06-24/25) — this
 * route fails fast with a specific 503 rather than letting a generic
 * Voyage SDK exception surface deep inside synthesizeSop.
 */

// Batch caps keep a single cron invocation short (Railway Cron minimum
// interval is 5 minutes) — this is a one-shot process, not a long-running
// worker.
const MAX_CANDIDATES_EVALUATED = 100
const MAX_SOPS_PER_SWEEP = 20

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed — no secret configured, reject everything

  const header = request.headers.get('authorization') ?? ''
  const provided = header.replace(/^Bearer\s+/i, '').trim()
  const providedBuf = Buffer.from(provided)
  const secretBuf = Buffer.from(secret)
  // timingSafeEqual throws on length mismatch — compare lengths first,
  // still constant-time for the (common) equal-length case.
  if (providedBuf.length !== secretBuf.length) return false
  return crypto.timingSafeEqual(providedBuf, secretBuf)
}

type StaleCandidate = { sopId: string; organisationId: string }

/**
 * Find published SOPs whose signals (completions / voice Q&A / reviewer
 * runs) have a row newer than their last sop_agent_metadata.regenerated_at
 * (or that have never been synthesized at all).
 *
 * ponytail: per-candidate existence checks (3 lightweight count queries
 * each), bounded by MAX_CANDIDATES_EVALUATED — fine at this project's
 * scale (up to ~500 SOPs/org). If published-SOP volume grows well past a
 * few hundred, replace with a single "last_signal_at" materialized column
 * updated by a trigger instead of computing it here.
 */
async function findStaleSops(): Promise<StaleCandidate[]> {
  const admin = createAdminClient()
  const { data: sops, error } = await admin
    .from('sops')
    .select('id, organisation_id, sop_agent_metadata(regenerated_at)')
    .eq('status', 'published')
    .limit(MAX_CANDIDATES_EVALUATED)
  if (error || !sops) return []

  const stale: StaleCandidate[] = []
  for (const sop of sops) {
    const metaField = (sop as { sop_agent_metadata: { regenerated_at: string | null }[] | { regenerated_at: string | null } | null }).sop_agent_metadata
    const meta = Array.isArray(metaField) ? metaField[0] : metaField
    const regeneratedAt = meta?.regenerated_at ?? null

    if (!regeneratedAt) {
      stale.push({ sopId: sop.id, organisationId: sop.organisation_id })
      continue
    }
    if (await hasNewerSignal(admin, sop.id, sop.organisation_id, regeneratedAt)) {
      stale.push({ sopId: sop.id, organisationId: sop.organisation_id })
    }
  }
  return stale
}

/** Any completion / voice Q&A / reviewer-run row newer than `since`? */
async function hasNewerSignal(
  admin: ReturnType<typeof createAdminClient>,
  sopId: string,
  organisationId: string,
  since: string,
): Promise<boolean> {
  const [completions, voice, reviewer] = await Promise.all([
    admin
      .from('sop_completions')
      .select('id', { count: 'exact', head: true })
      .eq('sop_id', sopId)
      .eq('organisation_id', organisationId)
      .gt('submitted_at', since),
    admin
      .from('sop_voice_qa_log')
      .select('id', { count: 'exact', head: true })
      .eq('sop_id', sopId)
      .eq('organisation_id', organisationId)
      .gt('created_at', since),
    admin
      .from('parse_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('sop_id', sopId)
      .eq('organisation_id', organisationId)
      .gt('updated_at', since),
  ])
  return (completions.count ?? 0) > 0 || (voice.count ?? 0) > 0 || (reviewer.count ?? 0) > 0
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Fail fast with a specific, greppable code — never let a generic Voyage
  // SDK exception surface from deep inside synthesizeSop (Deepgram
  // precedent, CLAUDE.md 2026-06-24/25; RESEARCH Open Question 1).
  if (!process.env.VOYAGE_API_KEY) {
    return NextResponse.json({ error: 'voyage_api_key_missing' }, { status: 503 })
  }

  const staleCandidates = await findStaleSops()
  const batch = staleCandidates.slice(0, MAX_SOPS_PER_SWEEP)

  let processed = 0
  for (const { sopId, organisationId } of batch) {
    // synthesizeSop self-enforces org-scope and never throws (it catches
    // internally and records last_synthesis_status='error' on failure) —
    // this loop just counts attempts made this run.
    await synthesizeSop(sopId, organisationId)
    processed++
  }

  return NextResponse.json({
    processed,
    skipped: staleCandidates.length - batch.length,
  })
}
