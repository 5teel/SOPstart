import { notFound, redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { requireSopEditAccess } from '@/lib/auth/guards'
import { loadFocusSop } from '@/lib/sop/focus-read'
import { focusHref } from '@/lib/sop/focus-path'
import { latestPublishedOf, resolveFocusTarget, type LineageRow } from '@/lib/sop/lineage-current'
import { memberLabel, userLabels } from '@/lib/members/labels'
import { toWalkState, WALK_COLUMNS } from '@/lib/sop/walk-read'
import type { ParseJobSnapshot } from '@/hooks/useParseJob'
import type { ParseJobStatus } from '@/types/sop'
import { FocusWalker } from '@/components/focus/FocusWalker'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The SOP focus screen (Phase 58, FOC-01/FOC-03). A server component: which
 * version this person may open is decided here, from the session, and any
 * redirect is a server redirect -- never a mount effect (CLAUDE.md 2026-09-29).
 * Nothing is written on load.
 *
 * `?mode=edit` opens the editor on the exact version for anyone the server
 * grants edit access (T-58-draft); a published SOP with an open draft redirects
 * to that draft. A SOP still being read opens in the editor frame too.
 */
export default async function SopFocusPage({
  params,
  searchParams,
}: {
  params: Promise<{ sopId: string }>
  searchParams: Promise<{ from?: string | string[]; mode?: string | string[] }>
}) {
  const { sopId } = await params
  const { from: rawFrom, mode: rawMode } = await searchParams
  // Raw; every consumer (Back, the superseded link) passes it through the place whitelist.
  const from = typeof rawFrom === 'string' ? rawFrom : null

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')
  if (!organisationId || !UUID.test(sopId)) notFound()

  const { data: requested } = await supabase
    .from('sops')
    .select('id, parent_sop_id, status')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!requested) notFound()

  // The lineage is flat: every version points at the original row.
  const root = requested.parent_sop_id ?? requested.id
  const { data: family } = await supabase
    .from('sops')
    .select('id, version, parent_sop_id, status')
    .eq('organisation_id', organisationId)
    .or(`id.eq.${root},parent_sop_id.eq.${root}`)
  const lineage = (family ?? []) as LineageRow[]
  const lineageIds = lineage.map((r) => r.id)

  // Edit mode: asked for, or an admin opening a SOP that is still being read. The
  // server decides; a refusal falls back to the worker resolution (drafts stay hidden).
  const isAdminRole = ['admin', 'safety_manager'].includes(role ?? '')
  const reading = requested.status === 'uploading' || requested.status === 'parsing'
  const wantEdit = rawMode === 'edit' || (isAdminRole && reading)
  const editCtx = wantEdit ? await requireSopEditAccess({ sopId }) : null
  const editing = !!editCtx && !('error' in editCtx)

  if (editing && requested.status === 'published') {
    const draft = lineage.find((r) => r.status === 'draft')
    if (draft) redirect(focusHref(draft.id, { mode: 'edit', from }))
  }

  const [walksRes, completionsRes, jobRes] = await Promise.all([
    supabase
      .from('sop_walks')
      .select(WALK_COLUMNS)
      .eq('organisation_id', organisationId)
      .eq('worker_id', userId)
      .eq('status', 'in_progress')
      .in('sop_id', lineageIds),
    // A rejected walk is not done (59 A-06), same as useWorkerSops and the competency reads.
    supabase.from('sop_completions').select('sop_id').neq('status', 'rejected').eq('worker_id', userId).in('sop_id', lineageIds),
    editing && requested.status !== 'published'
      ? supabase
          .from('parse_jobs')
          .select('status, error_message, current_stage, file_type, input_type, created_at')
          .eq('sop_id', sopId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const walks = walksRes.data ?? []

  let target = resolveFocusTarget({
    role: role ?? 'worker',
    requestedId: sopId,
    lineage,
    inProgressSopId: walks[0]?.sop_id ?? null,
  })
  if (editing) {
    // The exact row, whatever the worker resolution would have said (an approver editing a draft).
    const latestRow = latestPublishedOf(lineage, sopId)
    const row = lineage.find((r) => r.id === sopId)
    target = { kind: 'open', id: sopId, superseded: !!latestRow && (latestRow.version ?? 0) > (row?.version ?? 0) }
  }
  if (target.kind === 'not_found') notFound()
  if (target.kind === 'redirect') redirect(focusHref(target.id, { from }))

  const data = await loadFocusSop(supabase, target.id)
  if (!data) notFound()

  // The owner's name only goes to people who can open the editor (T-59-30): never browse or walk.
  const ownerId = data.sop.owner_user_id
  const owner =
    editing || isAdminRole
      ? {
          label: ownerId ? memberLabel((await userLabels([ownerId])).get(ownerId)) : null,
          canMarkReviewed: isAdminRole || ownerId === userId,
        }
      : null

  const walkRow = walks.find((w) => w.sop_id === target.id)
  const walk = walkRow ? toWalkState(walkRow) : null

  // A walk in progress finishes on the version it started on (D-12): it is live for that worker.
  const published = data.sop.status === 'published'
  const latest = latestPublishedOf(lineage, target.id)
  const superseded = published && target.superseded && !walk
  const versionState = !published ? 'draft' : superseded ? 'superseded' : 'live'

  // D-12: the worker has finished an earlier version of this SOP and not this one.
  const doneOn = new Set((completionsRes.data ?? []).map((c) => c.sop_id as string))
  const thisVersion = data.sop.version
  const updatedSinceLastWalk =
    published &&
    !doneOn.has(target.id) &&
    lineage.some((r) => doneOn.has(r.id) && (r.version ?? 0) < thisVersion)

  // The editor's first look: still being read, or ready to edit.
  const jobRow = jobRes.data as {
    status: ParseJobStatus
    error_message: string | null
    current_stage: string | null
    file_type: string
    input_type: string | null
    created_at: string
  } | null
  const job: ParseJobSnapshot | null = jobRow
    ? {
        status: jobRow.status,
        errorMessage: jobRow.error_message,
        currentStage: jobRow.current_stage,
        isVideo: jobRow.file_type === 'video',
        inputType: jobRow.input_type,
        startedAt: jobRow.created_at,
      }
    : null
  const stillReading =
    !published &&
    (data.sop.status === 'uploading' || data.sop.status === 'parsing' || (!!job && ['queued', 'processing', 'failed'].includes(job.status ?? '')))
  const initialMode = editing ? (stillReading ? 'parsing' : 'edit') : 'browse'

  // The Walk / Edit switch and the editor's tick, AI check and Publish are for admins and safety
  // managers only (D-06): an approver with edit access sees the editor, never the switch.
  // In browse the session client already proved the row is in the caller's organisation.
  const canEdit = isAdminRole && (editCtx ? editing : true)

  return (
    <FocusWalker
      key={`${target.id}:${walk?.id ?? 'none'}`}
      data={data}
      initialWalk={walk}
      from={from}
      versionState={versionState}
      supersededBy={superseded && latest ? { id: latest.id, version: latest.version ?? 0 } : null}
      updatedSinceLastWalk={updatedSinceLastWalk}
      initialMode={initialMode}
      job={job}
      canEdit={canEdit}
      owner={owner}
    />
  )
}
