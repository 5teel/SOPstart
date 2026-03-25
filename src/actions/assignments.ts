'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRole } from '@/types/auth'
import type { User } from '@supabase/supabase-js'

// ─── Schemas ────────────────────────────────────────────────────────────────

const APP_ROLES = ['worker', 'supervisor', 'admin', 'safety_manager'] as const
const roleSchema = z.enum(APP_ROLES)

// ─── Helpers ────────────────────────────────────────────────────────────────

type AdminContext =
  | { error: string }
  | { supabase: SupabaseClient; user: User; organisationId: string }

async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated' }

  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}

  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) return { error: 'No organisation found' }

  const role: string = jwtClaims['user_role'] ?? ''
  if (!['admin', 'safety_manager'].includes(role)) {
    return { error: 'You need admin access to manage assignments.' }
  }

  return { supabase: supabase as SupabaseClient, user, organisationId }
}

// ─── Actions ────────────────────────────────────────────────────────────────

export async function assignSopToRole(
  sopId: string,
  role: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const parsed = roleSchema.safeParse(role)
  if (!parsed.success) {
    return { success: false, error: 'Invalid role value' }
  }

  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, user, organisationId } = ctx

  const { data, error } = await supabase
    .from('sop_assignments')
    .insert({
      organisation_id: organisationId,
      sop_id: sopId,
      assignment_type: 'role',
      role: parsed.data as AppRole,
      assigned_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    // Unique constraint violation — already assigned
    if (error.code === '23505') {
      return { success: false, error: 'This role is already assigned to this SOP.' }
    }
    console.error('assignSopToRole error:', error)
    return { success: false, error: 'Failed to assign role. Please try again.' }
  }

  return { success: true, id: data.id }
}

export async function assignSopToUser(
  sopId: string,
  userId: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  if (!userId || typeof userId !== 'string') {
    return { success: false, error: 'Invalid user ID' }
  }

  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, user, organisationId } = ctx

  const { data, error } = await supabase
    .from('sop_assignments')
    .insert({
      organisation_id: organisationId,
      sop_id: sopId,
      assignment_type: 'individual',
      user_id: userId,
      assigned_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'This worker is already individually assigned to this SOP.' }
    }
    console.error('assignSopToUser error:', error)
    return { success: false, error: 'Failed to assign worker. Please try again.' }
  }

  return { success: true, id: data.id }
}

export async function removeAssignment(
  assignmentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!assignmentId || typeof assignmentId !== 'string') {
    return { success: false, error: 'Invalid assignment ID' }
  }

  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase } = ctx

  const { error } = await supabase
    .from('sop_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) {
    console.error('removeAssignment error:', error)
    return { success: false, error: 'Failed to remove assignment. Please try again.' }
  }

  return { success: true }
}

export async function getAssignments(
  sopId: string
): Promise<{ success: true; assignments: SopAssignment[] } | { success: false; error: string }> {
  if (!sopId) return { success: false, error: 'Invalid SOP ID' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('sop_assignments')
    .select('id, sop_id, assignment_type, role, user_id, assigned_by, created_at, organisation_id')
    .eq('sop_id', sopId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getAssignments error:', error)
    return { success: false, error: 'Failed to load assignments.' }
  }

  return { success: true, assignments: (data ?? []) as SopAssignment[] }
}

export async function getOrgMembers(): Promise<
  { success: true; members: OrgMemberWithProfile[] } | { success: false; error: string }
> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, organisationId } = ctx

  // organisation_members stores user_id + role; no user_profiles table in schema
  // We use the user_id as the display key; full_name not available without a profiles table
  const { data, error } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('organisation_id', organisationId)
    .order('role', { ascending: true })

  if (error) {
    console.error('getOrgMembers error:', error)
    return { success: false, error: 'Failed to load org members.' }
  }

  return {
    success: true,
    members: (data ?? []).map(m => ({
      user_id: m.user_id,
      role: m.role as AppRole,
      full_name: null,
      email: null,
    })),
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SopAssignment {
  id: string
  sop_id: string
  organisation_id: string
  assignment_type: 'role' | 'individual'
  role: AppRole | null
  user_id: string | null
  assigned_by: string
  created_at: string
}

export interface OrgMemberWithProfile {
  user_id: string
  role: AppRole
  full_name: string | null
  email: string | null
}
