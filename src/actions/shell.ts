'use server'

/**
 * Phase 57 (D-12, D-13, D-16, D-20): the admin read behind the one screen.
 * Admin-gated, ZERO parameters (org and role come from the session only),
 * session client only -- no service-role client. The Office count is
 * `items.length` from the same loadInbox() the Office pane reads, so it now
 * includes sign-offs waiting and the caller's own due reviews (Phase 59).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdminContext } from '@/lib/auth/guards'
import { loadInbox } from '@/lib/governance/load-inbox'
import { inboxCounts, type InboxChip } from '@/lib/governance/inbox'
import { ensureReviewDueNotifications } from '@/lib/notifications/ensure-review-due'
import { officePinCount } from '@/lib/requests/model'
import type { GovernanceRow } from '@/actions/governance'
import type { AdminSiteFloor } from '@/lib/validators/site'

export interface AdminShellData {
  floor: AdminSiteFloor
  /** Set when the site read failed: the floor above is empty, not "not drawn yet". */
  floorError: string | null
  governance: GovernanceRow[]
  inboxCount: number
  inboxChips: Record<'all' | InboxChip, number>
  drafts: Array<{
    id: string
    title: string
    status: string
    stuck: boolean
    /** null when the row is flagged unowned (the flag already says so). */
    ownerLabel: string | null
    reviewDueAt: string | null
  }>
  siteSopIds: string[]
}

export async function getAdminShell(): Promise<AdminShellData | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  // ADR-0002: due reviews are written when the owner loads the screen, so the bell
  // and the overview show them on this same load. Never throws.
  const reviewDue = ensureReviewDueNotifications(ctx.organisationId, ctx.user.id)
  const inbox = await loadInbox()
  await reviewDue
  if ('error' in inbox) return { error: inbox.error }

  const db = ctx.supabase as unknown as SupabaseClient
  const { data: siteRows, error: siteErr } = await db
    .from('sops')
    .select('id')
    .eq('organisation_id', ctx.organisationId)
    .eq('placement', 'site')
  if (siteErr) {
    console.error('[getAdminShell] placement read', siteErr)
    return { error: siteErr.message }
  }

  const floorError = 'error' in inbox.floor ? inbox.floor.error : null
  const floor: AdminSiteFloor =
    'error' in inbox.floor ? { layout: null, machines: [], links: [], departments: [] } : inbox.floor

  const govById = new Map(inbox.governance.map((g) => [g.id, g]))
  return {
    floor,
    floorError,
    governance: inbox.governance,
    inboxCount: officePinCount(inbox.items, inbox.requests),
    inboxChips: inboxCounts(inbox.items),
    // D-13: the Workshop list is every non-published SOP in the org.
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
    siteSopIds: ((siteRows ?? []) as Array<{ id: string }>).map((r) => r.id),
  }
}
