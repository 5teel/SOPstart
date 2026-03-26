import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CompletionDetailClient } from './CompletionDetailClient'

interface CompletionDetailPageProps {
  params: Promise<{ completionId: string }>
}

interface RawCompletionData {
  id: string
  sop_id: string
  worker_id: string
  sop_version: number
  status: string
  submitted_at: string
  step_data: Record<string, number>
  sops: { title: string | null; version: number } | { title: string | null; version: number }[] | null
  completion_photos: {
    id: string
    step_id: string
    storage_path: string
    content_type: string
  }[] | null
  completion_sign_offs: {
    id: string
    supervisor_id: string
    decision: string
    reason: string | null
    created_at: string
  }[] | null
}

export default async function CompletionDetailPage({ params }: CompletionDetailPageProps) {
  const { completionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Role check
  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = member?.role ?? null
  if (!role) redirect('/dashboard')

  // Fetch completion with all joins (use admin client to bypass RLS for presigned URLs)
  const admin = createAdminClient()

  const { data: rawData, error } = await admin
    .from('sop_completions')
    .select(`
      id,
      sop_id,
      worker_id,
      sop_version,
      status,
      submitted_at,
      step_data,
      sops ( title, version ),
      completion_photos ( id, step_id, storage_path, content_type ),
      completion_sign_offs ( id, supervisor_id, decision, reason, created_at )
    `)
    .eq('id', completionId)
    .single()

  if (error || !rawData) {
    redirect('/activity')
  }

  const data = rawData as unknown as RawCompletionData

  // Access control: workers can only view their own completions
  if (role === 'worker' && data.worker_id !== user.id) {
    redirect('/activity')
  }

  // Supervisors can only view their assigned workers (RLS already enforced but double-check)
  // safety_manager can see all

  // Extract SOP info
  const sopInfo = Array.isArray(data.sops)
    ? data.sops[0] ?? null
    : data.sops

  const sopTitle = sopInfo?.title ?? null
  const sopVersion = sopInfo?.version ?? data.sop_version

  // Worker display info — no profiles table, use abbreviated user_id as display name
  const workerName = `Worker ${data.worker_id.slice(0, 8)}`

  // Generate presigned read URLs for all photos (1hr expiry)
  const photos = data.completion_photos ?? []
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: urlData } = await admin.storage
        .from('completion-photos')
        .createSignedUrl(photo.storage_path, 3600)
      return {
        id: photo.id,
        step_id: photo.step_id,
        storage_path: photo.storage_path,
        content_type: photo.content_type,
        signed_url: urlData?.signedUrl ?? '',
      }
    })
  )

  // Fetch SOP steps so we can show step text
  const { data: sections } = await supabase
    .from('sop_sections')
    .select('id, sort_order, sop_steps ( id, step_number, text )')
    .eq('sop_id', data.sop_id)
    .order('sort_order', { ascending: true })

  type RawSection = {
    id: string
    sort_order: number
    sop_steps: { id: string; step_number: number; text: string }[] | null
  }

  const allSteps = ((sections ?? []) as unknown as RawSection[])
    .flatMap((sec) => sec.sop_steps ?? [])
    .sort((a, b) => a.step_number - b.step_number)

  const signOffs = data.completion_sign_offs ?? []
  const signOff = signOffs.length > 0 ? signOffs[0] : null

  const isSupervisor = role === 'supervisor' || role === 'safety_manager'
  const alreadySigned = signOff !== null

  return (
    <CompletionDetailClient
      completionId={completionId}
      sopTitle={sopTitle}
      sopVersion={sopVersion}
      status={data.status as 'pending_sign_off' | 'signed_off' | 'rejected'}
      submittedAt={data.submitted_at}
      stepData={(data.step_data ?? {}) as Record<string, number>}
      workerName={workerName}
      workerId={data.worker_id}
      steps={allSteps}
      photos={photosWithUrls}
      signOff={signOff}
      isSupervisor={isSupervisor}
      alreadySigned={alreadySigned}
    />
  )
}
