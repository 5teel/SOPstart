/**
 * Phase 59 -- ledger read. Requirement DEC-02; decisions D-09, D-10.
 * Owners: 59-02 (kinds, groups, words, cursor, migration list), 59-10 (listDecisions).
 * Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { DECISION_KINDS } from '@/lib/decisions/shape'
import { nzStartOfDayIso } from '@/lib/office/format'
import { DECISION_GROUPS, KIND_GROUPS, KIND_WORDS, CLEARED_KINDS, PAGE_SIZE, cursorFilter } from '@/lib/decisions/read'

const MIGRATION = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/00073_office_ledger.sql'), 'utf8')

test.describe('ledger read', () => {
  test('every DECISION_KINDS value sits in exactly one KIND_GROUPS group (59-02)', () => {
    const all = Object.values(KIND_GROUPS).flat()
    expect([...all].sort()).toEqual([...DECISION_KINDS].sort())
    expect(new Set(all).size).toBe(all.length)
    expect([...KIND_GROUPS.other].sort()).toEqual(['member_invited', 'member_removed', 'observation', 'role_change'])
  })

  test('the filter groups, their order and labels are the UI-SPEC chips (59-02)', () => {
    expect(DECISION_GROUPS.map((g) => g.key)).toEqual(['all', 'approvals', 'signoffs', 'ownership', 'publishing', 'reviews', 'ai', 'other'])
    expect(DECISION_GROUPS.map((g) => g.label)).toEqual(['All', 'Approvals', 'Sign-offs', 'Ownership', 'Publishing', 'Reviews', 'AI', 'Other'])
  })

  test('every kind has plain words (59-02)', () => {
    expect(Object.keys(KIND_WORDS).sort()).toEqual([...DECISION_KINDS].sort())
    expect(KIND_WORDS.approve).toBe('Approved')
    expect(KIND_WORDS.reject).toBe('Rejected')
    // 59 review WR-02: sign_off is the worker's submit row, countersign the supervisor's approval
    expect(KIND_WORDS.sign_off).toBe('Sent for sign-off')
    expect(KIND_WORDS.countersign).toBe('Signed off')
    expect(KIND_WORDS.review).toBe('Marked reviewed')
    expect(KIND_WORDS.role_change).toBe('Changed a role')
    expect(KIND_WORDS.member_invited).toBe('Invited someone')
    expect(KIND_WORDS.member_removed).toBe('Removed someone')
  })

  test('cursorFilter keys on created_at then id; page size and cleared kinds are fixed (59-02)', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    const at = '2026-10-05T01:02:03.000Z'
    expect(cursorFilter({ createdAt: at, id })).toBe(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`)
    expect(PAGE_SIZE).toBe(50)
    expect([...CLEARED_KINDS]).toEqual(['countersign', 'reject', 'approve', 'owner_change', 'review'])
  })

  test('the migration kind list equals DECISION_KINDS, including role_change, member_invited, member_removed (59-02)', () => {
    const m = MIGRATION.match(/check\s*\(\s*kind\s+in\s*\(([^)]*)\)/i)
    expect(m).not.toBeNull()
    const kinds = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    expect(new Set(kinds)).toEqual(new Set(DECISION_KINDS))
    expect(kinds.length).toBe(DECISION_KINDS.length)
    for (const k of ['role_change', 'member_invited', 'member_removed']) expect(kinds).toContain(k)
  })

  test('the new migration changes the kind check only and adds no policy (A-04) (59-02)', () => {
    const code = MIGRATION.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    expect(code).not.toMatch(/\bpolicy\b/i)
    expect(code).not.toMatch(/\b(create|drop)\s+(table|trigger|function|index)\b/i)
    expect(code).toMatch(/alter table public\.decisions drop constraint if exists decisions_kind_check/)
  })

  test.describe('listDecisions (59-10)', () => {
    const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8').replace(/\r\n/g, '\n')
    // Whole-line comments out, so a comment can never satisfy or trip an assertion.
    const strip = (src: string) =>
      src
        .split('\n')
        .map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l))
        .join('\n')
    const ACTIONS = strip(read('src/actions/office.ts'))
    const body = ACTIONS.slice(ACTIONS.indexOf('export async function listDecisions('), ACTIONS.indexOf('export async function countClearedToday('))
    const TAB = strip(read('src/components/office/DecisionsTab.tsx'))
    const PANE = strip(read('src/components/office/OfficePane.tsx'))
    const INBOX = strip(read('src/components/office/InboxTab.tsx'))

    test('listDecisions orders created_at desc then id desc and returns a 51-row page (59-10)', () => {
      expect(body).toContain(".order('created_at', { ascending: false })")
      expect(body).toContain(".order('id', { ascending: false })")
      expect(body).toContain('.limit(PAGE_SIZE + 1)')
      expect(body.indexOf(".order('created_at'")).toBeLessThan(body.indexOf(".order('id'"))
      expect(body).toContain('fetched.slice(0, PAGE_SIZE)')
      expect(body).toContain('hasOlder = fetched.length > PAGE_SIZE')
      expect(body).toContain("q.in('kind', [...KIND_GROUPS[group]])")
    })

    test('listDecisions cursor continues without gaps or repeats (59-10)', () => {
      expect(body).toContain('q.or(cursorFilter(cursor))')
      // The next page starts at the last row RETURNED (the 50th), taken from the database's own text.
      expect(body).toContain('page[page.length - 1]')
      expect(body).toContain('nextCursor: last ? { createdAt: last.created_at, id: last.id } : null')
      expect(ACTIONS).toContain("z.string().datetime({ offset: true })")
      expect(ACTIONS).toContain("id: z.string().uuid()")
    })

    test('listDecisions is guarded to admin and safety manager and takes no org id from the client (59-10)', () => {
      expect(ACTIONS).not.toContain('createAdminClient')
      expect(ACTIONS).toContain("ctx.role !== 'admin' && ctx.role !== 'safety_manager'")
      expect(body.indexOf('ledgerReader()')).toBeLessThan(body.indexOf(".from('decisions')"))
      expect(ACTIONS).toContain('.strict()')
      expect(ACTIONS).toContain('z.enum(GROUP_KEYS)')
      expect(ACTIONS).not.toMatch(/organisationId\s*:\s*z\./)
      // Free text from details never leaves the server.
      expect(body).not.toContain('details')
      const cleared = ACTIONS.slice(ACTIONS.indexOf('export async function countClearedToday('))
      expect(cleared).toContain('ledgerReader()')
      expect(cleared).toContain(".in('kind', [...CLEARED_KINDS])")
      expect(cleared).toContain(".eq('actor_kind', 'person')")
      expect(cleared).toContain('nzStartOfDayIso()')
    })

    test('nzStartOfDayIso is NZ midnight in winter and summer, DST changeover days included (59-10)', () => {
      // NZST (+12): 12:00 UTC on 5 Jul is 00:00 on 6 Jul in NZ, so the day began at 12:00 UTC on 5 Jul.
      expect(nzStartOfDayIso(new Date('2026-07-05T20:30:00Z'))).toBe('2026-07-05T12:00:00.000Z')
      // NZDT (+13).
      expect(nzStartOfDayIso(new Date('2026-12-10T05:00:00Z'))).toBe('2026-12-09T11:00:00.000Z')
      // Spring forward 27 Sep 2026: that day began at +12, the next at +13.
      expect(nzStartOfDayIso(new Date('2026-09-27T10:00:00Z'))).toBe('2026-09-26T12:00:00.000Z')
      expect(nzStartOfDayIso(new Date('2026-09-28T01:00:00Z'))).toBe('2026-09-27T11:00:00.000Z')
    })

    test('DecisionsTab calls listDecisions in its query, the chip is in the key, Show older fetches the next page (59-10)', () => {
      expect(TAB).toContain("queryKey: ['office-decisions', group]")
      expect(TAB).toMatch(/queryFn: async \(\{ pageParam \}\)[\s\S]*?await listDecisions\(\{ group, cursor: pageParam \}\)/)
      expect(TAB).toContain('getNextPageParam')
      expect(TAB).toMatch(/data-testid="decisions-show-older"[\s\S]*?fetchNextPage/)
      expect(TAB).toContain('hasNextPage')
      expect(TAB).toContain('KIND_WORDS[row.kind]')
      expect(TAB).toContain("focusHref(about.sopId, { from: 'office' })")
      expect(TAB).not.toContain('details')
      expect(PANE).toMatch(/tab === 'decisions' && <DecisionsTab/)
    })

    test('the cleared-today line sits in the inbox empty state and is not rendered for a supervisor (59-10)', () => {
      expect(INBOX).toContain('countClearedToday()')
      expect(INBOX).toContain('data-testid="office-cleared-today"')
      expect(INBOX).toMatch(/enabled: canSeeLedger/)
      expect(INBOX).toContain("role === 'admin' || role === 'safety_manager'")
      expect(INBOX).toMatch(/invalidateQueries\(\{ queryKey: CLEARED_TODAY_KEY \}\)/)
      expect(INBOX).toMatch(/queryKey: CLEARED_TODAY_KEY, queryFn: \(\) => countClearedToday\(\)/)
      expect(INBOX).toContain('Nothing was waiting today.')
    })
  })
})
