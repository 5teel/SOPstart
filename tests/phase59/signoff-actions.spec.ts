/**
 * Phase 59 -- sign-off server. Requirement OFF-02; decisions D-06, A-03, A-06, A-08, A-09.
 * Owner: 59-06. Source-contract guards over comment-stripped source (CLAUDE.md 2026-09-28).
 * Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) =>
  src
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
    .join('\n')

function body(src: string, name: string): string {
  const m = new RegExp(`export async function ${name}\\b`).exec(src)
  if (!m) return ''
  const rest = src.slice(m.index + 1)
  const next = rest.search(/\nexport /)
  return next === -1 ? src.slice(m.index) : src.slice(m.index, m.index + 1 + next)
}

const COMPLETIONS = strip(read('src/actions/completions.ts'))
const SIGN_OFF = body(COMPLETIONS, 'signOffCompletion')

test.describe('signoff actions', () => {
  test('signOffCompletion refuses the caller own walk (A-03)', () => {
    const refuse = SIGN_OFF.indexOf('You cannot sign off your own walk')
    expect(refuse).toBeGreaterThan(-1)
    expect(SIGN_OFF).toMatch(/completion\.worker_id === userId/)
    expect(refuse).toBeLessThan(SIGN_OFF.indexOf("from('completion_sign_offs')"))
    expect(refuse).toBeLessThan(SIGN_OFF.indexOf('isSignedOffAssessor('))
  })

  test('a walk that was already decided is refused, so a double submit writes one row (Pitfall 11)', () => {
    const refuse = SIGN_OFF.indexOf('This walk has already been decided.')
    expect(refuse).toBeGreaterThan(-1)
    expect(SIGN_OFF).toContain("completion.status !== 'pending_sign_off'")
    expect(refuse).toBeLessThan(SIGN_OFF.indexOf("from('completion_sign_offs')"))
  })

  test('the counter-signature is still written after approval, on the server (A-08)', () => {
    const update = SIGN_OFF.indexOf('.update({ status: newStatus })')
    const sign = SIGN_OFF.indexOf("await recordSignature({ completionId, role: 'supervisor' })")
    expect(update).toBeGreaterThan(-1)
    expect(sign).toBeGreaterThan(update)
    // only on an approval
    expect(SIGN_OFF.slice(update, sign)).toContain("decision === 'approved'")
    const client = read('src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx')
    expect(client).not.toContain('recordSignature')
  })

  test('signOffCompletion returns whether the ledger row was written', () => {
    expect(SIGN_OFF).toMatch(/const rec = await recordDecision\(/)
    expect(SIGN_OFF).toContain('logged: rec.ok')
  })

  test('signOffCompletion keeps the assessor gate with the admin override reason (A-08)', () => {
    expect(SIGN_OFF).toContain('isSignedOffAssessor(')
    expect(SIGN_OFF).toContain('ASSESSOR_OVERRIDE_REQUIRED')
    expect(SIGN_OFF).toContain('NOT_SIGNED_OFF_ASSESSOR')
    expect(SIGN_OFF).toContain('Rejection reason must be at least 10 characters.')
    expect(SIGN_OFF).toContain('You are not assigned to supervise this worker.')
  })

  test.fixme('getCompletionForReview reads through the session client first, then signs storage paths (A-09)', () => {})
  test.fixme('getCompletionForReview refuses a non-visible completion and takes only a UUID completion id', () => {})
  test.fixme('the review reads exclude the caller own walk', () => {})
  test.fixme('rejected not done: the worker completion read skips rejected rows (A-06)', () => {})
})
