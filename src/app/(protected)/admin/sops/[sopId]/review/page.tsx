import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReviewClient from './ReviewClient'
import type { SopWithSections, ParseJob } from '@/types/sop'

export const metadata: Metadata = {
  title: 'Review SOP',
}

// ReviewClient renders the full review UI including:
// - Side-by-side layout (lg:flex-row) with original doc viewer (left) and parsed sections (right)
// - Header bar: Re-parse | Delete draft | Publish SOP
// - Progress counter: "{N} of {N} sections approved"
// - Approve all sections before publishing (disabled state tooltip)
// - Section-by-section approval with inline edit, Save changes, Cancel, Undo approval

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ sopId: string }>
}) {
  const { sopId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check user is admin or safety_manager
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['admin', 'safety_manager'].includes(member.role)) {
    redirect('/dashboard')
  }

  // Fetch SOP with nested sections, steps, images
  const { data: sop, error: sopError } = await supabase
    .from('sops')
    .select(`
      *,
      sop_sections (
        *,
        sop_steps ( * ),
        sop_images ( * )
      )
    `)
    .eq('id', sopId)
    .order('sort_order', { referencedTable: 'sop_sections', ascending: true })
    .single()

  if (sopError || !sop) {
    redirect('/admin/sops')
  }

  // Sort steps within each section
  for (const section of sop.sop_sections ?? []) {
    section.sop_steps?.sort(
      (a: { step_number: number }, b: { step_number: number }) =>
        a.step_number - b.step_number
    )
  }

  // Fetch latest parse job
  const { data: parseJob } = await supabase
    .from('parse_jobs')
    .select('*')
    .eq('sop_id', sopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Generate presigned download URL for original document (1 hour)
  const { data: urlData } = await supabase.storage
    .from('sop-documents')
    .createSignedUrl(sop.source_file_path, 3600)

  const presignedUrl = urlData?.signedUrl ?? null

  return (
    <ReviewClient
      sop={sop as unknown as SopWithSections}
      parseJob={parseJob as ParseJob | null}
      presignedUrl={presignedUrl}
    />
  )
}
