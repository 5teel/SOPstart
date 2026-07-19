import { resolveEffectiveAccess } from './resolve-access'
import type { ChainLink, SubjectType } from '@/types/org-model'

/**
 * Phase 33 SC-3/SC-4 — pure narrowing-override decision logic for SOP-target
 * grants. Lives here (NOT an export of src/actions/grants.ts) because a pure
 * sync helper inside a 'use server' file passes `tsc` but breaks `next build`
 * (CLAUDE.md 2026-06-27 learning, RESEARCH Pitfall 4).
 *
 * Locked decision (2026-07-19): "once people are chosen by name for a SOP,
 * it stops following its collection." A SOP with ANY direct SOP-target
 * grant, from any subject tier (org/area/department/role/person), stops
 * following its collection entirely — `overridden` triggers on existence
 * alone, not on subject tier. Re-follow is emergent: pass an empty
 * `sopTargetGrants` array (the last grant was revoked) and this function
 * naturally falls back to the collection-derived sets — no stored flag.
 *
 * `resolveEffectiveAccess` (resolve-access.ts) stays byte-unchanged — this
 * helper calls it a second time per org unit, keyed by a sentinel marker
 * instead of a real collection id, so org/area/department/role-subject
 * SOP-target grants inherit down the chain exactly like collection grants
 * do today (D-11 survives WITHIN the SOP-target tier; only the collection
 * tier is severed by the override).
 */

const SOP_TARGET_MARKER = '__sop_target__'

export interface OrgDepartmentShape {
  id: string
  areaId: string | null
}

export interface OrgRoleShape {
  id: string
  departmentId: string
}

export interface SopTargetGrant {
  subjectType: SubjectType
  subjectId: string | null
}

export interface CollectionPersonGrant {
  subjectId: string
  collectionId: string
}

export interface ResolveSopAccessInput {
  orgId: string
  depts: OrgDepartmentShape[]
  roles: OrgRoleShape[]
  /** roleId -> member (organisation_members) ids. */
  membersByRole: Record<string, string[]>
  /** Collection-target grants, keyed by unit id -> collection ids granted (existing shape, unchanged). */
  collectionGrantsByUnit: Record<string, Iterable<string>>
  /** Person-subject collection-target grants (never routed through the department/role chain — D-13, the Priya scenario). */
  collectionPersonGrants: CollectionPersonGrant[]
  /** This SOP's collection memberships (sop_collections rows). */
  sopCollectionIds: Set<string>
  /** Grants that target THIS sop directly, any subject tier — existence triggers the override. */
  sopTargetGrants: SopTargetGrant[]
}

export interface ResolveSopAccessResult {
  overridden: boolean
  deptSet: Set<string>
  personSet: Set<string>
}

export function resolveSopAccess(input: ResolveSopAccessInput): ResolveSopAccessResult {
  const { orgId, depts, roles, membersByRole, collectionGrantsByUnit, collectionPersonGrants, sopCollectionIds, sopTargetGrants } = input
  const overridden = sopTargetGrants.length > 0

  const sopGrantsByUnit: Record<string, string[]> = {}
  for (const g of sopTargetGrants) {
    const key = g.subjectType === 'org' ? orgId : g.subjectId
    if (!key) continue
    ;(sopGrantsByUnit[key] ??= []).push(SOP_TARGET_MARKER)
  }

  const deptById = new Map(depts.map(d => [d.id, d]))
  const deptSet = new Set<string>()
  const personSet = new Set<string>()

  for (const d of depts) {
    const chain: ChainLink[] = [{ unitId: orgId, subjectType: 'org' }]
    if (d.areaId) chain.push({ unitId: d.areaId, subjectType: 'area' })
    chain.push({ unitId: d.id, subjectType: 'department' })
    if (unitQualifies(chain, overridden, sopGrantsByUnit, collectionGrantsByUnit, sopCollectionIds)) deptSet.add(d.id)
  }

  for (const r of roles) {
    const dept = deptById.get(r.departmentId)
    if (!dept) continue
    const chain: ChainLink[] = [{ unitId: orgId, subjectType: 'org' }]
    if (dept.areaId) chain.push({ unitId: dept.areaId, subjectType: 'area' })
    chain.push({ unitId: dept.id, subjectType: 'department' })
    chain.push({ unitId: r.id, subjectType: 'role' })
    if (unitQualifies(chain, overridden, sopGrantsByUnit, collectionGrantsByUnit, sopCollectionIds)) {
      for (const memberId of membersByRole[r.id] ?? []) personSet.add(memberId)
    }
  }

  // Person-subject direct grants -> sop_access_people ONLY, never
  // sop_departments (D-13, the Priya rule carries over verbatim for both
  // target tiers).
  if (overridden) {
    for (const g of sopTargetGrants) {
      if (g.subjectType === 'person' && g.subjectId) personSet.add(g.subjectId)
    }
  } else {
    for (const g of collectionPersonGrants) {
      if (sopCollectionIds.has(g.collectionId)) personSet.add(g.subjectId)
    }
  }

  return { overridden, deptSet, personSet }
}

function unitQualifies(
  chain: ChainLink[],
  overridden: boolean,
  sopGrantsByUnit: Record<string, string[]>,
  collectionGrantsByUnit: Record<string, Iterable<string>>,
  sopCollectionIds: Set<string>,
): boolean {
  if (overridden) {
    const access = resolveEffectiveAccess(chain, sopGrantsByUnit)
    return access.direct.has(SOP_TARGET_MARKER) || Boolean(access.inherited[SOP_TARGET_MARKER])
  }
  const access = resolveEffectiveAccess(chain, collectionGrantsByUnit)
  for (const c of access.direct) if (sopCollectionIds.has(c)) return true
  for (const c of Object.keys(access.inherited)) if (sopCollectionIds.has(c)) return true
  return false
}
