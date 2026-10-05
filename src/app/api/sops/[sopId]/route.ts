import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sops/[sopId] — fetch SOP with all sections, their focus steps (hazard / ppe / step / check), and images
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  const supabase = await createClient()

  const { data: sop, error } = await supabase
    .from('sops')
    .select(`
      *,
      sop_sections (
        *,
        sop_focus_steps ( * ),
        sop_images ( * )
      )
    `)
    .eq('id', sopId)
    .order('sort_order', { referencedTable: 'sop_sections', ascending: true })
    .single()

  if (error || !sop) {
    return NextResponse.json({ error: 'SOP not found' }, { status: 404 })
  }

  // Sort steps within each section
  if (sop.sop_sections) {
    for (const section of sop.sop_sections) {
      if (section.sop_focus_steps) {
        section.sop_focus_steps.sort(
          (a: { sort_order: number }, b: { sort_order: number }) =>
            a.sort_order - b.sort_order
        )
      }
    }
  }

  return NextResponse.json(sop)
}

// DELETE /api/sops/[sopId] — delete a draft SOP and its Storage files
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  const supabase = await createClient()

  // Verify SOP exists and is draft (don't allow deleting published SOPs)
  const { data: sop, error: fetchError } = await supabase
    .from('sops')
    .select('id, status, source_file_path, organisation_id')
    .eq('id', sopId)
    .single()

  if (fetchError || !sop) {
    return NextResponse.json({ error: 'SOP not found' }, { status: 404 })
  }

  if (sop.status === 'published') {
    return NextResponse.json({ error: 'Cannot delete a published SOP' }, { status: 400 })
  }

  // Delete from database (cascade deletes sections, steps, images, parse_jobs)
  const { error: deleteError } = await supabase
    .from('sops')
    .delete()
    .eq('id', sopId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete SOP' }, { status: 500 })
  }

  // Best-effort cleanup of Storage files (don't fail the request if this fails)
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    // Remove source document folder
    const { data: files } = await admin.storage
      .from('sop-documents')
      .list(`${sop.organisation_id}/${sopId}/original`)
    if (files && files.length > 0) {
      await admin.storage
        .from('sop-documents')
        .remove(files.map((f: { name: string }) => `${sop.organisation_id}/${sopId}/original/${f.name}`))
    }
    // Remove extracted images folder
    const { data: imgFiles } = await admin.storage
      .from('sop-images')
      .list(`${sop.organisation_id}/${sopId}/images`)
    if (imgFiles && imgFiles.length > 0) {
      await admin.storage
        .from('sop-images')
        .remove(imgFiles.map((f: { name: string }) => `${sop.organisation_id}/${sopId}/images/${f.name}`))
    }
    // Remove editor-uploaded step photos and baked annotation copies (review WR-07):
    // {org}/{sop}/steps/{stepId}/{file}, one folder per step.
    const stepsDir = `${sop.organisation_id}/${sopId}/steps`
    const { data: stepDirs } = await admin.storage.from('sop-images').list(stepsDir)
    const stepFiles: string[] = []
    for (const d of stepDirs ?? []) {
      const { data: files } = await admin.storage.from('sop-images').list(`${stepsDir}/${d.name}`)
      for (const f of files ?? []) stepFiles.push(`${stepsDir}/${d.name}/${f.name}`)
    }
    if (stepFiles.length > 0) await admin.storage.from('sop-images').remove(stepFiles)
  } catch (storageErr) {
    console.error('Storage cleanup error (non-fatal):', storageErr)
  }

  return NextResponse.json({ success: true })
}
