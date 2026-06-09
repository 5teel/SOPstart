'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { UatFeedbackRow } from '@/lib/uat/tests'

// ---------------------------------------------------------------------------
// Auth + org helper — org id comes from JWT custom claims (same pattern as
// completions.ts). RLS on uat_feedback (00034) is the real gate; we also set
// the columns explicitly so inserts satisfy the with-check policy.
// ---------------------------------------------------------------------------
type OrgUserCtx =
  | { ok: false; error: string }
  | {
      ok: true
      supabase: Awaited<ReturnType<typeof createClient>>
      user: { id: string; email?: string }
      organisationId: string
    }

async function requireOrgUser(): Promise<OrgUserCtx> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) return { ok: false, error: 'Not authenticated' }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const claims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = claims['organisation_id'] ?? null
  if (!organisationId) return { ok: false, error: 'No organisation found' }

  return { ok: true, supabase, user: { id: user.id, email: user.email }, organisationId }
}

// ---------------------------------------------------------------------------
// listOrgFeedback — every feedback row for the caller's org (RLS-scoped).
// Used by the /uat page to pre-fill the current user's responses and show
// aggregate team input per test.
// ---------------------------------------------------------------------------
export async function listOrgFeedback(): Promise<UatFeedbackRow[]> {
  const ctx = await requireOrgUser()
  if (!ctx.ok) return []
  // uat_feedback isn't in the generated Database type — cast the client (same
  // approach as other not-yet-generated tables in this codebase).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any
  const { data, error } = await sb
    .from('uat_feedback')
    .select(
      'id, test_id, user_id, user_email, criteria_responses, preferred_direction, overall_verdict, rating, notes, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[listOrgFeedback] error', error)
    return []
  }
  return (data ?? []) as UatFeedbackRow[]
}

// ---------------------------------------------------------------------------
// saveFeedback — upsert the caller's response for one test.
// ---------------------------------------------------------------------------
const SaveSchema = z.object({
  testId: z.string().min(1).max(120),
  criteriaResponses: z.record(z.string(), z.enum(['pass', 'fail', 'na'])),
  preferredDirection: z.string().max(120).nullable(),
  overallVerdict: z.enum(['approve', 'needs_work', 'reject']).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(5_000).nullable(),
})

export async function saveFeedback(
  rawInput: unknown
): Promise<{ success: true; row: UatFeedbackRow } | { success: false; error: string }> {
  const parsed = SaveSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const ctx = await requireOrgUser()
  if (!ctx.ok) return { success: false, error: ctx.error }
  const { user, organisationId } = ctx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = ctx.supabase as any

  const row = {
    organisation_id: organisationId,
    test_id: parsed.data.testId,
    user_id: user.id,
    user_email: user.email ?? null,
    criteria_responses: parsed.data.criteriaResponses,
    preferred_direction: parsed.data.preferredDirection,
    overall_verdict: parsed.data.overallVerdict,
    rating: parsed.data.rating,
    notes: parsed.data.notes,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await sb
    .from('uat_feedback')
    .upsert(row, { onConflict: 'organisation_id,test_id,user_id' })
    .select(
      'id, test_id, user_id, user_email, criteria_responses, preferred_direction, overall_verdict, rating, notes, created_at, updated_at'
    )
    .single()

  if (error) {
    console.error('[saveFeedback] error', error)
    return { success: false, error: 'Failed to save feedback.' }
  }
  return { success: true, row: data as UatFeedbackRow }
}
