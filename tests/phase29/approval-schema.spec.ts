import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Phase 29 Wave 0 — source-contract proof that migration 00045 uses the
// CORRECT current_organisation_id() RLS predicate (not the app_metadata
// HR-01 bug signature, CLAUDE.md 2026-06-15/2026-07-12), and that
// sop_approvals uses a PARTIAL unique index (not a blanket constraint,
// RESEARCH Pitfall 4).
const MIGRATION_PATH = path.resolve(__dirname, '../../supabase/migrations/00045_approval_chains.sql')

test.describe('approval_chains RLS + sop_approvals partial index', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')

  test('uses current_organisation_id() predicate', () => {
    expect(sql).toContain('current_organisation_id')
  })

  test('does NOT use the app_metadata JWT path (HR-01 bug signature)', () => {
    expect(sql).not.toContain('app_metadata')
  })

  test('sop_approvals idempotency guard is a PARTIAL index scoped to approved rows', () => {
    expect(sql).toContain("where action = 'approved'")
  })

  test('approval_chains has no authenticated write policy (service-role only)', () => {
    expect(sql).not.toMatch(/create policy approval_chains_(insert|update|delete)/)
  })
})
