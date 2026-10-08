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
const OFFICE = strip(read('src/actions/office.ts'))

test.describe('signoff actions', () => {
  test('signOffCompletion refuses the caller own completion (A-03)', () => {
    const refuse = SIGN_OFF.indexOf('You cannot sign off your own completion')
    expect(refuse).toBeGreaterThan(-1)
    expect(SIGN_OFF).toMatch(/completion\.worker_id === userId/)
    expect(refuse).toBeLessThan(SIGN_OFF.indexOf("from('completion_sign_offs')"))
    expect(refuse).toBeLessThan(SIGN_OFF.indexOf('isSignedOffAssessor('))
  })

  test('a walk that was already decided is refused, so a double submit writes one row (Pitfall 11)', () => {
    const refuse = SIGN_OFF.indexOf('This completion has already been decided.')
    expect(refuse).toBeGreaterThan(-1)
    expect(SIGN_OFF).toContain("completion.status !== 'pending_sign_off'")
    expect(refuse).toBeLessThan(SIGN_OFF.indexOf("from('completion_sign_offs')"))
    // review WR-01: the status is claimed conditionally, and zero rows stops the
    // write, before the sign-off row and the ledger row
    const claim = SIGN_OFF.indexOf('.update({ status: newStatus })')
    expect(claim).toBeGreaterThan(-1)
    expect(SIGN_OFF.slice(claim, claim + 240)).toContain(".eq('status', 'pending_sign_off')")
    expect(SIGN_OFF.slice(claim, claim + 240)).toContain(".select('id')")
    const bail = SIGN_OFF.indexOf('if (!claimed?.length)')
    expect(bail).toBeGreaterThan(claim)
    expect(bail).toBeLessThan(SIGN_OFF.indexOf("from('completion_sign_offs')"))
    expect(bail).toBeLessThan(SIGN_OFF.indexOf('await recordDecision('))
  })

  test('the counter-signature is still written after approval, on the server (A-08)', () => {
    const update = SIGN_OFF.indexOf('.update({ status: newStatus })')
    const sign = SIGN_OFF.indexOf("await recordSignature({ completionId, sopId: completion.sop_id, role: 'supervisor'")
    expect(update).toBeGreaterThan(-1)
    expect(sign).toBeGreaterThan(update)
    // only on an approval
    expect(SIGN_OFF.slice(update, sign)).toContain("decision === 'approved'")
    const client = read('src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx')
    expect(client).not.toContain('recordSignature')
  })

  test('review CR-01: recordSignature is not an endpoint -- the file exports exactly three actions', () => {
    expect(COMPLETIONS.match(/^export async function (\w+)/gm)?.sort()).toEqual([
      'export async function getPhotoUploadUrl',
      'export async function signOffCompletion',
      'export async function submitCompletion',
    ])
    expect(COMPLETIONS).toMatch(/\nasync function recordSignature\(/)
    expect(read('src/lib/validators/completions.ts')).not.toContain('RecordSignatureSchema')
  })

  test('signOffCompletion returns whether the ledger row was written', () => {
    expect(SIGN_OFF).toMatch(/const rec = await recordDecision\(/)
    expect(SIGN_OFF).toContain('logged = rec.ok')
    expect(SIGN_OFF).toContain('logged = countersigned.success && countersigned.logged')
    expect(SIGN_OFF).toContain('return { success: true, logged }')
  })

  test('review WR-02: one ledger row per decision -- reject here, the approval through its counter-signature', () => {
    expect(SIGN_OFF.match(/await recordDecision\(/g)?.length).toBe(1)
    const rec = SIGN_OFF.indexOf('await recordDecision(')
    expect(SIGN_OFF.lastIndexOf("if (decision === 'rejected')", rec)).toBeGreaterThan(-1)
    expect(SIGN_OFF.slice(rec, rec + 80)).toContain("kind: 'reject'")
    expect(SIGN_OFF).not.toContain("kind: decision === 'approved' ? 'sign_off'")
    const sig = COMPLETIONS.slice(COMPLETIONS.indexOf('async function recordSignature('))
    expect(sig.match(/await recordDecision\(/g)?.length).toBe(1)
    expect(sig).toContain("kind: role === 'supervisor' ? 'countersign' : 'sign_off'")
    expect(sig).toContain('details: { role, ...details }')
  })

  test('signOffCompletion keeps the assessor gate with the admin override reason (A-08)', () => {
    expect(SIGN_OFF).toContain('isSignedOffAssessor(')
    expect(SIGN_OFF).toContain('ASSESSOR_OVERRIDE_REQUIRED')
    expect(SIGN_OFF).toContain('NOT_SIGNED_OFF_ASSESSOR')
    expect(SIGN_OFF).toContain('Rejection reason must be at least 10 characters.')
    expect(SIGN_OFF).toContain('You are not assigned to supervise this worker.')
  })

  test('getCompletionForReview reads through the session client first, then signs storage paths (A-09)', () => {
    const b = body(OFFICE, 'getCompletionForReview')
    expect(b.indexOf(".from('sop_completions')")).toBeGreaterThan(-1)
    expect(b.indexOf(".from('sop_completions')")).toBeLessThan(b.indexOf('signCompletionPhotos('))
    expect(b).toContain(".eq('organisation_id', organisationId)")
    expect(OFFICE).not.toContain('createAdminClient')
    const review = read('src/lib/completions/review.ts')
    expect(review).not.toContain("'use server'")
    expect(review).not.toContain('server-only')
    expect(review).toContain('`${organisationId}/completions/`')
    expect(review.indexOf('startsWith(prefix)')).toBeLessThan(review.indexOf('createSignedUrl(p.storage_path, 3600)'))
    for (const name of ['signCompletionPhotos', 'orderedReviewSteps', 'assessorFor']) {
      expect(review).toContain(`export async function ${name}(`)
    }
    expect(review).toMatch(/isSignedOffAssessor\(userId, sopId, createAdminClient\(\), organisationId\)/)
  })
  test('getCompletionForReview refuses a non-visible completion and takes only a UUID completion id', () => {
    const b = body(OFFICE, 'getCompletionForReview')
    expect(b).toContain('completionIdSchema.safeParse(completionId)')
    expect(OFFICE).toContain('z.string().uuid()')
    expect(b).toContain("{ error: 'Completion not found' }")
    expect(b).toContain("role !== 'supervisor' && role !== 'safety_manager' && role !== 'admin'")
    // org, role and actor are the session's; no other parameter exists
    expect(b.split('\n')[0]).toMatch(/getCompletionForReview\(completionId: string\)/)
    expect(b).toContain('canOverride: role ===')
    expect(b).toContain('isAssessor')
  })
  test('the review reads exclude the caller own completion', () => {
    expect(body(OFFICE, 'getCompletionForReview')).toContain('row.worker_id === userId')
    expect(body(OFFICE, 'getCompletionForReview')).toContain("'You cannot sign off your own completion'")
    expect(strip(read('src/lib/governance/load-inbox.ts'))).toContain(".neq('worker_id', userId)")
  })
  test('rejected not done: the worker completion read skips rejected rows (A-06)', () => {
    const hook = strip(read('src/hooks/useWorkerSops.ts'))
    expect(hook).toContain(".neq('status', 'rejected')")
    // the filter sits in the queryFn, on the sop_completions read itself
    const q = hook.slice(hook.indexOf(".from('sop_completions')"), hook.indexOf(".from('sop_completions')") + 200)
    expect(q).toContain(".neq('status', 'rejected')")
  })

  test('review WR-04: the SOP focus page does not count a rejected walk as done (A-06)', () => {
    const page = strip(read('src/app/(protected)/sops/[sopId]/page.tsx'))
    const at = page.indexOf("from('sop_completions')")
    expect(at).toBeGreaterThan(-1)
    expect(page.slice(at, at + 160)).toContain(".neq('status', 'rejected')")
  })

  test('competency reads never count a rejected walk (A-06)', () => {
    const src = strip(read('src/actions/competency.ts'))
    const reads = src.match(/\.from\('sop_completions'\)/g) ?? []
    expect(reads.length).toBe(5)
    let at = src.indexOf(".from('sop_completions')")
    while (at !== -1) {
      expect(src.slice(at, at + 160), 'each completion read carries the filter').toContain(".neq('status', 'rejected')")
      at = src.indexOf(".from('sop_completions')", at + 1)
    }
  })
})
