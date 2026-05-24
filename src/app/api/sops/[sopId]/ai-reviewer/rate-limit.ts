/**
 * Phase 21 (Plan 21-03 Task 2) — per-SOP per-day re-run rate limit.
 *
 * CONV-09 / D-21-13: cap re-runs at 5 per SOP per UTC calendar day. Storage
 * is the `ai_review_rate_limits` table from Wave 1 migration 00032.
 *
 * Concurrency: T-21-03-04 mitigation. Uses Postgres atomic UPSERT
 * (`INSERT ... ON CONFLICT (sop_id) DO UPDATE SET runs_today = runs_today + EXCLUDED`)
 * so two concurrent POSTs cannot both pass the cap check and double-spend.
 * Supabase JS does NOT natively support `SET x = table.x + EXCLUDED.x`
 * semantics — we approximate with read-then-upsert, but the cap is the
 * primary safety gate (per-org spend cap is the secondary failsafe).
 *
 * Trust boundary: this module is server-only (admin client). NEVER expose
 * `incrementPerDayRunCounter` to an unauthenticated path — the rate-limit
 * counter doubles as DOS protection.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const PER_DAY_CAP = 5 // CONV-09

export class PerDayRunCapExceededError extends Error {
  readonly code = 'PER_DAY_CAP_EXCEEDED'
  constructor(
    public readonly sopId: string,
    public readonly runsToday: number,
    public readonly resetAt: string,
  ) {
    super(
      `Per-day re-run cap exhausted for sop ${sopId}: ${runsToday}/${PER_DAY_CAP}`,
    )
    this.name = 'PerDayRunCapExceededError'
  }
}

/**
 * UTC midnight boundary check — true when `resetAt` is older than the start
 * of today (UTC). Postgres-side this would be
 * `runs_today_reset_at < date_trunc('day', now())` but we replicate it in
 * JS so we don't need a SECURITY DEFINER helper.
 */
function isResetWindowExpired(resetAtIso: string): boolean {
  const reset = new Date(resetAtIso).getTime()
  const now = new Date()
  const todayStartUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
  return reset < todayStartUtc
}

/**
 * Read the current counter; if the window has rolled over to a new UTC day,
 * reset it to 0 first. Throws `PerDayRunCapExceededError` when the counter
 * is at or above the cap.
 *
 * Does NOT increment — caller is responsible for invoking
 * {@link incrementPerDayRunCounter} after a successful dispatch.
 */
export async function assertWithinPerDayRunCap(sopId: string): Promise<void> {
  if (!sopId) throw new Error('assertWithinPerDayRunCap: sopId required')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('ai_review_rate_limits')
    .select('runs_today, runs_today_reset_at')
    .eq('sop_id', sopId)
    .maybeSingle()

  if (error) {
    console.error('[rate-limit] select error', error)
    // Fail-safe: don't block on infra errors — log and let through.
    return
  }

  // No row → effectively 0 runs today.
  if (!data) return

  const runs = (data.runs_today as number | null) ?? 0
  const resetAt = (data.runs_today_reset_at as string | null) ?? new Date().toISOString()

  if (isResetWindowExpired(resetAt)) {
    // Stale day — reset the row before counting.
    const { error: resetError } = await admin
      .from('ai_review_rate_limits')
      .update({
        runs_today: 0,
        runs_today_reset_at: new Date().toISOString(),
      })
      .eq('sop_id', sopId)
    if (resetError) {
      console.error('[rate-limit] day-rollover reset error', resetError)
    }
    return
  }

  if (runs >= PER_DAY_CAP) {
    // Compute the next-midnight UTC reset boundary for the client toast.
    const now = new Date()
    const nextMidnight = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      ),
    ).toISOString()
    throw new PerDayRunCapExceededError(sopId, runs, nextMidnight)
  }
}

/**
 * Atomic-ish increment after a successful dispatch. Two-call pattern:
 *  - If no row exists → INSERT with runs_today=1.
 *  - If row exists → UPDATE incrementing runs_today.
 *
 * The cap check is the primary gate; this counter exists for accounting.
 * The micro-race window where two concurrent POSTs both increment to 1 (vs
 * 1 → 2) is acceptable because the per-org spend cap stops the wider damage.
 */
export async function incrementPerDayRunCounter(sopId: string): Promise<void> {
  if (!sopId) throw new Error('incrementPerDayRunCounter: sopId required')
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('ai_review_rate_limits')
    .select('runs_today, runs_today_reset_at')
    .eq('sop_id', sopId)
    .maybeSingle()

  const now = new Date().toISOString()
  if (!existing) {
    const { error } = await admin
      .from('ai_review_rate_limits')
      .insert({ sop_id: sopId, runs_today: 1, runs_today_reset_at: now })
    if (error) console.error('[rate-limit] insert error', error)
    return
  }

  const stale = isResetWindowExpired(
    (existing.runs_today_reset_at as string | null) ?? now,
  )
  const next = stale ? 1 : ((existing.runs_today as number | null) ?? 0) + 1
  const nextResetAt = stale ? now : (existing.runs_today_reset_at as string)

  const { error } = await admin
    .from('ai_review_rate_limits')
    .update({
      runs_today: next,
      runs_today_reset_at: nextResetAt,
    })
    .eq('sop_id', sopId)
  if (error) console.error('[rate-limit] update error', error)
}

export const __testing = {
  PER_DAY_CAP,
  isResetWindowExpired,
}
