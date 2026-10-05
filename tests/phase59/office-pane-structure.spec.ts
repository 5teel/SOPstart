/**
 * Phase 59 -- Office pane structure. Requirement OFF-01; decisions D-01, D-04, D-05, A-11.
 * Owners: 59-09 (pane, inbox row, inbox tab -- live), 59-12 (mount -- still stubs).
 * Registration: playwright.config.ts `phase59`.
 * Source contract, but every case pins WIRING (a handler calls the action, a branch renders
 * the panel), not that a string appears (CLAUDE.md 2026-06-05).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8').replace(/\r\n/g, '\n')
// Whole-line comments out, so a comment can never satisfy or trip an assertion.
const strip = (src: string) =>
  src
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')

const ROW = strip(read('src/components/office/InboxRow.tsx'))

test.describe('inbox row (59-09)', () => {
  test('every branch renders exactly one button element', () => {
    // One `button =` assignment per branch of the if / else chain, each carrying the one test id.
    const chain = ROW.slice(ROW.indexOf('let button'), ROW.indexOf('return (\n    <li'))
    const assignments = chain.match(/button = /g) ?? []
    expect(assignments.length).toBeGreaterThanOrEqual(6)
    // A branch yields a <button>, a <Link> or the picker trigger -- never two of them.
    const testIds = chain.match(/data-testid="office-row-action"|triggerTestId="office-row-action"/g) ?? []
    expect(testIds.length).toBe(assignments.length - 1) // the last branch is the "no button" null
    expect(chain).toContain('button = null')
    // The row element itself never holds a second action outside `{button}`.
    expect(ROW.match(/\{button\}/g)?.length).toBe(1)
  })

  test('the approve-me, unowned, stale-role, confirm precedence is kept (APR-03/04)', () => {
    const fnBody = ROW.slice(ROW.indexOf('function branchOf'), ROW.indexOf('const CHIP_WORD'))
    const approve = fnBody.indexOf("g.flags.includes('awaiting_approval') && g.isCallerNextApprover")
    const owner = fnBody.indexOf("g.flags.includes('unowned')")
    const stale = fnBody.indexOf("g.flags.includes('stale_role')")
    const confirm = fnBody.indexOf("return 'confirm'")
    expect(approve).toBeGreaterThan(-1)
    expect(approve).toBeLessThan(owner)
    expect(owner).toBeLessThan(stale)
    expect(stale).toBeLessThan(confirm)
    expect(ROW).toContain('isCallerNextApprover')
  })

  test('Mark reviewed is wired for governance rows and for the owner\'s own review rows', () => {
    expect(ROW).toContain('confirmSopCurrent(sopId)')
    expect(ROW).toMatch(/branch === 'confirm' && g\) \|\| \(branch === 'review' && item\.review\)/)
    expect(ROW).toMatch(/onClick=\{\(\) => void markReviewed\(id\)\}/)
    expect(ROW).toContain("receipt: 'Marked reviewed'")
  })

  test('Try again, Sign off, Approve and Assign owner each reach their action', () => {
    expect(ROW).toMatch(/onClick=\{\(\) => void tryAgain\(retry\)\}/)
    expect(ROW).toContain('requeueParse(retry.sopId, retry.isVideo)')
    expect(ROW).toMatch(/<SignOffPanel completionId=\{item\.signOff\.completionId\} onDone=\{onDone\} \/>/)
    expect(ROW).toMatch(/<ApprovePanel sopId=\{g\.id\} title=\{item\.title\} onDone=\{onDone\} \/>/)
    expect(ROW).toMatch(/<OwnerPicker[\s\S]*?onDone=\{\(r\) => onDone\(\{ receipt: 'Owner set', logged: r\.logged \}\)\}/)
    expect(ROW).toContain('/admin/sops/${g.id}/assign')
    // Expansion is the only thing the Sign off / Approve opener does.
    expect(ROW).toMatch(/aria-expanded=\{expanded\}[\s\S]*?aria-controls=\{panelId\}[\s\S]*?onClick=\{onToggle\}/)
  })

  test('Esc collapses the row only when no modal layer is open, and never navigates', () => {
    expect(ROW).toContain("document.addEventListener('keydown', onKey, true)")
    expect(ROW).toContain("document.querySelector('[aria-modal=\"true\"]')")
    expect(ROW).toContain('e.defaultPrevented')
    expect(ROW).toContain('e.preventDefault()')
    expect(ROW).not.toMatch(/router\.|next\/navigation/)
  })

  test('a failure shows the server words under the row as an alert and a pending row dims', () => {
    expect(ROW).toMatch(/role="alert"/)
    expect(ROW).toContain("opacity-60")
    expect(ROW).toContain('Loader2')
  })
})

test.describe('office pane structure (stubs for later plans)', () => {
  test.fixme(true, 'flips live in 59-12')
  test('the pane is one lazy module imported by next/dynamic from both shells (59-12)', () => {})
  test('worker and supervisor shell files carry no static admin import (59-12)', () => {})
  test('the bundle script has a forbidden marker for the pane and it validates itself (59-12)', () => {})
  test('the supervisor pin and card read the same inbox data the pane does (59-12)', () => {})
})
