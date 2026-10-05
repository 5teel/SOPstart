/**
 * Phase 59 -- owner and review meta (OFF-04; decisions D-08, A-01). Source-contract cases.
 * Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf-8')
const GOV = read('src/actions/governance.ts')
const OWNER = read('src/lib/governance/owner-review.ts')
const body = (src: string, name: string) => {
  const a = src.indexOf(`export async function ${name}(`)
  const b = src.indexOf('\nexport ', a + 10)
  return src.slice(a, b === -1 ? undefined : b)
}

test.describe('owner review meta -- server', () => {
  test('confirmSopCurrent has an owner path: plain module, session org + user, owner re-checked server-side (A-01)', () => {
    const confirm = body(GOV, 'confirmSopCurrent')
    expect(confirm).toContain('markReviewedAsOwner({ sopId, organisationId: s.organisationId, userId: s.userId })')
    expect(confirm).not.toContain('createAdminClient')
    expect(confirm).toContain("Only the owner or an admin can mark this reviewed.")
    expect(GOV).toContain("from '@/lib/governance/owner-review'")
    // the module re-checks ownership and scopes every service-role call to the session org
    expect(OWNER).toContain('export async function markReviewedAsOwner')
    expect(OWNER).toContain('Only the owner or an admin can mark this reviewed.')
    expect(OWNER).not.toMatch(/^'use server'/m)
    const owned = (OWNER.match(/\.eq\('owner_user_id', userId\)/g) ?? []).length
    expect(owned).toBeGreaterThanOrEqual(2) // the read and the write
    expect((OWNER.match(/\.eq\('organisation_id', organisationId\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(OWNER).toContain('organisation_id: organisationId')
    expect(OWNER).toContain('last_reviewed_by: userId')
    expect(OWNER).toContain('reviewed_by: userId')
    expect(OWNER).toContain(".select('id')")
    expect(OWNER).not.toMatch(/row\.organisation_id|sop\.organisation_id/)
  })

  test('both owner actions record the decision after the write and say whether it was logged', () => {
    const confirm = body(GOV, 'confirmSopCurrent')
    expect(confirm.indexOf('markReviewedAsOwner(')).toBeLessThan(confirm.indexOf("recordDecision({\n    kind: 'review'"))
    expect(confirm).toContain('const rec = await recordDecision({')
    expect(confirm).toContain('logged: rec.ok')
    const owner = body(GOV, 'setSopOwner')
    expect(owner).toContain('const rec = await recordDecision({')
    expect(owner).toContain('success: true, logged: rec.ok')
    expect(confirm).toMatch(/confirmSopCurrent\(\s*sopId: string,\s*\)/)
  })

  test('getOrgMembers labels are emails or names, never "role (uuid8)"', () => {
    const picker = read('src/components/admin/governance/OwnerPicker.tsx')
    expect(picker).not.toMatch(/slice\(0, 8\)/)
    expect(read('src/actions/assignments.ts')).not.toMatch(/\$\{[^}]*role\}\s*\(/)
  })
})

test.describe('owner review meta -- surfaces', () => {
  test.fixme(true, 'flips live in task 2 and 3')
  test('the meta line reads "Owner · name · review due date"; no owner reads "No owner" in the warn tint; overdue in the escalate tint', () => {})
  test('AdminSopRows and Workshop drafts render the line', () => {})
  test('OwnerPicker closes on onDone and on Escape', () => {})
})
