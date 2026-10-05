/**
 * Phase 59 -- inbox model. Requirements OFF-01, OFF-02, OFF-04; decisions D-04, D-05,
 * A-01, A-03, A-07, A-11. Owner: 59-04. Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { GovernanceRow } from '@/actions/governance'
import type { MillerSop } from '@/lib/sop-list/admin-rows'
import {
  deriveInbox,
  inboxCounts,
  INBOX_CHIPS,
  type OwnedReview,
  type PendingSignOff,
} from '@/lib/governance/inbox'
import { nzDateTime, nzDay, relativeWhen, reviewSegment } from '@/lib/office/format'
import { memberLabel } from '@/lib/members/labels'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf-8')

const NOW = new Date('2026-10-05T03:00:00Z') // 4 pm NZDT, Mon 5 Oct
const DAY = 86_400_000
const SOP = '0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const SOP2 = '1c1f1e7b-2d3e-4f60-9bac-1d2e3f4a5b6c'

const govRow = (id: string, o: Partial<GovernanceRow> = {}): GovernanceRow => ({
  id,
  title: `SOP ${id}`,
  category_slug: null,
  status: 'published',
  ownerUserId: null,
  ownerLabel: 'No owner',
  reviewDueAt: null,
  flags: [],
  isCallerNextApprover: false,
  ...o,
})

const libRow = (id: string, o: Partial<MillerSop> = {}): MillerSop => ({
  id,
  title: `SOP ${id}`,
  displayTitle: `SOP ${id}`,
  untitled: false,
  status: 'draft',
  categoryLabel: null,
  categorySlug: null,
  departments: [],
  departmentIds: [],
  allDepartments: false,
  ownerLabel: null,
  age: '3d',
  updatedAt: null,
  flagLabel: null,
  flagStyle: null,
  stuck: false,
  confidence: null,
  ownerUserId: null,
  flags: [],
  lastReviewedAt: null,
  chainRequired: false,
  hasPersonGrant: false,
  parseFailed: false,
  machines: [],
  parseRetry: null,
  ...o,
})

const signOff = (o: Partial<PendingSignOff> = {}): PendingSignOff => ({
  completionId: 'c1',
  sopId: SOP,
  sopTitle: 'Press 3',
  sopVersion: 4,
  workerId: 'w1',
  workerLabel: 'jane@x',
  submittedAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString(),
  photoCount: 2,
  ...o,
})

const review = (reviewDueAt: string, sopId = SOP): OwnedReview => ({ sopId, title: 'Press 3', reviewDueAt })
const empty = { governance: [], library: [], machines: [], links: [] }

test.describe('inbox model', () => {
  test('deriveInbox adds signoff and review kinds; legacy call shapes still valid (optional inputs)', () => {
    expect(deriveInbox({ ...empty })).toEqual([])
    const [s] = deriveInbox({ ...empty, signOffs: [signOff()], now: NOW })
    expect(s).toMatchObject({
      kind: 'signoff',
      chips: ['signoff'],
      severity: 'warn',
      key: 'signoff-c1',
      title: 'Press 3',
      meta: 'From jane@x · 2 photos',
      age: '2 hours ago',
      action: null,
    })
    expect(s.signOff?.completionId).toBe('c1')
    const [one] = deriveInbox({ ...empty, signOffs: [signOff({ photoCount: 1 })], now: NOW })
    expect(one.meta).toBe('From jane@x · 1 photo')
  })

  test('owned reviews: overdue warn, due soon grey, later none, governance duplicate skipped', () => {
    const overdue = new Date(NOW.getTime() - 3 * DAY).toISOString()
    const soon = new Date(NOW.getTime() + 10 * DAY).toISOString()
    const later = new Date(NOW.getTime() + 90 * DAY).toISOString()
    const [o] = deriveInbox({ ...empty, ownedReviews: [review(overdue)], now: NOW })
    expect(o).toMatchObject({ kind: 'review', chips: ['overdue'], severity: 'warn', key: `review-${SOP}` })
    expect(o.review?.sopId).toBe(SOP)
    const [d] = deriveInbox({ ...empty, ownedReviews: [review(soon)], now: NOW })
    expect(d).toMatchObject({ kind: 'review', chips: [], severity: 'grey' })
    expect(deriveInbox({ ...empty, ownedReviews: [review(later)], now: NOW })).toEqual([])
    const dup = deriveInbox({
      ...empty,
      governance: [govRow(SOP, { flags: ['overdue'] })],
      ownedReviews: [review(overdue)],
      now: NOW,
    })
    expect(dup).toHaveLength(1)
    expect(dup[0].kind).toBe('governance')
  })

  test('chip order is All, Owner, Overdue, Approve, Sign-off, Stuck, Machines', () => {
    expect(INBOX_CHIPS.map((c) => c.key)).toEqual(['all', 'owner', 'overdue', 'approve', 'signoff', 'stuck', 'machines'])
    expect(INBOX_CHIPS.find((c) => c.key === 'signoff')?.label).toBe('Sign-off')
  })

  test('an owned SOP that is also overdue yields one row, not two (dedupe of owned rows)', () => {
    const overdue = new Date(NOW.getTime() - DAY).toISOString()
    const items = deriveInbox({
      ...empty,
      governance: [govRow(SOP, { flags: ['unowned', 'overdue'] })],
      ownedReviews: [review(overdue)],
      now: NOW,
    })
    expect(items).toHaveLength(1)
  })

  test('counts per chip and the pin total come from the same derive call; empty is 0', () => {
    const overdue = new Date(NOW.getTime() - DAY).toISOString()
    const items = deriveInbox({
      ...empty,
      signOffs: [signOff(), signOff({ completionId: 'c2' })],
      ownedReviews: [review(overdue, SOP2)],
      now: NOW,
    })
    const counts = inboxCounts(items)
    expect(counts.all).toBe(items.length)
    expect(counts.signoff).toBe(2)
    expect(counts.overdue).toBe(1)
    expect(inboxCounts([]).all).toBe(0)
  })

  test('row actions: stuck retry / open and machine write-a-SOP', () => {
    const href = `/sops/${SOP}?mode=edit&from=office`
    const [retry] = deriveInbox({
      ...empty,
      library: [libRow(SOP, { stuck: true, parseRetry: { isVideo: false, canRetry: true } })],
    })
    expect(retry.action).toEqual({ label: 'Try again', href, retry: { sopId: SOP, isVideo: false } })
    const [video] = deriveInbox({
      ...empty,
      library: [libRow(SOP, { parseFailed: true, parseRetry: { isVideo: true, canRetry: true } })],
    })
    expect(video.action?.retry).toEqual({ sopId: SOP, isVideo: true })
    const [open] = deriveInbox({
      ...empty,
      library: [libRow(SOP, { stuck: true, parseRetry: { isVideo: false, canRetry: false } })],
    })
    expect(open.action).toEqual({ label: 'Open', href, retry: null })
    const [m] = deriveInbox({ ...empty, machines: [{ id: 'm1', name: 'Press 1' }] })
    expect(m.action).toEqual({ label: 'Write a SOP', href: '/admin/sops/new/blank?machine=m1', retry: null })
  })

  test('relativeWhen, nzDay, nzDateTime and reviewSegment format as the spec states (NZ dates)', () => {
    const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
    expect(relativeWhen(ago(10_000), NOW)).toBe('just now')
    expect(relativeWhen(ago(12 * 60_000), NOW)).toBe('12 min ago')
    expect(relativeWhen(ago(3 * 3600_000), NOW)).toBe('3 hours ago')
    expect(relativeWhen(ago(23 * 3600_000), NOW)).toBe('yesterday')
    expect(relativeWhen(ago(4 * DAY), NOW)).toBe('4 days ago')
    expect(relativeWhen('2026-09-12T00:00:00Z', NOW)).toMatch(/^12 Sep/)
    expect(nzDay('2026-11-12T00:00:00Z', NOW)).toBe('12 Nov')
    expect(nzDay('2027-11-12T00:00:00Z', NOW)).toBe('12 Nov 2027')
    expect(nzDateTime('2026-10-05T01:14:00Z')).toBe('Mon 5 Oct, 2:14 pm')
    expect(reviewSegment(null, NOW)).toEqual({ state: 'none', text: 'no review date' })
    expect(reviewSegment('2026-11-12T00:00:00Z', NOW)).toEqual({ state: 'due', text: 'review due 12 Nov' })
    expect(reviewSegment('2026-10-05T10:00:00Z', NOW)).toEqual({ state: 'due', text: 'review due today' })
    expect(reviewSegment('2026-10-03T00:00:00Z', NOW)).toEqual({ state: 'overdue', lead: 'review was due ', date: '3 Oct' })
  })
})
