import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { requireAdminContext } from '@/lib/auth/guards'
import { generateSceneSchema } from '@/lib/validators/site'
import { upsertSiteLayout } from '@/actions/site'
import {
  SCENE_BUCKET,
  GEMINI_IMAGE_MODEL_DEFAULT,
  buildScenePrompt,
  buildGeminiImageRequest,
  extractGeminiImage,
  geminiEndpoint,
  scenePath,
} from '@/lib/site/scene'

/**
 * Phase 51 — D-06. Server-side scene generation via the Gemini image model.
 * A multi-second paid call — an API route (not a server action) so it isn't
 * bound by the action timeout, hence the long maxDuration.
 *
 * Guard order (pinned by tests/phase51/site-actions-contract.spec.ts):
 *   requireAdminContext() -> GEMINI_API_KEY presence -> body validation ->
 *   409 if the org already has a layout -> ONE Gemini fetch.
 */
export const maxDuration = 120

const GENERATION_ERROR = { error: 'Scene generation failed — try again or upload an image.' } as const

export async function POST(req: NextRequest) {
  const ctx = await requireAdminContext()
  if ('error' in ctx) {
    const status = ctx.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: ctx.error }, { status })
  }
  const orgId = ctx.organisationId
  if (!orgId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }

  // D-06 backstop: the UI never shows the Generate control without a key, but
  // the server refuses the call too, rather than failing open (2026-06-02).
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'Scene generation is not set up — upload an image instead.' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = generateSceneSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const { description } = parsed.data

  const db = ctx.supabase as unknown as SupabaseClient

  // Checked BEFORE the paid call — the v1 UI works with the org's first
  // layout, and this caps paid generations to one per org (T-51-04-A).
  const { data: existing, error: existingErr } = await db
    .from('site_layouts')
    .select('id')
    .eq('organisation_id', orgId)
    .limit(1)
    .maybeSingle()
  if (existingErr) {
    console.error('[site/generate] existing check error', existingErr)
    return NextResponse.json({ error: 'Could not check the existing site' }, { status: 500 })
  }
  if (existing) {
    return NextResponse.json({ error: 'This organisation already has a site' }, { status: 409 })
  }

  const model = process.env.GEMINI_IMAGE_MODEL ?? GEMINI_IMAGE_MODEL_DEFAULT

  let geminiRes: Response
  try {
    geminiRes = await fetch(geminiEndpoint(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The key goes in the request header, never a URL query param — a query
        // param would land in access logs.
        'x-goog-api-key': key,
      },
      body: JSON.stringify(buildGeminiImageRequest(buildScenePrompt(description))),
      signal: AbortSignal.timeout(110_000),
    })
  } catch (err) {
    console.error('[site/generate] fetch error', err)
    return NextResponse.json(GENERATION_ERROR, { status: 502 })
  }

  if (!geminiRes.ok) {
    const bodyText = await geminiRes.text().catch(() => '')
    // The upstream error body is logged server-side only — never forwarded.
    console.error('[site/generate] gemini', geminiRes.status, bodyText.slice(0, 500))
    return NextResponse.json(GENERATION_ERROR, { status: 502 })
  }

  const json = await geminiRes.json().catch(() => null)
  const image = extractGeminiImage(json)
  if (!image) {
    console.error('[site/generate] gemini returned no image')
    return NextResponse.json(GENERATION_ERROR, { status: 502 })
  }

  const buf = Buffer.from(image.data, 'base64')
  let meta: sharp.Metadata
  try {
    meta = await sharp(buf).metadata()
  } catch (err) {
    console.error('[site/generate] sharp error', err)
    return NextResponse.json(GENERATION_ERROR, { status: 502 })
  }
  if (meta.format !== 'jpeg' && meta.format !== 'png') {
    console.error('[site/generate] unexpected image format', meta.format)
    return NextResponse.json(GENERATION_ERROR, { status: 502 })
  }
  const ext = meta.format === 'jpeg' ? 'jpg' : 'png'
  const contentType = meta.format === 'jpeg' ? 'image/jpeg' : 'image/png'

  const layoutId = crypto.randomUUID()
  const path = scenePath(orgId, layoutId, ext)

  const { error: uploadErr } = await db.storage.from(SCENE_BUCKET).upload(path, buf, { contentType })
  if (uploadErr) {
    console.error('[site/generate] upload error', uploadErr)
    return NextResponse.json(GENERATION_ERROR, { status: 502 })
  }

  // The single record path — probes the stored object again and writes
  // scene_width/height before any polygon can be drawn (D-07).
  const result = await upsertSiteLayout({ id: layoutId, ext })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ layoutId }, { status: 200 })
}
