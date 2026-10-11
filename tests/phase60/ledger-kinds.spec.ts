/**
 * Phase 60 -- Ledger kinds. Requirements: RQS-02, OBJ-01. Decisions: D-04, A-05. Owning plan: 60-02.
 * Registration: playwright.config.ts `phase60` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { DECISION_KINDS } from '@/lib/decisions/shape'
import { DECISION_GROUPS, KIND_GROUPS, KIND_WORDS, CLEARED_KINDS } from '@/lib/decisions/read'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n')
const NEW_KINDS = ['request_accepted', 'request_declined', 'objective_set', 'objective_cleared', 'objective_confirmed']

function kindList(src: string): string[] {
  const m = src.match(/check\s*\(\s*kind\s+in\s*\(([^)]*)\)/i)
  expect(m).not.toBeNull()
  return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
}

test.describe('Ledger kinds (60-02)', () => {
  test('the five new kinds are in DECISION_KINDS, after the 59 kinds and before the ADR-0008 kinds', () => {
    expect(DECISION_KINDS.length).toBe(34)
    expect([...DECISION_KINDS].slice(18, 23)).toEqual(NEW_KINDS)
  })

  test('each kind sits in exactly one group; requests sits between ownership and publishing; objective kinds are in other', () => {
    const all = Object.values(KIND_GROUPS).flat()
    expect([...all].sort()).toEqual([...DECISION_KINDS].sort())
    expect(new Set(all).size).toBe(all.length)
    expect([...KIND_GROUPS.requests]).toEqual(['request_accepted', 'request_declined'])
    for (const k of ['objective_set', 'objective_cleared', 'objective_confirmed'] as const) expect(KIND_GROUPS.other).toContain(k)
    const keys = DECISION_GROUPS.map((g) => g.key)
    expect(keys.indexOf('requests')).toBe(keys.indexOf('ownership') + 1)
    expect(keys.indexOf('publishing')).toBe(keys.indexOf('requests') + 1)
    expect(DECISION_GROUPS.find((g) => g.key === 'requests')?.label).toBe('Requests')
    expect([...CLEARED_KINDS]).toEqual(['countersign', 'reject', 'approve', 'owner_change', 'review'])
  })

  test('every kind has plain words matching the UI-SPEC copy', () => {
    expect(Object.keys(KIND_WORDS).sort()).toEqual([...DECISION_KINDS].sort())
    expect(KIND_WORDS.request_accepted).toBe('Accepted a request')
    expect(KIND_WORDS.request_declined).toBe('Declined a request')
    expect(KIND_WORDS.objective_set).toBe('Set an objective')
    expect(KIND_WORDS.objective_cleared).toBe('Removed an objective')
    expect(KIND_WORDS.objective_confirmed).toBe('Confirmed an objective')
  })

  test('the latest migration kind list (00076) equals DECISION_KINDS', () => {
    const kinds = kindList(read('supabase/migrations/00076_ledger_every_action.sql'))
    expect(new Set(kinds)).toEqual(new Set(DECISION_KINDS))
    expect(kinds.length).toBe(DECISION_KINDS.length)
  })

  test('the applier script KINDS list equals DECISION_KINDS (a fallback apply never re-drops a later kind)', () => {
    const src = read('scripts/apply-phase60-migration.mjs')
    const m = src.match(/const KINDS = \[([\s\S]*?)\]/)
    expect(m).not.toBeNull()
    const kinds = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    expect(new Set(kinds)).toEqual(new Set(DECISION_KINDS))
    expect(src).toContain('00074_requests_notifications_objectives.sql')
  })
})
