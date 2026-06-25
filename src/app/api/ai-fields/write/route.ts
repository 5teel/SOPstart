/**
 * Phase 23 Plan 23-04 — POST /api/ai-fields/write
 *
 * The v5.0 conversational-agent entrypoint for AI field writes (D-04).
 * Routes all write requests through gateWrite via applyAiWrite server action.
 *
 * Key invariant: gateWrite is the SINGLE write path — this route NEVER calls
 * descriptor.write() directly. All writes route through applyAiWrite (T-23-04-02).
 *
 * Before gating:
 *   - Imports the registrations barrel (side-effect) to populate the field registry
 *     (23-RESEARCH.md Pitfall 3 / A4: registry populated at module load).
 *   - Reads sop.status to determine sopIsPublished, closing the A6 ambiguity window
 *     before the write reaches the approval gate.
 *
 * Responses:
 *   200 { result: WriteResult }       — write applied or pending_approval
 *   400 { error: string }             — Zod validation failed
 *   401 { error: 'unauthorized' }     — no session
 *   404 { error: 'Unknown field' }    — fieldId not in registry (T-23-04-05)
 *   500 { error: string }             — write / DB error
 *
 * Sources:
 *   - 23-04-PLAN.md Task 2
 *   - 23-CONTEXT.md D-04 (write route = v5.0 agent entrypoint)
 *   - src/app/api/ai-fields/read/route.ts (sibling — same auth + org-claim pattern)
 *   - 23-RESEARCH.md § Open Questions #3 (sopIsPublished resolution before gate)
 */

// Side-effect import: populates the registry Map before any request is served.
// MUST be first import to avoid "Unknown field" on cold-start (23-RESEARCH.md Pitfall 3 / A4).
import '@/lib/ai-fields/registrations'

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getField } from '@/lib/ai-fields/registry'
import { AiWriteRequestSchema } from '@/lib/validators/ai-fields'
import { applyAiWrite } from '@/actions/ai-fields'

/**
 * POST /api/ai-fields/write
 *
 * Body: { fieldId: string; context: FieldContext; newValue: unknown }
 *
 * Before delegating to applyAiWrite, the route:
 *   1. Authenticates the caller (JWT session).
 *   2. Resolves sopIsPublished from sop.status if context.sopId is present —
 *      this closes the A6 ambiguity window so the approval gate has explicit status.
 *   3. Delegates to applyAiWrite (which calls gateWrite — the single write path).
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

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = AiWriteRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  const { fieldId, context, newValue } = parsed.data

  // ── 3. Registry allow-list check (T-23-04-05) ─────────────────────────────
  const descriptor = getField(fieldId)
  if (!descriptor) {
    return NextResponse.json({ error: `Unknown field: ${fieldId}` }, { status: 404 })
  }

  // ── 4. Resolve sopIsPublished (close A6 ambiguity) ────────────────────────
  // If the request carries a sopId but doesn't specify sopIsPublished, look up the
  // SOP status from the DB and inject it into the context. This ensures the approval
  // gate has an explicit sopIsPublished value and does NOT fall into the ambiguous
  // undefined path (which defaults to high-stake / pending — the safe side, but we
  // want to avoid spuriously routing draft edits to proposals).
  let enrichedContext = { ...context }
  if (context.sopId && context.sopIsPublished === undefined) {
    const { data: sop } = await supabase
      .from('sops')
      .select('status')
      .eq('id', context.sopId)
      .single()

    if (sop) {
      // sop.status === 'published' → sopIsPublished = true (high-stake gate)
      // sop.status === 'draft' | 'uploading' | 'parsing' → sopIsPublished = false (low-stake for low fields)
      enrichedContext = {
        ...context,
        sopIsPublished: sop.status === 'published',
      }
    }
    // If the SOP is not found, leave sopIsPublished undefined → A6 fail-safe applies
  }

  // ── 5. Delegate to applyAiWrite (single write path via gateWrite) ──────────
  const result = await applyAiWrite({
    fieldId,
    context: enrichedContext,
    newValue,
  })

  if (!result.success) {
    // Distinguish 404 (unknown field) vs 500 (write error) by error text
    const status = result.error.startsWith('Unknown field') ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ result: result.result }, { status: 200 })
}
