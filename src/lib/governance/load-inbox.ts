/**
 * Phase 57 (D-16), widened in Phase 59 (D-05, A-11): the ONE inbox read. The
 * Office pane, its Inbox count and the Office pin all count `items.length`
 * from it (plus the open requests, via officePinCount), so the numbers cannot disagree. Completions waiting for sign-off
 * and the caller's own due reviews are part of it. Plain module (no server
 * directive) -- every source below runs its own role guard, and the two reads
 * added here use the SESSION client only, so row-level security decides which
 * completions a supervisor sees.
 *
 * ponytail: listAdminSopRows recomputes the governance queue a second time
 * internally -- accepted, admin read, org-sized data.
 */
import { listGovernanceQueue, type GovernanceRow } from '@/actions/governance'
import { listAdminSopRows } from '@/actions/admin-sop-list'
import { listSiteHealthForOrg } from '@/actions/site'
import { getSessionContext } from '@/lib/auth/session-context'
import { resolveNextStepIndex, type ChainStep } from '@/lib/governance/approvals'
import { deriveInbox, type HandoverItem, type InboxItem, type OwnedReview, type PendingSignOff } from '@/lib/governance/inbox'
import { memberLabel, userLabels } from '@/lib/members/labels'
import { memberStatusMap } from '@/lib/members/active'
import { statusSuffix } from '@/lib/members/authority'
import { aboutTitles } from '@/lib/requests/core'
import { RAISABLE_KINDS, type OfficeRequest, type RequestSubjectType } from '@/lib/requests/model'
import { categoryLabel } from '@/lib/sop-categories'
import type { MillerSop } from '@/lib/sop-list/admin-rows'
import type { AdminSiteFloor } from '@/lib/validators/site'
import type { MemberStatus } from '@/types/auth'

export interface LoadedInbox {
  governance: GovernanceRow[]
  library: MillerSop[]
  floor: AdminSiteFloor | { error: string }
  items: InboxItem[]
  requests: OfficeRequest[]
}

const INBOX_ROLES = ['supervisor', 'safety_manager', 'admin']
const HANDOVER_ROLES = ['safety_manager', 'admin']

/** Completions waiting for the caller to sign off, oldest first. Never the caller's own walk (A-03). */
export async function listPendingSignOffs(): Promise<PendingSignOff[] | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation' }
  if (!role || !INBOX_ROLES.includes(role)) return []

  const { data, error } = await supabase
    .from('sop_completions')
    .select('id, sop_id, worker_id, sop_version, submitted_at, sops ( title ), completion_photos ( id )')
    .eq('organisation_id', organisationId)
    .eq('status', 'pending_sign_off')
    .neq('worker_id', userId)
    .order('submitted_at', { ascending: true })
  if (error) {
    console.error('[listPendingSignOffs]', error)
    return { error: error.message }
  }

  type Row = {
    id: string
    sop_id: string
    worker_id: string
    sop_version: number
    submitted_at: string
    sops: { title: string | null } | null
    completion_photos: Array<{ id: string }> | null
  }
  const rows = (data ?? []) as unknown as Row[]
  const workerIds = rows.map((r) => r.worker_id)
  const [labels, statuses] = await Promise.all([userLabels(workerIds), memberStatusMap(organisationId, workerIds)])
  return rows.map((r) => ({
    completionId: r.id,
    sopId: r.sop_id,
    sopTitle: r.sops?.title ?? 'Untitled SOP',
    sopVersion: r.sop_version,
    workerId: r.worker_id,
    workerLabel: statusSuffix(memberLabel(labels.get(r.worker_id)), statuses.get(r.worker_id)),
    submittedAt: r.submitted_at,
    photoCount: r.completion_photos?.length ?? 0,
  }))
}

/**
 * Open requests the viewer can answer, newest first (Phase 60 D-03). Session client: RLS
 * `requests_read` decides who sees open rows; the raisable kinds exclude asks, which are not
 * the Office's to answer; agent-raised machine requests are not offered. Asker names and about-titles come from plain modules.
 */
