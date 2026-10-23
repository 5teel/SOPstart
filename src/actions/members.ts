'use server'

import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { recordDecision } from '@/lib/decisions/record'
import { changeMemberState } from '@/lib/members/state'
import { createAdminClient } from '@/lib/supabase/admin'
import { memberLabel, userLabels } from '@/lib/members/labels'
import { hashSigninCode, newSigninCode, normaliseSigninCode, signinCodeExpiry } from '@/lib/members/signin-code'
import { mayIssueSigninCode, resetsSecondSteps } from '@/lib/members/authority'
import { resetMemberFactors } from '@/actions/mfa'
import type { AppRole, MemberStatus } from '@/types/auth'

// Phase 64 (MEMB-02..04, D-03, D-05): suspend, mark as left, reinstate. Admin or safety manager,
// never on yourself, only an admin changes an admin, the last active admin stays. Not exported:
// the three actions below are the only public endpoints.

/** The states each target state may be reached from. Reinstate works from either (D-03). */
const ALLOWED_FROM: Record<MemberStatus, MemberStatus[]> = {
  suspended: ['active'],
  left: ['active', 'suspended'],
  active: ['suspended', 'left'],
}

const KIND = { suspended: 'member_suspended', left: 'member_left', active: 'member_reinstated' } as const
const SUMMARY = { suspended: 'Suspended a person', left: 'Marked a person as left', active: 'Reinstated a person' } as const

type Result = { success: true; logged: boolean; signedOut: boolean } | { error: string }

async function applyMemberState(memberId: string, to: MemberStatus): Promise<Result> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) return { error: 'Admin access required' }
  if (!organisationId) return { error: 'No organisation' }
  if (!z.string().uuid().safeParse(memberId).success) return { error: 'Member not found' }

  const { data: target } = await supabase
    .from('organisation_members')
    .select('user_id, role, status')
    .eq('id', memberId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!target) return { error: 'Member not found' }
  const seen = target.status as MemberStatus
  if (target.user_id === userId) return { error: 'You cannot change your own access.' }
  if (target.role === 'admin' && role !== 'admin') return { error: 'Only an admin can change an admin.' }
  if (!ALLOWED_FROM[to].includes(seen)) return { error: 'That has already changed. Refresh and try again.' }

  if (target.role === 'admin' && seen === 'active' && to !== 'active') {
    const { count } = await supabase
      .from('organisation_members')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', organisationId)
      .eq('role', 'admin')
      .eq('status', 'active')
    if ((count ?? 0) <= 1) return { error: 'There has to be at least one admin.' }
  }

  // The state and role the caller saw: a double click or a role changed meanwhile is a clean
  // refusal. The database keeps the last active admin even when two changes race (00083).
  const changed = await changeMemberState({
    memberId,
    organisationId,
    actorId: userId,
    from: [seen],
    to,
    seenRole: target.role as AppRole,
  })
  if (!changed.ok) {
    return { error: changed.lastAdmin ? 'There has to be at least one admin.' : "That didn't work. Nothing was changed — try again." }
  }

  const rec = await recordDecision({
    kind: KIND[to],
    subject: { kind: 'member', id: target.user_id },
    summary: SUMMARY[to],
    details: { role: target.role, from: seen, to, signed_out: changed.signedOut },
  })
  return { success: true, logged: rec.ok, signedOut: changed.signedOut }
}

export async function suspendMember(memberId: string): Promise<Result> {
  return applyMemberState(memberId, 'suspended')
}

export async function markMemberLeft(memberId: string): Promise<Result> {
  return applyMemberState(memberId, 'left')
}

export async function reinstateMember(memberId: string): Promise<Result> {
  return applyMemberState(memberId, 'active')
}

// ─────────────────────────────────────────────
// Phase 67 / ADR-0029: in-person sign-in codes. D-01 authority from the session (the effective
// role, so an elevated person without aal2 is refused like a worker), the subject read in the
// session organisation with the service role, the code stored only as a hash.
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = () => createAdminClient() as any

