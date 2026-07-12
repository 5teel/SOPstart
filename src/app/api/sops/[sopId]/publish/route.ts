import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJwtPayload } from '@/lib/supabase/jwt'
import { performPublish } from '@/lib/governance/publish-core'

// POST /api/sops/[sopId]/publish — transition draft -> published
//
// Phase 29 (Plan 29-01) — steps 2 through 5 (unapproved-sections gate,
// verify-checklist gate, status flip, review-clock reset, video auto-queue,
// agent synthesis) were relocated VERBATIM into performPublish()
// (src/lib/governance/publish-core.ts). This route now only resolves
// auth/org (step 1) and delegates — no chain-gate branch yet (that lands in
// Plan 29-02). The no-chain response shape below is BYTE-IDENTICAL to the
// pre-Phase-29 route.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  const supabase = await createClient()

  // 1. Resolve user + org for downstream auto-queue call
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: { session } } = await supabase.auth.getSession()
  // parseJwtPayload, not raw atob — JWT payloads are Base64URL (CLAUDE.md 2026-06-26)
  const jwtClaims = session?.access_token ? parseJwtPayload(session.access_token) : {}
  const organisationId = jwtClaims['organisation_id'] as string | undefined
  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }

  const result = await performPublish(supabase, { sopId, organisationId, userId: user.id })

  if (!result.success) {
    // count is only present for the unverified_blocks 400 — byte-identical
    // to the pre-Phase-29 { error: 'unverified_blocks', count } shape.
    const body = result.count !== undefined ? { error: result.error, count: result.count } : { error: result.error }
    return NextResponse.json(body, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    pipelineAutoQueued: result.pipelineAutoQueued,
  })
}
