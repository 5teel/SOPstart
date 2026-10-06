'use server'

/**
 * Phase 59 (D-03, A-02, A-04): the Office's server reads. One parameterless
 * read per role -- org, user and role come from the session only. Privileged
 * (service-role) reads live in plain modules under src/lib, so this file
 * never imports the service-role client (CLAUDE.md 2026-10-04). Async
 * exports only.
 */
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import {
  assessorFor,
  orderedReviewSteps,
  signCompletionPhotos,
  type ReviewPhotoRow,
  type ReviewStepKind,
  type SignedReviewPhoto,
} from '@/lib/completions/review'
import { CLEARED_KINDS, KIND_GROUPS, PAGE_SIZE, cursorFilter, type DecisionGroupKey } from '@/lib/decisions/read'
import type { DecisionKind } from '@/lib/decisions/shape'
import { nzStartOfDayIso } from '@/lib/office/format'
import { deriveInbox, type InboxItem } from '@/lib/governance/inbox'
import { listMyReviewRows, listOpenRequests, listPendingSignOffs, loadInbox } from '@/lib/governance/load-inbox'
import { memberLabel, userLabels } from '@/lib/members/labels'
import type { OfficeRequest } from '@/lib/requests/model'

export type OfficeInbox = { role: 'admin' | 'safety_manager' | 'supervisor'; items: InboxItem[]; requests: OfficeRequest[] }

export async function getOfficeInbox(): Promise<OfficeInbox | { error: string }> {
  const { userId, role } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }

  if (role === 'admin' || role === 'safety_manager') {
    const inbox = await loadInbox()
    if ('error' in inbox) return { error: inbox.error }
    return { role, items: inbox.items, requests: inbox.requests }
  }

  if (role === 'supervisor') {
    // A-02: a supervisor has no approval or owner rows -- sign-offs and own reviews only; D-03: they answer requests.
    const [signOffs, ownedReviews, requests] = await Promise.all([
      listPendingSignOffs(),
      listMyReviewRows(),
      listOpenRequests(),
    ])
    if ('error' in signOffs) return { error: signOffs.error }
    if ('error' in ownedReviews) return { error: ownedReviews.error }
    if ('error' in requests) return { error: requests.error }
    return {
      role,
      items: deriveInbox({ governance: [], library: [], signOffs, ownedReviews }),
      requests,
    }
  }

  return { error: 'Office access required' }
}

export type ReviewStep = {
  id: string
  stepNumber: number
  text: string
  kind: ReviewStepKind
  sectionTitle: string | null
  /** 'acknowledged' is a hazard or PPE step the worker confirmed. */
  state: 'done' | 'acknowledged' | 'not_done'
  doneAt: string | null
  photoIds: string[]
}

export type CompletionReview = {
  completionId: string
  sopId: string
  sopTitle: string
  sopVersion: number
  status: string
  submittedAt: string
  workerLabel: string
  steps: ReviewStep[]
  photos: SignedReviewPhoto[]
  /** Server-computed so the panel never decides it; signOffCompletion stays the authority (A-08). */
  isAssessor: boolean
  canOverride: boolean
  decided: { decision: string; reason: string | null; at: string } | null
}

const completionIdSchema = z.string().uuid()

/**
 * The completion review read behind a sign-off row (59 A-09, F-05). Session client first:
 * RLS lets a supervisor see only assigned workers and an admin the org, and only the photo
 * rows that come back are signed. Org, role and actor come from the session; the only
 * client input is a UUID.
 */
