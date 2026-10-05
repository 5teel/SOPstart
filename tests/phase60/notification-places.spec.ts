/**
 * Phase 60 -- notification kinds, titles, dedupe keys and places.
 * Requirements NTF-01, NTF-02; decisions D-07, D-08; threats T-60-11, T-60-12. Owner: 60-03.
 * Registration: playwright.config.ts `phase60`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_WORDS,
  notificationTitle,
  dedupeKey,
} from '@/lib/notifications/kinds'
import { notificationPlace, isSafePlace, placeTarget } from '@/lib/notifications/places'
import { OBJECTIVES_KEY, MY_REQUESTS_KEY, NOTIFICATIONS_KEY } from '@/lib/shell/query-keys'

const NOW = new Date('2026-10-06T03:00:00Z')
const SOP = '0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const T = 'Press 3 — Lockout / Tagout'

test.describe('Notification kinds, titles and places (60-03)', () => {
  test('kinds are a closed list with a word each', () => {
    expect([...NOTIFICATION_KINDS]).toEqual(['approve_next', 'review_due', 'signoff', 'request_answered', 'new_version', 'asked'])
    expect(NOTIFICATION_KINDS.map((k) => NOTIFICATION_KIND_WORDS[k])).toEqual([
      'Approve',
      'Review',
      'Sign-off',
      'Answered',
      'New version',
      'Asked',
    ])
  })

  test('titles reproduce the UI-SPEC sentences', () => {
    const t = (i: Parameters<typeof notificationTitle>[0]) => notificationTitle(i, NOW)
    expect(t({ kind: 'approve_next', sop: T })).toBe(`Your approval is next on ${T}.`)
    expect(t({ kind: 'review_due', sop: T, dueAt: '2026-11-12T00:00:00Z' })).toBe(`${T} is due for you to review by 12 Nov.`)
    expect(t({ kind: 'review_due', sop: T, dueAt: '2026-10-03T00:00:00Z' })).toBe(`${T} was due for review on 3 Oct.`)
    expect(t({ kind: 'signoff', sop: T, name: 'Jane Smith' })).toBe(`Jane finished ${T} and is waiting for you to sign off.`)
    expect(t({ kind: 'signoff', sop: T, name: null })).toBe(`Someone finished ${T} and is waiting for you to sign off.`)
    expect(t({ kind: 'request_answered', outcome: 'accepted', about: T })).toBe(`Your request about ${T} was accepted.`)
    expect(t({ kind: 'request_answered', outcome: 'declined', about: T })).toBe(`Your request about ${T} was declined.`)
    expect(t({ kind: 'request_answered', outcome: 'observe_accepted', sop: T, name: 'Jane' })).toBe(
      `Jane accepted — they'll observe you on ${T}.`,
    )
    expect(t({ kind: 'request_answered', outcome: 'ask_declined', sop: T, name: null })).toBe(`Someone can't do ${T}.`)
    expect(t({ kind: 'new_version', sop: T, version: 4 })).toBe(`${T} has a new version (v4).`)
    expect(t({ kind: 'asked', sop: T })).toBe(`You've been asked to do ${T}.`)
  })

  test('a title never runs past 200 characters', () => {
    expect(notificationTitle({ kind: 'asked', sop: 'x'.repeat(400) }, NOW).length).toBeLessThanOrEqual(200)
  })

  test('dedupe keys are per event, stable, and differ across subjects', () => {
    expect(dedupeKey({ kind: 'review_due', sopId: SOP, dueAt: '2026-11-12T00:00:00Z' })).toBe(`review_due:${SOP}:2026-11-12`)
    expect(dedupeKey({ kind: 'approve_next', sopId: SOP, version: 3, step: 1 })).toBe(`approve_next:${SOP}:3:1`)
    expect(dedupeKey({ kind: 'signoff', completionId: 'c1' })).toBe('signoff:c1')
    expect(dedupeKey({ kind: 'request_answered', requestId: 'r1' })).toBe('request_answered:r1')
    expect(dedupeKey({ kind: 'asked', requestId: 'r1' })).toBe('asked:r1')
    expect(dedupeKey({ kind: 'new_version', sopId: SOP })).toBe(`new_version:${SOP}`)
    const a = { kind: 'signoff', completionId: 'c1' } as const
    expect(dedupeKey(a)).toBe(dedupeKey({ ...a }))
    expect(dedupeKey(a)).not.toBe(dedupeKey({ kind: 'signoff', completionId: 'c2' }))
  })

  test('places come from fixed templates; a bad SOP id throws', () => {
    for (const k of ['approve_next', 'review_due', 'signoff'] as const) expect(notificationPlace(k)).toBe('/?place=office')
    expect(notificationPlace('request_answered')).toBe('/')
    expect(notificationPlace('new_version', { sopId: SOP })).toBe(`/sops/${SOP}`)
    expect(notificationPlace('asked', { sopId: SOP })).toBe(`/sops/${SOP}`)
    expect(() => notificationPlace('asked', { sopId: 'not-a-uuid' })).toThrow()
    expect(() => notificationPlace('new_version')).toThrow()
  })

  test('every kind maps to a place that is safe and opens', () => {
    for (const k of NOTIFICATION_KINDS) {
      const p = notificationPlace(k, { sopId: SOP })
      expect(isSafePlace(p)).toBe(true)
      expect(['select', 'href']).toContain(placeTarget(p).type)
    }
  })

  test('isSafePlace accepts in-app paths and refuses everything else', () => {
    for (const ok of ['/', '/?place=office', '/?place=office&tab=requests', `/sops/${SOP}`, `/sops/${SOP}?from=office`]) {
      expect(isSafePlace(ok), ok).toBe(true)
    }
    for (const bad of [
      '//evil.com',
      'https://x',
      '/\\evil',
      'javascript:alert(1)',
      '',
      '/admin/sops/abc/assign',
      '/sops/not-a-uuid',
      `/sops/${SOP}/../x`,
      '/?place=//evil.com',
      `/${'a'.repeat(300)}`,
      `/?place=${'a'.repeat(300)}`,
      null,
      42,
    ]) {
      expect(isSafePlace(bad), String(bad)).toBe(false)
    }
  })

  test('placeTarget selects the overview and ?place= strings, links a SOP, and sends anything unsafe to the overview', () => {
    expect(placeTarget('/')).toEqual({ type: 'select', place: { kind: 'overview' } })
    expect(placeTarget('/?place=office')).toEqual({ type: 'select', place: { kind: 'room', id: 'office' } })
    expect(placeTarget('/?place=office&tab=requests')).toEqual({ type: 'select', place: { kind: 'room', id: 'office' } }) // tab not whitelisted until 60-11
    expect(placeTarget(`/sops/${SOP}`)).toEqual({ type: 'href', href: `/sops/${SOP}` })
    expect(placeTarget('//evil.com')).toEqual({ type: 'select', place: { kind: 'overview' } })
    expect(placeTarget('https://x')).toEqual({ type: 'select', place: { kind: 'overview' } })
  })

  test('the three query keys exist and the modules are plain', () => {
    expect(OBJECTIVES_KEY).toEqual(['objectives'])
    expect(MY_REQUESTS_KEY).toEqual(['my-requests'])
    expect(NOTIFICATIONS_KEY).toEqual(['notifications'])
    for (const f of ['src/lib/notifications/kinds.ts', 'src/lib/notifications/places.ts']) {
      expect(fs.readFileSync(path.resolve(__dirname, '..', '..', f), 'utf-8')).not.toMatch(/^'use server'|server-only/m)
    }
  })
})
