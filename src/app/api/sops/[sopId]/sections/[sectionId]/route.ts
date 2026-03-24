import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/sops/[sopId]/sections/[sectionId]
// Body: { content?: string, approved?: boolean, steps?: { id: string, text: string }[] }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string; sectionId: string }> }
) {
  const { sopId, sectionId } = await params
  const body = await request.json()
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

  // If steps are provided, update them individually
  if (body.steps && Array.isArray(body.steps)) {
    for (const step of body.steps) {
      if (step.id && step.text !== undefined) {
        await supabase
          .from('sop_steps')
          .update({ text: step.text, updated_at: new Date().toISOString() })
          .eq('id', step.id)
      }
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
