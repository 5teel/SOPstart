'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseJwtPayload } from '@/lib/supabase/jwt'
import { getSessionContext } from '@/lib/auth/session-context'
import { roleHome } from '@/lib/auth/role-home'
import { safeNextPath } from '@/lib/auth/next-redirect'
import { recordDecision } from '@/lib/decisions/record'
import { deleteOrgMember } from '@/lib/members/remove'
import type { TablesInsert, TablesUpdate } from '@/types/database.types'
import type { AppRole } from '@/types/auth'
import {
  loginSchema,
  inviteCodeSchema,
  inviteWorkerSchema,
  acceptInviteSchema,
  updateRoleSchema,
} from '@/lib/validators/auth'

// ─────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─────────────────────────────────────────────
// loginWithEmail — AUTH-02, AUTH-03
// ─────────────────────────────────────────────
export async function loginWithEmail(
  formData: {
    email: string
    password: string
  },
  next?: string
) {
  const result = loginSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { email, password } = result.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Invalid email or password' }
  }

  // UX-01: land the user directly on their role home (JWT claim, Base64URL-safe parse).
  // Phase 53 PHN-02: prefer a validated ?next= (e.g. a scanned /m/<code> plate)
  // over the role home when present -- re-validated here (defence in depth,
  // T-53-03) since `next` arrives from the client form call.
  const claims = data.session ? parseJwtPayload(data.session.access_token) : {}
  redirect(safeNextPath(next) ?? roleHome(claims['user_role'] as string | undefined))
}

// ─────────────────────────────────────────────
// joinWithInviteCode — D-07, AUTH-02
// Allows a logged-in user to join an org via invite code
// ─────────────────────────────────────────────
export async function joinWithInviteCode(formData: {
  code: string
}) {
  const result = inviteCodeSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { code } = result.data
  const { supabase, userId } = await getSessionContext()

  if (!userId) {
    redirect('/login')
  }

  // Look up org by invite_code
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id, name')
    .eq('invite_code', code)
    .maybeSingle()

  if (orgError || !org) {
    return { error: 'Invalid invite code' }
  }

  // Check if already a member of THIS org
  const admin = createAdminClient()
  const { data: existingMember } = await admin
    .from('organisation_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organisation_id', org.id)
    .maybeSingle()

  if (existingMember) {
    return { error: `You are already a member of ${(org as { name?: string }).name ?? 'this organisation'}.` }
  }

  // Join the organisation as a worker (multi-org allowed)
  const { error: memberError } = await admin.from('organisation_members').insert({
    organisation_id: org.id,
    user_id: userId,
    role: 'worker',
  })

  if (memberError) {
    console.error('join with code member insert error:', memberError)
    return { error: 'Failed to join organisation. Please try again.' }
  }

  // Set this as the active org and refresh JWT
  await supabase.auth.updateUser({
    data: { active_org_id: org.id },
  })
  await supabase.auth.refreshSession()

  // UX-01: join-by-code always creates a worker membership → worker home
  redirect(roleHome('worker'))
}