export async function getCompletionForReview(completionId: string): Promise<CompletionReview | { error: string }> {
  if (!completionIdSchema.safeParse(completionId).success) return { error: 'Completion not found' }

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }
  if (role !== 'supervisor' && role !== 'safety_manager' && role !== 'admin') return { error: 'Office access required' }

  const { data, error } = await supabase
    .from('sop_completions')
    .select(
      'id, sop_id, worker_id, sop_version, status, submitted_at, step_data, sops ( title, version ), completion_photos ( id, step_id, storage_path, content_type ), completion_sign_offs ( decision, reason, created_at )',
    )
    .eq('id', completionId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (error || !data) return { error: 'Completion not found' }

  type Row = {
    id: string
    sop_id: string
    worker_id: string
    sop_version: number
    status: string
    submitted_at: string
    step_data: Record<string, unknown> | null
    sops: { title: string | null; version: number } | { title: string | null; version: number }[] | null
    completion_photos: ReviewPhotoRow[] | null
    completion_sign_offs: { decision: string; reason: string | null; created_at: string }[] | null
  }
  const row = data as unknown as Row
  if (row.worker_id === userId) return { error: 'You cannot sign off your own walk' }

  const sop = Array.isArray(row.sops) ? (row.sops[0] ?? null) : row.sops
  const stepData = row.step_data ?? {}

  const [photos, ordered, isAssessor, labels] = await Promise.all([
    signCompletionPhotos(row.completion_photos ?? [], organisationId),
    orderedReviewSteps(supabase, { sopId: row.sop_id, organisationId, stepData }),
    assessorFor(userId, row.sop_id, organisationId),
    userLabels([row.worker_id]),
  ])

  const steps: ReviewStep[] = ordered.map((st) => {
    const at = stepData[st.id]
    const done = Object.prototype.hasOwnProperty.call(stepData, st.id)
    const ms = typeof at === 'number' && Number.isFinite(at) ? new Date(at) : null
    return {
      id: st.id,
      stepNumber: st.step_number,
      text: st.text,
      kind: st.kind,
      sectionTitle: st.sectionTitle,
      state: !done ? 'not_done' : st.kind === 'hazard' || st.kind === 'ppe' ? 'acknowledged' : 'done',
      doneAt: ms && !Number.isNaN(ms.getTime()) ? ms.toISOString() : null,
      photoIds: photos.filter((p) => p.step_id === st.id).map((p) => p.id),
    }
  })

  const signOff = row.completion_sign_offs?.[0] ?? null
  return {
    completionId: row.id,
    sopId: row.sop_id,
    sopTitle: sop?.title ?? 'Untitled SOP',
    sopVersion: sop?.version ?? row.sop_version,
    status: row.status,
    submittedAt: row.submitted_at,
    workerLabel: memberLabel(labels.get(row.worker_id)),
    steps,
    photos,
    isAssessor,
    canOverride: role === 'admin' || role === 'safety_manager',
    decided: signOff ? { decision: signOff.decision, reason: signOff.reason, at: signOff.created_at } : null,
  }
}

// ---- Decisions tab (DEC-02, D-09, A-04) ---------------------------------------------------------

const GROUP_KEYS = ['all', ...Object.keys(KIND_GROUPS)] as [DecisionGroupKey, ...DecisionGroupKey[]]

const listDecisionsSchema = z
  .object({
    group: z.enum(GROUP_KEYS),
    cursor: z.object({ createdAt: z.string().datetime({ offset: true }), id: z.string().uuid() }).strict().optional(),
  })
  .strict()

export type DecisionAbout = { type: 'sop'; sopId: string; title: string } | { type: 'text'; text: string }
export type DecisionListRow = {
  id: string
  /** ISO time of the decision. */
  when: string
  who: { name: string; agent: boolean }
  kind: DecisionKind
  about: DecisionAbout
}
export type DecisionPage = {
  rows: DecisionListRow[]
  hasOlder: boolean
  /** Where the next page starts; the database's own timestamp text, so paging never loses precision. */
  nextCursor: { createdAt: string; id: string } | null
}

type LedgerRow = {
  id: string
  kind: DecisionKind
  actor_kind: 'person' | 'agent'
  actor_name: string | null
  subject_kind: string
  subject_id: string | null
  sop_id: string | null
  summary: string
  details: Record<string, unknown> | null
  created_at: string
}

/** Admin and safety manager only (A-04); the session client then reads under admins_can_read_decisions. */
async function ledgerReader() {
  const ctx = await getSessionContext()
  if (!ctx.userId) return { supabase: null, error: 'Not authenticated' }
  if (!ctx.organisationId) return { supabase: null, error: 'No organisation found' }
  if (ctx.role !== 'admin' && ctx.role !== 'safety_manager') return { supabase: null, error: 'Admin access required' }
  return { supabase: ctx.supabase, error: null }
}

