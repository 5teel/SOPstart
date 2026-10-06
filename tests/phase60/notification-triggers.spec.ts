/**
 * Phase 60 -- Notification writers (stub; Wave 0 / 60-01).
 * Requirements: NTF-02. Decisions: D-08, A-11. Owning plan: 60-07.
 * Each case below is a test.fixme the owning plan turns live with real assertions.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

const WRITE = strip(read('src/lib/notifications/write.ts'))
const PUBLISH = strip(read('src/app/api/sops/[sopId]/publish/route.ts'))
const APPROVALS = strip(read('src/actions/approvals.ts'))
const approve = APPROVALS.slice(APPROVALS.indexOf('export async function approveStep'), APPROVALS.indexOf('export async function requestChanges'))

test.describe('Notification writers (60-07)', () => {
  test('a fresh pending divert notifies step one after the divert write, inside try/catch', () => {
    const divert = PUBLISH.indexOf("approval_state: 'pending'")
    const call = PUBLISH.indexOf('await notifyNextApprover(')
    expect(call).toBeGreaterThan(divert)
    // the already-pending early return sits before the notify call
    expect(PUBLISH.lastIndexOf('alreadyPending: true', call)).toBeGreaterThan(divert)
    expect(PUBLISH.lastIndexOf('try {', call)).toBeGreaterThan(PUBLISH.lastIndexOf('alreadyPending: true', call))
    expect(PUBLISH).toContain('stepIndex: 0')
    expect(PUBLISH).toContain('organisationId,')
  })

  test('approveStep notifies the next step only after the ledger row, for a fresh non-final approval', () => {
    const rec = approve.indexOf('await recordDecision(')
    const call = approve.indexOf('await notifyNextApprover(')
    expect(rec).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(rec)
    expect(approve.slice(rec, call)).toContain('if (nextIndex < steps.length - 1)')
    expect(approve.slice(call - 200, call)).toContain('try {')
    expect(approve).toContain('stepIndex: nextIndex + 1')
    expect(approve).toContain('organisationId: ctx.organisationId')
    expect(approve.indexOf('await notifyNextApprover(')).toBeLessThan(approve.indexOf('await performPublish('))
  })

  test('notifyNextApprover drops the actor, dedupes per sop, version and step, and never throws', () => {
    const fn = WRITE.slice(WRITE.indexOf('export async function notifyNextApprover'), WRITE.indexOf('export async function membersWithRole'))
    expect(fn).toContain('id !== a.actorId')
    expect(fn).toContain("dedupeKey({ kind: 'approve_next'")
    expect(fn).toContain('a.step.userId')
    expect(fn).toContain('membersWithRole(a.organisationId, a.step.role)')
    expect(fn).toContain('catch (err)')
  })

  test('scripts/verify-gate-check.tsx stubs the server-only notification module (A-11)', () => {
    const h = read('scripts/verify-gate-check.tsx')
    expect(h).toContain("request.includes('lib/notifications/write')")
    expect(h).toContain('notifyNextApprover')
  })

  test.fixme('submitCompletion notifies the worker\'s supervisors, or admins and safety managers, after the signature (Task 2)', () => {})
  test.fixme('notifyAssignedWorkers writes through notify with the session org (Task 2)', () => {})
})
