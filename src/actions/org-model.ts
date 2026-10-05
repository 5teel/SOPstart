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
 * page canvases that were their only callers; this module is read-only now.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
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