// ─────────────────────────────────────────────
// inviteWorker — D-05, D-06, AUTH-02; Phase 59 D-11, A-10
// Admin-only. One form: an existing account is added to the site with the
// chosen role; a new address gets the email invite carrying that role.
// ─────────────────────────────────────────────
export async function inviteWorker(formData: {
  email: string
  role?: AppRole
}) {
  const result = inviteWorkerSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { role: newRole } = result.data
  const email = result.data.email.trim().toLowerCase()
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) {
    redirect('/login')
  }
  if (role !== 'admin') return { error: 'Only an admin can invite people.' }
  if (!organisationId) {
    return { error: 'You must be part of an organisation to invite people.' }
  }

  const admin = createAdminClient()

  // ponytail: first 1000 auth users only (same ceiling as getTeamMembersWithEmails); page it if an org outgrows that.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error('invite listUsers error:', listError)
    return { error: 'Failed to send invite. Please try again.' }
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === email)

  let subjectId: string | null = null
  if (existing) {
    const { data: already } = await admin
      .from('organisation_members')
      .select('id')
      .eq('user_id', existing.id)
      .eq('organisation_id', organisationId)
      .maybeSingle()
    if (already) return { error: 'This person is already a member of your organisation.' }

    const { error: addError } = await admin.from('organisation_members').insert({
      organisation_id: organisationId,
      user_id: existing.id,
      role: newRole,
    })
    if (addError) {
      console.error('invite existing member insert error:', addError)
      return { error: 'Failed to add this person. Please try again.' }
    }
    subjectId = existing.id
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        organisation_id: organisationId,
        invited_role: newRole,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/invite/accept`,
    })
    if (inviteError) {
      console.error('invite worker error:', inviteError)
      return { error: inviteError.message ?? 'Failed to send invite. Please try again.' }
    }
    subjectId = invited?.user?.id ?? null
  }

  const rec = await recordDecision({
    kind: 'member_invited',
    subject: { kind: 'member', id: subjectId },
    summary: 'Invited a person',
    details: { role: newRole, existing_account: Boolean(existing) },
  })
  return { success: existing ? 'Added to the site' : 'Invite sent', logged: rec.ok }
}

// ─────────────────────────────────────────────
// acceptInvite — D-06, AUTH-02
// Worker accepts email invite: verifies token, sets password, creates org membership
// ─────────────────────────────────────────────
export async function acceptInvite(formData: {
  password: string
  confirmPassword: string
  token: string
}) {
  const result = acceptInviteSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { password, token } = result.data
  const supabase = await createClient()

  // Exchange the invite token for a session
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'invite',
  })

  if (verifyError || !verifyData.user) {
    return {
      error: 'This invite link is invalid or has expired. Please ask your admin to send a new invite.',
    }
  }

  const user = verifyData.user

  // Read organisation_id and invited_role from user metadata (set by inviteWorker)
  const organisationId: string | null = user.user_metadata?.['organisation_id'] ?? null
  const invitedRole: string = user.user_metadata?.['invited_role'] ?? 'worker'

  if (!organisationId) {
    return { error: 'Invite is missing organisation details. Please ask your admin to send a new invite.' }
  }

  // Insert into organisation_members
  const inviteInsert: TablesInsert<'organisation_members'> = {
    organisation_id: organisationId,
    user_id: user.id,
    role: invitedRole as TablesInsert<'organisation_members'>['role'],
  }
  const { error: memberError } = await supabase.from('organisation_members').insert(inviteInsert)

  if (memberError) {
    console.error('accept invite member insert error:', memberError)
    return { error: 'Failed to complete account setup. Please try again.' }
  }

  // Set the user's password
  const { error: passwordError } = await supabase.auth.updateUser({ password })

  if (passwordError) {
    console.error('accept invite password set error:', passwordError)
    return { error: 'Failed to set password. Please try again.' }
  }

  // Refresh JWT to get updated org claims
  await supabase.auth.refreshSession()

  // UX-01: invited role is in hand → land directly on its home
  redirect(roleHome(invitedRole))
}

// ─────────────────────────────────────────────
// getTeamMembersWithEmails — fetch members + emails via admin client
// ─────────────────────────────────────────────

export interface TeamMember {
  id: string
  user_id: string
  role: AppRole
  email: string | null
  created_at: string | null
  /** Phase 25: department IDs this member is assigned to (from member_departments junction). */
  department_ids: string[]
}

/** Phase 59 (A-10): someone invited to this site who has not accepted yet. */
export interface InvitedPerson {
  user_id: string
  email: string | null
  role: AppRole
  invited_at: string
}

export async function getTeamMembersWithEmails() {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }

  // Fetch members
  const { data: members } = await supabase
    .from('organisation_members')
    .select('id, user_id, role, created_at')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: true })

  if (!members) return { error: 'Failed to load team' }

  // Fetch emails via admin client (RLS blocks auth.users from regular client)
  const admin = createAdminClient()
  const userIds = members.map((m) => m.user_id)
  const memberIds = new Set(userIds)
  const emailMap: Record<string, string> = {}
  const invited: InvitedPerson[] = []

  // Supabase admin API: list users and filter
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of users) {
    if (memberIds.has(u.id) && u.email) {
      emailMap[u.id] = u.email
    }
    // Invited, not yet accepted: this site's metadata, no membership row, never
    // signed in, and an invite stamp. last_sign_in_at alone is not enough (59-01).
    if (
      u.user_metadata?.['organisation_id'] === organisationId &&
      !memberIds.has(u.id) &&
      !u.last_sign_in_at &&
      u.invited_at
    ) {
      invited.push({
        user_id: u.id,
        email: u.email ?? null,
        role: (u.user_metadata?.['invited_role'] as AppRole | undefined) ?? 'worker',
        invited_at: u.invited_at,
      })
    }
  }

  // Phase 25: fetch department_ids per member from member_departments junction.
  const memberUserIds = members.map((m) => m.user_id)
  const deptMap: Record<string, string[]> = {}
  if (memberUserIds.length > 0) {
    // Use admin client since member_departments may not be accessible via regular RLS for all callers.
    const { data: deptRows } = await admin
      .from('member_departments' as Parameters<typeof admin.from>[0])
      .select('member_id, department_id')
      .in('member_id', memberUserIds)

    for (const r of (deptRows ?? []) as Array<{ member_id: string; department_id: string }>) {
      if (!deptMap[r.member_id]) deptMap[r.member_id] = []
      deptMap[r.member_id].push(r.department_id)
    }
  }

  const result: TeamMember[] = members.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role as AppRole,
    email: emailMap[m.user_id] ?? null,
    created_at: m.created_at,
    department_ids: deptMap[m.user_id] ?? [],
  }))

  // The join code is an admin-only secret (regenerateInviteCode is admin-only too).
  let inviteCode: string | null = null
  if (role === 'admin') {
    const { data: org } = await supabase
      .from('organisations')
      .select('invite_code')
      .eq('id', organisationId)
      .maybeSingle()
    inviteCode = (org as { invite_code?: string | null } | null)?.invite_code ?? null
  }

  return { members: result, currentUserId: userId, invited, inviteCode }
}

// ─────────────────────────────────────────────
// removeMember — remove a user from the organisation
// The delete itself is deleteOrgMember: organisation_members has no delete policy.
// ─────────────────────────────────────────────

export async function removeMember(memberId: string) {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  if (!organisationId) return { error: 'No organisation' }
  if (!z.string().uuid().safeParse(memberId).success) return { error: 'Member not found' }

  // Read the target (and its user id) BEFORE the delete, in the session organisation.
  const { data: target } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!target) return { error: 'Member not found' }
  if (target.user_id === userId) return { error: 'You cannot remove yourself' }
  if (target.role === 'admin' && role !== 'admin') {
    return { error: 'Only an admin can remove an admin.' }
  }

  // Prevent removing the last admin
  if (target.role === 'admin') {
    const { count } = await supabase
      .from('organisation_members')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', organisationId)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return { error: 'There has to be at least one admin.' }
    }
  }

  const removed = await deleteOrgMember({ memberId, organisationId })
  if (removed === 0) return { error: 'Failed to remove member' }

  const rec = await recordDecision({
    kind: 'member_removed',
    subject: { kind: 'member', id: target.user_id },
    summary: 'Removed a person',
    details: { role: target.role },
  })
  return { success: true, logged: rec.ok }
}

// ─────────────────────────────────────────────
// regenerateInviteCode — generate new code, old one stops working
// ─────────────────────────────────────────────

export async function regenerateInviteCode() {
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (role !== 'admin') return { error: 'Only admins can regenerate invite codes' }
  if (!organisationId) return { error: 'No organisation' }

  // Generate new 8-char code
  const newCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .slice(0, 8)

  const admin = createAdminClient()
  const { error } = await admin
    .from('organisations')
    .update({ invite_code: newCode })
    .eq('id', organisationId)

  if (error) return { error: 'Failed to regenerate code' }
  return { code: newCode }
}

// ─────────────────────────────────────────────
// updateMemberRoleSafe — admin-only role change (mirrors RLS 00062), last-admin protected
// ─────────────────────────────────────────────

export async function updateMemberRoleSafe(formData: {
  memberId: string
  role: string
}) {
  const result = updateRoleSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { memberId, role: newRole } = result.data
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (role !== 'admin') return { error: 'Only an admin can change roles.' }
  if (!organisationId) return { error: 'No organisation' }

  const { data: target } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!target) return { error: 'Member not found' }

  // Demoting an admin: someone must stay admin.
  if (target.role === 'admin' && newRole !== 'admin') {
    const { count } = await supabase
      .from('organisation_members')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', organisationId)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return { error: 'There has to be at least one admin.' }
    }
  }

  const roleUpdate: TablesUpdate<'organisation_members'> = { role: newRole }
  const { data: updated, error } = await supabase
    .from('organisation_members')
    .update(roleUpdate)
    .eq('id', memberId)
    .eq('organisation_id', organisationId)
    .select('id')

  if (error) {
    return { error: 'Failed to update role' }
  }
  // Zero rows means RLS or the scope filtered the write out: not a success.
  if (!updated || updated.length === 0) {
    return { error: 'Failed to update role' }
  }

  const rec = await recordDecision({
    kind: 'role_change',
    subject: { kind: 'member', id: target.user_id },
    summary: "Changed a person's role",
    details: { from: target.role, to: newRole },
  })
  return { success: 'Role updated', logged: rec.ok }
}
