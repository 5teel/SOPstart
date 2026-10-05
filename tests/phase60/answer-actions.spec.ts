/**
 * Phase 60 -- Answer a request.
 * Requirements: RQS-02. Decisions: D-03, D-04, D-07. Owning plan: 60-04.
 * Wiring and call ORDER on comment-stripped source (CLAUDE.md 2026-06-05).
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf-8').replace(/\r\n/g, '\n')
const strip = (src: string) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')

const ACTIONS = strip(read('src/actions/requests.ts'))
const start = ACTIONS.indexOf('export async function answerRequest')
const ANSWER = ACTIONS.slice(start, ACTIONS.indexOf('export async function listMyRequests'))

test.describe('Answer a request (60-04)', () => {
  test('answerRequest claims the row before any ledger or notification write', () => {
    const claim = ANSWER.indexOf('await claimOpenRequest(organisationId, requestId')
    expect(claim).toBeGreaterThan(-1)
    expect(ANSWER.indexOf('await recordDecision(')).toBeGreaterThan(claim)
    expect(ANSWER.indexOf('await notify(')).toBeGreaterThan(ANSWER.indexOf('await recordDecision('))
    const core = strip(read('src/lib/requests/core.ts'))
    expect(core.slice(core.indexOf('export async function claimOpenRequest'))).toContain(".eq('state', 'open')")
  })

  test('exactly one recordDecision follows the claim, with one kind per answer', () => {
    expect(ANSWER.match(/recordDecision\(/g)?.length).toBe(1)
    expect(ANSWER).toContain("answer === 'accept' ? 'request_accepted' : 'request_declined'")
    expect(ANSWER).toContain("subject: { kind: 'request', id: claimed.id }")
    expect(ANSWER).not.toMatch(/email/i) // ledger details never carry an email (T-60-19)
  })

  test('workers are refused before anything is written', () => {
    const guard = ANSWER.indexOf('canAnswerRequests(role)')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(ANSWER.indexOf('claimOpenRequest('))
  })

  test('a decline needs a note of at least 10 characters, checked before the claim', () => {
    const rule = ANSWER.indexOf('declineNoteRule(')
    expect(rule).toBeGreaterThan(-1)
    expect(rule).toBeLessThan(ANSWER.indexOf('claimOpenRequest('))
    const model = strip(read('src/lib/requests/model.ts'))
    expect(model).toContain('export const MIN_NOTE = 10')
    expect(model).toMatch(/declineNoteRule[\s\S]*solid\(note\) < MIN_NOTE/)
  })

  test('the result says logged only from the ledger result', () => {
    expect(ANSWER).toContain('logged: result.ok')
  })

  test('a second answer is refused with no ledger row', () => {
    const claim = ANSWER.indexOf('await claimOpenRequest(')
    const refused = ANSWER.indexOf("return { error: 'Someone already answered this.' }")
    expect(refused).toBeGreaterThan(claim)
    expect(refused).toBeLessThan(ANSWER.indexOf('await recordDecision('))
  })

  test('accepting does nothing else: no fork, no edit, no observation row', () => {
    expect(ANSWER).not.toMatch(/forkDraft|sop_observations|\.from\(/)
  })

  test('the asker is told once, only when a person raised it, with a safe place and a dedupe key', () => {
    expect(ANSWER).toContain('if (claimed.raised_by_user)')
    expect(ANSWER).toContain("notificationPlace('request_answered')")
    expect(ANSWER).toContain("dedupeKey({ kind: 'request_answered', requestId: claimed.id })")
  })

  test.fixme('a supervisor change_sop receipt links to browse, not edit (60-11)', () => {})
})
