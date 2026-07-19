/**
 * SC-4 — resolveSopAccess: pure override-rule helper for SOP-target grants
 * (narrowing override). See src/lib/org-model/resolve-sop-access.ts.
 *
 * Registration: auto-registered by playwright.config.ts's existing
 *   `phase32-unit` project (testDir: './src/lib/org-model/__tests__',
 *   testMatch: /.*\.test\.ts$/) — no config edit required.
 * Verify: `npx playwright test --list --project=phase32-unit`
 */
import { test, expect } from '@playwright/test'
import { resolveSopAccess } from '@/lib/org-model/resolve-sop-access'

// Shared org shape fixture: org1 -> area1 -> dept1 -> role1 -> priya; dept2 is
// a sibling department with no collection grant, used to prove org-tier
// SOP-target grants reach EVERY department while collection grants stay
// scoped to dept1 alone.
const ORG_ID = 'org1'
const depts = [
  { id: 'dept1', areaId: 'area1' },
  { id: 'dept2', areaId: null },
]
const roles = [{ id: 'role1', departmentId: 'dept1' }]
const membersByRole = { role1: ['priya'] }
const collectionGrantsByUnit = { dept1: ['colA'] }
const sopCollectionIds = new Set(['colA'])

test.describe('resolveSopAccess — narrowing override rule', () => {
  test('no SOP-target grants: collection-derived sets pass through unchanged', () => {
    const result = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit,
      collectionPersonGrants: [],
      sopCollectionIds,
      sopTargetGrants: [],
    })
    expect(result.overridden).toBe(false)
    expect([...result.deptSet]).toEqual(['dept1'])
    expect([...result.personSet]).toEqual(['priya'])
  })

  test('a person-subject SOP-target grant overrides: department access is dropped (D-13 never widens), personSet is the named person only', () => {
    const result = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit,
      collectionPersonGrants: [],
      sopCollectionIds,
      sopTargetGrants: [{ subjectType: 'person', subjectId: 'priya' }],
    })
    expect(result.overridden).toBe(true)
    expect(result.deptSet.size).toBe(0)
    expect([...result.personSet]).toEqual(['priya'])
  })

  test('revoking the last SOP-target grant re-follows the collection (emergent, no stored flag)', () => {
    // Same input as the override case, but with sopTargetGrants now empty —
    // the caller passes this after a real revoke deletes the grant row.
    const result = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit,
      collectionPersonGrants: [],
      sopCollectionIds,
      sopTargetGrants: [],
    })
    expect(result.overridden).toBe(false)
    expect([...result.deptSet]).toEqual(['dept1'])
    expect([...result.personSet]).toEqual(['priya'])
  })

  test('an org-tier SOP-target grant overrides AND inherits down to every department and role (D-11 survives within the SOP-target tier)', () => {
    const result = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit,
      collectionPersonGrants: [],
      sopCollectionIds,
      sopTargetGrants: [{ subjectType: 'org', subjectId: null }],
    })
    expect(result.overridden).toBe(true)
    expect([...result.deptSet].sort()).toEqual(['dept1', 'dept2'])
    expect([...result.personSet]).toEqual(['priya'])
  })

  test('an area-tier SOP-target grant overrides and inherits only to departments in that area', () => {
    const result = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit,
      collectionPersonGrants: [],
      sopCollectionIds,
      sopTargetGrants: [{ subjectType: 'area', subjectId: 'area1' }],
    })
    expect(result.overridden).toBe(true)
    // dept2 has no area — an area1 grant never reaches it.
    expect([...result.deptSet]).toEqual(['dept1'])
    expect([...result.personSet]).toEqual(['priya'])
  })

  test('a department-tier SOP-target grant overrides that department only — role-tier grants never widen the department (ancestors-only inheritance)', () => {
    const deptTarget = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit,
      collectionPersonGrants: [],
      sopCollectionIds,
      sopTargetGrants: [{ subjectType: 'department', subjectId: 'dept1' }],
    })
    expect(deptTarget.overridden).toBe(true)
    expect([...deptTarget.deptSet]).toEqual(['dept1'])
    expect([...deptTarget.personSet]).toEqual(['priya'])

    const roleTarget = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit,
      collectionPersonGrants: [],
      sopCollectionIds,
      sopTargetGrants: [{ subjectType: 'role', subjectId: 'role1' }],
    })
    expect(roleTarget.overridden).toBe(true)
    // Role is a descendant of department, not an ancestor — a role-level
    // grant fans out to its own members only, never widens sop_departments.
    expect(roleTarget.deptSet.size).toBe(0)
    expect([...roleTarget.personSet]).toEqual(['priya'])
  })

  test('collection-target person grants never widen sop_departments (D-13, the Priya scenario carries over verbatim for the non-overridden path)', () => {
    const result = resolveSopAccess({
      orgId: ORG_ID,
      depts,
      roles,
      membersByRole,
      collectionGrantsByUnit: {},
      collectionPersonGrants: [{ subjectId: 'dave', collectionId: 'colA' }],
      sopCollectionIds,
      sopTargetGrants: [],
    })
    expect(result.overridden).toBe(false)
    expect(result.deptSet.size).toBe(0)
    expect([...result.personSet]).toEqual(['dave'])
  })
})
