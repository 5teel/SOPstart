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
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
import { materializeSopAccess } from '@/actions/grants'
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
  // ponytail: local AdminCtx kept only for its `supabase: any` — the
  // departments/junction tables aren't in database.types.ts yet.
  return requireAdminContext()
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
      owner_name: null,
      owner_role: null,
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

  // Phase 25 (REQ-5): resolve owner display (email) + org role for owned departments
  // so the department card renders the filled "Owner" line, not just the no-owner warning.
  // Mirrors getTeamMembersWithEmails — emails come from the admin auth API (no profiles table).
  const ownerIds = Array.from(
    new Set((depts as Department[]).map(d => d.owner_user_id).filter((x): x is string => !!x))
  )
  const ownerName: Record<string, string> = {}
  const ownerRole: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const admin = createAdminClient()
    const { data: roleRows } = await admin
      .from('organisation_members')
      .select('user_id, role')
      .eq('organisation_id', organisationId)
      .in('user_id', ownerIds)
    for (const r of (roleRows ?? []) as Array<{ user_id: string; role: string }>) {
      ownerRole[r.user_id] = r.role
    }
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of users) {
      if (ownerIds.includes(u.id) && u.email) ownerName[u.id] = u.email
    }
  }

  return (depts as Department[]).map(d => ({
    ...d,
    people_count: peopleCount[d.id] ?? 0,
    sop_count:    sopCount[d.id] ?? 0,
    block_count:  blockCount[d.id] ?? 0,
    owner_name:   d.owner_user_id ? (ownerName[d.owner_user_id] ?? null) : null,
    owner_role:   d.owner_user_id ? (ownerRole[d.owner_user_id] ?? null) : null,
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
// Junction-write helper.
//
// The three junction tables (member/block/sop _departments) have NO authenticated
// write policy by design (00035: "writes via admin server actions only"). So the
// assigners below write with the service-role client, which bypasses RLS — meaning
// the org gate is enforced HERE, not by the database. Every assigner therefore:
//   1. requireAdmin() (role + organisation_id from JWT, never client input)
//   2. confirms the parent row (member/block/sop) is in the caller's org
//   3. filters department ids to the caller's org (orgScopedDeptIds)
// ---------------------------------------------------------------------------

/** Returns the subset of `ids` that are real departments in `organisationId`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function orgScopedDeptIds(admin: any, organisationId: string, ids: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return []
  const { data } = await admin
    .from('departments')
    .select('id')
    .eq('organisation_id', organisationId)
    .in('id', ids)
  return ((data ?? []) as Array<{ id: string }>).map(d => d.id)
}

/**
 * Authoritative organisation for the caller — read from their live
 * organisation_members row, NOT the parsed JWT claim (which can lag a role/org
 * change until the token refreshes). Falls back to the JWT claim only if no
 * membership row is found.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // Guard: member must belong to the caller's organisation.
  const { data: memberRow } = await admin
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', memberId)
    .maybeSingle()
  if (!memberRow) return { error: 'Member not found' }
  if (memberRow.organisation_id !== orgId) return { error: 'Member belongs to another organisation' }

  const validIds = await orgScopedDeptIds(admin, orgId, departmentIds)

  // Replace semantics: delete existing rows for this member, then insert new ones.
  const { error: delErr } = await admin
    .from('member_departments')
    .delete()
    .eq('member_id', memberId)
  if (delErr) {
    console.error('[assignMemberDepartments] delete error', delErr)
    return { error: delErr.message }
  }

  if (validIds.length > 0) {
    const rows = validIds.map((department_id: string) => ({
      member_id: memberId,
      department_id,
      assigned_by: ctx.user.id,
    }))
    const { error: insErr } = await admin
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // Guard: block must exist and not belong to a DIFFERENT org (null-org legacy rows OK).
  const { data: blockRow } = await admin
    .from('blocks')
    .select('id, organisation_id')
    .eq('id', blockId)
    .maybeSingle()
  if (!blockRow) return { error: 'Block not found' }
  if (blockRow.organisation_id && blockRow.organisation_id !== orgId) {
    return { error: 'Block belongs to another organisation' }
  }
  if (!blockRow.organisation_id) {
    await admin.from('blocks').update({ organisation_id: orgId }).eq('id', blockId)
  }

  // Replace semantics: clear junction rows, set the flag, then re-insert if scoped.
  const { error: delErr } = await admin
    .from('block_departments')
    .delete()
    .eq('block_id', blockId)
  if (delErr) return { error: delErr.message }

  const { error: flagErr } = await admin
    .from('blocks')
    .update({ all_departments: allDepartments })
    .eq('id', blockId)
  if (flagErr) return { error: flagErr.message }

  if (!allDepartments) {
    const validIds = await orgScopedDeptIds(admin, orgId, departmentIds)
    if (validIds.length > 0) {
      const rows = validIds.map((department_id: string) => ({ block_id: blockId, department_id }))
      const { error: insErr } = await admin
        .from('block_departments')
        .insert(rows)
      if (insErr) return { error: insErr.message }
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 8. assignSopDepartments — SOP-target dept-subject grants (Phase 33 SC-3/SC-4)
//
// sop_departments is 100% derived — this function NEVER writes it directly.
// Replace semantics on the SOP's dept-subject SOP-target access_grants rows,
// then materializeSopAccess() turns those grants into sop_departments. A
// hand-picked SOP is therefore overridden-from-birth (research OQ1 option i):
// it stops following its collection and survives sibling-collection
// re-materialization — this is what closes the 32-VERIFICATION silent-drop
// hole. Empty pick-set = delete-all grants + materialize (SOP re-follows its
// collection, emergent — no stored flag).
// ---------------------------------------------------------------------------

export async function assignSopDepartments(
  sopId: string,
  departmentIds: string[],
  allDepartments: boolean = false
): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // Guard: SOP must exist and not belong to a DIFFERENT org. Legacy SOPs with a
  // null organisation_id (visible to the admin via the department/all-departments
  // RLS arm) are allowed and healed — this is what caused the false "not found".
  const { data: sopRow } = await admin
    .from('sops')
    .select('id, organisation_id')
    .eq('id', sopId)
    .maybeSingle()
  if (!sopRow) return { error: 'SOP not found' }
  if (sopRow.organisation_id && sopRow.organisation_id !== orgId) {
    return { error: 'SOP belongs to another organisation' }
  }
  if (!sopRow.organisation_id) {
    await admin.from('sops').update({ organisation_id: orgId }).eq('id', sopId)
  }

  // Replace semantics: clear this SOP's dept-subject SOP-target grants only —
  // never touch other subject-tier SOP-target grants (those belong to the
  // org-model wiring surface, 32-08/33-08).
  const { error: delErr } = await admin
    .from('access_grants')
    .delete()
    .eq('organisation_id', orgId)
    .eq('sop_id', sopId)
    .eq('subject_type', 'department')
  if (delErr) return { error: delErr.message }

  // 33-05's override rule only forces all_departments=false when a SOP-target
  // grant EXISTS for this SOP — setting the flag here first and re-inserting
  // grants after cannot conflict with that rule.
  const { error: flagErr } = await admin
    .from('sops')
    .update({ all_departments: allDepartments })
    .eq('id', sopId)
  if (flagErr) return { error: flagErr.message }

  if (!allDepartments) {
    const validIds = await orgScopedDeptIds(admin, orgId, departmentIds)
    if (validIds.length > 0) {
      const rows = validIds.map((department_id: string) => ({
        organisation_id: orgId,
        subject_type: 'department',
        subject_id: department_id,
        collection_id: null,
        sop_id: sopId,
        granted_by: ctx.user.id,
      }))
      const { error: insErr } = await admin
        .from('access_grants')
        .insert(rows)
      if (insErr) return { error: insErr.message }
    }
  }

  // sop_departments derives entirely from the grants just written.
  const materialized = await materializeSopAccess(sopId)
  if ('error' in materialized) return { error: `Departments assigned but materialization failed: ${materialized.error}` }

  return { success: true }
}
