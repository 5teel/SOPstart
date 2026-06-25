/**
 * Phase 23 AFL-AI-01 — GET /api/ai-fields/read
 *
 * Serves the current value of any registered AI field.
 *
 * Designed for v5.0 conversational agent consumption (D-04):
 * programmatically driveable, no UI coupling, no write path in this route.
 *
 * Query params:
 *   fieldId       — required. Registered field ID, e.g. 'sop.title'
 *   organisationId — optional. Falls back to JWT claim (recommended: omit and let JWT win)
 *   sopId          — optional UUID. Passed as context to the descriptor's read()
 *   sectionId      — optional UUID. Passed as context to the descriptor's read()
 *   stepId         — optional UUID.
 *   memberId       — optional UUID.
 *
 * Responses:
 *   200 { fieldId, value }
 *   400 { error: 'Invalid context' }  — Zod validation failed
 *   401 { error: 'unauthorized' }      — no session
 *   404 { error: 'Unknown field' }     — fieldId not in registry (T-23-02-03 allow-list)
 *   500 { error: 'Read failed' }       — descriptor.read() threw
 *
 * Security (T-23-02-01 mitigations):
 *   - RLS-respecting createClient() — NOT createAdminClient()
 *   - organisationId always taken from JWT claim, never from client-supplied param
 *   - descriptor.read() runs under session RLS (cross-org reads impossible)
 *   - route exports GET only — no mutation (T-23-02-02)
 *
 * Sources:
 *   - 23-CONTEXT.md D-04 — backbone-only; v5.0-consumable
 *   - 23-RESEARCH.md Pitfall 3 — import registrations barrel before first request
 *   - 23-PATTERNS.md § route.ts — getField() + registration side-effect
 *   - CLAUDE.md 2026-06-15 — RLS-respecting session client for reads
 */

// Side-effect import: populates the registry Map before any request is served.
// MUST be first import to avoid "Unknown field" on first cold-start request
// (23-RESEARCH.md Pitfall 3 / A4).
import '@/lib/ai-fields/registrations'

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getField } from '@/lib/ai-fields/registry'
import { FieldContextSchema } from '@/lib/validators/ai-fields'
import { parseJwtPayload } from '@/lib/supabase/jwt'

/**
 * GET /api/ai-fields/read?fieldId=sop.title&sopId=...
 */
export async function GET(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Extract organisationId from JWT claim — NEVER trust client-supplied value
  // (T-23-02-01: information disclosure via cross-org reads).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? parseJwtPayload(session.access_token)
    : {}
  const organisationId: string | null = (jwtClaims['organisation_id'] as string | undefined) ?? null
  if (!organisationId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── 2. Parse query params ─────────────────────────────────────────────
  const { searchParams } = new URL(req.url)
  const fieldId = searchParams.get('fieldId')

  if (!fieldId) {
    return NextResponse.json(
      { error: 'fieldId query param is required' },
      { status: 400 },
    )
  }

  // ── 3. Registry lookup (allow-list gate — T-23-02-03) ────────────────
  const descriptor = getField(fieldId)
  if (!descriptor) {
    return NextResponse.json({ error: 'Unknown field' }, { status: 404 })
  }

  // ── 4. Build FieldContext ─────────────────────────────────────────────
  // organisationId comes from JWT (never client-supplied).
  // All other context IDs are optional — validate with Zod.
  const rawContext = {
    organisationId, // JWT-derived — overrides any client param
    sopId: searchParams.get('sopId') ?? undefined,
    sectionId: searchParams.get('sectionId') ?? undefined,
    stepId: searchParams.get('stepId') ?? undefined,
    memberId: searchParams.get('memberId') ?? undefined,
  }

  const contextResult = FieldContextSchema.safeParse(rawContext)
  if (!contextResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid context',
        detail: contextResult.error.issues[0]?.message,
      },
      { status: 400 },
    )
  }

  // ── 5. Read field value via descriptor ───────────────────────────────
  // descriptor.read() runs under the session client's RLS — org-scoped reads.
  try {
    const value = await descriptor.read(contextResult.data)
    return NextResponse.json({ fieldId, value })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error(`[ai-fields/read] ${fieldId} read error:`, message)
    return NextResponse.json({ error: 'Read failed', detail: message }, { status: 500 })
  }
}
