'use server'

/**
 * Phase 15 / Wave 4 — Sub-trade tag assignment server actions.
 *
 * Surface (consumed by SubTradePicker on /admin/team and
 * /admin/sops/[sopId]/assign):
 *   - listSubTrades()              — returns the 5-row controlled vocab
 *   - getUserSubTrades(userId)     — selected sub_trade_ids for a worker
 *   - getSopSubTrades(sopId)       — selected sub_trade_ids for an SOP
 *   - assignUserSubTrades(userId, subTradeIds[]) — replace-semantics write
 *   - assignSopSubTrades(sopId,  subTradeIds[])  — replace-semantics write
 *
 * Auth model: write paths gate on `requireAdmin()` (admin | safety_manager
 * via JWT user_role claim). Reads use the RLS-respecting server client —
 * the `users_sub_trades_self_read` policy from migration 00030 allows the
 * logged-in user to see their own tags, and admins to see same-org users'
 * tags. Junction-row writes are policy-gated to admin/safety_manager as
 * well, so the requireAdmin() check is defence-in-depth.
 *
 * RLS NOTE: this action deliberately does NOT use createAdminClient. The
 * RLS policies in migration 00030 are the source of truth for who can read
 * and write the junction tables — using the admin client would bypass
 * org-scoping and let an admin from org A theoretically tag a worker from
 * org B. The RLS policies join through organisation_members.organisation_id
 * which is the correct enforcement point.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdminContext } from '@/lib/auth/guards'
import {
  assignUserSubTradesSchema,
  assignSopSubTradesSchema,
} from '@/lib/validators/sub-trades'
import type { SubTrade } from '@/types/sop'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  return requireAdminContext()
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Lists the controlled sub-trade vocabulary, ordered by sort_order. Seed
 * rows (migration 00030): operator, fitter, sparky, maintainer, other.
 */
export async function listSubTrades(): Promise<SubTrade[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sub_trades')
    .select('id, slug, label, sort_order')
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as SubTrade[]
}

/**
 * Returns the sub_trade_ids currently assigned to a worker. RLS limits
 * visibility to self + same-org admin/safety_manager.
 */
export async function getUserSubTrades(userId: string): Promise<string[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('users_sub_trades')
    .select('sub_trade_id')
    .eq('user_id', userId)
  return ((data ?? []) as { sub_trade_id: string }[]).map(r => r.sub_trade_id)
}

/**
 * Returns the sub_trade_ids currently tagged on a SOP. Empty array means
 * the SOP is visible to ALL workers regardless of sub-trade (backward
 * compat per D-11).
 */
export async function getSopSubTrades(sopId: string): Promise<string[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('sops_sub_trades')
    .select('sub_trade_id')
    .eq('sop_id', sopId)
  return ((data ?? []) as { sub_trade_id: string }[]).map(r => r.sub_trade_id)
}

// ---------------------------------------------------------------------------
// Writes — replace-semantics, admin-gated
// ---------------------------------------------------------------------------

/**
 * Replace-semantics: deletes all existing users_sub_trades rows for this
 * user, then inserts the new set. Empty subTradeIds clears the user's
 * tags entirely.
 *
 * Race note (T-15-04-03 accept): two admins assigning simultaneously can
 * wipe each other's writes. Admin team is 1-3 people typical; race is
 * rare. ETag/version-vector tracking is Phase 15b territory if it bites.
 */
export async function assignUserSubTrades(
  userId: string,
  subTradeIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const parsed = assignUserSubTradesSchema.safeParse({ userId, subTradeIds })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (ctx.supabase as any)
    .from('users_sub_trades')
    .delete()
    .eq('user_id', userId)
  if (delErr) return { error: delErr.message }

  if (parsed.data.subTradeIds.length === 0) return { ok: true }

  const rows = parsed.data.subTradeIds.map(stId => ({
    user_id: userId,
    sub_trade_id: stId,
    assigned_by: ctx.user.id,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (ctx.supabase as any)
    .from('users_sub_trades')
    .insert(rows)
  if (insErr) return { error: insErr.message }

  return { ok: true }
}

/**
 * Replace-semantics for SOP-level tagging. Empty subTradeIds clears the
 * SOP's tags — restoring the backward-compat "visible to all workers"
 * behaviour per D-11.
 */
export async function assignSopSubTrades(
  sopId: string,
  subTradeIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const parsed = assignSopSubTradesSchema.safeParse({ sopId, subTradeIds })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (ctx.supabase as any)
    .from('sops_sub_trades')
    .delete()
    .eq('sop_id', sopId)
  if (delErr) return { error: delErr.message }

  if (parsed.data.subTradeIds.length === 0) return { ok: true }

  const rows = parsed.data.subTradeIds.map(stId => ({
    sop_id: sopId,
    sub_trade_id: stId,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insErr } = await (ctx.supabase as any)
    .from('sops_sub_trades')
    .insert(rows)
  if (insErr) return { error: insErr.message }

  return { ok: true }
}
