'use server'

/**
 * Phase 32: Visual Org Model & Library Permissions — access-grant CRUD +
 * materialization fanout.
 *
 * Exports:
 *  - listGrants()                          — all access_grants for the caller's org
 *  - createGrant({subjectType,subjectId,collectionId}) — additive grant (D-02/D-06/D-11)
 *  - revokeGrant(grantId)                  — deletes the source grant (additive-only, D-11)
 *  - materializeSopAccess(sopId)           — resolves + replace-writes sop_departments AND sop_access_people for one SOP
 *  - materializeCollectionAccess(collectionId) — materializeSopAccess for every SOP in a collection
 *  - materializeOrgAccess()                — re-materializes every collection-bearing SOP in the org (CR-03:
 *    called by org-model.ts after chain/membership mutations so revocation propagates)
 *  - ensureSopCollections(sopId)           — runtime sop_collections companion write (CR-02, mirrors 00047 A/B)
 *
 * This is the security-critical write path (T-32-05-01/02/03/04). access_grants,
 * sop_departments, and sop_access_people have NO authenticated write policy —
 * every write here goes through createAdminClient() and self-enforces org scope
 * on EVERY path before touching a row (CLAUDE.md 2026-06-15/2026-06-26 class of
 * bug — cross-tenant admin-client writes recurred twice in this repo already).
 *
 * materializeSopAccess/materializeCollectionAccess are the ONLY thing that turns
 * a grant into worker-visible rows — createGrant and revokeGrant both funnel
 * through materializeCollectionAccess so there is no orphan write path that
 * could leave sop_departments/sop_access_people stale (T-32-05-03).
 *
 * resolveEffectiveAccess() (32-04) is called per department and per role — the
 * ONE 5-level union resolver every view/writer must use, never recomputed here
 * (RESEARCH Pattern 2). Person-level grants are read directly off access_grants
 * (subject_type='person') and never routed through a department/role chain —
 * a person grant materializes ONLY into sop_access_people, never widening
 * sop_departments (D-13, the Priya scenario, T-32-05-02).
 */

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
import { resolveSopAccess } from '@/lib/org-model/resolve-sop-access'
import { ensureSopCollectionsForOrg } from '@/lib/org-model/sop-collections'
import type { SubjectType } from '@/types/org-model'

// ---------------------------------------------------------------------------
// Helpers (mirror src/actions/org-model.ts / departments.ts verbatim)
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

/** Authoritative organisation for the caller — read from their live organisation_members row, never the parsed JWT claim ([2026-06-26] staleness class). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callerOrgId(admin: any, ctx: AdminCtx): Promise<string | null> {
  const { data } = await admin
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', ctx.user.id)
    .maybeSingle()
  return (data?.organisation_id as string | undefined) ?? ctx.organisationId
}

/** Verifies subjectId (per subjectType) is a real row in the caller's org. 'org' has no subjectId to check — it IS the caller's own org. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifySubjectInOrg(admin: any, orgId: string, subjectType: SubjectType, subjectId: string | null): Promise<boolean> {
  if (subjectType === 'org') return subjectId === null
  if (!subjectId) return false
  const TABLE_BY_TYPE: Record<Exclude<SubjectType, 'org'>, string> = {
    area: 'areas',
    department: 'departments',
    role: 'roles',
    person: 'organisation_members',
  }
  const table = TABLE_BY_TYPE[subjectType]
  const idColumn = subjectType === 'person' ? 'user_id' : 'id'
  const { data } = await admin.from(table).select(idColumn).eq(idColumn, subjectId).eq('organisation_id', orgId).maybeSingle()
  return !!data
}

// ---------------------------------------------------------------------------
// Input schema (V5 — z.enum, never a free string)
// ---------------------------------------------------------------------------

const GRANT_SUBJECT_TYPES = ['org', 'area', 'department', 'role', 'person'] as const

const CreateGrantInput = z
  .object({
    subjectType: z.enum(GRANT_SUBJECT_TYPES),
    subjectId: z.string().uuid().nullable(),
    // Phase 33 SC-3: a grant targets exactly one of collectionId/sopId
    // (XOR, mirrors the 00050 DB constraint). Both default to null so
    // existing callers passing only collectionId are unaffected.
    collectionId: z.string().uuid().nullable().default(null),
    sopId: z.string().uuid().nullable().default(null),
  })
  .refine(v => (v.subjectType === 'org') === (v.subjectId === null), {
    message: 'subjectId must be null for org grants, and required for every other subject type',
  })
  .refine(v => (v.collectionId === null) !== (v.sopId === null), {
    message: 'Exactly one of collectionId or sopId must be set',
  })

export interface GrantRow {
  id: string
  subjectType: SubjectType
  subjectId: string | null
  collectionId: string
  /** Phase 33 SC-3: set for SOP-target grants, null for collection-target grants. */
  sopId: string | null
  grantedBy: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// 1. listGrants — access_grants carries an authenticated org-scoped SELECT
