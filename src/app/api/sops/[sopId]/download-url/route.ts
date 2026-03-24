import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sops/[sopId]/download-url — generate a presigned URL for the original document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  const supabase = await createClient()

  const { data: sop, error } = await supabase
    .from('sops')
    .select('source_file_path, source_file_type')
    .eq('id', sopId)
    .single()

  if (error || !sop) {
    return NextResponse.json({ error: 'SOP not found' }, { status: 404 })
  }

  const { data: urlData } = await supabase.storage
    .from('sop-documents')
    .createSignedUrl(sop.source_file_path, 3600) // 1 hour

  return NextResponse.json({ url: urlData?.signedUrl ?? null })
}
