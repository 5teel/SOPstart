'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TablesInsert, TablesUpdate } from '@/types/database.types'
import {
  orgSignUpSchema,
  loginSchema,
  inviteCodeSchema,
  inviteWorkerSchema,
  acceptInviteSchema,
  updateRoleSchema,
} from '@/lib/validators/auth'

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

  // Pitfall 3: Check if user already belongs to an organisation
  const { data: existingMember } = await supabase
    .from('organisation_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMember) {
    return { error: 'You are already a member of an organisation.' }
  }

  // Look up org by invite_code
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id')
    .eq('invite_code', code)
    .maybeSingle()

  if (orgError || !org) {
    return { error: 'Invalid invite code' }
  }

  // Join the organisation as a worker
  const joinInsert: TablesInsert<'organisation_members'> = {
    organisation_id: org.id,
    user_id: user.id,
    role: 'worker',
  }
  const { error: memberError } = await supabase.from('organisation_members').insert(joinInsert)

  if (memberError) {
    console.error('join with code member insert error:', memberError)
    return { error: 'Failed to join organisation. Please try again.' }
  }

  // Refresh JWT to get updated org claims
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
