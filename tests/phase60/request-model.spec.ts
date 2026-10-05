/**
 * Phase 60 -- Request model. Requirements RQS-01, RQS-02, RQS-03; decisions D-01, D-03, A-03.
 * Owner: 60-03. Registration: playwright.config.ts `phase60`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  REQUEST_KINDS,
  REQUEST_STATES,
  RAISABLE_KINDS,
  REQUEST_KIND_WORDS,
  REQUEST_STATE_WORDS,
  ROLE_PLURAL,
  canAnswerRequests,
  canAsk,
  noteRule,
  declineNoteRule,
  subjectTypesFor,
  officePinCount,
  groupMyRequests,
  type MyRequest,
} from '@/lib/requests/model'

const NOW = new Date('2026-10-06T03:00:00Z')
const DAY = 86_400_000
const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString()

let n = 0
const req = (over: Partial<MyRequest>): MyRequest => ({
  id: `r${++n}`,
  kind: 'change_sop',
  state: 'open',
  subject: { type: 'sop', id: null, title: 'Press 3' },
  note: '',
  answerNote: null,
  answeredByLabel: null,
  targetLabel: null,
  targetRole: null,
  targetUserId: null,
  raisedByMe: true,
  agent: null,
  createdAt: iso(1),
  decidedAt: null,
  ...over,
})

test.describe('Request model (60-03)', () => {
  test('kinds and states are closed lists with words, and the raisable kinds exclude do_sop', () => {
    expect([...REQUEST_KINDS]).toEqual(['change_sop', 'new_sop', 'observe_me', 'do_sop'])
    expect([...RAISABLE_KINDS]).toEqual(['change_sop', 'new_sop', 'observe_me'])
    expect([...REQUEST_STATES]).toEqual(['open', 'accepted', 'declined', 'withdrawn'])
    for (const k of REQUEST_KINDS) expect(REQUEST_KIND_WORDS[k]).toBeTruthy()
    for (const s of REQUEST_STATES) expect(REQUEST_STATE_WORDS[s]).toBeTruthy()
    expect(REQUEST_KIND_WORDS.change_sop).toBe('Change a SOP')
    expect(REQUEST_KIND_WORDS.new_sop).toBe('New SOP')
    expect(REQUEST_KIND_WORDS.observe_me).toBe('Observe me')
    expect(ROLE_PLURAL).toEqual({
      worker: 'Workers',
      supervisor: 'Supervisors',
      admin: 'SOP Admins',
      safety_manager: 'Safety Managers',
    })
  })

  test('canAnswerRequests and canAsk: admin, safety manager and supervisor only', () => {
    for (const f of [canAnswerRequests, canAsk]) {
      for (const r of ['admin', 'safety_manager', 'supervisor']) expect(f(r)).toBe(true)
      for (const r of ['worker', null, undefined, 'x']) expect(f(r as string | null)).toBe(false)
    }
  })

  test('subjectTypesFor: new SOP is a machine or the site; everything else is a SOP', () => {
    expect([...subjectTypesFor('new_sop')]).toEqual(['machine', 'site'])
    for (const k of ['change_sop', 'observe_me', 'do_sop'] as const) expect([...subjectTypesFor(k)]).toEqual(['sop'])
  })

  test('noteRule: change and new need 10 non-space characters, observe may be empty, all cap at 500', () => {
    expect(noteRule('change_sop', 'short')).not.toBeNull()
    expect(noteRule('new_sop', '   a  b  c  d  e  ')).not.toBeNull() // 5 solid characters
    expect(noteRule('change_sop', 'abcdefghij')).toBeNull()
    expect(noteRule('change_sop', 'a b c d e f g h i j')).toBeNull()
    expect(noteRule('observe_me', '')).toBeNull()
    expect(noteRule('observe_me', 'x'.repeat(500))).toBeNull()
    for (const k of REQUEST_KINDS) expect(noteRule(k, 'x'.repeat(501))).not.toBeNull()
  })

  test('a decline note under 10 characters is refused', () => {
    expect(declineNoteRule('too short')).not.toBeNull()
    expect(declineNoteRule('   ')).not.toBeNull()
    expect(declineNoteRule('Fixing it in v5.')).toBeNull()
    expect(declineNoteRule('x'.repeat(501))).not.toBeNull()
  })

  test('officePinCount is inbox rows plus open requests', () => {
    expect(officePinCount([1, 2], [3])).toBe(3)
    expect(officePinCount([], [])).toBe(0)
  })

  test('groupMyRequests: asked of you is a person-targeted do_sop in the last 14 days, newest first, max 3', () => {
    const mine = (id: string, over: Partial<MyRequest>) =>
      req({ id, kind: 'do_sop', state: 'accepted', raisedByMe: false, targetUserId: ME, ...over })
    const rows = [
      mine('a', { createdAt: iso(5) }),
      mine('b', { createdAt: iso(1) }),
      mine('c', { createdAt: iso(3) }),
      mine('d', { createdAt: iso(2) }),
      mine('old', { createdAt: iso(15) }),
      mine('role', { targetUserId: null, targetRole: 'worker' }),
      mine('other', { targetUserId: OTHER }),
      mine('declined', { state: 'declined' }),
    ]
    expect(groupMyRequests(rows, ME, NOW).askedOfYou.map((r) => r.id)).toEqual(['b', 'd', 'c'])
  })

  test('groupMyRequests: you asked holds open requests and live asks, newest first, with a total', () => {
    const rows = [
      req({ id: 'o1', createdAt: iso(2) }),
      req({ id: 'ask', kind: 'do_sop', state: 'accepted', createdAt: iso(1) }),
      req({ id: 'o2', createdAt: iso(4) }),
      req({ id: 'acc', state: 'accepted' }), // answered, not still open
      req({ id: 'notmine', raisedByMe: false }),
      ...[10, 11, 12, 13].map((d) => req({ id: `x${d}`, createdAt: iso(d) })),
    ]
    const g = groupMyRequests(rows, ME, NOW)
    expect(g.youAsked.map((r) => r.id)).toEqual(['ask', 'o1', 'o2', 'x10', 'x11'])
    expect(g.youAskedTotal).toBe(7)
    expect(groupMyRequests(rows, ME, NOW, Infinity).youAsked).toHaveLength(7)
  })

  test('groupMyRequests: answered holds declined, withdrawn and non-ask accepted, newest decision first, max 3', () => {
    const rows = [
      req({ id: 'd1', state: 'declined', decidedAt: iso(5) }),
      req({ id: 'w', state: 'withdrawn', decidedAt: iso(1) }),
      req({ id: 'acc', state: 'accepted', decidedAt: iso(3) }),
      req({ id: 'd2', state: 'declined', decidedAt: iso(9) }),
      req({ id: 'liveask', kind: 'do_sop', state: 'accepted', decidedAt: iso(0) }),
      req({ id: 'open' }),
    ]
    expect(groupMyRequests(rows, ME, NOW).answered.map((r) => r.id)).toEqual(['w', 'acc', 'd1'])
  })

  test('the module is plain: no directive, no server-only', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src/lib/requests/model.ts'), 'utf-8')
    expect(src).not.toMatch(/^'use server'|server-only/m)
  })
})
