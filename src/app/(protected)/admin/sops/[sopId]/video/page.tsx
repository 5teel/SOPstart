import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import VideoGeneratePanel from '@/components/admin/VideoGeneratePanel'
import type { VideoGenerationJob } from '@/types/sop'

export const metadata: Metadata = {
  title: 'Video Versions',
}

export default async function VideoGeneratePage({
  params,
  searchParams,
}: {
  params: Promise<{ sopId: string }>
  searchParams: Promise<{ play?: string }>
}) {
  const { sopId } = await params
  const { play: autoPlayJobId } = await searchParams
  // Auth check — shared per-request session context (JWT verified locally).
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')

  // Check user is admin or safety_manager
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()

  // Fetch SOP record
  const { data: sop } = await admin
    .from('sops')
    .select('id, title, status, updated_at, version, organisation_id')
    .eq('id', sopId)
    .single()

  // Phase 37-07 rule-5 sibling of CR-01: org-scope guard against the
  // attacker-controlled sopId route param — an admin/safety_manager of ANY
  // organisation could otherwise read another org's SOP + video jobs.
  if (!sop || !organisationId || sop.organisation_id !== organisationId || sop.status !== 'published') {
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
      autoPlayJobId={autoPlayJobId}
    />
  )
}
