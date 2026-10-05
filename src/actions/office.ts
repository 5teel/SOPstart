'use server'

/**
 * Phase 59 (D-03, A-02, A-04): the Office's server reads. One parameterless
 * read per role -- org, user and role come from the session only. Privileged
 * (service-role) reads live in plain modules under src/lib, so this file
 * never imports the service-role client (CLAUDE.md 2026-10-04). Async
 * exports only.
 */
import { getSessionContext } from '@/lib/auth/session-context'
import { deriveInbox, type InboxItem } from '@/lib/governance/inbox'
import { listMyReviewRows, listPendingSignOffs, loadInbox } from '@/lib/governance/load-inbox'

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
