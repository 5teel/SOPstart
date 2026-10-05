/**
 * Phase 56 / 56-05 -- buildDecisionRow unit spec (DEC-01, DEC-04).
 * Imports shape.ts only: record.ts is server-only and is not runtime-imported.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { buildDecisionRow, DECISION_KINDS, type DecisionInput } from '@/lib/decisions/shape'

const session = { userId: 'u-1', userEmail: 'e@x.nz', organisationId: 'o-1' }
const base: DecisionInput = {
  kind: 'approve',
  subject: { kind: 'sop', id: 's-1' },
  sopId: 's-1',
  summary: 'Approved step 1 of the approval chain',
}

test.describe('buildDecisionRow', () => {
  test('person input takes organisation and actor from the session', () => {
    const r = buildDecisionRow(session, base)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row).toMatchObject({
      organisation_id: 'o-1', actor_kind: 'person', actor_id: 'u-1', actor_name: 'e@x.nz',
      source: 'live', kind: 'approve', sop_id: 's-1', subject_kind: 'sop', subject_id: 's-1',
    })
  })

  test('no organisation in the session is refused', () => {
    expect(buildDecisionRow({ ...session, organisationId: null }, base).ok).toBe(false)
  })

  test('person input without a session user is refused', () => {
    expect(buildDecisionRow({ ...session, userId: null }, base).ok).toBe(false)
  })

  test('named agent: agent actor, no actor id, invoked_by is the session user', () => {
    const r = buildDecisionRow(session, { ...base, agent: 'SOPstart assistant' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row.actor_kind).toBe('agent')
    expect(r.row.actor_name).toBe('SOPstart assistant')
    expect(r.row.actor_id).toBeNull()
    expect(r.row.details.invoked_by).toBe('u-1')
  })

  test('an agent outside the allowlist is refused', () => {
    expect(buildDecisionRow(session, { ...base, agent: 'Rogue bot' as never }).ok).toBe(false)
    expect(buildDecisionRow(session, { ...base, agent: '' as never }).ok).toBe(false)
  })

  test('unknown kind, empty summary and over-long summary are refused', () => {
    expect(buildDecisionRow(session, { ...base, kind: 'nope' as never }).ok).toBe(false)
    expect(buildDecisionRow(session, { ...base, summary: '' }).ok).toBe(false)
    expect(buildDecisionRow(session, { ...base, summary: 'x'.repeat(201) }).ok).toBe(false)
    expect(buildDecisionRow(session, { ...base, summary: 'x'.repeat(200) }).ok).toBe(true)
  })

  test('DECISION_KINDS equals the kind list in the live CHECK (00073 widened 00070)', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/00073_office_ledger.sql'), 'utf-8')
    const m = /check \(kind in \(([^)]*)\)\)/.exec(sql)
    expect(m, 'kind CHECK not found').not.toBeNull()
    const inSql = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    expect([...DECISION_KINDS].sort()).toEqual(inSql.sort())
  })
})
