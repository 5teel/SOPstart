/**
 * The People board's authority marks (2026-10-11). `authorityOf()` mirrors the server gates for
 * display; these cases pin it to them (CAPABILITY-MATRIX.md: sign off completion, ask someone to
 * do a SOP, approval chains, publish, invite / change roles). Registration: `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { authorityLines, authorityOf } from '@/lib/members/authority'

const chains = [
  { category: 'safety', steps: [{ role: 'safety_manager' as const, label: 'Safety manager' }] },
  { category: 'maintenance', steps: [{ userId: 'u-admin', label: 'Named admin' }, { role: 'admin' as const, label: 'Any admin' }] },
]
const supervision = [
  { supervisor_id: 'u-sup', worker_id: 'w1' },
  { supervisor_id: 'u-sup', worker_id: 'w2' },
]

test.describe('authorityOf', () => {
  test('a worker signs off nothing, assigns nothing, approves nothing', () => {
    const a = authorityOf({ user_id: 'w1', role: 'worker' }, chains, supervision)
    expect(a).toEqual({ signOff: null, supervises: 0, assigns: false, approves: [], publishes: false, managesPeople: false })
    expect(authorityLines(a)).toEqual(['Follows SOPs and sends them for sign-off.'])
  })

  test('a supervisor signs off only their supervised workers and assigns', () => {
    const a = authorityOf({ user_id: 'u-sup', role: 'supervisor' }, chains, supervision)
    expect(a.signOff).toBe('supervised')
    expect(a.supervises).toBe(2)
    expect(a.assigns).toBe(true)
    expect(a.publishes).toBe(false)
    expect(authorityLines(authorityOf({ user_id: 'u-lone', role: 'supervisor' }, chains, supervision))[0]).toContain('no workers are linked')
  })

  test('approvals follow the chains by role or by person; admins publish, only an admin manages people', () => {
    const admin = authorityOf({ user_id: 'u-admin', role: 'admin' }, chains, supervision)
    expect(admin.approves).toEqual(['Maintenance'])
    expect(admin.signOff).toBe('any')
    expect(admin.managesPeople).toBe(true)
    const sm = authorityOf({ user_id: 'u-sm', role: 'safety_manager' }, chains, supervision)
    expect(sm.approves).toEqual(['Safety'])
    expect(sm.publishes).toBe(true)
    expect(sm.managesPeople).toBe(false)
  })

  test('the module reuses the server rules instead of restating them', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/members/authority.ts'), 'utf-8')
    expect(src).toContain('stepMatchesCaller(')
    expect(src).toContain('canAsk(')
  })

  test('the authority read is admin-guarded and org-scoped', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/actions/people.ts'), 'utf-8')
    expect(src.indexOf('requireAdminContext()')).toBeGreaterThan(-1)
    expect(src.match(/\.eq\('organisation_id', ctx\.organisationId\)/g)?.length).toBe(2)
    expect(src).not.toContain('createAdminClient')
  })

  test('linking a supervisor to a worker is admin only, org-scoped, and only a supervisor can be linked', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/actions/people.ts'), 'utf-8')
    const fn = src.slice(src.indexOf('export async function setSupervision'))
    expect(fn).toContain("ctx.role !== 'admin'")
    expect(fn).toContain("sup.role !== 'supervisor'")
    expect(fn.split(".eq('organisation_id', org)").length - 1).toBe(2)
    const tab = fs.readFileSync(path.join(process.cwd(), 'src/components/office/PeopleTab.tsx'), 'utf-8')
    expect(tab).toContain('data-testid="people-supervises-worker"')
    expect(tab).toContain('setSupervision({ supervisorId, workerId, linked })')
  })
})
