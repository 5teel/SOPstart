import { test, expect } from '@playwright/test'
import { resolveEffectiveAccess } from '@/lib/org-model/resolve-access'
import type { ChainLink } from '@/types/org-model'

// Shared 5-level chain fixture: org1 -> area1 -> dept1 -> role1 -> priya
const orgLink: ChainLink = { unitId: 'org1', subjectType: 'org' }
const areaLink: ChainLink = { unitId: 'area1', subjectType: 'area' }
const deptLink: ChainLink = { unitId: 'dept1', subjectType: 'department' }
const roleLink: ChainLink = { unitId: 'role1', subjectType: 'role' }
const personLink: ChainLink = { unitId: 'priya', subjectType: 'person' }

test.describe('resolveEffectiveAccess — 5-level union resolver (org -> area -> department -> role -> person)', () => {
  test('grant on org subject: every descendant unit inherits it, labelled inherited-via org', () => {
    const grants = { org1: ['safety'] }

    const deptAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink], grants)
    expect(deptAccess.direct.size).toBe(0)
    expect(deptAccess.inherited).toEqual({ safety: 'org1' })

    const roleAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink, roleLink], grants)
    expect(roleAccess.inherited).toEqual({ safety: 'org1' })

    const personAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink, roleLink, personLink], grants)
    expect(personAccess.inherited).toEqual({ safety: 'org1' })
    expect(personAccess.personal.size).toBe(0)
  })

  test('grant on a department: that department has it direct; its roles + people inherit it labelled via that department', () => {
    const grants = { dept1: ['chemical'] }

    const deptAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink], grants)
    expect(deptAccess.direct.has('chemical')).toBe(true)
    expect(deptAccess.inherited).toEqual({})

    const roleAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink, roleLink], grants)
    expect(roleAccess.direct.size).toBe(0)
    expect(roleAccess.inherited).toEqual({ chemical: 'dept1' })

    const personAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink, roleLink, personLink], grants)
    expect(personAccess.inherited).toEqual({ chemical: 'dept1' })
  })

  test('personal grant on a person the department does NOT otherwise have: resolves personal, department unaffected (the Priya scenario)', () => {
    const grants = { priya: ['chemical'] }

    const personAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink, roleLink, personLink], grants)
    expect(personAccess.personal.has('chemical')).toBe(true)
    expect(personAccess.direct.size).toBe(0)
    expect(personAccess.inherited).toEqual({})

    // The department's own effective access is computed independently and is untouched.
    const deptAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink], grants)
    expect(deptAccess.direct.size).toBe(0)
    expect(deptAccess.inherited).toEqual({})
  })

  test('effective access = union over the ancestor chain; direct beats inherited beats absent', () => {
    const grants = { org1: ['safety', 'hazmat'], dept1: ['safety'] }

    const deptAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink], grants)
    // 'safety' is direct on dept1 AND granted at org1 — direct wins, not duplicated into inherited.
    expect(deptAccess.direct.has('safety')).toBe(true)
    expect(deptAccess.inherited).toEqual({ hazmat: 'org1' })

    // 'quality' granted nowhere in the chain -> absent from every bucket.
    expect(deptAccess.direct.has('quality')).toBe(false)
    expect(deptAccess.inherited.quality).toBeUndefined()
    expect(deptAccess.personal.has('quality')).toBe(false)
  })

  test('same collection granted at two ancestors: resolves once, source = nearest ancestor', () => {
    const grants = { org1: ['safety'], area1: ['safety'] }

    const deptAccess = resolveEffectiveAccess([orgLink, areaLink, deptLink], grants)
    expect(Object.keys(deptAccess.inherited)).toEqual(['safety'])
    expect(deptAccess.inherited.safety).toBe('area1') // nearest ancestor, not 'org1'
  })

  test('empty chain returns empty effective access', () => {
    const access = resolveEffectiveAccess([], {})
    expect(access.direct.size).toBe(0)
    expect(access.personal.size).toBe(0)
    expect(access.inherited).toEqual({})
  })
})
