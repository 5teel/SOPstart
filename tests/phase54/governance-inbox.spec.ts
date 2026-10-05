/**
 * Phase 54 / Plan 54-02 -- ADM-01 inbox contracts.
 *
 * `deriveInbox` describe: pure unit tests over the row derivation (severity
 * ordering, chip assignment, All-clear empty state).
 * `loadInbox` describe: the one parallel read behind every inbox consumer. The
 * governance page and its client wrapper were deleted in 59-14; the Office rows
 * are pinned in tests/phase59/office-pane-structure.spec.ts.
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { deriveInbox, inboxCounts, chipMatches, INBOX_CHIPS, type InboxItem } from '@/lib/governance/inbox'
import type { GovernanceRow } from '@/actions/governance'
import type { MillerSop } from '@/lib/sop-list/admin-rows'
import type { SopMachineLink } from '@/lib/validators/site'

const ROOT = path.resolve(__dirname, '..', '..')
const LOAD_INBOX = path.join(ROOT, 'src', 'lib', 'governance', 'load-inbox.ts')
const read = (p: string) => fs.readFileSync(p, 'utf-8')

const SOP_ID = '0b0e0d6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

function govRow(id: string, overrides: Partial<GovernanceRow> = {}): GovernanceRow {
  return {
    id,
    title: `SOP ${id}`,
    category_slug: null,
    status: 'draft',
    ownerUserId: null,
    ownerLabel: 'No owner',
    reviewDueAt: null,
    flags: [],
    isCallerNextApprover: false,
    ...overrides,
  }
}

function libRow(id: string, overrides: Partial<MillerSop> = {}): MillerSop {
  return {
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
    parseRetry: { isVideo: false, canRetry: true },
    ...overrides,
  }
}

test.describe('deriveInbox', () => {
  test('unowned row -> chips [owner], severity bad, gov set, action null', () => {
    const items = deriveInbox({ governance: [govRow('a', { flags: ['unowned'] })], library: [], machines: [], links: [] })
    expect(items).toHaveLength(1)
    expect(items[0].chips).toEqual(['owner'])
    expect(items[0].severity).toBe('bad')
    expect(items[0].gov).not.toBeNull()
    expect(items[0].action).toBeNull()
  })

  test('overdue only -> chips [overdue], severity warn', () => {
    const items = deriveInbox({ governance: [govRow('a', { flags: ['overdue'] })], library: [], machines: [], links: [] })
    expect(items[0].chips).toEqual(['overdue'])
    expect(items[0].severity).toBe('warn')
  })

  test('awaiting_approval + isCallerNextApprover true -> chips [approve], severity info', () => {
    const items = deriveInbox({
      governance: [govRow('a', { flags: ['awaiting_approval'], isCallerNextApprover: true })],
      library: [],
      machines: [],
      links: [],
    })
    expect(items[0].chips).toEqual(['approve'])
    expect(items[0].severity).toBe('info')
  })

  test('awaiting_approval + isCallerNextApprover false, nothing else -> excluded', () => {
    const items = deriveInbox({
      governance: [govRow('a', { flags: ['awaiting_approval'], isCallerNextApprover: false })],
      library: [],
      machines: [],
      links: [],
    })
    expect(items).toHaveLength(0)
  })

  test('due_soon only -> excluded', () => {
    const items = deriveInbox({ governance: [govRow('a', { flags: ['due_soon'] })], library: [], machines: [], links: [] })
    expect(items).toHaveLength(0)
  })

  test('stale_role only -> included, chips [], severity grey', () => {
    const items = deriveInbox({ governance: [govRow('a', { flags: ['stale_role'] })], library: [], machines: [], links: [] })
    expect(items).toHaveLength(1)
    expect(items[0].chips).toEqual([])
    expect(items[0].severity).toBe('grey')
  })

  test('unowned + overdue -> ONE item, chips [owner, overdue], severity bad', () => {
    const items = deriveInbox({
      governance: [govRow('a', { flags: ['unowned', 'overdue'] })],
      library: [],
      machines: [],
      links: [],
    })
    expect(items).toHaveLength(1)
    expect(items[0].chips).toEqual(['owner', 'overdue'])
    expect(items[0].severity).toBe('bad')
  })

  test('library row stuck -> kind stuck, chips [stuck], severity bad, meta + Try again action', () => {
    const items = deriveInbox({ governance: [], library: [libRow(SOP_ID, { stuck: true })], machines: [], links: [] })
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('stuck')
    expect(items[0].chips).toEqual(['stuck'])
    expect(items[0].severity).toBe('bad')
    expect(items[0].meta).toContain('stopped while converting')
    expect(items[0].action).toEqual({ label: 'Try again', href: `/sops/${SOP_ID}?mode=edit&from=office`, retry: { sopId: SOP_ID, isVideo: false } })
  })

  test('library row parseFailed -> meta contains conversion failed, same action shape', () => {
    const items = deriveInbox({ governance: [], library: [libRow(SOP_ID, { parseFailed: true })], machines: [], links: [] })
    expect(items[0].meta).toContain('conversion failed')
    expect(items[0].action).toEqual({ label: 'Try again', href: `/sops/${SOP_ID}?mode=edit&from=office`, retry: { sopId: SOP_ID, isVideo: false } })
  })

  test('machine with no links -> kind machines, chips [machines], severity grey, Write a SOP action', () => {
    const items = deriveInbox({
      governance: [],
      library: [],
      machines: [{ id: 'm1', name: 'Press 1' }],
      links: [],
    })
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('machines')
    expect(items[0].chips).toEqual(['machines'])
    expect(items[0].severity).toBe('grey')
    expect(items[0].meta).toBe('no procedures yet')
    expect(items[0].action).toEqual({ label: 'Write a SOP', href: '/admin/sops/new/blank?machine=m1', retry: null })
  })

  test('machine with a link -> no item', () => {
    const items = deriveInbox({
      governance: [],
      library: [],
      machines: [{ id: 'm1', name: 'Press 1' }],
      links: [{ sop_id: 's1', machine_id: 'm1' }],
    })
    expect(items).toHaveLength(0)
  })

  test('governance meta = machine names then status word; title falls back displayTitle -> row title -> Untitled SOP; age from library', () => {
    const withLibrary = deriveInbox({
      governance: [govRow('a', { flags: ['unowned'], status: 'published' })],
      library: [libRow('a', { displayTitle: 'Oven Cleaning', machines: ['Oven 1', 'Oven 2'], age: '5d' })],
      machines: [],
      links: [],
    })
    expect(withLibrary[0].title).toBe('Oven Cleaning')
    expect(withLibrary[0].meta).toBe('Oven 1 · Oven 2 · live')
    expect(withLibrary[0].age).toBe('5d')

    const withoutLibrary = deriveInbox({
      governance: [govRow('b', { flags: ['unowned'], title: 'Fallback Title' })],
      library: [],
      machines: [],
      links: [],
    })
    expect(withoutLibrary[0].title).toBe('Fallback Title')

    const untitled = deriveInbox({
      governance: [govRow('c', { flags: ['unowned'], title: null })],
      library: [],
      machines: [],
      links: [],
    })
    expect(untitled[0].title).toBe('Untitled SOP')
  })

  test('items ordered bad -> warn -> info -> grey, stable within a severity', () => {
    const items = deriveInbox({
      governance: [
        govRow('warn1', { flags: ['overdue'] }),
        govRow('bad1', { flags: ['unowned'] }),
        govRow('grey1', { flags: ['stale_role'] }),
        govRow('info1', { flags: ['awaiting_approval'], isCallerNextApprover: true }),
        govRow('bad2', { flags: ['unowned'] }),
      ],
      library: [],
      machines: [],
      links: [],
    })
    expect(items.map((i) => i.key)).toEqual(['gov-bad1', 'gov-bad2', 'gov-warn1', 'gov-info1', 'gov-grey1'])
  })

  test('inboxCounts: all = items.length, each chip counts; chipMatches(all) always true', () => {
    const items = deriveInbox({
      governance: [govRow('a', { flags: ['unowned'] }), govRow('b', { flags: ['overdue'] })],
      library: [],
      machines: [],
      links: [],
    })
    const counts = inboxCounts(items)
    expect(counts.all).toBe(2)
    expect(counts.owner).toBe(1)
    expect(counts.overdue).toBe(1)
    expect(counts.approve).toBe(0)
    for (const item of items) expect(chipMatches(item, 'all')).toBe(true)
  })

  test('empty inputs -> [] (the All clear state)', () => {
    const items = deriveInbox({ governance: [], library: [], machines: [], links: [] })
    expect(items).toEqual([])
  })

  test('INBOX_CHIPS carries all seven chip keys in order', () => {
    expect(INBOX_CHIPS.map((c) => c.key)).toEqual(['all', 'owner', 'overdue', 'approve', 'signoff', 'stuck', 'machines'])
  })
})

test.describe('loadInbox wiring (54-02 Task 2, repointed 59-14)', () => {
  test('load-inbox.ts: one Promise.all(listGovernanceQueue, listAdminSopRows, listSiteHealthForOrg), deriveInbox called server-side', () => {
    const src = read(LOAD_INBOX).replace(/\r\n/g, '\n')
    expect(src.match(/Promise\.all\(/g)).toHaveLength(1)
    const allMatch = src.match(/Promise\.all\(\[([\s\S]*?)\]\)/)
    expect(allMatch).not.toBeNull()
    expect(allMatch![1]).toContain('listGovernanceQueue()')
    expect(allMatch![1]).toContain('listAdminSopRows(')
    expect(allMatch![1]).toContain('listSiteHealthForOrg()')
    expect(src).toContain('deriveInbox(')
  })
})
