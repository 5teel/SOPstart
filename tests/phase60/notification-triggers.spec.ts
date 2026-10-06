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
    // WR-01: the key carries the send-back count for this version, read under the session org
    expect(fn).toContain('const cycle = await sendBackCount(a.organisationId, a.sopId, a.version)')
    expect(fn).toContain('cycle, step: a.stepIndex')
    const counter = WRITE.slice(WRITE.indexOf('async function sendBackCount'), WRITE.indexOf('export async function signOffRecipients'))
    expect(counter).toContain(".from('sop_approvals')")
    expect(counter).toContain(".eq('organisation_id', organisationId)")
    expect(counter).toContain(".eq('action', 'changes_requested')")
    expect(fn).toContain('a.step.userId')
    expect(fn).toContain('membersWithRole(a.organisationId, a.step.role)')
    expect(fn).toContain('catch (err)')
  })

  test('scripts/verify-gate-check.tsx stubs the server-only notification module (A-11)', () => {
    const h = read('scripts/verify-gate-check.tsx')
    expect(h).toContain("request.includes('lib/notifications/write')")
    expect(h).toContain('notifyNextApprover')
  })

  test('submitCompletion notifies sign-off recipients after the signature, inside try/catch, deduped per completion', () => {
    const c = strip(read('src/actions/completions.ts'))
    const body = c.slice(c.indexOf('export async function submitCompletion'), c.indexOf('export async function signOffCompletion'))
    const sig = body.indexOf('await recordSignature(')
    const rec = body.indexOf('await signOffRecipients(organisationId, userId)')
    expect(sig).toBeGreaterThan(-1)
    expect(rec).toBeGreaterThan(sig)
    expect(body.slice(sig, rec)).toContain('try {')
    expect(body).toContain("dedupeKey({ kind: 'signoff', completionId: walk.id })")
    expect(body.indexOf('await notify(')).toBeGreaterThan(rec)
    expect(body.slice(body.indexOf('await notify('))).toContain('catch (err)')
  })

  test('signOffRecipients reads supervisors, falls back to admins and safety managers, and never returns the worker', () => {
    const fn = WRITE.slice(WRITE.indexOf('export async function signOffRecipients'), WRITE.indexOf('export async function membersWithRole'))
    expect(fn).toContain("from('supervisor_assignments')")
    expect(fn).toContain(".eq('organisation_id', organisationId)")
    expect(fn).toContain("membersWithRole(organisationId, 'admin')")
    expect(fn).toContain("membersWithRole(organisationId, 'safety_manager')")
    expect(fn).toContain('id !== workerId')
  })

  test('notifyAssignedWorkers writes through notify with the session org and no worker_notifications insert', () => {
    const v = strip(read('src/actions/versioning.ts'))
    const fn = v.slice(v.indexOf('export async function notifyAssignedWorkers'), v.indexOf('export async function markNotificationRead'))
    expect(fn).toContain('organisationId } = await getSessionContext()')
    expect(fn).toContain(".eq('organisation_id', organisationId)")
    expect(fn).not.toContain('newSop.organisation_id')
    expect(fn).not.toContain('worker_notifications')
    expect(fn).toContain("dedupeKey({ kind: 'new_version', sopId: newSopId })")
    expect(fn).toContain("notificationPlace('new_version', { sopId: newSopId })")
    // the notification comes before, and never blocks, the assignment repoint
    expect(fn.indexOf('await notify(')).toBeLessThan(fn.indexOf(".from('sop_assignments')\n    .update"))
    // the assessment-request panel's own table is untouched
    expect(v).toContain(".from('worker_notifications')")
  })
})
