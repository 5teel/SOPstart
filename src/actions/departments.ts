'use server'

/**
 * Phase 25: Department as a First-Class Entity — server actions.
 *
 * Exports:
 *  - listDepartments()          — DepartmentWithCounts[] for the caller's org
 *  - createDepartment()         — insert with org_id from JWT
 *  - updateDepartment()         — name/code/colour/icon/owner
 *  - archiveDepartment()        — flag-only, never DELETE (REQ-6)
 *  - setDepartmentOwner()       — must verify userId ∈ organisation_members (D-03, T-25-03)
 *  - assignMemberDepartments()  — replace-semantics junction write (REQ-4)
 *  - assignBlockDepartments()   — replace-semantics + all_departments flag (D-04)
 *  - assignSopDepartments()     — replace-semantics + all_departments flag (D-04)
 *
 * All functions return a discriminated union { data } | { error } — never throw.
 * requireAdmin() reads role + organisation_id from JWT claims, never from client input (T-25-03).
 *
 * NOTE: The new tables (departments, block_departments, sop_departments, member_departments)
 * are not yet in the auto-generated database.types.ts, so we use `(supabase as any)` for
 * queries against those tables, exactly as blocks.ts does for block_suggestions.
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Department, DepartmentWithCounts } from '@/types/sop'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AdminCtx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  user: { id: string }
  role: string
  organisationId: string | null
}

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jwtClaims: Record<string, any> = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string = jwtClaims['user_role'] ?? ''
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { supabase: supabase as any, user: { id: user.id }, role, organisationId }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * Allowed department colours (V5 — z.enum prevents CSS injection).
 * Exactly the 8 hex values from 25-UI-SPEC.md colour table.
 */
const DEPT_COLOURS = [
  '#f97316', // orange  — slot 1
  '#3b82f6', // blue    — slot 2
  '#06b6d4', // cyan    — slot 3
  '#10b981', // green   — slot 4
  '#ec4899', // pink    — slot 5
  '#ef4444', // red     — slot 6
  '#fbbf24', // amber   — slot 7
  '#8b5cf6', // violet  — slot 8
] as const

const CreateDepartmentInput = z.object({
  name:        z.string().min(1).max(100),
  code:        z.string().min(1).max(6).transform(v => v.toUpperCase()),
  colour:      z.enum(DEPT_COLOURS),
  icon:        z.string().max(4).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
})

const UpdateDepartmentInput = z.object({
  id:          z.string().uuid(),
  name:        z.string().min(1).max(100).optional(),
  code:        z.string().min(1).max(6).transform(v => v.toUpperCase()).optional(),
  colour:      z.enum(DEPT_COLOURS).optional(),
  icon:        z.string().max(4).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
})

// ---------------------------------------------------------------------------
// 1. listDepartments
// ---------------------------------------------------------------------------

