'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TablesInsert, TablesUpdate } from '@/types/database.types'
import type { AppRole } from '@/types/auth'
import {
  orgSignUpSchema,
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
// signUpOrganisation — AUTH-01, D-01, D-02, D-03
// Creates the org and admin user using service_role
// ─────────────────────────────────────────────
export async function signUpOrganisation(formData: {
  organisationName: string
  email: string
  password: string
  confirmPassword: string
}) {
  const result = orgSignUpSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { organisationName, email, password } = result.data
  const admin = createAdminClient()

  // Create the organisation record
  const { data: org, error: orgError } = await admin
    .from('organisations')
    .insert({ name: organisationName })
    .select()
    .single()

  if (orgError || !org) {
    console.error('org creation error:', orgError)
    return { error: 'Failed to create organisation. Please try again.' }
  }

  // Create the user via service_role (auto-confirms email)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('auth create user error:', authError)
    // Roll back org creation
    await admin.from('organisations').delete().eq('id', org.id)
    return { error: authError?.message ?? 'Failed to create account. Please try again.' }
  }

  // Insert admin into organisation_members
  const adminMemberInsert: TablesInsert<'organisation_members'> = {
    organisation_id: org.id,
    user_id: authData.user.id,
    role: 'admin',
  }
  const { error: memberError } = await admin.from('organisation_members').insert(adminMemberInsert)

  if (memberError) {
    console.error('member insert error:', memberError)
    // Roll back
    await admin.auth.admin.deleteUser(authData.user.id)
    await admin.from('organisations').delete().eq('id', org.id)
    return { error: 'Failed to set up your account. Please try again.' }
  }

  redirect('/login?registered=1')
}

