import 'server-only'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildDecisionRow, type DecisionInput } from '@/lib/decisions/shape'

/**
 * Phase 56 / DEC-01 -- the ONE ledger writer.
 *
 * Callers pass what was decided and about what; never the organisation or the
 * person. Both come from getSessionContext() here (T-56-02).
 *
 * Why service role: the decisions table has no authenticated INSERT policy by
 * design (56-03) -- an own-actor policy would still let any org member put a
 * decision the system never made into the audit trail. Agent rows and roles
 * whose own RLS cannot insert share this single path.
 *
 * Why fail-soft: the primary write has already happened when this runs (A-08).
 * A ledger failure is logged with a distinct tag and never breaks the action;
 * scripts/reconcile-decisions.mjs (56-08) lists the gaps.
 */
export async function recordDecision(
  input: DecisionInput,
  opts: { coalesceMinutes?: number } = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const s = await getSessionContext()
    const built = buildDecisionRow(
      { userId: s.userId, userEmail: s.userEmail, organisationId: s.organisationId },
      input,
    )
    if (!built.ok) {
      console.error('[recordDecision] FAILED', input.kind, built.error)
      return built
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    // Autosaved edits (ADR-0008): one row per person, kind and subject per window, not one per keystroke.
    if (opts.coalesceMinutes) {
      const since = new Date(Date.now() - opts.coalesceMinutes * 60_000).toISOString()
      const { data: recent } = await admin
        .from('decisions')
        .select('id')
        .eq('organisation_id', built.row.organisation_id)
        .eq('actor_id', built.row.actor_id)
        .eq('kind', built.row.kind)
        .eq('subject_id', built.row.subject_id)
        .gte('created_at', since)
        .limit(1)
        .maybeSingle()
      if (recent) return { ok: true, id: recent.id as string }
    }
    const { data, error } = await admin.from('decisions').insert(built.row).select('id').single()
    if (error || !data) {
      console.error('[recordDecision] FAILED', input.kind, error)
      return { ok: false, error: error?.message ?? 'Insert returned no row' }
    }
    return { ok: true, id: data.id as string }
  } catch (err) {
    console.error('[recordDecision] FAILED', input.kind, err)
    return { ok: false, error: err instanceof Error ? err.message : 'recordDecision threw' }
  }
}
