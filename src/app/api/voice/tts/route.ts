import { NextResponse, type NextRequest } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { voiceTtsSchema } from '@/lib/validators/voice-tts'
import { TTS_MODEL } from '@/lib/voice/tts-constants'

// 30s safety cap for OpenAI TTS timeouts (typical ≤3s for ≤500 char input).
// Mitigation for T-22-02-01 (DoS via runaway TTS calls).
export const maxDuration = 30

/**
 * Concurrency cap — mirrors /api/voice/query route.
 *
 * NOTE: per-process in-memory state. Works on Railway single-process deploy.
 * If we ever move to PM2 cluster or serverless, replace with Redis-backed
 * rate-limit — see CLAUDE.md Cross-Project Learnings about PM2 cluster mode.
 *
 * Threat: T-22-02-01 (DoS via 50 workers × 500-char loops) — Zod max(500) already
 * limits per-request size; this prevents one user spamming N concurrent calls.
 */
const inFlight = new Set<string>()

// Lazy OpenAI client init — prevents build failure without OPENAI_API_KEY set.
// Pattern from src/lib/video-gen/tts.ts lines 10-13.
let openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

// NZ industrial pronunciation guidance — reused wording from src/lib/video-gen/tts.ts.
const TTS_INSTRUCTIONS =
  'Speak clearly and at a measured pace suitable for an industrial safety procedure in New Zealand. ' +
  'Pronounce: PPE as P-P-E, kPa as kilopascals, SCBA as S-C-B-A, MSDS as M-S-D-S.'

/**
 * Phase 22 — VDW-VOICE-02, VDW-LIT-03: TTS text-to-speech streaming route.
 *
 * POST { text: string (1..500 chars) }
 *   → 200 audio/mpeg  — MP3 buffer (TTS of text)
 *   → 400 invalid_input — Zod validation failed (empty or >500 chars)
 *   → 401 unauthorized — no session
 *   → 429 concurrent_query — user has another TTS call in flight
 *   → 502 tts_failed — OpenAI exception
 *
 * Security: T-22-02-02 — regular (non-admin) Supabase client; session required.
 *   Does NOT use createAdminClient / service-role — prevents this becoming a
 *   free OpenAI TTS proxy for unauthenticated callers.
 *
 * Model ID: sourced from TTS_MODEL constant (src/lib/voice/tts-constants.ts).
 *   Never hardcoded in this route body — prevents silent model-rot per
 *   CLAUDE.md Learnings 2026-06-02.
 *
 * Error logging: T-22-02-04 — only error.message logged, never the request body.
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // NOTE: no admin-role check — workers must be allowed to use TTS (D-15).
  // Auth via session is the gate; RLS org-scoping is implicit.

  // ── 2. Body validation ───────────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  const parsed = voiceTtsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', detail: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }
  const { text } = parsed.data

  // ── 3. Concurrency cap (1 in-flight per user) ────────────────────────────
  if (inFlight.has(user.id)) {
    return NextResponse.json({ error: 'concurrent_query' }, { status: 429 })
  }
  inFlight.add(user.id)

  try {
    // ── 4. OpenAI TTS call ───────────────────────────────────────────────
    // TTS_MODEL sourced from tts-constants.ts (CLAUDE.md 2026-06-02 model-rot learning).
    const response = await getClient().audio.speech.create({
      model: TTS_MODEL,
      voice: 'nova', // Clear, authoritative voice per Phase 15 research (D-08)
      input: text,
      instructions: TTS_INSTRUCTIONS,
      response_format: 'mp3',
    })

    const arrayBuffer = await response.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // T-22-02-01: never cache TTS responses — text may change between SOP versions.
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    // T-22-02-04: log only error.message, never the request body (mirrors T-15-03-05).
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('TTS route error:', message)
    return NextResponse.json({ error: 'tts_failed' }, { status: 502 })
  } finally {
    inFlight.delete(user.id)
  }
}