const REFUSED = "You can't give this person a sign-in code."
type IssueResult = { code: string; name: string; expiresAt: string; logged: boolean } | { error: string }

export async function issueSigninCode(subjectUserId: string): Promise<IssueResult> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation' }
  if (!z.string().uuid().safeParse(subjectUserId).success) return { error: 'Person not found' }
  const pepper = process.env.RECOVERY_PEPPER
  if (!pepper || pepper.length < 32) return { error: "Sign-in codes aren't available right now." }

  const { data: target } = await svc()
    .from('organisation_members')
    .select('role, status')
    .eq('organisation_id', organisationId)
    .eq('user_id', subjectUserId)
    .eq('status', 'active')
    .maybeSingle()
  if (!target) return { error: REFUSED }
  let supervises = false
  if (role === 'supervisor') {
    const { data: link } = await svc()
      .from('supervisor_assignments')
      .select('id')
      .eq('organisation_id', organisationId)
      .eq('supervisor_id', userId)
      .eq('worker_id', subjectUserId)
      .maybeSingle()
    supervises = !!link
  }
  const allowed = mayIssueSigninCode({
    callerId: userId,
    callerRole: role,
    subjectId: subjectUserId,
    subjectRole: target.role as AppRole,
    subjectStatus: target.status as string,
    supervises,
  })
  if (!allowed) return { error: REFUSED }

  // D-01 row 3: an admin or safety manager also loses their second steps (Phase 66 reset: admin
  // and aal2 only, other admins told), so the code gets them back in to set up again.
  if (resetsSecondSteps(target.role as AppRole)) {
    const reset = await resetMemberFactors(subjectUserId)
    if ('error' in reset) return { error: reset.error }
  }

  const code = newSigninCode()
  const expiresAt = signinCodeExpiry().toISOString()
  // A new code voids this person's unused one in this organisation.
  const voided = await svc()
    .from('signin_codes')
    .update({ expires_at: new Date().toISOString() })
    .eq('organisation_id', organisationId)
    .eq('user_id', subjectUserId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
  if (voided.error) return { error: "Couldn't make a code. Try again." }
  const ins = await svc()
    .from('signin_codes')
    .insert({
      organisation_id: organisationId,
      user_id: subjectUserId,
      code_hash: hashSigninCode(normaliseSigninCode(code)!, pepper),
      issued_by: userId,
      expires_at: expiresAt,
    })
    .select('id')
    .single()
  if (ins.error || !ins.data) return { error: "Couldn't make a code. Try again." }

  const rec = await recordDecision({
    kind: 'signin_code_issued',
    subject: { kind: 'person', id: subjectUserId },
    summary: 'Gave a person a sign-in code',
    details: { code_id: ins.data.id, role: target.role, expires_at: expiresAt },
  })
  const name = memberLabel((await userLabels([subjectUserId])).get(subjectUserId))
  return { code, name, expiresAt, logged: rec.ok }
}

/** A supervisor's own active workers, for "Give a sign-in code" in their Sign-offs section. */
export async function listSigninCodeWorkers(): Promise<{ workers: { userId: string; name: string }[] } | { error: string }> {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId || !organisationId) return { error: 'Not authenticated' }
  if (role !== 'supervisor') return { workers: [] }
  const { data: links } = await svc()
    .from('supervisor_assignments')
    .select('worker_id')
    .eq('organisation_id', organisationId)
    .eq('supervisor_id', userId)
  const ids = ((links ?? []) as { worker_id: string }[]).map((l) => l.worker_id)
  if (ids.length === 0) return { workers: [] }
  const { data: active } = await svc()
    .from('organisation_members')
    .select('user_id')
    .eq('organisation_id', organisationId)
    .eq('role', 'worker')
    .eq('status', 'active')
    .in('user_id', ids)
  const activeIds = ((active ?? []) as { user_id: string }[]).map((m) => m.user_id)
  const labels = await userLabels(activeIds)
  return {
    workers: activeIds
      .map((id) => ({ userId: id, name: memberLabel(labels.get(id)) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
