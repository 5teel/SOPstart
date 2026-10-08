'use server'

/**
 * Phase 63 (HOME-04, T-63-22): the drafts behind Manage SOPs. Admin-gated, ZERO parameters
 * (org and role come from the session), session client only. A plain read: it deliberately
 * does not run the machine-request reconcile or the review-due write that getAdminShell does
 * (ADR-0002 -- those belong to the event that causes them, not to opening a list).
 */
import { requireAdminContext } from '@/lib/auth/guards'
import { loadInbox } from '@/lib/governance/load-inbox'

export interface ManageDraft {
  id: string
  title: string
  status: string
  stuck: boolean
  /** null when the row is flagged unowned (the flag already says so). */
  ownerLabel: string | null
  reviewDueAt: string | null
}

export async function listManageDrafts(): Promise<{ drafts: ManageDraft[] } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }

  const inbox = await loadInbox()
  if ('error' in inbox) return { error: inbox.error }

  const govById = new Map(inbox.governance.map((g) => [g.id, g]))
  return {
    drafts: inbox.library
      .filter((s) => s.status !== 'published')
      .map((s) => {
        const gov = govById.get(s.id)
        return {
          id: s.id,
          title: s.displayTitle,
          status: s.status,
          stuck: s.stuck,
          ownerLabel: gov?.flags.includes('unowned') ? null : (gov?.ownerLabel ?? s.ownerLabel),
          reviewDueAt: gov?.reviewDueAt ?? null,
        }
      }),
  }
}
