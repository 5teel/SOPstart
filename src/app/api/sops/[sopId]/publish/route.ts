import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sops/[sopId]/publish — transition draft -> published
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  const supabase = await createClient()

  // Verify all sections are approved (server-side check — don't trust client)
  const { count: unapprovedCount, error: countError } = await supabase
    .from('sop_sections')
    .select('*', { count: 'exact', head: true })
    .eq('sop_id', sopId)
    .eq('approved', false)

  if (countError) {
    return NextResponse.json({ error: 'Failed to check section approvals' }, { status: 500 })
  }

  if (unapprovedCount && unapprovedCount > 0) {
    return NextResponse.json(
      { error: 'All sections must be approved before publishing' },
      { status: 400 }
    )
  }

  // Publish
  const { error: publishError } = await supabase
    .from('sops')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sopId)
    .eq('status', 'draft') // Only publish drafts

  if (publishError) {
    return NextResponse.json({ error: 'Failed to publish SOP' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
