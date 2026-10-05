/**
 * Phase 59 -- capability matrix (stub; Wave 0 / 59-01). Decision D-03.
 * Every plan that changes a gate edits .planning/codebase/CAPABILITY-MATRIX.md in the same commit
 * and flips its case here. Do not rename the rows "Governance queue", "Approval chains",
 * "Manage team" or "Sign off completion" (tests/phase46/capability-matrix-doc.spec.ts pins them);
 * edit their cells. Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MATRIX = fs.readFileSync(path.resolve(__dirname, '..', '..', '.planning', 'codebase', 'CAPABILITY-MATRIX.md'), 'utf-8')
const row = (label: string) => MATRIX.split(/\r?\n/).find((l) => l.startsWith(`| ${label} |`)) ?? ''

test.describe('capability matrix', () => {
  test('Office inbox row: admin and safety manager see all, supervisor sees own sign-offs (59-04)', () => {
    const cells = row('Governance queue').split('|').map((c) => c.trim())
    // | label | worker | supervisor | admin | safety_manager | chain approver | enforced at |
    expect(cells.slice(2, 6)).toEqual(['—', '✅', '✅', '✅'])
    for (const name of ['getOfficeInbox()', 'listPendingSignOffs()', 'listMyReviewRows()', 'src/actions/office.ts']) {
      expect(row('Governance queue')).toContain(name)
    }
  })
  test('Manage team row: invite is admin-only, role change guarded, removal logged (59-05)', () => {
    const r = row('Manage team')
    const cells = r.split('|').map((c) => c.trim())
    expect(cells[4]).toBe('✅')
    expect(cells[5]).toContain('⚠')
    for (const name of ['inviteWorker()', 'updateMemberRoleSafe()', 'removeMember()', 'deleteOrgMember()', 'src/lib/members/remove.ts', 'cannot invite', 'member_removed']) {
      expect(r).toContain(name)
    }
  })
  test.fixme('Sign off completion row: self sign-off refused, supervisor scoped to assigned workers (59-06)', () => {})
  test.fixme('Approve step row: the drifted supervisor cell is corrected to admin and safety manager (59-06)', () => {})
  test.fixme('Mark reviewed row: owner or admin (59-07)', () => {})
  test.fixme('Decisions tab row: admin and safety manager only (59-10)', () => {})
  test.fixme('legacy addresses row: the governance, team and access addresses redirect (59-13)', () => {})
  test.fixme('Activity row: a non-owner completion address redirects to the Office (59-15)', () => {})
})