export async function listDecisions(input: unknown): Promise<DecisionPage | { error: string }> {
  const parsed = listDecisionsSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid request' }
  const { group, cursor } = parsed.data

  const reader = await ledgerReader()
  if (!reader.supabase) return { error: reader.error }
  const { supabase } = reader

  let q = supabase
    .from('decisions')
    .select('id, kind, actor_kind, actor_id, actor_name, subject_kind, subject_id, sop_id, summary, details, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (group !== 'all') q = q.in('kind', [...KIND_GROUPS[group]])
  if (cursor) q = q.or(cursorFilter(cursor))
  const { data, error } = await q
  if (error) return { error: "Couldn't load the decision ledger" }

  const fetched = (data ?? []) as unknown as LedgerRow[]
  const hasOlder = fetched.length > PAGE_SIZE
  const page = fetched.slice(0, PAGE_SIZE)

  const completionIds = [...new Set(page.filter((r) => r.subject_kind === 'completion' && r.subject_id).map((r) => r.subject_id as string))]
  const completions = new Map<string, { worker_id: string; sop_id: string }>()
  if (completionIds.length > 0) {
    const { data: cs } = await supabase.from('sop_completions').select('id, worker_id, sop_id').in('id', completionIds)
    for (const c of cs ?? []) completions.set(c.id, { worker_id: c.worker_id, sop_id: c.sop_id })
  }

  const sopIds = new Set<string>()
  for (const r of page) if (r.subject_kind === 'sop' && r.subject_id) sopIds.add(r.subject_id)
  for (const c of completions.values()) sopIds.add(c.sop_id)
  const titles = new Map<string, string>()
  if (sopIds.size > 0) {
    const { data: sops } = await supabase.from('sops').select('id, title').in('id', [...sopIds])
    for (const s of sops ?? []) titles.set(s.id, s.title ?? 'Untitled SOP')
  }

  const personIds = new Set<string>()
  for (const r of page) if ((r.subject_kind === 'member' || r.subject_kind === 'worker') && r.subject_id) personIds.add(r.subject_id)
  for (const c of completions.values()) personIds.add(c.worker_id)
  for (const r of page) {
    const asker = r.subject_kind === 'request' ? r.details?.asker_user_id : null
    if (typeof asker === 'string') personIds.add(asker)
  }
  const labels = await userLabels([...personIds])

  const rows: DecisionListRow[] = page.map((r) => {
    let about: DecisionAbout = { type: 'text', text: r.summary }
    if (r.subject_kind === 'sop' && r.subject_id && titles.has(r.subject_id)) {
      about = { type: 'sop', sopId: r.subject_id, title: titles.get(r.subject_id) as string }
    } else if (r.subject_kind === 'completion' && r.subject_id && completions.has(r.subject_id)) {
      const c = completions.get(r.subject_id) as { worker_id: string; sop_id: string }
      about = { type: 'text', text: `${memberLabel(labels.get(c.worker_id))}'s walk of ${titles.get(c.sop_id) ?? 'a SOP'}` }
    } else if ((r.subject_kind === 'member' || r.subject_kind === 'worker') && r.subject_id) {
      about = { type: 'text', text: memberLabel(labels.get(r.subject_id)) }
    } else if (r.subject_kind === 'request') {
      // "<asker>'s request about <SOP or machine>"; a ledger row with no details keeps its summary.
      const d = r.details ?? {}
      const asker = typeof d.asker_user_id === 'string' ? memberLabel(labels.get(d.asker_user_id)) : typeof d.asker_agent === 'string' ? d.asker_agent : null
      if (asker && typeof d.about_title === 'string') about = { type: 'text', text: `${asker}'s request about ${d.about_title}` }
    }
    return {
      id: r.id,
      when: r.created_at,
      who: { name: r.actor_name ?? (r.actor_kind === 'agent' ? 'An agent' : 'Someone'), agent: r.actor_kind === 'agent' },
      kind: r.kind,
      about,
    }
  })

  const last = hasOlder ? page[page.length - 1] : null
  return { rows, hasOlder, nextCursor: last ? { createdAt: last.created_at, id: last.id } : null }
}

/** How many things people cleared today (NZ time) -- the line on the empty inbox (D-05). */
export async function countClearedToday(): Promise<{ count: number } | { error: string }> {
  const reader = await ledgerReader()
  if (!reader.supabase) return { error: reader.error }
  const { count, error } = await reader.supabase
    .from('decisions')
    .select('id', { count: 'exact', head: true })
    .in('kind', [...CLEARED_KINDS])
    .eq('actor_kind', 'person')
    .gte('created_at', nzStartOfDayIso())
  if (error) return { error: "Couldn't count today's decisions" }
  return { count: count ?? 0 }
}