export async function listDepartments(): Promise<DepartmentWithCounts[]> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return []
  if (!ctx.organisationId) return []

  const { supabase, organisationId } = ctx

  const { data: depts, error } = await supabase
    .from('departments')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name', { ascending: true })

  if (error || !depts) {
    console.error('[listDepartments] error', error)
    return []
  }

  // Compute counts via separate queries (all RLS-scoped to org through junction).
  const deptIds = (depts as Department[]).map(d => d.id)

  if (deptIds.length === 0) {
    return (depts as Department[]).map(d => ({
      ...d,
      people_count: 0,
      sop_count: 0,
      block_count: 0,
    }))
  }

  // People count per department
  const { data: memberRows } = await supabase
    .from('member_departments')
    .select('department_id')
    .in('department_id', deptIds)

  // SOP count per department
  const { data: sopRows } = await supabase
    .from('sop_departments')
    .select('department_id')
    .in('department_id', deptIds)

  // Block count per department
  const { data: blockRows } = await supabase
    .from('block_departments')
    .select('department_id')
    .in('department_id', deptIds)

  // Build count maps
  const peopleCount: Record<string, number> = {}
  const sopCount: Record<string, number> = {}
  const blockCount: Record<string, number> = {}

  for (const r of (memberRows ?? []) as Array<{ department_id: string }>) {
    peopleCount[r.department_id] = (peopleCount[r.department_id] ?? 0) + 1
  }
  for (const r of (sopRows ?? []) as Array<{ department_id: string }>) {
    sopCount[r.department_id] = (sopCount[r.department_id] ?? 0) + 1
  }
  for (const r of (blockRows ?? []) as Array<{ department_id: string }>) {
    blockCount[r.department_id] = (blockCount[r.department_id] ?? 0) + 1
  }

  return (depts as Department[]).map(d => ({
    ...d,
    people_count: peopleCount[d.id] ?? 0,
    sop_count:    sopCount[d.id] ?? 0,
    block_count:  blockCount[d.id] ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// 2. createDepartment
// ---------------------------------------------------------------------------

export async function createDepartment(
  input: z.input<typeof CreateDepartmentInput>
): Promise<{ department: Department } | { error: string }> {
  const parsed = CreateDepartmentInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data, error } = await ctx.supabase
    .from('departments')
    .insert({
      organisation_id: ctx.organisationId,
      name:            parsed.data.name,
      code:            parsed.data.code,
      colour:          parsed.data.colour,
      icon:            parsed.data.icon ?? null,
      owner_user_id:   parsed.data.ownerUserId ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[createDepartment] insert error', error)
    return { error: error?.message ?? 'Failed to create department' }
  }
  return { department: data as unknown as Department }
}

// ---------------------------------------------------------------------------
// 3. updateDepartment
// ---------------------------------------------------------------------------

export async function updateDepartment(
  input: z.input<typeof UpdateDepartmentInput>
): Promise<{ department: Department } | { error: string }> {
  const parsed = UpdateDepartmentInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (parsed.data.name        !== undefined) updates.name          = parsed.data.name
  if (parsed.data.code        !== undefined) updates.code          = parsed.data.code
  if (parsed.data.colour      !== undefined) updates.colour        = parsed.data.colour
  if (parsed.data.icon        !== undefined) updates.icon          = parsed.data.icon
  if (parsed.data.ownerUserId !== undefined) updates.owner_user_id = parsed.data.ownerUserId

  const { data, error } = await ctx.supabase
    .from('departments')
    .update(updates)
    .eq('id', parsed.data.id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[updateDepartment] update error', error)
    return { error: error?.message ?? 'Failed to update department' }
  }
  return { department: data as unknown as Department }
}

// ---------------------------------------------------------------------------
// 4. archiveDepartment — flag only, never DELETE (REQ-6)
// ---------------------------------------------------------------------------

export async function archiveDepartment(
  departmentId: string
): Promise<{ success: true } | { error: string }> {
  if (!departmentId) return { error: 'departmentId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from('departments')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', departmentId)

  if (error) {
    console.error('[archiveDepartment] update error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 5. setDepartmentOwner — D-03, T-25-03
//    owner MUST be a current organisation_members row for the same org
// ---------------------------------------------------------------------------

export async function setDepartmentOwner(
  departmentId: string,
  userId: string | null
): Promise<{ success: true } | { error: string }> {
  if (!departmentId) return { error: 'departmentId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  // D-03 / T-25-03: verify userId is in organisation_members for the SAME org
  // (never trust client-supplied userId to be a member of this org).
  if (userId !== null) {
    const regularSupabase = await createClient()
    const { data: member } = await regularSupabase
      .from('organisation_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organisation_id', ctx.organisationId)
      .maybeSingle()

    if (!member) {
      return { error: 'Owner must be a member of this organisation' }
    }
  }

  const { error } = await ctx.supabase
    .from('departments')
    .update({ owner_user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', departmentId)

  if (error) {
    console.error('[setDepartmentOwner] update error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 6. assignMemberDepartments — replace-semantics (REQ-4)
// ---------------------------------------------------------------------------

export async function assignMemberDepartments(
  memberId: string,
  departmentIds: string[]
): Promise<{ success: true } | { error: string }> {
  if (!memberId) return { error: 'memberId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // Replace semantics: delete existing rows for this member, then insert new ones.
  const { error: delErr } = await ctx.supabase
    .from('member_departments')
    .delete()
    .eq('member_id', memberId)

  if (delErr) {
    console.error('[assignMemberDepartments] delete error', delErr)
    return { error: delErr.message }
  }

  if (departmentIds.length > 0) {
    const rows = departmentIds.map((department_id: string) => ({
      member_id: memberId,
      department_id,
      assigned_by: ctx.user.id,
    }))
    const { error: insErr } = await ctx.supabase
      .from('member_departments')
      .insert(rows)
    if (insErr) {
      console.error('[assignMemberDepartments] insert error', insErr)
      return { error: insErr.message }
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 7. assignBlockDepartments — replace-semantics + all_departments flag (D-04)
// ---------------------------------------------------------------------------

export async function assignBlockDepartments(
  blockId: string,
  departmentIds: string[],
  allDepartments: boolean = false
): Promise<{ success: true } | { error: string }> {
  if (!blockId) return { error: 'blockId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  if (allDepartments) {
    // D-04: all_departments=true → set flag on block, clear junction rows
    const { error: flagErr } = await ctx.supabase
      .from('blocks')
      .update({ all_departments: true })
      .eq('id', blockId)
    if (flagErr) return { error: flagErr.message }

    // Clear junction rows (block is now org-wide — no per-dept tags needed)
    const { error: delErr } = await ctx.supabase
      .from('block_departments')
      .delete()
      .eq('block_id', blockId)
    if (delErr) return { error: delErr.message }
  } else {
    // Clear all_departments flag + replace junction rows
    const { error: flagErr } = await ctx.supabase
      .from('blocks')
      .update({ all_departments: false })
      .eq('id', blockId)
    if (flagErr) return { error: flagErr.message }

    const { error: delErr } = await ctx.supabase
      .from('block_departments')
      .delete()
      .eq('block_id', blockId)
    if (delErr) return { error: delErr.message }

    if (departmentIds.length > 0) {
      const rows = departmentIds.map((department_id: string) => ({ block_id: blockId, department_id }))
      const { error: insErr } = await ctx.supabase
        .from('block_departments')
        .insert(rows)
      if (insErr) return { error: insErr.message }
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 8. assignSopDepartments — replace-semantics + all_departments flag (D-04)
// ---------------------------------------------------------------------------

export async function assignSopDepartments(
  sopId: string,
  departmentIds: string[],
  allDepartments: boolean = false
): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  if (allDepartments) {
    // D-04: all_departments=true → set flag on sop, clear junction rows
    const { error: flagErr } = await ctx.supabase
      .from('sops')
      .update({ all_departments: true })
      .eq('id', sopId)
    if (flagErr) return { error: flagErr.message }

    const { error: delErr } = await ctx.supabase
      .from('sop_departments')
      .delete()
      .eq('sop_id', sopId)
    if (delErr) return { error: delErr.message }
  } else {
    // Clear all_departments flag + replace junction rows
    const { error: flagErr } = await ctx.supabase
      .from('sops')
      .update({ all_departments: false })
      .eq('id', sopId)
    if (flagErr) return { error: flagErr.message }

    const { error: delErr } = await ctx.supabase
      .from('sop_departments')
      .delete()
      .eq('sop_id', sopId)
    if (delErr) return { error: delErr.message }

    if (departmentIds.length > 0) {
      const rows = departmentIds.map((department_id: string) => ({ sop_id: sopId, department_id }))
      const { error: insErr } = await ctx.supabase
        .from('sop_departments')
        .insert(rows)
      if (insErr) return { error: insErr.message }
    }
  }

  return { success: true }
}
