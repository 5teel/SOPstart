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

  test('review WR-05: the admin branch treats a zero-row sops update as failure, before the review event and the ledger', () => {
    const confirm = body(GOV, 'confirmSopCurrent')
    const update = confirm.indexOf("from('sops')\n      .update(")
    expect(update).toBeGreaterThan(-1)
    const chain = confirm.slice(update, update + 320)
    expect(chain).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(chain).toContain(".select('id')")
    const bail = confirm.indexOf("if (!updated?.length) return { error: 'SOP not found' }")
    expect(bail).toBeGreaterThan(update)
    expect(bail).toBeLessThan(confirm.indexOf("from('sop_review_events')"))
    expect(bail).toBeLessThan(confirm.indexOf('await recordDecision('))
  })

  test('getOrgMembers labels are emails or names, never "role (uuid8)"', () => {
    const picker = read('src/components/admin/governance/OwnerPicker.tsx')
    expect(picker).not.toMatch(/slice\(0, 8\)/)
    expect(read('src/actions/assignments.ts')).not.toMatch(/\$\{[^}]*role\}\s*\(/)
  })
})

test.describe('owner review meta -- surfaces', () => {
  const META = read('src/components/admin/governance/OwnerReviewMeta.tsx')
  const PICKER = read('src/components/admin/governance/OwnerPicker.tsx')

  test('the meta line reads "Owner · name · review due date"; no owner reads "No owner" in the warn tint; overdue in the escalate tint', () => {
    expect(META).toContain('data-testid="owner-review-meta"')
    expect(META).toContain("data-owner={ownerLabel ? 'set' : 'none'}")
    expect(META).toContain('data-review={review.state}')
    expect(META).toContain('Owner ·')
    expect(META).toContain('No owner')
    expect(META).toContain('bg-accent-decision/10')
    expect(META).toContain('text-accent-escalate')
    expect(META).toContain("from '@/lib/office/format'")
  })

  test('Manage SOPs drafts render the line', () => {
    const manage = read('src/components/home/sections/ManageSection.tsx')
    expect(manage).toContain('<OwnerReviewMeta ownerLabel={d.ownerLabel} reviewDueAt={d.reviewDueAt}')
  })

  test('OwnerPicker closes on onDone and on Escape', () => {
    expect(PICKER).not.toContain('router.refresh')
    expect(PICKER).not.toContain('next/navigation')
    expect(PICKER).toContain('onDone?.(')
    expect(PICKER).toMatch(/e\.key !== 'Escape'[\s\S]*e\.preventDefault\(\)/)
    expect(PICKER).toContain("addEventListener('keydown', onKey, true)")
    // the retired governance queue row used to refresh the router here; the Office row hands onDone to the pane (59-14)
    expect(read('src/components/office/InboxRow.tsx')).toMatch(/<OwnerPicker[\s\S]*?onDone=/)
  })
})

test.describe('owner review meta -- This SOP', () => {
  const BLOCK = read('src/components/focus/admin/ThisSopBlock.tsx')
  const PAGE = read('src/app/(protected)/sops/[sopId]/page.tsx')

  test('ThisSopBlock wires Mark reviewed to confirmSopCurrent(sopId) and the picker to onDone; receipts follow logged', () => {
    expect(BLOCK).toContain('confirmSopCurrent(sopId)')
    expect(BLOCK).toContain('onClick={() => void markReviewed()}')
    expect(BLOCK).toContain('<OwnerPicker')
    expect(BLOCK).toContain('onDone={(r) =>')
    expect(BLOCK).toContain('Marked reviewed · logged in the decision ledger')
    expect(BLOCK).toContain("didn't reach the decision ledger. Tell an admin.")
    expect(BLOCK).toContain('res.logged')
    expect(BLOCK).toContain('r.logged ?')
    expect(BLOCK).toContain('owner.canMarkReviewed')
  })

  test('the page computes the owner row from the session user, only for people who can edit', () => {
    expect(PAGE).toContain('canMarkReviewed: isAdminRole || ownerId === userId')
    expect(PAGE).toMatch(/editing \|\| isAdminRole\s*\?/)
    expect(PAGE).toContain('owner={owner}')
    expect(read('src/components/focus/FocusWalker.tsx')).toContain('canPublish: canEdit, owner }')
    expect(read('src/components/focus/FocusFrame.tsx')).toContain('owner={editor.owner ?? null}')
    expect(read('src/components/focus/admin/FocusEditor.tsx')).toContain('owner={owner}')
    expect(read('src/lib/sop/focus-read.ts')).toContain('owner_user_id, review_due_at, organisation_id')
  })
})

