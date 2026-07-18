'use server'

/**
 * Phase 32: Visual Org Model & Library Permissions — org-model server actions.
 *
 * Exports:
 *  - listOrgTree()          — caller's org as areas -> departments -> roles -> people (D-04/D-05)
 *  - createArea/updateArea/archiveArea    — org-scoped area entity (D-04)
 *  - createRole/updateRole/archiveRole    — dept-scoped job role entity (D-05)
 *  - assignRoleMembers()    — replace-semantics role_members junction write (D-05/D-07)
 *  - setDepartmentArea()    — assign/clear a department's area_id (D-04)
 *
 * All functions return a discriminated union { data } | { error } — never throw.
 * requireAdminContext() reads role + organisation_id from the verified JWT/session,
 * never from client input (mirrors src/actions/departments.ts verbatim, [2026-07-13]).
 *
 * areas/roles carry authenticated admin write RLS policies (mirrors the Phase 25
 * departments shape) so their CRUD writes use the regular session client
 * (ctx.supabase). role_members has NO authenticated write policy (00046 §6) so
 * assignRoleMembers uses createAdminClient() and self-enforces org scope on every
 * write (CLAUDE.md 2026-06-15). Neither table is in database.types.ts yet, so we
 * use `(supabase as any)` casts, exactly as departments.ts does.
 *
 * D-07: role_members sits alongside member_departments — this file never reads
 * or writes member_departments, and never writes organisation_members.role
 * (job role != org privilege role, Pitfall 2 / T-32-04-02).
 */

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
import type { Area, DeptRole, OrgPerson, OrgTree, OrgTreeArea, OrgTreeDepartment, OrgTreeRole } from '@/types/org-model'

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
  return requireAdminContext()
}

/**
 * Authoritative organisation for the caller — read from their live
 * organisation_members row, NOT the parsed JWT claim (mirrors departments.ts
 * callerOrgId, [2026-06-26] class of staleness).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callerOrgId(admin: any, ctx: AdminCtx): Promise<string | null> {
  const { data } = await admin
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', ctx.user.id)
    .maybeSingle()
  return (data?.organisation_id as string | undefined) ?? ctx.organisationId
}

/** Returns the subset of `ids` that are real rows of `table` in `organisationId` (generalized departments.ts orgScopedDeptIds). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function orgScopedIds(admin: any, table: string, organisationId: string, ids: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return []
  const { data } = await admin
    .from(table)
    .select('id')
    .eq('organisation_id', organisationId)
    .in('id', ids)
  return ((data ?? []) as Array<{ id: string }>).map(r => r.id)
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/** Same controlled colour vocab as departments.ts DEPT_COLOURS (V5 — z.enum, never a free string). */
const AREA_COLOURS = [
  '#f97316', '#3b82f6', '#06b6d4', '#10b981',
  '#ec4899', '#ef4444', '#fbbf24', '#8b5cf6',
] as const

const CreateAreaInput = z.object({
  name:   z.string().min(1).max(100),
  colour: z.enum(AREA_COLOURS),
  sort:   z.number().int().min(0).optional(),
})

const UpdateAreaInput = z.object({
  id:     z.string().uuid(),
  name:   z.string().min(1).max(100).optional(),
  colour: z.enum(AREA_COLOURS).optional(),
  sort:   z.number().int().min(0).optional(),
})

const CreateRoleInput = z.object({
  departmentId:   z.string().uuid(),
  name:           z.string().min(1).max(100),
  budgetedCount:  z.number().int().min(0),
  sort:           z.number().int().min(0).optional(),
})

const UpdateRoleInput = z.object({
  id:             z.string().uuid(),
  name:           z.string().min(1).max(100).optional(),
  budgetedCount:  z.number().int().min(0).optional(),
  sort:           z.number().int().min(0).optional(),
})

// ---------------------------------------------------------------------------
// 1. listOrgTree — assembles the caller's org into an OrgTree
// ---------------------------------------------------------------------------

