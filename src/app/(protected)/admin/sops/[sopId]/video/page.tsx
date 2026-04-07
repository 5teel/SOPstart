import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import VideoGeneratePanel from '@/components/admin/VideoGeneratePanel'
import type { VideoGenerationJob } from '@/types/sop'

export const metadata: Metadata = {
  title: 'Video Versions',
}

export default async function VideoGeneratePage({
  params,
}: {
  params: Promise<{ sopId: string }>
}) {
  const { sopId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  const admin = createAdminClient()

  // Fetch SOP record
  const { data: sop } = await admin
    .from('sops')
    .select('id, title, status, updated_at, version')
    .eq('id', sopId)
    .single()

  if (!sop || sop.status !== 'published') {
    redirect('/admin/sops')
  }

  // Fetch all non-archived versions, newest first
  const { data: versions } = await admin
    .from('video_generation_jobs')
    .select('*')
    .eq('sop_id', sopId)
    .eq('archived', false)
    .order('version_number', { ascending: false })

  // Fetch archived versions
  const { data: archivedVersions } = await admin
    .from('video_generation_jobs')
    .select('*')
    .eq('sop_id', sopId)
    .eq('archived', true)
    .order('version_number', { ascending: false })

  return (
    <VideoGeneratePanel
      sop={{
        id: sop.id,
        title: sop.title ?? 'Untitled SOP',
        updated_at: sop.updated_at,
        version: sop.version,
      }}
      versions={(versions ?? []) as VideoGenerationJob[]}
      archivedVersions={(archivedVersions ?? []) as VideoGenerationJob[]}
    />
  )
}
