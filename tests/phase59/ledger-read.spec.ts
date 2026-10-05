/**
 * Phase 59 -- ledger read. Requirement DEC-02; decisions D-09, D-10.
 * Owners: 59-02 (kinds, groups, words, cursor, migration list), 59-10 (listDecisions).
 * Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { DECISION_KINDS } from '@/lib/decisions/shape'
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
    expect(KIND_WORDS.sign_off).toBe('Signed off')
    expect(KIND_WORDS.countersign).toBe('Counter-signed')
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
    test.fixme(true, 'flips live in 59-10')
    test('listDecisions orders created_at desc then id desc and returns a 51-row page (59-10)', () => {})
    test('listDecisions cursor continues without gaps or repeats (59-10)', () => {})
    test('listDecisions is guarded to admin and safety manager and takes no org id from the client (59-10)', () => {})
  })
})
