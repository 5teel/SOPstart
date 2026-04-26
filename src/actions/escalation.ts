'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------
// Shared auth helper — extracts user + org from current session
// ---------------------------------------------------------------
async function authOrg() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const claims = session?.access_token
    ? (JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64url').toString()
      ) as { organisation_id?: string })
    : {}
  if (!claims.organisation_id) return { error: 'Missing organisation_id claim' as const }

  return { supabase, user, orgId: claims.organisation_id }
}

// ---------------------------------------------------------------
// 1. dispatchEscalationAlert — alert mode → inserts into worker_notifications
// ---------------------------------------------------------------
const AlertInput = z.object({
  sopId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  completionId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
  recipients: z.array(z.enum(['supervisor', 'safety_manager', 'admin'])).optional(),
})

export async function dispatchEscalationAlert(input: z.infer<typeof AlertInput>) {
  const parsed = AlertInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const auth = await authOrg()
  if ('error' in auth) return auth
  const { supabase, user, orgId } = auth

  const recipients = parsed.data.recipients ?? ['supervisor']

  // Find org members with the specified roles
  const { data: members } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('organisation_id', orgId)
    .in('role', recipients)

  if (!members || members.length === 0) return { success: true as const, count: 0 }

  const rows = members.map((m) => ({
    user_id: m.user_id,
    organisation_id: orgId,
    kind: 'escalation_alert',
    sop_id: parsed.data.sopId,
    payload: {
      sectionId: parsed.data.sectionId,
      stepId: parsed.data.stepId,
      completionId: parsed.data.completionId,
      reason: parsed.data.reason,
      submittedBy: user.id,
    },
    created_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('worker_notifications').insert(rows)
  if (error) return { error: error.message }
  return { success: true as const, count: rows.length }
}

// ---------------------------------------------------------------
// 2. lockStep — lock mode → inserts escalation_reports row with mode=lock
// ---------------------------------------------------------------
const LockInput = z.object({
  sopId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  completionId: z.string().uuid().optional(),
})

export async function lockStep(input: z.infer<typeof LockInput>) {
  const parsed = LockInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const auth = await authOrg()
  if ('error' in auth) return auth
  const { supabase, user, orgId } = auth

  const id = crypto.randomUUID()
  const { error } = await supabase.from('escalation_reports').insert({
    id,
    organisation_id: orgId,
    sop_id: parsed.data.sopId,
    section_id: parsed.data.sectionId ?? null,
    step_id: parsed.data.stepId ?? null,
    completion_id: parsed.data.completionId ?? null,
    escalation_mode: 'lock',
    status: 'open',
    submitted_by: user.id,
    submitted_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  return { success: true as const, id }
}

// ---------------------------------------------------------------
// 3. submitEscalationReport — form mode → inserts escalation_reports row with mode=form
// ---------------------------------------------------------------
const FormInput = z.object({
  sopId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  completionId: z.string().uuid().optional(),
  reason: z.string().min(1).max(2000),
  photos: z.array(z.string()).optional(), // storage paths
  measurements: z.record(z.string(), z.unknown()).optional(),
})

export async function submitEscalationReport(input: z.infer<typeof FormInput>) {
  const parsed = FormInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const auth = await authOrg()
  if ('error' in auth) return auth
  const { supabase, user, orgId } = auth

  const id = crypto.randomUUID()
  const { error } = await supabase.from('escalation_reports').insert({
    id,
    organisation_id: orgId,
    sop_id: parsed.data.sopId,
    section_id: parsed.data.sectionId ?? null,
    step_id: parsed.data.stepId ?? null,
    completion_id: parsed.data.completionId ?? null,
    escalation_mode: 'form',
    reason: parsed.data.reason,
    photos: parsed.data.photos ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    measurements: (parsed.data.measurements ?? null) as any,
    status: 'open',
    submitted_by: user.id,
    submitted_at: new Date().toISOString(),
  })
  if (error) return { error: error.message }
  return { success: true as const, id }
}