export async function listOrgTree(): Promise<OrgTree | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { supabase, organisationId } = ctx

  // Independent reads in parallel ([2026-07-13] — no serial waterfall).
  const [{ data: areasData, error: areasErr }, { data: deptsData, error: deptsErr }] = await Promise.all([
    supabase.from('areas').select('*').eq('organisation_id', organisationId).order('sort', { ascending: true }),
    supabase.from('departments').select('*').eq('organisation_id', organisationId).eq('archived', false).order('name', { ascending: true }),
  ])
  if (areasErr) { console.error('[listOrgTree] areas error', areasErr); return { error: areasErr.message } }
  if (deptsErr) { console.error('[listOrgTree] departments error', deptsErr); return { error: deptsErr.message } }

  const depts = (deptsData ?? []) as Array<{ id: string; area_id: string | null; name: string; colour: string; icon: string | null }>
  const deptIds = depts.map(d => d.id)

  const { data: rolesData, error: rolesErr } = deptIds.length > 0
    ? await supabase.from('roles').select('*').in('department_id', deptIds).order('sort', { ascending: true })
    : { data: [], error: null }
  if (rolesErr) { console.error('[listOrgTree] roles error', rolesErr); return { error: rolesErr.message } }

  const roles = (rolesData ?? []) as Array<{ id: string; organisation_id: string; department_id: string; name: string; budgeted_count: number }>
  const roleIds = roles.map(r => r.id)

  const { data: membersData, error: membersErr } = roleIds.length > 0
    ? await supabase.from('role_members').select('role_id, member_id').in('role_id', roleIds)
    : { data: [], error: null }
  if (membersErr) { console.error('[listOrgTree] role_members error', membersErr); return { error: membersErr.message } }

  const memberRows = (membersData ?? []) as Array<{ role_id: string; member_id: string }>

  // Resolve filled member display names via the admin auth API (no profiles table — mirrors departments.ts owner resolution).
  const memberIds = Array.from(new Set(memberRows.map(m => m.member_id)))
  const memberNames: Record<string, string> = {}
  if (memberIds.length > 0) {
    const admin = createAdminClient()
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of users) {
      if (memberIds.includes(u.id) && u.email) memberNames[u.id] = u.email
    }
  }

  const roleMembersByRole: Record<string, string[]> = {}
  for (const m of memberRows) {
    ;(roleMembersByRole[m.role_id] ??= []).push(m.member_id)
  }

  const rolesByDept: Record<string, OrgTreeRole[]> = {}
  for (const r of roles) {
    const filledIds = roleMembersByRole[r.id] ?? []
    const people: OrgPerson[] = filledIds.map(id => ({ id, name: memberNames[id] ?? id, isVacancy: false }))
    // D-05: vacancies = budgetedCount - filledCount, rendered as first-class dashed chips.
    const vacancyCount = Math.max(0, r.budgeted_count - filledIds.length)
    for (let i = 0; i < vacancyCount; i++) {
      people.push({ id: null, name: r.name, isVacancy: true })
    }
    const role: OrgTreeRole = {
      id: r.id,
      organisationId: r.organisation_id,
      departmentId: r.department_id,
      name: r.name,
      budgetedCount: r.budgeted_count,
      filledCount: filledIds.length,
      people,
    }
    ;(rolesByDept[r.department_id] ??= []).push(role)
  }

  const deptsByArea: Record<string, OrgTreeDepartment[]> = {}
  const ungroupedDepartments: OrgTreeDepartment[] = []
  for (const d of depts) {
    const deptTree: OrgTreeDepartment = {
      id: d.id,
      areaId: d.area_id ?? null,
      name: d.name,
      colour: d.colour,
      icon: d.icon ?? null,
      roles: rolesByDept[d.id] ?? [],
    }
    if (deptTree.areaId) {
      ;(deptsByArea[deptTree.areaId] ??= []).push(deptTree)
    } else {
      ungroupedDepartments.push(deptTree)
    }
  }

  const areas: OrgTreeArea[] = ((areasData ?? []) as Array<{ id: string; organisation_id: string; name: string; colour: string; sort: number }>)
    .map(a => ({
      id: a.id,
      organisationId: a.organisation_id,
      name: a.name,
      colour: a.colour,
      sort: a.sort,
      departments: deptsByArea[a.id] ?? [],
    }))

  return { organisationId, areas, ungroupedDepartments }
}