// policy (00046 §8), so the plain session client is sufficient (no admin client).
// ---------------------------------------------------------------------------

export async function listGrants(): Promise<{ grants: GrantRow[] } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  const { data, error } = await ctx.supabase
    .from('access_grants')
    .select('*')
    .eq('organisation_id', ctx.organisationId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listGrants] read error', error)
    return { error: error.message }
  }

  const rows = (data ?? []) as Array<{ id: string; subject_type: SubjectType; subject_id: string | null; collection_id: string; sop_id: string | null; granted_by: string | null; created_at: string }>
  return {
    grants: rows.map(r => ({
      id: r.id,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      collectionId: r.collection_id,
      sopId: r.sop_id,
      grantedBy: r.granted_by,
      createdAt: r.created_at,
    })),
  }
}

// ---------------------------------------------------------------------------
// 2. createGrant — additive-only grant of a collection to an org unit (D-02/D-06/D-11)
// access_grants has NO authenticated write policy — writes via admin client,
// org self-enforced on BOTH subjectId and collectionId BEFORE the insert
// (T-32-05-01, [2026-06-15]).
// ---------------------------------------------------------------------------

export async function createGrant(
  input: z.input<typeof CreateGrantInput>
): Promise<{ grant: GrantRow } | { error: string }> {
  const parsed = CreateGrantInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  const { subjectType, subjectId, collectionId, sopId } = parsed.data

  // Guard: subjectId (per type) AND the target (collectionId XOR sopId) must
  // both belong to the caller's org — every new write path, not just the
  // happy one (RESEARCH Pitfall 1, T-32-05-01/T-33-05-01).
  const subjectOk = await verifySubjectInOrg(admin, orgId, subjectType, subjectId)
  if (!subjectOk) return { error: 'Subject not found in this organisation' }

  if (collectionId) {
    const { data: collRow } = await admin.from('collections').select('id').eq('id', collectionId).eq('organisation_id', orgId).maybeSingle()
    if (!collRow) return { error: 'Collection not found in this organisation' }
  } else if (sopId) {
    const { data: sopRow } = await admin.from('sops').select('id').eq('id', sopId).eq('organisation_id', orgId).maybeSingle()
    if (!sopRow) return { error: 'SOP not found in this organisation' }
  }

  const { data, error } = await admin
    .from('access_grants')
    .insert({
      organisation_id: orgId,
      subject_type: subjectType,
      subject_id: subjectId,
      collection_id: collectionId,
      sop_id: sopId,
      granted_by: ctx.user.id,
    })
    .select('*')
    .single()

  let row = data
  if ((error || !data) && (error as { code?: string } | null)?.code === '23505') {
    // WR-04: unique violation (00050 uq_access_grants_subject_target) — the
    // identical grant already exists. Idempotent success: re-read the
    // existing row and fall through to re-materialization (double-click Done /
    // re-entered wire-up mode must never surface as an error).
    let existingQuery = admin
      .from('access_grants')
      .select('*')
      .eq('organisation_id', orgId)
      .eq('subject_type', subjectType)
    existingQuery = subjectId === null ? existingQuery.is('subject_id', null) : existingQuery.eq('subject_id', subjectId)
    existingQuery = collectionId === null ? existingQuery.is('collection_id', null) : existingQuery.eq('collection_id', collectionId)
    existingQuery = sopId === null ? existingQuery.is('sop_id', null) : existingQuery.eq('sop_id', sopId)
    const { data: existing } = await existingQuery.maybeSingle()
    row = existing
  }

  if (!row) {
    console.error('[createGrant] insert error', error)
    return { error: error?.message ?? 'Failed to create grant' }
  }

  // Materialize immediately — a grant with no fanout is silent stale visibility (T-32-05-03).
  const materialized = collectionId
    ? await materializeCollectionAccessForOrg(admin, orgId, collectionId)
    : await materializeSopAccessForOrg(admin, orgId, sopId as string)
  if ('error' in materialized) {
    return { error: `Grant created but materialization failed: ${materialized.error}` }
  }

  return {
    grant: {
      id: row.id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      collectionId: row.collection_id,
      sopId: row.sop_id,
      grantedBy: row.granted_by,
      createdAt: row.created_at,
    },
  }
}

