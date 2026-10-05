import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSignedOffAssessor } from '@/lib/competency/assessor'
import { CompletionDetailClient } from './CompletionDetailClient'

interface CompletionDetailPageProps {
  params: Promise<{ completionId: string }>
}

interface RawCompletionData {
  id: string
  sop_id: string
  worker_id: string
  organisation_id: string
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

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')
  if (!role) redirect('/')

  // Fetch completion with all joins (use admin client to bypass RLS for presigned URLs)
  const admin = createAdminClient()

  const { data: rawData, error } = await admin
    .from('sop_completions')
    .select(`
      id,
      sop_id,
      worker_id,
      organisation_id,
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

  // Phase 37-07 CR-01: org-scope guard against the attacker-controlled
  // completionId route param, evaluated against the SESSION organisation
  // (never the row's own organisation_id) — service-role self-enforcement
  // class per CLAUDE.md 2026-06-15 / 2026-07-20. Must run before the
  // presigned-URL Promise.all below or it leaks the photo URLs it protects.
  if (!organisationId || data.organisation_id !== organisationId) {
    redirect('/activity')
  }

  // Access control: workers can only view their own completions
  if (role === 'worker' && data.worker_id !== userId) {
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

  // Generate presigned read URLs for all photos (1hr expiry), fetch SOP
  // steps, and compute derived assessor state IN PARALLEL — no serial
  // waterfall on this hot page (CLAUDE.md 2026-07-13).
  const photos = data.completion_photos ?? []
  const [photosWithUrls, { data: sections }, { data: focusRows }, isAssessor] = await Promise.all([
    Promise.all(
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
    ),
    supabase
      .from('sop_sections')
      .select('id, sort_order, sop_steps ( id, step_number, text )')
      .eq('sop_id', data.sop_id)
      .order('sort_order', { ascending: true }),
    // Phase 58: walks recorded after the cutover key step_data by focus step id.
    // Filtered by the SESSION organisation (T-58-17), never the row's own.
    supabase
      .from('sop_focus_steps')
      .select('id, section_id, sort_order, text')
      .eq('organisation_id', organisationId)
      .eq('sop_id', data.sop_id)
      .order('sort_order', { ascending: true }),
    // Phase 37 ASR-01: server-computed so the client's disabled Approve
    // button is never trusted as the authority (signOffCompletion
    // recomputes this itself) — this is purely for the UI's blocked/override
    // state.
    // Phase 37-07 CR-01: fourth arg is the SESSION organisationId, not the
    // row's own org field — that field is attacker-influenced (whatever org
    // the supplied completionId UUID happens to belong to). The guard above
    // already proves the two equal; this is defence-in-depth so the
    // predicate stays correct even if the guard is later moved or deleted.
    isSignedOffAssessor(userId, data.sop_id, admin, organisationId),
  ])

  type RawSection = {
    id: string
    sort_order: number
    sop_steps: { id: string; step_number: number; text: string }[] | null
  }

  // Section order, then step order within the section; numbered sequentially.
  // step_number restarts at 1 in every section, so a global sort by it
  // interleaved the procedures and printed "1" four times in a row.
  const rawSections = (sections ?? []) as unknown as RawSection[]
  const oldSteps = rawSections.flatMap((sec) => [...(sec.sop_steps ?? [])].sort((a, b) => a.step_number - b.step_number))

  // Focus steps first (new walks); the old step table only for keys that are not
  // focus steps, i.e. completions recorded before the cutover.
  const sectionOrder = new Map(rawSections.map((sec) => [sec.id, sec.sort_order]))
  const focusSteps = [...((focusRows ?? []) as Array<{ id: string; section_id: string; sort_order: number; text: string }>)]
    .sort((a, b) => (sectionOrder.get(a.section_id) ?? 0) - (sectionOrder.get(b.section_id) ?? 0) || a.sort_order - b.sort_order)
    .map((f) => ({ id: f.id, text: f.text }))
  const keys = Object.keys((data.step_data ?? {}) as Record<string, unknown>)
  const focusIds = new Set(focusSteps.map((f) => f.id))
  const walkedOnFocusSteps = focusSteps.length > 0 && (keys.length === 0 || keys.some((k) => focusIds.has(k)))
  const allSteps = (walkedOnFocusSteps
    ? [...focusSteps, ...oldSteps.filter((o) => keys.includes(o.id) && !focusIds.has(o.id)).map((o) => ({ id: o.id, text: o.text }))]
    : oldSteps.map((o) => ({ id: o.id, text: o.text }))
  ).map((st, i) => ({ ...st, step_number: i + 1 }))

  const signOffs = data.completion_sign_offs ?? []
  const signOff = signOffs.length > 0 ? signOffs[0] : null

  // Phase 37 D-06: admin must reach the sign-off bar too — it holds the
  // override path, so excluding it here would make the override unreachable
  // on this surface no matter how correct the gate is.
  const isSupervisor = role === 'supervisor' || role === 'safety_manager' || role === 'admin'
  const alreadySigned = signOff !== null
  const canOverride = role === 'admin' || role === 'safety_manager'

  return (
    <CompletionDetailClient
      completionId={completionId}
      sopId={data.sop_id}
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
      currentUserId={userId}
      isAssessor={isAssessor}
      canOverride={canOverride}
    />
  )
}
