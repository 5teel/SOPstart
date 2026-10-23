'use server'

import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { recordDecision } from '@/lib/decisions/record'
import { changeMemberState } from '@/lib/members/state'
import type { MemberStatus } from '@/types/auth'

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

  // The state the caller saw, so a double click is a clean refusal.
  const changed = await changeMemberState({ memberId, organisationId, actorId: userId, from: [seen], to })
  if (!changed.ok) return { error: "That didn't work. Nothing was changed — try again." }

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
