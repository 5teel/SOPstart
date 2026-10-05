'use server'

/**
 * Phase 58 (58-04, D-02, D-17) -- clearing one AI finding.
 *
 * sop_ai_findings has no authenticated write policy (00071), so the clear is a
 * service-role write that scopes itself: the finding is fetched by id AND the
 * session organisation, the update repeats that filter, and the SOP for the
 * ledger row comes from the finding, never from the client. Admin and safety
 * manager only. Ticking a step never clears its findings (D-17).
 *
 * Async exports only (CLAUDE.md 2026-06-27).
 */
import { z } from 'zod'
import { requireAdminContext } from '@/lib/auth/guards'
import { recordDecision } from '@/lib/decisions/record'
import { createAdminClient } from '@/lib/supabase/admin'

export async function clearFinding(input: { findingId: string }): Promise<{ ok: true } | { error: string }> {
  const parsed = z.object({ findingId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const { findingId } = parsed.data

  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation found' }

  const admin = createAdminClient()
  const { data: finding } = await admin
    .from('sop_ai_findings')
    .select('id, sop_id, step_id, job')
    .eq('id', findingId)
    .eq('organisation_id', ctx.organisationId)
    .is('cleared_at', null)
    .maybeSingle()
  if (!finding) return { error: 'Finding not found.' }
  const row = finding as { id: string; sop_id: string; step_id: string | null; job: string }

  const { data, error } = await admin
    .from('sop_ai_findings')
    .update({ cleared_by: ctx.user.id, cleared_at: new Date().toISOString() })
    .eq('id', findingId)
    .eq('organisation_id', ctx.organisationId)
    .is('cleared_at', null)
    .select('id')
  if (error) {
    console.error('[clearFinding] update error', error)
    return { error: error.message }
  }
  if (!data || data.length === 0) return { error: 'Finding not found.' }

  await recordDecision({
    kind: 'ai_finding_cleared',
    subject: { kind: 'ai_finding', id: findingId },
    sopId: row.sop_id,
    summary: 'Cleared an AI finding',
    details: { job: row.job, step_id: row.step_id },
  })
  return { ok: true }
}
