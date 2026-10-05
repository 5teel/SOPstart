/**
 * Phase 57 (D-16), widened in Phase 59 (D-05, A-11): the ONE inbox read. The
 * Office pane, its Inbox count and the Office pin all count `items.length`
 * from it, so the numbers cannot disagree. Completions waiting for sign-off
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
import { deriveInbox, type InboxItem, type OwnedReview, type PendingSignOff } from '@/lib/governance/inbox'
import { memberLabel, userLabels } from '@/lib/members/labels'
import type { MillerSop } from '@/lib/sop-list/admin-rows'
import type { AdminSiteFloor } from '@/lib/validators/site'

export interface LoadedInbox {
  governance: GovernanceRow[]
  library: MillerSop[]
  floor: AdminSiteFloor | { error: string }
  items: InboxItem[]
}

const INBOX_ROLES = ['supervisor', 'safety_manager', 'admin']

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
  const labels = await userLabels(rows.map((r) => r.worker_id))
  return rows.map((r) => ({
    completionId: r.id,
    sopId: r.sop_id,
    sopTitle: r.sops?.title ?? 'Untitled SOP',
    sopVersion: r.sop_version,
    workerId: r.worker_id,
    workerLabel: memberLabel(labels.get(r.worker_id)),
    submittedAt: r.submitted_at,
    photoCount: r.completion_photos?.length ?? 0,
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

export async function loadInbox(): Promise<LoadedInbox | { error: string }> {
  const [gov, library, floor, signOffs, ownedReviews] = await Promise.all([
    listGovernanceQueue(),
    listAdminSopRows({}),
    listSiteHealthForOrg(),
    listPendingSignOffs(),
    listMyReviewRows(),
  ])
  if ('error' in gov) return { error: gov.error }
  if ('error' in library) return { error: library.error }
  if ('error' in signOffs) return { error: signOffs.error }
  if ('error' in ownedReviews) return { error: ownedReviews.error }

  const floorOk = !('error' in floor)
  const items = deriveInbox({
    governance: gov.rows,
    library: library.sops,
    machines: floorOk ? floor.machines : [],
    links: floorOk ? floor.links : [],
    signOffs,
    ownedReviews,
  })
  return { governance: gov.rows, library: library.sops, floor, items }
}