// ─────────────────────────────────────────────
// loginWithEmail — AUTH-02, AUTH-03
// ─────────────────────────────────────────────
export async function loginWithEmail(formData: {
  email: string
  password: string
}) {
  const result = loginSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { email, password } = result.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Invalid email or password' }
  }

  redirect('/dashboard')
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
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
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
    .eq('user_id', user.id)
    .eq('organisation_id', org.id)
    .maybeSingle()

  if (existingMember) {
    return { error: `You are already a member of ${(org as { name?: string }).name ?? 'this organisation'}.` }
  }

  // Join the organisation as a worker (multi-org allowed)
  const { error: memberError } = await admin.from('organisation_members').insert({
    organisation_id: org.id,
    user_id: user.id,
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

  redirect('/dashboard')
}

// ─────────────────────────────────────────────
// inviteWorker — D-05, D-06, AUTH-02
// Admin sends an email invite to a worker
// ─────────────────────────────────────────────
export async function inviteWorker(formData: {
  email: string
}) {
  const result = inviteWorkerSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { email } = result.data
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    redirect('/login')
  }

  // Get the admin's organisation_id from JWT claims
  const { data: { session } } = await supabase.auth.getSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jwtClaims = (session?.access_token ? JSON.parse(atob(session.access_token.split('.')[1])) : {}) as Record<string, any>
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null

  if (!organisationId) {
    return { error: 'You must be part of an organisation to invite workers.' }
  }

  const admin = createAdminClient()

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      organisation_id: organisationId,
      invited_role: 'worker',
    },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/invite/accept`,
  })

  if (inviteError) {
    console.error('invite worker error:', inviteError)
    return { error: inviteError.message ?? 'Failed to send invite. Please try again.' }
  }

  return { success: `Invite sent to ${email}` }
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

  redirect('/dashboard')
}

// ─────────────────────────────────────────────
// updateMemberRole — D-10 through D-15, AUTH-04
// Admin updates a member's role (RLS enforced — only admins can do this per RLS policy)
// ─────────────────────────────────────────────
export async function updateMemberRole(formData: {
  memberId: string
  role: string
}) {
  const result = updateRoleSchema.safeParse(formData)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { memberId, role } = result.data
  const supabase = await createClient()

  const roleUpdate: TablesUpdate<'organisation_members'> = { role }
  const { error } = await supabase
    .from('organisation_members')
    .update(roleUpdate)
    .eq('id', memberId)

  if (error) {
    console.error('update member role error:', error)
    return { error: 'Failed to update role. You may not have permission to do this.' }
  }

  return { success: 'Role updated successfully' }
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
}

export async function getTeamMembersWithEmails() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation' }

  const role: string = jwtClaims['user_role'] ?? ''
  if (!['admin', 'safety_manager'].includes(role)) {
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
  const emailMap: Record<string, string> = {}

  // Supabase admin API: list users and filter
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of users) {
    if (userIds.includes(u.id) && u.email) {
      emailMap[u.id] = u.email
    }
  }

  const result: TeamMember[] = members.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role as AppRole,
    email: emailMap[m.user_id] ?? null,
    created_at: m.created_at,
  }))

  return { members: result, currentUserId: user.id }
}

// ─────────────────────────────────────────────
// removeMember — remove a user from the organisation
// ─────────────────────────────────────────────

export async function removeMember(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string = jwtClaims['user_role'] ?? ''
  if (!['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }

  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation' }

  // Prevent removing yourself
  const { data: target } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('id', memberId)
    .maybeSingle()

  if (!target) return { error: 'Member not found' }
  if (target.user_id === user.id) return { error: 'You cannot remove yourself' }

  // Prevent removing the last admin
  if (target.role === 'admin') {
    const { count } = await supabase
      .from('organisation_members')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', organisationId)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return { error: 'Cannot remove the last admin. Promote another member first.' }
    }
  }

  const { error } = await supabase
    .from('organisation_members')
    .delete()
    .eq('id', memberId)

  if (error) return { error: 'Failed to remove member' }
  return { success: true }
}

// ─────────────────────────────────────────────
// regenerateInviteCode — generate new code, old one stops working
// ─────────────────────────────────────────────

export async function regenerateInviteCode() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string = jwtClaims['user_role'] ?? ''
  if (role !== 'admin') return { error: 'Only admins can regenerate invite codes' }

  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
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
// updateMemberRole with self-demotion protection
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null

  // Check if this is self-demotion from admin
  const { data: target } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('id', memberId)
    .maybeSingle()

  if (!target) return { error: 'Member not found' }

  if (target.user_id === user.id && target.role === 'admin' && newRole !== 'admin') {
    // Check if they're the last admin
    const { count } = await supabase
      .from('organisation_members')
      .select('id', { count: 'exact', head: true })
      .eq('organisation_id', organisationId!)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return { error: 'You are the last admin. Promote another member before changing your role.' }
    }
  }

  const roleUpdate: TablesUpdate<'organisation_members'> = { role: newRole }
  const { error } = await supabase
    .from('organisation_members')
    .update(roleUpdate)
    .eq('id', memberId)

  if (error) {
    return { error: 'Failed to update role' }
  }

  return { success: 'Role updated successfully' }
}

// ─────────────────────────────────────────────
// switchOrganisation — set active org in user_metadata
// ─────────────────────────────────────────────

export async function switchOrganisation(organisationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify user is a member of this org
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('organisation_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (!membership) return { error: 'You are not a member of this organisation' }

  await supabase.auth.updateUser({
    data: { active_org_id: organisationId },
  })
  await supabase.auth.refreshSession()

  return { success: true }
}

// ─────────────────────────────────────────────
// getUserMemberships — all orgs the user belongs to
// ─────────────────────────────────────────────

export interface UserMembership {
  organisationId: string
  orgName: string
  role: AppRole
  joinedAt: string | null
}

export async function getUserMemberships() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { memberships: [] as UserMembership[], activeOrgId: null as string | null }

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('organisation_members')
    .select('organisation_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (!members) return { memberships: [] as UserMembership[], activeOrgId: null as string | null }

  const orgIds = members.map((m) => m.organisation_id)
  const { data: orgs } = await admin
    .from('organisations')
    .select('id, name')
    .in('id', orgIds)

  const orgMap: Record<string, string> = {}
  for (const o of orgs ?? []) {
    orgMap[o.id] = o.name
  }

  const memberships: UserMembership[] = members.map((m) => ({
    organisationId: m.organisation_id,
    orgName: orgMap[m.organisation_id] ?? 'Unknown',
    role: m.role as AppRole,
    joinedAt: m.created_at,
  }))

  const activeOrgId = user.user_metadata?.active_org_id ?? memberships[0]?.organisationId ?? null

  return { memberships, activeOrgId }
}

// ─────────────────────────────────────────────
// addMemberByEmail — admin adds existing user to their org with a role
// ─────────────────────────────────────────────

export async function addMemberByEmail(email: string, role: AppRole) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const currentRole: string = jwtClaims['user_role'] ?? ''
  if (!['admin', 'safety_manager'].includes(currentRole)) {
    return { error: 'Admin access required' }
  }
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation' }

  const admin = createAdminClient()

  // Find user by email
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const targetUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (!targetUser) {
    return { error: 'No account found for this email. Send an invite instead.' }
  }

  // Check if already a member of this org
  const { data: existing } = await admin
    .from('organisation_members')
    .select('id')
    .eq('user_id', targetUser.id)
    .eq('organisation_id', organisationId)
    .maybeSingle()

  if (existing) {
    return { error: 'This person is already a member of your organisation.' }
  }

  const { error } = await admin.from('organisation_members').insert({
    organisation_id: organisationId,
    user_id: targetUser.id,
    role,
  })

  if (error) return { error: 'Failed to add member' }
  return { success: true }
}
