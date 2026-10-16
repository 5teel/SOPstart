/**
 * ADR-0021 -- the job-role actions. Source contract (the live writes are covered by the deployed
 * People chart eval): guarded first, org from the session on every write, zero rows is a failure,
 * the service role only for role_members after both sides are checked, access re-materialised when
 * a role or seat goes, and every change logged.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const SRC = fs.readFileSync('src/actions/org-model.ts', 'utf8').replace(/\r\n/g, '\n')
const body = (name: string) => {
  const start = SRC.indexOf(`export async function ${name}(`)
  const next = SRC.indexOf('\nexport async function ', start + 1)
  return SRC.slice(start, next < 0 ? undefined : next)
}

test.describe('job roles (ADR-0021)', () => {
  for (const name of ['createRole', 'updateRole', 'removeRole', 'setRoleSeat']) {
    test(`${name}: guard first, org from the session, logged`, () => {
      const b = body(name)
      expect(b.indexOf('requireAdmin()')).toBeGreaterThan(0)
      expect(b.indexOf('requireAdmin()')).toBeLessThan(b.indexOf('.from('))
      expect(b).toMatch(/\.eq\('organisation_id', (orgId|ctx\.organisationId)\)/)
      expect(b).toContain('recordDecision(')
    })
  }

  test('update and remove treat zero rows as not found', () => {
    for (const name of ['updateRole', 'removeRole']) expect(body(name)).toContain('data.length === 0')
  })

  test('removing a role or a seat re-materialises access', () => {
    expect(body('removeRole')).toContain('materializeOrgAccess()')
    expect(body('setRoleSeat')).toContain('materializeOrgAccess()')
  })

  test('a job role never touches the access level or department membership', () => {
    for (const name of ['createRole', 'updateRole', 'removeRole', 'setRoleSeat']) {
      expect(body(name)).not.toContain("from('member_departments')")
      expect(body(name)).not.toMatch(/organisation_members'\)\s*\.(update|upsert|insert|delete)/)
    }
  })
})
