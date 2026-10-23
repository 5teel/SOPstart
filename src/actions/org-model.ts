'use server'

/**
 * Org-model server action: listOrgTree() -- the caller's org as
 * areas -> departments -> roles -> people. Read by the Access lens
 * (admin-access-view.ts) and the training bridge page.
 *
 * Returns { error } instead of throwing. requireAdminContext() reads role and
 * organisation_id from the verified session, never from client input.
 *
 * Phase 59 deleted the area / role / role-member write actions with the team
 * page canvases that were their only callers. ADR-0021 brings back job roles for
 * the People chart: createRole, updateRole, removeRole and setRoleSeat, each
 * org-scoped from the session and logged to the ledger (ADR-0008).
 */

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
import { recordDecision } from '@/lib/decisions/record'
import { materializeOrgAccess } from '@/actions/grants'
import type { OrgPerson, OrgTree, OrgTreeArea, OrgTreeDepartment, OrgTreeRole } from '@/types/org-model'

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
// 2. Job roles (ADR-0021) -- a department's roles and who sits in them.
// A job role is not the access level (organisation_members.role) and never
// changes it, nor member_departments (32 D-07). Org scope comes from the
// session; every write filters on organisation_id and treats zero rows as a
// failure. Role membership feeds role-subject grants, so a change that can move
// someone's access re-materialises it (32 CR-03).
// ---------------------------------------------------------------------------

const RoleName = z.string().trim().min(1, 'Give the role a name').max(100)
const Seats = z.number().int().min(0).max(500)
const CreateRoleInput = z.object({ departmentId: z.string().uuid(), name: RoleName, budgetedCount: Seats })
const UpdateRoleInput = z.object({ id: z.string().uuid(), name: RoleName.optional(), budgetedCount: Seats.optional() })
const SeatInput = z.object({ roleId: z.string().uuid(), memberId: z.string().uuid(), seated: z.boolean() })

type Logged = { logged: boolean }

export async function createRole(input: z.input<typeof CreateRoleInput>): Promise<({ id: string } & Logged) | { error: string }> {
  const parsed = CreateRoleInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }
  const orgId = ctx.organisationId

  const { data: dept } = await ctx.supabase
    .from('departments')
    .select('id')
    .eq('id', parsed.data.departmentId)
    .eq('organisation_id', orgId)
    .maybeSingle()
  if (!dept) return { error: 'Department not found in this organisation' }

  const { data: last } = await ctx.supabase
    .from('roles')
    .select('sort')
    .eq('department_id', parsed.data.departmentId)
    .eq('organisation_id', orgId)
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data, error } = await ctx.supabase
    .from('roles')
    .insert({
      organisation_id: orgId,
      department_id: parsed.data.departmentId,
      name: parsed.data.name,
      budgeted_count: parsed.data.budgetedCount,
      sort: ((last?.sort as number | undefined) ?? -1) + 1,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Could not add the role' }
  const rec = await recordDecision({
    kind: 'department_change',
    subject: { kind: 'department', id: parsed.data.departmentId },
    summary: `Added the role ${parsed.data.name}`,
    details: { action: 'role_create', roleId: data.id, name: parsed.data.name, seats: parsed.data.budgetedCount },
  })
  return { id: data.id as string, logged: rec.ok }
}

export async function updateRole(input: z.input<typeof UpdateRoleInput>): Promise<Logged | { error: string }> {
  const parsed = UpdateRoleInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  if (parsed.data.name === undefined && parsed.data.budgetedCount === undefined) return { error: 'Nothing to change' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.budgetedCount !== undefined) updates.budgeted_count = parsed.data.budgetedCount
  const { data, error } = await ctx.supabase
    .from('roles')
    .update(updates)
    .eq('id', parsed.data.id)
    .eq('organisation_id', ctx.organisationId)
    .select('id, department_id, name')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Role not found in this organisation' }
  const row = data[0] as { id: string; department_id: string; name: string }
  const rec = await recordDecision({
    kind: 'department_change',
    subject: { kind: 'department', id: row.department_id },
    summary: `Changed the role ${row.name}`,
    details: { action: 'role_update', roleId: row.id, name: parsed.data.name ?? null, seats: parsed.data.budgetedCount ?? null },
  })
  return { logged: rec.ok }
}

/** Deletes the role; its seats (role_members) go with it, and access through it is re-derived. */
export async function removeRole(roleId: string): Promise<Logged | { error: string }> {
  const id = z.string().uuid().safeParse(roleId)
  if (!id.success) return { error: 'Invalid role' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data, error } = await ctx.supabase
    .from('roles')
    .delete()
    .eq('id', id.data)
    .eq('organisation_id', ctx.organisationId)
    .select('id, department_id, name')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Role not found in this organisation' }
  const row = data[0] as { id: string; department_id: string; name: string }
  const mat = await materializeOrgAccess()
  const rec = await recordDecision({
    kind: 'department_change',
    subject: { kind: 'department', id: row.department_id },
    summary: `Removed the role ${row.name}`,
    details: { action: 'role_remove', roleId: row.id, name: row.name },
  })
  if ('error' in mat) return { error: `Role removed, but access was not refreshed: ${mat.error}` }
  return { logged: rec.ok }
}

/** Seats one person in a role, or takes them out of it. The person must be a member of this org. */
export async function setRoleSeat(input: z.input<typeof SeatInput>): Promise<Logged | { error: string }> {
  const parsed = SeatInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }
  const orgId = ctx.organisationId
  const { roleId, memberId, seated } = parsed.data

  // role_members has no authenticated write policy (00046 §6): service role, org checked on both sides.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const [{ data: role }, { data: member }] = await Promise.all([
    admin.from('roles').select('id, department_id, name').eq('id', roleId).eq('organisation_id', orgId).maybeSingle(),
    admin.from('organisation_members').select('user_id').eq('user_id', memberId).eq('organisation_id', orgId).eq('status', 'active').maybeSingle(),
  ])
  if (!role) return { error: 'Role not found in this organisation' }
  if (!member) return { error: 'That person is not on this site' }

  if (seated) {
    const { error } = await admin
      .from('role_members')
      .upsert({ role_id: roleId, member_id: memberId, assigned_by: ctx.user.id }, { onConflict: 'role_id,member_id' })
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('role_members').delete().eq('role_id', roleId).eq('member_id', memberId)
    if (error) return { error: error.message }
  }
  const mat = await materializeOrgAccess()
  const rec = await recordDecision({
    kind: 'department_change',
    subject: { kind: 'department', id: role.department_id as string },
    summary: seated ? `Seated someone as ${role.name}` : `Took someone out of ${role.name}`,
    details: { action: seated ? 'role_seat' : 'role_unseat', roleId, memberId },
  })
  if ('error' in mat) return { error: `Saved, but access was not refreshed: ${mat.error}` }
  return { logged: rec.ok }
}
