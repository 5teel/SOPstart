/**
 * Phase 58 -- SOP-04 version currency and where a person lands (58-02 Task 2,
 * D-12, D-13, D-18, T-58-draft). Unit spec, static imports.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import { latestPublished, resolveFocusTarget, type LineageRow } from '@/lib/sop/lineage-current'

const row = (id: string, version: number, parent_sop_id: string | null, status: string): LineageRow => ({ id, version, parent_sop_id, status })
const v1 = row('v1', 1, null, 'published')
const v2 = row('v2', 2, 'v1', 'published')
const v3 = row('v3', 3, 'v1', 'draft')
const w1 = row('w1', 1, null, 'published')
const lineage = [v1, v2, v3]

test.describe('latestPublished', () => {
  test('one highest published row per lineage, drafts ignored', () => {
    expect(latestPublished([v1, v2, v3, w1]).map((r) => r.id)).toEqual(['v2', 'w1'])
  })

  test('the pointer column is never read', () => {
    const withPointer = [{ ...v1, superseded_by: 'zzz' }, { ...v2, superseded_by: null }]
    expect(latestPublished(withPointer).map((r) => r.id)).toEqual(['v2'])
  })
})

test.describe('resolveFocusTarget', () => {
  test('worker is redirected to the latest published version', () => {
    expect(resolveFocusTarget({ role: 'worker', requestedId: 'v1', lineage })).toEqual({ kind: 'redirect', id: 'v2' })
  })

  test('worker with a walk in progress stays on that version (D-12)', () => {
    expect(resolveFocusTarget({ role: 'worker', requestedId: 'v1', lineage, inProgressSopId: 'v1' })).toEqual({ kind: 'open', id: 'v1', superseded: true })
  })

  test('worker never reaches a draft; no published row is not found (D-13)', () => {
    expect(resolveFocusTarget({ role: 'worker', requestedId: 'v3', lineage })).toEqual({ kind: 'redirect', id: 'v2' })
    expect(resolveFocusTarget({ role: 'worker', requestedId: 'd1', lineage: [row('d1', 1, null, 'draft')] })).toEqual({ kind: 'not_found' })
  })

  test('worker on the latest version just opens it', () => {
    expect(resolveFocusTarget({ role: 'supervisor', requestedId: 'v2', lineage })).toEqual({ kind: 'open', id: 'v2', superseded: false })
  })

  test('admin opens the exact row, flagged when an earlier version (D-28)', () => {
    expect(resolveFocusTarget({ role: 'admin', requestedId: 'v1', lineage })).toEqual({ kind: 'open', id: 'v1', superseded: true })
    expect(resolveFocusTarget({ role: 'admin', requestedId: 'v2', lineage })).toEqual({ kind: 'open', id: 'v2', superseded: false })
    expect(resolveFocusTarget({ role: 'admin', requestedId: 'v3', lineage })).toEqual({ kind: 'open', id: 'v3', superseded: false })
  })

  test('an id outside the lineage is not found', () => {
    expect(resolveFocusTarget({ role: 'admin', requestedId: 'nope', lineage })).toEqual({ kind: 'not_found' })
  })
})