export async function listOpenRequests(): Promise<OfficeRequest[] | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation' }
  if (!role || !INBOX_ROLES.includes(role)) return []

  const { data, error } = await supabase
    .from('requests')
    .select('id, kind, subject_type, subject_id, note, raised_by_user, raised_by_agent, created_at')
    .eq('organisation_id', organisationId)
    .eq('state', 'open')
    .in('kind', [...RAISABLE_KINDS])
    // R1 (ADR-0004 rule 4): the agent no longer asks for a SOP for a bare machine; rows it wrote before stay as data, not offered.
    .or('raised_by_agent.is.null,subject_type.neq.machine')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[listOpenRequests]', error)
    return { error: error.message }
  }
  const rows = data ?? []
  const [labels, titles] = await Promise.all([
    userLabels(rows.flatMap((r) => (r.raised_by_user ? [r.raised_by_user] : []))),
    aboutTitles(
      organisationId,
      rows.map((r) => ({ type: r.subject_type as RequestSubjectType, id: r.subject_id })),
    ),
  ])
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as OfficeRequest['kind'],
    subject: {
      type: r.subject_type as RequestSubjectType,
      id: r.subject_id,
      title: titles.get(`${r.subject_type}:${r.subject_id ?? ''}`) ?? 'Something that has been removed',
    },
    askerLabel: r.raised_by_agent ?? memberLabel(r.raised_by_user ? labels.get(r.raised_by_user) : undefined),
    agent: r.raised_by_agent,
    note: r.note ?? '',
    createdAt: r.created_at,
  }))
}

/** Published SOPs the caller owns that have a review date. Due-ness is decided by deriveInbox. */
export async function listMyReviewRows(): Promise<OwnedReview[] | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation' }
  if (!role || !INBOX_ROLES.includes(role)) return []

  const { data, error } = await supabase
    .from('sops')
    .select('id, title, review_due_at')
    .eq('organisation_id', organisationId)
    .eq('owner_user_id', userId)
    .eq('status', 'published')
    .not('review_due_at', 'is', null)
  if (error) {
    console.error('[listMyReviewRows]', error)
    return { error: error.message }
  }
  return (data ?? []).map((r) => ({
    sopId: r.id,
    title: r.title ?? 'Untitled SOP',
    reviewDueAt: r.review_due_at as string,
  }))
}

/**
 * Phase 64 (D-10): what suspended and departed people were looking after, beyond the SOPs they own
 * (those are unowned rows in the governance queue): departments, approval chains and in-flight
 * approvals that name them, open asks to them, and workers left with no active supervisor. Admin and
 * safety manager only; the session client, so RLS scopes every read to the organisation.
 *
 * ponytail: the pending-approval read repeats one listGovernanceQueue read -- accepted for an
 * admin-only, organisation-sized read.
 */