// ---------------------------------------------------------------------------
// 2. createArea / updateArea / archiveArea (D-04)
// areas carries authenticated admin write RLS policies (00046 §2) — write with
// the regular session client, same idiom as departments.ts createDepartment.
// ---------------------------------------------------------------------------

export async function createArea(
  input: z.input<typeof CreateAreaInput>
): Promise<{ area: Area } | { error: string }> {
  const parsed = CreateAreaInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data, error } = await ctx.supabase
    .from('areas')
    .insert({
      organisation_id: ctx.organisationId,
      name:             parsed.data.name,
      colour:           parsed.data.colour,
      sort:             parsed.data.sort ?? 0,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[createArea] insert error', error)
    return { error: error?.message ?? 'Failed to create area' }
  }
  return { area: { id: data.id, organisationId: data.organisation_id, name: data.name, colour: data.colour, sort: data.sort } }
}

export async function updateArea(
  input: z.input<typeof UpdateAreaInput>
): Promise<{ area: Area } | { error: string }> {
  const parsed = UpdateAreaInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (parsed.data.name   !== undefined) updates.name   = parsed.data.name
  if (parsed.data.colour !== undefined) updates.colour = parsed.data.colour
  if (parsed.data.sort   !== undefined) updates.sort   = parsed.data.sort

  const { data, error } = await ctx.supabase
    .from('areas')
    .update(updates)
    .eq('id', parsed.data.id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[updateArea] update error', error)
    return { error: error?.message ?? 'Failed to update area' }
  }
  return { area: { id: data.id, organisationId: data.organisation_id, name: data.name, colour: data.colour, sort: data.sort } }
}

/**
 * areas has no soft-delete column (unlike departments' REQ-6 `archived` flag) —
 * the 00046 admin_delete RLS policy is the intended removal path. departments.area_id
 * is ON DELETE SET NULL, so removing an area just ungroups its departments.
 */
