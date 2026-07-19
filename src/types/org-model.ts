/**
 * Phase 32: Visual Org Model & Library Permissions — shared types.
 *
 * NEVER declare a bare `Role` type here — `role` already means an
 * organisation_members privilege (admin/safety_manager/worker/...)
 * throughout this codebase. A job-role entity is always `DeptRole`
 * (32-04-PLAN Pitfall 2, grep-enforced by the resolver's unit test).
 */

/** D-06: the 5-level grantable chain, org first, person last. */
export type SubjectType = 'org' | 'area' | 'department' | 'role' | 'person'

/** areas table (D-04) — org-scoped, groups departments in the chart/rail. */
export interface Area {
  id: string
  organisationId: string
  name: string
  colour: string
  sort: number
}

/** roles table (D-05) — dept-scoped job role. Vacancies = budgetedCount - filledCount. */
export interface DeptRole {
  id: string
  organisationId: string
  departmentId: string
  name: string
  budgetedCount: number
  filledCount: number
}

/** A named member or an unfilled role slot, rendered as a first-class dashed chip. */
export interface OrgPerson {
  /** null for a vacancy — there is no person to link to. */
  id: string | null
  name: string
  isVacancy: boolean
}

export interface OrgTreeRole extends DeptRole {
  people: OrgPerson[]
}

export interface OrgTreeDepartment {
  id: string
  areaId: string | null
  name: string
  colour: string
  icon: string | null
  roles: OrgTreeRole[]
}

export interface OrgTreeArea extends Area {
  departments: OrgTreeDepartment[]
}

/** listOrgTree() shape — the caller's org as areas -> departments -> roles -> people. */
export interface OrgTree {
  organisationId: string
  areas: OrgTreeArea[]
  /** Departments with no area_id — rendered ungrouped in the chart/rail (D-04). */
  ungroupedDepartments: OrgTreeDepartment[]
}

/** access_grants row shape — an org-unit x collection/SOP grant (D-02/D-06/D-11, additive-only). */
export interface AccessGrant {
  subjectType: SubjectType
  /** null only when subjectType === 'org'. */
  subjectId: string | null
  collectionId: string
  /** Phase 33 SC-3: null for collection-target grants (the only kind the wiring UI writes today); set for SOP-target grants (createGrant/listGrants, XOR with collectionId at the DB layer). */
  sopId: string | null
}

/** One link in an org-unit's ancestor chain — root (org) first, the unit itself last. */
export interface ChainLink {
  unitId: string
  subjectType: SubjectType
}

/** resolveEffectiveAccess() result for a single org unit. */
export interface EffectiveAccess {
  /** Collections granted directly to this unit (org/area/department/role — never person). */
  direct: Set<string>
  /** Collections inherited from an ancestor: collectionId -> nearest granting ancestor unitId. */
  inherited: Record<string, string>
  /** Collections granted directly to a person (D-13, the Priya scenario) — never widens the department. */
  personal: Set<string>
}
