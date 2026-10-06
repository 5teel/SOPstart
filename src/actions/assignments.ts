'use server'

import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppRole } from '@/types/auth'
import { userLabels } from '@/lib/members/labels'

// ─── Helpers ────────────────────────────────────────────────────────────────

type AdminContext =
  | { error: string }
  | { supabase: SupabaseClient; user: { id: string }; organisationId: string }

async function getAdminContext(): Promise<AdminContext> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }

  if (!organisationId) return { error: 'No organisation found' }

  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'You need admin access to manage assignments.' }
  }

  return { supabase: supabase as SupabaseClient, user: { id: userId }, organisationId }
}

// ─── Actions ────────────────────────────────────────────────────────────────

export async function getOrgMembers(): Promise<
  { success: true; members: OrgMemberWithProfile[] } | { success: false; error: string }
> {
  const ctx = await getAdminContext()
  if ('error' in ctx) return { success: false, error: ctx.error }
  const { supabase, organisationId } = ctx

  // organisation_members stores user_id + role; names and emails come from the
  // auth users via userLabels, for the member ids read below only (A-07).
  const { data, error } = await supabase
    .from('organisation_members')
    .select('user_id, role')
    .eq('organisation_id', organisationId)
    .order('role', { ascending: true })

  if (error) {
    console.error('getOrgMembers error:', error)
    return { success: false, error: 'Failed to load org members.' }
  }

  const labels = await userLabels((data ?? []).map(m => m.user_id))
  return {
    success: true,
    members: (data ?? []).map(m => ({
      user_id: m.user_id,
      role: m.role as AppRole,
      full_name: labels.get(m.user_id)?.fullName ?? null,
      email: labels.get(m.user_id)?.email ?? null,
    })),
  }
}

// ─── Worker Self-Assignment ─────────────────────────────────────────────────

async function getWorkerContext() {
  // getSessionContext already resolves role + organisation_id from
  // organisation_members — no separate member query needed.
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' } as const

  if (!organisationId) return { error: 'No organisation membership' } as const

  return { supabase, user: { id: userId }, organisationId, role: role as AppRole | null }
}

/**
 * Self-add a published SOP to "Your SOPs".
 * Uses admin client because workers can't INSERT via RLS.
 */
export async function selfAddSop(sopId: string) {
  const ctx = await getWorkerContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const admin = createAdminClient()
  const { error } = await admin.from('sop_assignments').insert({
    organisation_id: ctx.organisationId,
    sop_id: sopId,
    assignment_type: 'individual',
    user_id: ctx.user.id,
    assigned_by: ctx.user.id,
  })

  if (error) {
    if (error.code === '23505') return { success: true } // already assigned
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * Remove a self-added SOP (where assigned_by = current user).
 */
export async function selfRemoveSop(sopId: string) {
  const ctx = await getWorkerContext()
  if ('error' in ctx) return { success: false, error: ctx.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('sop_assignments')
    .delete()
    .eq('sop_id', sopId)
    .eq('user_id', ctx.user.id)
    .eq('assigned_by', ctx.user.id)
    .eq('assignment_type', 'individual')

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Get all SOP assignments for the current user (self + ask + role-based).
 */
export async function getUserSopAssignments() {
  const ctx = await getWorkerContext()
  if ('error' in ctx) return []

  const { data: individual } = await ctx.supabase
    .from('sop_assignments')
    .select('id, sop_id, assigned_by, assignment_type')
    .eq('user_id', ctx.user.id)
    .eq('assignment_type', 'individual')

  let roleAssignments: typeof individual = []
  if (ctx.role) {
    const { data } = await ctx.supabase
      .from('sop_assignments')
      .select('id, sop_id, assigned_by, assignment_type')
      .eq('role', ctx.role)
      .eq('assignment_type', 'role')
    roleAssignments = data ?? []
  }

  return [...(individual ?? []), ...(roleAssignments ?? [])].map((a) => ({
    ...a,
    isSelfAssigned: a.assignment_type === 'individual' && a.assigned_by === ctx.user.id,
  }))
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