export async function archiveArea(
  areaId: string
): Promise<{ success: true } | { error: string }> {
  if (!areaId) return { error: 'areaId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from('areas')
    .delete()
    .eq('id', areaId)

  if (error) {
    console.error('[archiveArea] delete error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 3. createRole / updateRole / archiveRole (D-05)
// roles carries authenticated admin write RLS policies (00046 §3) — write with
// the regular session client. departmentId is verified in the caller org
// BEFORE insert since organisation_id/department_id are independent FKs and
// RLS alone won't catch an org-mismatched department_id.
// ---------------------------------------------------------------------------

export async function createRole(
  input: z.input<typeof CreateRoleInput>
): Promise<{ role: DeptRole } | { error: string }> {
  const parsed = CreateRoleInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data: deptRow } = await ctx.supabase
    .from('departments')
    .select('id')
    .eq('id', parsed.data.departmentId)
    .eq('organisation_id', ctx.organisationId)
    .maybeSingle()
  if (!deptRow) return { error: 'Department not found in this organisation' }

  const { data, error } = await ctx.supabase
    .from('roles')
    .insert({
      organisation_id: ctx.organisationId,
      department_id:   parsed.data.departmentId,
      name:            parsed.data.name,
      budgeted_count:  parsed.data.budgetedCount,
      sort:            parsed.data.sort ?? 0,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[createRole] insert error', error)
    return { error: error?.message ?? 'Failed to create role' }
  }
  return {
    role: {
      id: data.id,
      organisationId: data.organisation_id,
      departmentId: data.department_id,
      name: data.name,
      budgetedCount: data.budgeted_count,
      filledCount: 0,
    },
  }
}

export async function updateRole(
  input: z.input<typeof UpdateRoleInput>
): Promise<{ role: DeptRole } | { error: string }> {
  const parsed = UpdateRoleInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (parsed.data.name          !== undefined) updates.name           = parsed.data.name
  if (parsed.data.budgetedCount !== undefined) updates.budgeted_count = parsed.data.budgetedCount
  if (parsed.data.sort          !== undefined) updates.sort           = parsed.data.sort

  const { data, error } = await ctx.supabase
    .from('roles')
    .update(updates)
    .eq('id', parsed.data.id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[updateRole] update error', error)
    return { error: error?.message ?? 'Failed to update role' }
  }

  const admin: any = createAdminClient() // eslint-disable-line @typescript-eslint/no-explicit-any
  const { count } = await admin
    .from('role_members')
    .select('member_id', { count: 'exact', head: true })
    .eq('role_id', data.id)

  return {
    role: {
      id: data.id,
      organisationId: data.organisation_id,
      departmentId: data.department_id,
      name: data.name,
      budgetedCount: data.budgeted_count,
      filledCount: count ?? 0,
    },
  }
}

/** roles has no soft-delete column — same rationale as archiveArea above. role_members cascades on delete. */
export async function archiveRole(
  roleId: string
): Promise<{ success: true } | { error: string }> {
  if (!roleId) return { error: 'roleId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from('roles')
    .delete()
    .eq('id', roleId)

  if (error) {
    console.error('[archiveRole] delete error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 4. assignRoleMembers — replace-semantics role_members write (D-05/D-07)
//
// role_members has NO authenticated write policy (00046 §6: "writes via admin
// server actions only") — write with createAdminClient() and self-enforce org
// scope on every path (CLAUDE.md 2026-06-15):
//   1. requireAdmin() (role + organisation_id from verified session)
//   2. verify roleId belongs to the caller's org (roles.organisation_id)
//   3. filter memberIds to organisation_members rows in the caller's org
// MUST NOT touch member_departments (D-07) or write organisation_members.role
// (Pitfall 2 — job role != org privilege role, T-32-04-02).
// ---------------------------------------------------------------------------

export async function assignRoleMembers(
  roleId: string,
  memberIds: string[]
): Promise<{ success: true } | { error: string }> {
  if (!roleId) return { error: 'roleId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  const admin: any = createAdminClient() // eslint-disable-line @typescript-eslint/no-explicit-any
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // Guard: role must belong to the caller's organisation.
  const { data: roleRow } = await admin
    .from('roles')
    .select('id, organisation_id')
    .eq('id', roleId)
    .maybeSingle()
  if (!roleRow) return { error: 'Role not found' }
  if (roleRow.organisation_id !== orgId) return { error: 'Role belongs to another organisation' }

  // Guard: filter memberIds down to real organisation_members of the caller's org.
  const validMemberIds: string[] = []
  if (memberIds.length > 0) {
    const { data: memberRows } = await admin
      .from('organisation_members')
      .select('user_id')
      .eq('organisation_id', orgId)
      .in('user_id', memberIds)
    validMemberIds.push(...((memberRows ?? []) as Array<{ user_id: string }>).map(m => m.user_id))
  }

  // Replace semantics: delete existing rows for this role, then insert validated ones.
  const { error: delErr } = await admin
    .from('role_members')
    .delete()
    .eq('role_id', roleId)
  if (delErr) {
    console.error('[assignRoleMembers] delete error', delErr)
    return { error: delErr.message }
  }

  if (validMemberIds.length > 0) {
    const rows = validMemberIds.map((member_id: string) => ({
      role_id: roleId,
      member_id,
      assigned_by: ctx.user.id,
    }))
    const { error: insErr } = await admin
      .from('role_members')
      .insert(rows)
    if (insErr) {
      console.error('[assignRoleMembers] insert error', insErr)
      return { error: insErr.message }
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 5. setDepartmentArea — assign/clear a department's area grouping (D-04)
// ---------------------------------------------------------------------------

export async function setDepartmentArea(
  departmentId: string,
  areaId: string | null
): Promise<{ success: true } | { error: string }> {
  if (!departmentId) return { error: 'departmentId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data: deptRow } = await ctx.supabase
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('organisation_id', ctx.organisationId)
    .maybeSingle()
  if (!deptRow) return { error: 'Department not found in this organisation' }

  if (areaId !== null) {
    const validIds = await orgScopedIds(ctx.supabase, 'areas', ctx.organisationId, [areaId])
    if (validIds.length === 0) return { error: 'Area not found in this organisation' }
  }

  const { error } = await ctx.supabase
    .from('departments')
    .update({ area_id: areaId, updated_at: new Date().toISOString() })
    .eq('id', departmentId)

  if (error) {
    console.error('[setDepartmentArea] update error', error)
    return { error: error.message }
  }
  return { success: true }
}