// ---------------------------------------------------------------------------
// 3. revokeGrant — deletes the source grant (additive-only, D-11 — no negative/
// exclusion rows), then re-materializes the affected collection.
// ---------------------------------------------------------------------------

export async function revokeGrant(grantId: string): Promise<{ success: true } | { error: string }> {
  if (!grantId) return { error: 'grantId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // Guard: grant must belong to the caller's org. Capture the target (collectionId XOR sopId) before delete.
  const { data: grantRow } = await admin.from('access_grants').select('id, organisation_id, collection_id, sop_id').eq('id', grantId).maybeSingle()
  if (!grantRow) return { error: 'Grant not found' }
  if (grantRow.organisation_id !== orgId) return { error: 'Grant belongs to another organisation' }

  const { error: delErr } = await admin.from('access_grants').delete().eq('id', grantId)
  if (delErr) {
    console.error('[revokeGrant] delete error', delErr)
    return { error: delErr.message }
  }

  // SOP-target branch re-materializes the SOP directly — this is what makes
  // last-person-removed re-follow work (the SOP's collection path resumes
  // the instant its last SOP-target grant is gone).
  const materialized = grantRow.collection_id
    ? await materializeCollectionAccessForOrg(admin, orgId, grantRow.collection_id)
    : await materializeSopAccessForOrg(admin, orgId, grantRow.sop_id as string)
  if ('error' in materialized) {
    return { error: `Grant revoked but materialization failed: ${materialized.error}` }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 4. materializeSopAccess — resolves effective access via resolveEffectiveAccess
// and replace-writes BOTH sop_departments (org/area/department grants) and
// sop_access_people (role/person grants, D-13).
// ---------------------------------------------------------------------------

export async function materializeSopAccess(sopId: string): Promise<{ success: true } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  const { data: sopRow } = await admin.from('sops').select('id, organisation_id').eq('id', sopId).maybeSingle()
  if (!sopRow) return { error: 'SOP not found' }
  if (sopRow.organisation_id !== orgId) return { error: 'SOP belongs to another organisation' }

  return materializeSopAccessForOrg(admin, orgId, sopId)
}

// ---------------------------------------------------------------------------
// 5. materializeCollectionAccess — materializeSopAccess for every SOP in the collection.
// ---------------------------------------------------------------------------

export async function materializeCollectionAccess(collectionId: string): Promise<{ success: true } | { error: string }> {
  if (!collectionId) return { error: 'collectionId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  return materializeCollectionAccessForOrg(admin, orgId, collectionId)
}

// ---------------------------------------------------------------------------
// 5b. materializeOrgAccess — re-materializes EVERY collection-bearing SOP in
// the caller's org (CR-03). Resolved access changes not only on grant CRUD but
// whenever the inheritance chain or role membership changes (assignRoleMembers,
// archiveRole, setDepartmentArea, archiveArea in org-model.ts). Without this,
// removing a person from a role left their materialized sop_access_people rows
// live indefinitely — retained access after revocation. Sequential per-SOP
// fanout is fine at this scale (50-500 SOPs); per-role narrowing is an
// optimization, not a correctness requirement.
// ---------------------------------------------------------------------------

export async function materializeOrgAccess(): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  const { data: sopRows, error: sopsErr } = await admin.from('sops').select('id').eq('organisation_id', orgId)
  if (sopsErr) return { error: sopsErr.message }
  const sopIds = ((sopRows ?? []) as Array<{ id: string }>).map(r => r.id)
  if (sopIds.length === 0) return { success: true }

  // Only SOPs with a sop_collections row or a direct SOP-target grant are
  // inside the grant system — the CR-02 guard in materializeSopAccessForOrg
  // would skip the rest anyway; filtering here just avoids pointless
  // per-SOP round-trips. SOP-target-bearing SOPs must be included too
  // (Phase 33 CR-02 update) or role-membership/chain changes won't
  // propagate revocation to overridden SOPs — the same retained-access
  // class CR-03 originally closed.
  const { data: scRows, error: scErr } = await admin.from('sop_collections').select('sop_id').in('sop_id', sopIds)
  if (scErr) return { error: scErr.message }
  const collectionBearing = new Set(((scRows ?? []) as Array<{ sop_id: string }>).map(r => r.sop_id))

  const { data: sopTargetRows, error: sopTargetErr } = await admin
    .from('access_grants')
    .select('sop_id')
    .eq('organisation_id', orgId)
    .not('sop_id', 'is', null)
  if (sopTargetErr) return { error: sopTargetErr.message }
  const sopTargetBearing = new Set(((sopTargetRows ?? []) as Array<{ sop_id: string }>).map(r => r.sop_id))

  for (const sopId of sopIds) {
    if (!collectionBearing.has(sopId) && !sopTargetBearing.has(sopId)) continue
    const result = await materializeSopAccessForOrg(admin, orgId, sopId)
    if ('error' in result) return result
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 6. ensureSopCollections — the runtime sop_collections write path (CR-02).
// Mirrors migration 00047 Steps A/B for one SOP (collection from sops.category
// + junction row) via the shared ensureSopCollectionsForOrg helper. Called by
// the access-view page for a pinned ?sop= so wire-up always has a real
// collection to grant (CR-01). performPublish() runs the same helper on every
// publish path.
// ---------------------------------------------------------------------------

export async function ensureSopCollections(sopId: string): Promise<{ collectionIds: string[] } | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // ensureSopCollectionsForOrg re-verifies sops.organisation_id === orgId
  // before any write (2026-06-15 self-enforced org scope).
  return ensureSopCollectionsForOrg(admin, orgId, sopId)
}

// ---------------------------------------------------------------------------
// Internal fanout — org already verified by the caller above. Shared by
// createGrant/revokeGrant (already hold orgId) and the public wrappers.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function materializeCollectionAccessForOrg(admin: any, orgId: string, collectionId: string): Promise<{ success: true } | { error: string }> {
  const { data: collRow } = await admin.from('collections').select('id').eq('id', collectionId).eq('organisation_id', orgId).maybeSingle()
  if (!collRow) return { error: 'Collection not found in this organisation' }

  const { data: sopCollRows, error: readErr } = await admin.from('sop_collections').select('sop_id').eq('collection_id', collectionId)
  if (readErr) return { error: readErr.message }

  const sopIds = ((sopCollRows ?? []) as Array<{ sop_id: string }>).map(r => r.sop_id)
  for (const sopId of sopIds) {
    const result = await materializeSopAccessForOrg(admin, orgId, sopId)
    if ('error' in result) return result
  }
  return { success: true }
}

/**
 * The core resolve + replace-write. org/sop already verified by the caller.
 *
 * Department-level access (org/area/department grants) -> sop_departments.
 * Role-level access (role grants, fanned out to role_members) and person-level
 * access (direct person grants) -> sop_access_people. A person grant is read
 * straight off access_grants (subject_type='person') and NEVER routed through
 * a department/role chain, so it can never widen sop_departments (D-13).
 *
 * Phase 33 SC-3/SC-4: a SOP with ANY direct SOP-target grant (any subject
 * tier) is "overridden" — it stops following its collection entirely. The
 * override decision + final dept/person sets are computed by the pure
 * resolveSopAccess() helper (resolve-sop-access.ts); this function only
 * assembles its DB-sourced inputs and performs the replace-write.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function materializeSopAccessForOrg(admin: any, orgId: string, sopId: string): Promise<{ success: true } | { error: string }> {
  const { data: sopCollRows, error: sopCollErr } = await admin.from('sop_collections').select('collection_id').eq('sop_id', sopId)
  if (sopCollErr) return { error: sopCollErr.message }
  const sopCollectionIds = new Set(((sopCollRows ?? []) as Array<{ collection_id: string }>).map(r => r.collection_id))

  const [{ data: deptsData, error: deptsErr }, { data: rolesData, error: rolesErr }, { data: grantsData, error: grantsErr }] = await Promise.all([
    admin.from('departments').select('id, area_id').eq('organisation_id', orgId).eq('archived', false),
    admin.from('roles').select('id, department_id').eq('organisation_id', orgId),
    admin.from('access_grants').select('subject_type, subject_id, collection_id, sop_id').eq('organisation_id', orgId),
  ])
  if (deptsErr) return { error: deptsErr.message }
  if (rolesErr) return { error: rolesErr.message }
  if (grantsErr) return { error: grantsErr.message }

  const depts = (deptsData ?? []) as Array<{ id: string; area_id: string | null }>
  const roles = (rolesData ?? []) as Array<{ id: string; department_id: string }>
  const grants = (grantsData ?? []) as Array<{ subject_type: SubjectType; subject_id: string | null; collection_id: string | null; sop_id: string | null }>

  // SOP-target grants for THIS sop trigger the narrowing override (locked
  // 2026-07-19: any direct SOP-target grant, any subject tier).
  const sopTargetGrants = grants.filter(g => g.sop_id === sopId).map(g => ({ subjectType: g.subject_type, subjectId: g.subject_id }))

  // CR-02 guard (documented decision, extended for Phase 33): a SOP outside
  // the grant system entirely — no collection membership AND no SOP-target
  // grant — would replace-write sop_departments/sop_access_people down to
  // EMPTY, silently revoking live (legacy, pre-Phase-32) worker visibility.
  // Preserve existing rows and skip instead. A collection-less SOP WITH a
  // SOP-target grant IS inside the grant system (can be wired by name
  // before it has a category).
  if (sopCollectionIds.size === 0 && sopTargetGrants.length === 0) return { success: true }

  const roleIds = roles.map(r => r.id)
  const { data: roleMembersData, error: roleMembersErr } = roleIds.length > 0
    ? await admin.from('role_members').select('role_id, member_id').in('role_id', roleIds)
    : { data: [], error: null }
  if (roleMembersErr) return { error: roleMembersErr.message }
  const membersByRole: Record<string, string[]> = {}
  for (const rm of (roleMembersData ?? []) as Array<{ role_id: string; member_id: string }>) {
    ;(membersByRole[rm.role_id] ??= []).push(rm.member_id)
  }

  // collectionGrantsByUnit: 'org' grants have subject_id=null in the DB —
  // keyed by orgId itself. SOP-target rows have collection_id === null and
  // are naturally excluded here — old code paths stay blind to them.
  const collectionGrantsByUnit: Record<string, string[]> = {}
  const collectionPersonGrants: Array<{ subjectId: string; collectionId: string }> = []
  for (const g of grants) {
    if (!g.collection_id) continue
    const key = g.subject_type === 'org' ? orgId : g.subject_id
    if (!key) continue
    ;(collectionGrantsByUnit[key] ??= []).push(g.collection_id)
    if (g.subject_type === 'person' && g.subject_id) collectionPersonGrants.push({ subjectId: g.subject_id, collectionId: g.collection_id })
  }

  const { overridden, deptSet, personSet } = resolveSopAccess({
    orgId,
    depts: depts.map(d => ({ id: d.id, areaId: d.area_id })),
    roles: roles.map(r => ({ id: r.id, departmentId: r.department_id })),
    membersByRole,
    collectionGrantsByUnit,
    collectionPersonGrants,
    sopCollectionIds,
    sopTargetGrants,
  })

  // Override forces all_departments=false — the 00035 bypass would otherwise
  // make the narrowing override cosmetic (a SOP could still reach everyone
  // via the all_departments arm regardless of materialized junction rows).
  if (overridden) {
    const { error: allDeptErr } = await admin.from('sops').update({ all_departments: false }).eq('id', sopId)
    if (allDeptErr) return { error: allDeptErr.message }
  }

  // Replace-write sop_departments.
  const { error: delDeptErr } = await admin.from('sop_departments').delete().eq('sop_id', sopId)
  if (delDeptErr) return { error: delDeptErr.message }
  if (deptSet.size > 0) {
    const rows = [...deptSet].map(department_id => ({ sop_id: sopId, department_id }))
    const { error: insDeptErr } = await admin.from('sop_departments').insert(rows)
    if (insDeptErr) return { error: insDeptErr.message }
  }

  // Replace-write sop_access_people.
  const { error: delPeopleErr } = await admin.from('sop_access_people').delete().eq('sop_id', sopId)
  if (delPeopleErr) return { error: delPeopleErr.message }
  if (personSet.size > 0) {
    const rows = [...personSet].map(member_id => ({ sop_id: sopId, member_id }))
    const { error: insPeopleErr } = await admin.from('sop_access_people').insert(rows)
    if (insPeopleErr) return { error: insPeopleErr.message }
  }

  return { success: true }
}
