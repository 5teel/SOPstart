/**
 * POST /api/sops/generate-video/callback?secret=<SHOTSTACK_CALLBACK_SECRET>
 *
 * Shotstack completion webhook — the self-healing path. Shotstack POSTs here
 * the instant a render finishes (done | failed), so a job reaches its terminal
 * state on its own even when the in-request poll loop timed out. No cron, no
 * staleness threshold: the broken job is fixed at the moment it breaks.
 *
 * Cookie-less webhook → MUST be exempted in src/lib/supabase/middleware.ts,
 * else the session middleware 307-redirects it to /login before this handler
 * runs (see 2026-07-05 learning). Auth is a shared secret in the query string
 * (Shotstack does not sign callbacks).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShotstackRender } from '@/lib/video-gen/shotstack-client'
import { finalizeRenderJob } from '@/lib/video-gen/finalize-job'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const secret = process.env.SHOTSTACK_CALLBACK_SECRET
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Shotstack callback body: { type, action, id: <renderId>, status, url, ... }
  const body = (await request.json().catch(() => null)) as { id?: string } | null
  const renderId = body?.id
  if (!renderId) return NextResponse.json({ error: 'Missing render id' }, { status: 400 })

  const admin = createAdminClient()

  const { data: job } = await admin
    .from('video_generation_jobs')
    .select('id, sop_id, organisation_id, status')
    .eq('shotstack_render_id', renderId)
    .maybeSingle()

  // Unknown render id — ack so Shotstack stops retrying, but nothing to do.
  if (!job) return NextResponse.json({ ok: true, matched: false })

  // Re-fetch authoritative status from Shotstack rather than trusting the
  // callback body — reuses the proven path and survives partial payloads.
  const render = await getShotstackRender(renderId)
  const result = await finalizeRenderJob(admin, job, render)

  return NextResponse.json({ ok: true, jobId: job.id, ...result })
}