export async function listHandover(): Promise<HandoverItem[] | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation' }
  if (!role || !HANDOVER_ROLES.includes(role)) return []

  const { data: gone, error: goneErr } = await supabase
    .from('organisation_members')
    .select('user_id, status')
    .eq('organisation_id', organisationId)
    .neq('status', 'active')
  if (goneErr) {
    console.error('[listHandover] members', goneErr)
    return { error: goneErr.message }
  }
  const status = new Map((gone ?? []).map((m) => [m.user_id as string, m.status as MemberStatus]))
  if (status.size === 0) return []
  const ids = [...status.keys()]
  const labels = await userLabels(ids)
  const who = (id: string) => statusSuffix(memberLabel(labels.get(id)), status.get(id))
  const out: HandoverItem[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const fail = (what: string, error: { message: string }) => {
    console.error(`[listHandover] ${what}`, error)
    return { error: error.message }
  }

  const { data: depts, error: deptErr } = await db
    .from('departments')
    .select('id, name, owner_user_id')
    .eq('organisation_id', organisationId)
    .eq('archived', false)
    .in('owner_user_id', ids)
  if (deptErr) return fail('departments', deptErr)
  for (const d of (depts ?? []) as Array<{ id: string; name: string; owner_user_id: string }>) {
    out.push({ type: 'department', key: `handover-dept-${d.id}`, title: d.name, personLabel: who(d.owner_user_id), departmentId: d.id })
  }

  const { data: chains, error: chainErr } = await db.from('approval_chains').select('category, steps').eq('organisation_id', organisationId)
  if (chainErr) return fail('chains', chainErr)
  for (const c of (chains ?? []) as Array<{ category: string; steps: ChainStep[] }>) {
    c.steps.forEach((st, i) => {
      if (!st.userId || !status.has(st.userId)) return
      out.push({
        type: 'chain_step',
        key: `handover-chain-${c.category}-${i}`,
        title: categoryLabel(c.category) ?? c.category,
        personLabel: who(st.userId),
        category: c.category,
        stepIndex: i,
      })
    })
  }

  const { data: pending, error: pendErr } = await supabase
    .from('sops')
    .select('id, title, version, approval_snapshot')
    .eq('organisation_id', organisationId)
    .eq('approval_state', 'pending')
  if (pendErr) return fail('pending approvals', pendErr)
  const stuck = (pending ?? []).filter((s) => ((s.approval_snapshot as unknown as ChainStep[]) ?? []).some((st) => st.userId && status.has(st.userId)))
  if (stuck.length > 0) {
    const { data: done, error: doneErr } = await db
      .from('sop_approvals')
      .select('sop_id, version, step_index')
      .in('sop_id', stuck.map((s) => s.id))
      .eq('action', 'approved')
    if (doneErr) return fail('approvals', doneErr)
    for (const s of stuck) {
      const steps = (s.approval_snapshot as unknown as ChainStep[]) ?? []
      const approved = new Set(
        ((done ?? []) as Array<{ sop_id: string; version: number; step_index: number }>)
          .filter((a) => a.sop_id === s.id && a.version === s.version)
          .map((a) => a.step_index),
      )
      const next = resolveNextStepIndex(steps.length, approved)
      const holder = next === -1 ? undefined : steps[next].userId
      if (holder && status.has(holder)) {
        out.push({ type: 'approval_step', key: `handover-step-${s.id}`, title: s.title ?? 'Untitled SOP', personLabel: who(holder), sopId: s.id, stepIndex: next })
      }
    }
  }

  const { data: asks, error: askErr } = await supabase
    .from('requests')
    .select('id, subject_id, target_user_id')
    .eq('organisation_id', organisationId)
    .eq('kind', 'do_sop')
    .eq('state', 'accepted')
    .in('target_user_id', ids)
  if (askErr) return fail('asks', askErr)
  if ((asks ?? []).length > 0) {
    const titles = await aboutTitles(organisationId, (asks ?? []).map((a) => ({ type: 'sop' as const, id: a.subject_id })))
    for (const a of asks ?? []) {
      out.push({
        type: 'ask',
        key: `handover-ask-${a.id}`,
        title: titles.get(`sop:${a.subject_id}`) ?? 'a SOP',
        personLabel: who(a.target_user_id as string),
        requestId: a.id,
        sopId: a.subject_id as string,
      })
    }
  }

  const { data: links, error: linkErr } = await supabase
    .from('supervisor_assignments')
    .select('supervisor_id, worker_id')
    .eq('organisation_id', organisationId)
    .in('supervisor_id', ids)
  if (linkErr) return fail('supervision', linkErr)
  const workerIds = [...new Set((links ?? []).map((l) => l.worker_id as string))]
  if (workerIds.length > 0) {
    const { data: all, error: allErr } = await supabase
      .from('supervisor_assignments')
      .select('supervisor_id, worker_id')
      .eq('organisation_id', organisationId)
      .in('worker_id', workerIds)
    if (allErr) return fail('supervision', allErr)
    const involved = [...new Set([...workerIds, ...(all ?? []).map((l) => l.supervisor_id as string)])]
    const { data: people, error: peopleErr } = await supabase
      .from('organisation_members')
      .select('user_id, status')
      .eq('organisation_id', organisationId)
      .in('user_id', involved)
    if (peopleErr) return fail('members', peopleErr)
    const live = new Set((people ?? []).filter((p) => p.status === 'active').map((p) => p.user_id as string))
    const workerLabels = await userLabels(workerIds.filter((w) => live.has(w)))
    for (const w of workerIds) {
      const sups = (all ?? []).filter((l) => l.worker_id === w).map((l) => l.supervisor_id as string)
      if (!live.has(w) || sups.some((s) => live.has(s))) continue
      out.push({
        type: 'supervision',
        key: `handover-sup-${w}`,
        title: memberLabel(workerLabels.get(w)),
        personLabel: who(sups.find((s) => status.has(s)) ?? sups[0]),
        workerId: w,
      })
    }
  }
  return out
}

export async function loadInbox(): Promise<LoadedInbox | { error: string }> {
  const [gov, library, floor, signOffs, ownedReviews, requests, handover] = await Promise.all([
    listGovernanceQueue(),
    listAdminSopRows({}),
    listSiteHealthForOrg(),
    listPendingSignOffs(),
    listMyReviewRows(),
    listOpenRequests(),
    listHandover(),
  ])
  if ('error' in gov) return { error: gov.error }
  if ('error' in library) return { error: library.error }
  if ('error' in signOffs) return { error: signOffs.error }
  if ('error' in ownedReviews) return { error: ownedReviews.error }
  if ('error' in requests) return { error: requests.error }
  if ('error' in handover) return { error: handover.error }

  const items = deriveInbox({
    governance: gov.rows,
    library: library.sops,
    signOffs,
    ownedReviews,
    handover,
  })
  return { governance: gov.rows, library: library.sops, floor, items, requests }
}
