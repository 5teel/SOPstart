import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { orderedReviewSteps, signCompletionPhotos } from '@/lib/completions/review'
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Owner-only (Phase 59 D-13): a completion is the walker's own record. Sign-off happens in the
// Office inbox, so anyone else who lands here is sent there from the server (never a client effect).
export default async function CompletionDetailPage({ params }: CompletionDetailPageProps) {
  const { completionId } = await params

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')
  if (!role) redirect('/')
  const away = role === 'worker' ? '/?s=record' : '/?s=signoffs'
  if (!organisationId || !UUID_RE.test(completionId)) redirect(away)

  // Session client: RLS decides visibility, and the org filter is the SESSION org (F-05).
  const { data: rawData } = await supabase
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
    .eq('organisation_id', organisationId)
    .maybeSingle()

  const data = rawData as unknown as RawCompletionData | null
  if (!data || data.worker_id !== userId) redirect(away)

  const sopInfo = Array.isArray(data.sops) ? data.sops[0] ?? null : data.sops

  const stepData = (data.step_data ?? {}) as Record<string, number>
  const [photos, steps] = await Promise.all([
    signCompletionPhotos(data.completion_photos ?? [], organisationId),
    orderedReviewSteps(supabase, { sopId: data.sop_id, organisationId, stepData }),
  ])

  const signOffs = data.completion_sign_offs ?? []

  return (
    <CompletionDetailClient
      sopTitle={sopInfo?.title ?? null}
      sopVersion={sopInfo?.version ?? data.sop_version}
      status={data.status as 'pending_sign_off' | 'signed_off' | 'rejected'}
      submittedAt={data.submitted_at}
      stepData={stepData}
      steps={steps.map((s) => ({ id: s.id, step_number: s.step_number, text: s.text }))}
      photos={photos}
      signOff={signOffs.length > 0 ? signOffs[0] : null}
    />
  )
}
