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
import { deriveInbox, type InboxItem } from '@/lib/governance/inbox'
import { listMyReviewRows, listPendingSignOffs, loadInbox } from '@/lib/governance/load-inbox'
import { memberLabel, userLabels } from '@/lib/members/labels'

export type OfficeInbox = { role: 'admin' | 'safety_manager' | 'supervisor'; items: InboxItem[] }

export async function getOfficeInbox(): Promise<OfficeInbox | { error: string }> {
  const { userId, role } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }

  if (role === 'admin' || role === 'safety_manager') {
    const inbox = await loadInbox()
    if ('error' in inbox) return { error: inbox.error }
    return { role, items: inbox.items }
  }

  if (role === 'supervisor') {
    // A-02: a supervisor has no approval, owner or machine rows -- sign-offs and own reviews only.
    const [signOffs, ownedReviews] = await Promise.all([listPendingSignOffs(), listMyReviewRows()])
    if ('error' in signOffs) return { error: signOffs.error }
    if ('error' in ownedReviews) return { error: ownedReviews.error }
    return {
      role,
      items: deriveInbox({ governance: [], library: [], machines: [], links: [], signOffs, ownedReviews }),
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
