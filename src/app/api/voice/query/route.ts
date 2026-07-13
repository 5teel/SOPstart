import { NextResponse, type NextRequest } from 'next/server'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { voiceQuerySchema } from '@/lib/validators/voice-query'
import { answerSopQuestion } from '@/lib/voice/voice-qa'
import type { SopWithSections } from '@/types/sop'

/**
 * Phase 26.5 D-06 signal #3 (RESEARCH Pitfall 1) — persist the voice Q&A
 * transcript so the agent-layer synthesis pipeline has a real signal source.
 *
 * sop_voice_qa_log has no authenticated write policy (append-only via
 * service role only, migration 00040) — createAdminClient() is required.
 * organisation_id is taken from the already RLS-verified `sop` row (not a
 * JWT decode — CLAUDE.md 2026-06-26 prefers the already-fetched, already-
 * verified value when available). Fire-and-forget: a log failure must NEVER
 * change the 200 answer the worker receives (T-26.5-03-01/04).
 */
function logVoiceQaTranscript(params: {
  organisationId: string
  sopId: string
  userId: string
  question: string
  answer: string
  citations: string[]
}) {
  try {
    createAdminClient()
      .from('sop_voice_qa_log')
      .insert({
        organisation_id: params.organisationId,
        sop_id: params.sopId,
        user_id: params.userId,
        question: params.question,
        answer: params.answer,
        citations: params.citations,
      })
      .then(({ error }) => {
        if (error) console.error('voice_qa transcript log insert failed:', error.message)
      })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('voice_qa transcript log insert threw:', message)
  }
}

// 30s safety cap for Anthropic timeouts (typical ≤2s answer + verifier round trip).
// Mitigation for T-15-03-04 (cost runaway via long-running calls).
export const maxDuration = 30

/**
 * Concurrency cap — RESEARCH § Pattern 4 lines 316.
 *
 * NOTE: per-process in-memory state. Works on Railway single-process deploy.
 * If we ever move to PM2 cluster or serverless, replace with Redis-backed
 * rate-limit (per-user token bucket) — see CLAUDE.md Cross-Project Learnings
 * about PM2 cluster mode losing in-memory state.
 *
 * Threat: T-15-03-04 (DoS via 500-char question loop) — Zod max(500) already
 * limits per-request size; this prevents one user spamming N concurrent calls.
 */
const inFlight = new Set<string>()

/**
 * Phase 15 D-05..D-08, SB-LINE-03, SB-LINE-04 — voice Q&A endpoint.
 *
 * POST { sopId: uuid, question: string (5..500 chars) }
 *   → 200 { answer, citations, verifier_flags }
 *   → 400 invalid_input — Zod validation failed
 *   → 401 unauthorized — no session
 *   → 404 not_found — RLS hid the SOP (cross-org / wrong sub-trade / not published)
 *   → 429 concurrent_query — user has another query in flight
 *   → 502 voice_query_failed — Anthropic call exception
 *
 * SB-LINE-04 grounding-scope guarantee: query joins on `sops.id = :sopId` only.
 * No cross-SOP join, no semantic search across the corpus. A question whose
 * answer lives in a DIFFERENT SOP MUST yield "I can't find that in this procedure".
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────
  const { supabase, userId } = await getSessionContext()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // NOTE: no admin-role check — workers must be allowed to ask questions (D-15).
  // Auth via session is sufficient; RLS handles SOP visibility (org + sub-trade gate).

  // ── 2. Body validation ───────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  const parsed = voiceQuerySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', detail: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }
  const { sopId, question } = parsed.data

  // ── 3. Concurrency cap (1 in-flight per user) ────────────────────────
  if (inFlight.has(userId)) {
    return NextResponse.json({ error: 'concurrent_query' }, { status: 429 })
  }
  inFlight.add(userId)

  try {
    // ── 4. RLS-scoped single-SOP fetch ─────────────────────────────────
    // SB-LINE-04: ANY cross-SOP join here breaks grounding scope. Always
    // `.eq('id', sopId)` exactly once. Use the regular client (NOT admin) —
    // RLS enforces single-org + sub-trade gate from migration 00030.
    const { data: sop, error: fetchErr } = await supabase
      .from('sops')
      .select(`
        id, title, version, status, organisation_id, sop_number, revision_date,
        author, category, department, related_sops, applicable_equipment,
        required_certifications, source_file_path, source_file_type,
        source_file_name, overall_confidence, parse_notes, is_ocr, uploaded_by,
        published_at, source_type, category_tag, created_at, updated_at,
        sop_sections(
          id, sop_id, section_type, section_kind_id, title, content, sort_order,
          confidence, approved, layout_data, layout_version, created_at, updated_at,
          sop_steps(
            id, section_id, step_number, text, warning, caution, tip,
            required_tools, time_estimate_minutes, created_at, updated_at
          )
        )
      `)
      .eq('id', sopId)
      .eq('status', 'published')
      .single()

    if (fetchErr || !sop) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    // ── 5. Two-call Anthropic pipeline (answer + verifier with cache HIT) ──
    const sopWithSections = sop as unknown as SopWithSections
    try {
      const result = await answerSopQuestion(sopWithSections, question)
      logVoiceQaTranscript({
        organisationId: sopWithSections.organisation_id,
        sopId,
        userId,
        question,
        answer: result.answer,
        citations: result.citations,
      })
      return NextResponse.json(result)
    } catch (err) {
      // T-15-03-05: log only error.message, never the request body. Anthropic
      // exception payloads do not include the request body in `.message`.
      const message = err instanceof Error ? err.message : 'unknown'
      console.error('voice query pipeline error:', message)
      return NextResponse.json({ error: 'voice_query_failed' }, { status: 502 })
    }
  } finally {
    inFlight.delete(userId)
  }
}
