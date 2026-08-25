import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireSopEditAccess } from '@/lib/auth/guards'

// PATCH /api/sops/[sopId]/sections/[sectionId]
// Body: { content?: string, approved?: boolean, steps?: { id: string, text: string }[] }
//
// WR-03 (Phase 46 review): step updates are CONTAINED to the authorized
// section (.eq('section_id', sectionId) on every update) -- the guard
// authorizes per-SOP, so a raw client-supplied step.id must never reach a
// step under a different SOP. Per-step errors are surfaced, and a zero-row
// update (stale id or RLS deny -- PostgREST does not error on it) is an
// error, never silent success.
const PatchBodySchema = z.object({
  content: z.string().optional(),
  approved: z.boolean().optional(),
  // step.id is min(1) (not .uuid()) because SectionEditor's addStep sends
  // `new-${Date.now()}` placeholder ids for client-added steps. This legacy
  // route has never created steps; placeholders are skipped below (matching
  // the old silent behaviour) rather than failing the whole save.
  steps: z.array(z.object({ id: z.string().min(1), text: z.string() })).optional(),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string; sectionId: string }> }
) {
  const { sopId, sectionId } = await params

  const ctx = await requireSopEditAccess({ sopId })
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: 403 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = PatchBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 }
    )
  }
  const body = parsed.data

  const supabase = await createClient()

  // Verify section belongs to this SOP (RLS handles org scoping)
  const { data: section, error: fetchError } = await supabase
    .from('sop_sections')
    .select('id, sop_id, approved')
    .eq('id', sectionId)
    .eq('sop_id', sopId)
    .single()

  if (fetchError || !section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  // If updating content, reset approval (per I-04 step 6: "any edit requires re-approval")
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.content !== undefined) {
    updates.content = body.content
    updates.approved = false // Reset approval on edit
  }

  if (body.approved !== undefined && body.content === undefined) {
    // Pure approval toggle (not an edit)
    updates.approved = body.approved
  }

  const { error: updateError } = await supabase
    .from('sop_sections')
    .update(updates)
    .eq('id', sectionId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 })
  }

  // If steps are provided, update them individually -- contained to THIS
  // section, checking each result (zero affected rows = error, not success).
  if (body.steps && body.steps.length > 0) {
    const stepErrors: { id: string; error: string }[] = []
    // Skip client-side placeholder ids (`new-*`) -- see schema comment.
    const persistedSteps = body.steps.filter((s) => UUID_RE.test(s.id))
    for (const step of persistedSteps) {
      const { data: updated, error: stepError } = await supabase
        .from('sop_steps')
        .update({ text: step.text, updated_at: new Date().toISOString() })
        .eq('id', step.id)
        .eq('section_id', sectionId)
        .select('id')
      if (stepError) {
        stepErrors.push({ id: step.id, error: stepError.message })
      } else if (!updated || updated.length === 0) {
        stepErrors.push({ id: step.id, error: 'Step not found in this section (or no edit access)' })
      }
    }
    if (stepErrors.length > 0) {
      return NextResponse.json(
        { error: 'One or more step updates failed', stepErrors },
        { status: 400 }
      )
    }
    // Reset approval when steps are edited
    if (body.approved === undefined) {
      await supabase
        .from('sop_sections')
        .update({ approved: false })
        .eq('id', sectionId)
    }
  }

  return NextResponse.json({ success: true })
}
