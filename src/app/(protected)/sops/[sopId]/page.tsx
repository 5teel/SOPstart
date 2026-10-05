import { notFound, redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { loadFocusSop } from '@/lib/sop/focus-read'
import { focusHref } from '@/lib/sop/focus-path'
import { latestPublishedOf, resolveFocusTarget, type LineageRow } from '@/lib/sop/lineage-current'
import { toWalkState, WALK_COLUMNS } from '@/lib/sop/walk-read'
import { FocusWalker } from '@/components/focus/FocusWalker'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The SOP focus screen (Phase 58, FOC-01/FOC-03). A server component: which
 * version this person may open is decided here, from the session, and any
 * redirect is a server redirect -- never a mount effect (CLAUDE.md 2026-09-29).
 * Nothing is written on load.
 */
export default async function SopFocusPage({
  params,
  searchParams,
}: {
  params: Promise<{ sopId: string }>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { sopId } = await params
  const { from: rawFrom } = await searchParams
  // Raw; every consumer (Back, the superseded link) passes it through the place whitelist.
  const from = typeof rawFrom === 'string' ? rawFrom : null

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) redirect('/login')
  if (!organisationId || !UUID.test(sopId)) notFound()

  const { data: requested } = await supabase
    .from('sops')
    .select('id, parent_sop_id')
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

  const [walksRes, completionsRes] = await Promise.all([
    supabase
      .from('sop_walks')
      .select(WALK_COLUMNS)
      .eq('organisation_id', organisationId)
      .eq('worker_id', userId)
      .eq('status', 'in_progress')
      .in('sop_id', lineageIds),
    supabase.from('sop_completions').select('sop_id').eq('worker_id', userId).in('sop_id', lineageIds),
  ])
  const walks = walksRes.data ?? []

  const target = resolveFocusTarget({
    role: role ?? 'worker',
    requestedId: sopId,
    lineage,
    inProgressSopId: walks[0]?.sop_id ?? null,
  })
  if (target.kind === 'not_found') notFound()
  if (target.kind === 'redirect') redirect(focusHref(target.id, { from }))

  const data = await loadFocusSop(supabase, target.id)
  if (!data) notFound()

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

  return (
    <FocusWalker
      key={`${target.id}:${walk?.id ?? 'none'}`}
      data={data}
      initialWalk={walk}
      from={from}
      versionState={versionState}
      supersededBy={superseded && latest ? { id: latest.id, version: latest.version ?? 0 } : null}
      updatedSinceLastWalk={updatedSinceLastWalk}
    />
  )
}
