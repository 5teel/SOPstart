/**
 * Phase 54 / Plan 54-01 -- ADM-02/ADM-03 unit tests for the ONE admin health
 * classifier, `src/lib/sop/admin-health.ts` (CLAUDE.md 2026-09-27: a
 * classification lives in ONE plain module imported by every surface that
 * asks the question -- floor pins, machine-panel badges, library checks and
 * table status all read from here, never a second copy).
 *
 * Static @/ imports only (CLAUDE.md 2026-06-24).
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import {
  machineHealth,
  adminSopBadge,
  machinePanelSops,
  type HealthRow,
} from '@/lib/sop/admin-health'
import type { GovernanceFlag } from '@/lib/governance/classify'
import type { SopMachineLink } from '@/lib/validators/site'

function row(id: string, overrides: Partial<HealthRow> = {}): HealthRow {
  return {
    id,
    title: `SOP ${id}`,
    status: 'published',
    flags: [],
    ownerLabel: 'Jo',
    reviewDueAt: null,
    ...overrides,
  }
}

function flagsMap(rows: HealthRow[]): Map<string, readonly GovernanceFlag[]> {
  return new Map(rows.map((r) => [r.id, r.flags]))
}

test.describe('machineHealth', () => {
  test('unowned beats overdue -> bad', () => {
    const machines = [{ id: 'm1' }]
    const links: SopMachineLink[] = [
      { sop_id: 's1', machine_id: 'm1' },
      { sop_id: 's2', machine_id: 'm1' },
    ]
    const rows = [row('s1', { flags: ['unowned'] }), row('s2', { flags: ['overdue'] })]
    const health = machineHealth(machines, links, flagsMap(rows))
    expect(health.get('m1')).toBe('bad')
  })

  test('overdue but no unowned -> due', () => {
    const machines = [{ id: 'm1' }]
    const links: SopMachineLink[] = [{ sop_id: 's1', machine_id: 'm1' }]
    const rows = [row('s1', { flags: ['overdue'] })]
    const health = machineHealth(machines, links, flagsMap(rows))
    expect(health.get('m1')).toBe('due')
  })

  test('no flags, or only due_soon/stale_role/awaiting_approval -> ok', () => {
    const machines = [{ id: 'm1' }, { id: 'm2' }]
    const links: SopMachineLink[] = [
      { sop_id: 's1', machine_id: 'm1' },
      { sop_id: 's2', machine_id: 'm2' },
    ]
    const rows = [row('s1', { flags: [] }), row('s2', { flags: ['due_soon', 'stale_role', 'awaiting_approval'] })]
    const health = machineHealth(machines, links, flagsMap(rows))
    expect(health.get('m1')).toBe('ok')
    expect(health.get('m2')).toBe('ok')
  })

  test('machine with no links is absent from the map', () => {
    const machines = [{ id: 'm1' }]
    const health = machineHealth(machines, [], new Map())
    expect(health.has('m1')).toBe(false)
  })

  test('links to a SOP id missing from the flags map are ignored; machine with only such links is absent', () => {
    const machines = [{ id: 'm1' }]
    const links: SopMachineLink[] = [{ sop_id: 'ghost', machine_id: 'm1' }]
    const health = machineHealth(machines, links, new Map())
    expect(health.has('m1')).toBe(false)
  })
})

test.describe('adminSopBadge', () => {
  test('unowned -> NO OWNER', () => {
    expect(adminSopBadge({ flags: ['unowned'], status: 'published' })).toBe('NO OWNER')
  })

  test('overdue (owned) -> REVIEW DUE', () => {
    expect(adminSopBadge({ flags: ['overdue'], status: 'published' })).toBe('REVIEW DUE')
  })

  test('owned, current, status draft -> DRAFT', () => {
    expect(adminSopBadge({ flags: [], status: 'draft' })).toBe('DRAFT')
  })

  test('owned, current, published -> OK', () => {
    expect(adminSopBadge({ flags: [], status: 'published' })).toBe('OK')
  })

  test('unowned + overdue -> NO OWNER (unowned wins)', () => {
    expect(adminSopBadge({ flags: ['unowned', 'overdue'], status: 'published' })).toBe('NO OWNER')
  })
})

test.describe('machinePanelSops', () => {
  test('returns only that machine\'s SOPs, ordered NO OWNER -> REVIEW DUE -> DRAFT -> OK then title', () => {
    const links: SopMachineLink[] = [
      { sop_id: 'ok-b', machine_id: 'm1' },
      { sop_id: 'draft-a', machine_id: 'm1' },
      { sop_id: 'no-owner', machine_id: 'm1' },
      { sop_id: 'review-due', machine_id: 'm1' },
      { sop_id: 'other-machine', machine_id: 'm2' },
    ]
    const rowsById = new Map<string, HealthRow>([
      ['ok-b', row('ok-b', { title: 'Zeta', flags: [], status: 'published' })],
      ['draft-a', row('draft-a', { title: 'Alpha', flags: [], status: 'draft' })],
      ['no-owner', row('no-owner', { title: 'Beta', flags: ['unowned'], status: 'published', ownerLabel: 'No owner' })],
      ['review-due', row('review-due', { title: 'Gamma', flags: ['overdue'], status: 'published' })],
      ['other-machine', row('other-machine', { title: 'Elsewhere', flags: [], status: 'published' })],
    ])
    const result = machinePanelSops('m1', links, rowsById)
    expect(result.map((r) => r.id)).toEqual(['no-owner', 'review-due', 'draft-a', 'ok-b'])
    expect(result[0].ownerLabel).toBeNull()
    expect(result[1].badge).toBe('REVIEW DUE')
  })

  test('title falls back to Untitled SOP', () => {
    const links: SopMachineLink[] = [{ sop_id: 's1', machine_id: 'm1' }]
    const rowsById = new Map<string, HealthRow>([['s1', row('s1', { title: null })]])
    const result = machinePanelSops('m1', links, rowsById)
    expect(result[0].title).toBe('Untitled SOP')
  })
})
