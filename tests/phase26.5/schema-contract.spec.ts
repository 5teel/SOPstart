/**
 * Phase 26.5 — D-01/D-02: agent-metadata schema contract (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when the agent-metadata migration ships (Plan 26.5-02): asserts the
 * four org-scoped append-only tables exist, RLS uses current_organisation_id()
 * directly, and NO policy body cross-references public.sops (42P17 recursion
 * risk, CLAUDE.md 2026-05-13). Skips cleanly until the migration file exists
 * (phase22 fs.existsSync + test.skip convention — no dynamic import()).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'migrations')

function findMigration(): string | null {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /agent[_-]?metadata/i.test(f))
  return files.length ? path.join(MIGRATIONS_DIR, files[0]) : null
}

test('D-01: agent-metadata migration exists with all four tables', () => {
  const file = findMigration()
  if (!file) {
    test.skip(true, 'agent-metadata migration not yet created — waiting for Plan 26.5-02')
    return
  }
  const sql = fs.readFileSync(file, 'utf-8')
  for (const table of [
    'sop_agent_metadata',
    'block_agent_metadata',
    'agent_memory',
    'agent_learning_proposals',
  ]) {
    expect(sql).toContain(table)
  }
})

test('D-01: RLS policies use current_organisation_id() directly, never cross-table sops reference', () => {
  const file = findMigration()
  if (!file) {
    test.skip(true, 'agent-metadata migration not yet created — waiting for Plan 26.5-02')
    return
  }
  const sql = fs.readFileSync(file, 'utf-8')
  expect(sql).toContain('current_organisation_id()')
  // FK refs use `references public.sops(id)` — `from public.sops` only appears
  // in a policy subquery, which is the forbidden 42P17 recursion pattern.
  expect(sql).not.toMatch(/from\s+public\.sops/i)
})

test('D-02: block granularity keyed by sop_section_blocks junction id', () => {
  const file = findMigration()
  if (!file) {
    test.skip(true, 'agent-metadata migration not yet created — waiting for Plan 26.5-02')
    return
  }
  const sql = fs.readFileSync(file, 'utf-8')
  expect(sql).toContain('sop_section_blocks')
})

test.fixme('D-01: no authenticated INSERT/UPDATE/DELETE policy on agent tables (runtime RLS probe)', () => {
  // Live DB probe — implemented against seeded data in a later plan.
})
