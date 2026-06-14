/**
 * REQ-3 / D-02 — SOP department visibility + OR-composition (source-contract + runtime stubs)
 *
 * Verifies:
 *   REQ-3: A worker in only the Forming department sees Forming SOPs and all_departments SOPs,
 *          but NOT Cleaning-only SOPs (OR-composed department visibility gate)
 *   D-02:  Multiple permissive SELECT policies on sops compose as OR (additive)
 *   D-02a: No 42P17 infinite recursion on sops SELECT after the department policy is live
 *
 * Wave-0 status: source-contract assertions run immediately (no live DB required).
 * Runtime stubs are test.fixme — they activate after `node scripts/apply-phase25-migrations.mjs`
 * followed by `npm run test:integration`.
 *
 * Registration: playwright.config.ts `phase25-integration` project regex → sop-dept-visibility
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCHEMA_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00035_departments_schema.sql')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Source-contract assertions — run immediately, no live DB required
// ---------------------------------------------------------------------------

test.describe('REQ-3 / D-02 — SOP visibility source-contract', () => {
  test('sops_visible_by_department policy has all three OR arms', () => {
    const sql = read(SCHEMA_MIGRATION)

    // Locate the policy definition
    const policyMatch = sql.match(
      /create policy "sops_visible_by_department"[\s\S]*?;/,
    )
    expect(policyMatch).not.toBeNull()
    const policy = policyMatch![0]

    // Arm 1: all_departments = true (org-wide SOP)
    expect(policy).toMatch(/all_departments\s*=\s*true/)

    // Arm 2: backward compat — SOPs with no sop_departments rows are still visible
    // (mirrors the sub_trade not-exists short-circuit from migration 00030)
    expect(policy).toMatch(/not exists[\s\S]*?sop_departments/)

    // Arm 3: worker is in a department that has this SOP tagged
    expect(policy).toContain('sop_in_user_departments(sops.id)')
  })

  test('D-02: sops_visible_by_department is an ADDITIVE permissive SELECT (not restrictive)', () => {
    const sql = read(SCHEMA_MIGRATION)
    const policyMatch = sql.match(
      /create policy "sops_visible_by_department"[\s\S]*?;/,
    )
    expect(policyMatch).not.toBeNull()
    const policy = policyMatch![0]

    // Must be FOR SELECT
    expect(policy).toMatch(/for select/i)
    // Must NOT be a restrictive policy (restrictive would break the OR composition)
    expect(policy).not.toMatch(/as restrictive/i)
    // Comment confirms additive intent
    expect(sql).toContain('sops_visible_by_department')
    // Must NOT replace or drop sops_visible_by_sub_trade
    expect(sql).not.toMatch(/drop policy.*sops_visible_by_sub_trade/)
  })

  test('D-02: additive policy does NOT touch existing sops_visible_by_sub_trade', () => {
    const sql = read(SCHEMA_MIGRATION)
    // The Phase 25 migration should only ADD the new policy, not modify the sub-trade one
    expect(sql).not.toMatch(/alter policy.*sops_visible_by_sub_trade/)
    expect(sql).not.toMatch(/drop policy.*sops_visible_by_sub_trade/)
  })

  test('D-02a: sop_in_user_departments calls current_user_department_ids() (SECURITY DEFINER chain)', () => {
    const sql = read(SCHEMA_MIGRATION)
    // The helper must chain to current_user_department_ids — this is the recursion-safe path
    const helperMatch = sql.match(
      /create or replace function public\.sop_in_user_departments[\s\S]*?\$\$;/,
    )
    expect(helperMatch).not.toBeNull()
    const helperBody = helperMatch![0]

    expect(helperBody).toContain('sop_departments')
    expect(helperBody).toContain('current_user_department_ids()')
    // Must be SECURITY DEFINER
    expect(helperBody.toLowerCase()).toContain('security definer')
    // Must NOT reference public.sops directly (would re-enter the policy and recurse)
    expect(helperBody).not.toMatch(/from public\.sops/)
  })

  test('D-04: sops.all_departments column exists in migration (D-04 parity)', () => {
    const sql = read(SCHEMA_MIGRATION)
    // D-04: the all_departments flag must be on BOTH sops and blocks
    expect(sql).toMatch(/alter table public\.sops[\s\S]*?all_departments boolean/)
    expect(sql).toMatch(/alter table public\.blocks[\s\S]*?all_departments boolean/)
  })

  test('sops_visible_by_department backward-compat arm uses sop_departments (not sop_sub_trades)', () => {
    const sql = read(SCHEMA_MIGRATION)
    const policyMatch = sql.match(
      /create policy "sops_visible_by_department"[\s\S]*?;/,
    )
    expect(policyMatch).not.toBeNull()
    const policy = policyMatch![0]

    // Backward-compat arm: if a SOP has no sop_departments rows it should remain visible
    // The not-exists check must reference sop_departments, not sops_sub_trades
    expect(policy).toMatch(/not exists\s*\(\s*select 1 from public\.sop_departments/)
  })
})

// ---------------------------------------------------------------------------
// Runtime visibility UAT — activate after `node scripts/apply-phase25-migrations.mjs`
// ---------------------------------------------------------------------------

test.describe('REQ-3 — runtime OR-composed visibility (activate post-push)', () => {
  test.fixme(
    'REQ-3: Forming-dept worker sees Forming SOP and all_departments SOP',
    async ({ page }) => {
      /**
       * Steps after db push:
       * 1. Service-role seed:
       *    a. Create 1 org, 2 departments: Forming (code: FORM), Cleaning (code: CLEAN)
       *    b. Create 3 SOPs (status: published):
       *       - "Forming SOP"       → sop_departments linked to Forming dept only
       *       - "Cleaning SOP"      → sop_departments linked to Cleaning dept only
       *       - "All Depts SOP"     → sops.all_departments = true, no sop_departments rows
       *    c. Create a worker user and add to member_departments for Forming dept only
       * 2. Authenticate as the Forming worker via magic-link cookie (uat-session.mjs)
       * 3. Direct Supabase JS query (worker session, RLS-scoped):
       *    const { data } = await sb.from('sops').select('id, title')
       *    const titles = data?.map(s => s.title) ?? []
       * 4. Assert:
       *    expect(titles).toContain('Forming SOP')     — REQ-3 dept match
       *    expect(titles).toContain('All Depts SOP')   — D-04 all_departments flag
       *    expect(titles).not.toContain('Cleaning SOP') — REQ-3 isolation
       * 5. No error.code === '42P17' on the query (D-02a)
       */
      void page
    },
  )

  test.fixme(
    'D-02a: sops SELECT returns rows without 42P17 after department policy live',
    async ({ page }) => {
      /**
       * Steps after db push:
       * 1. Authenticate as any org member via magic-link cookie
       * 2. Direct Supabase JS query:
       *    const { data, error } = await sb.from('sops').select('id').limit(1)
       * 3. Assert error is null (no 42P17 infinite recursion from junction policy)
       * 4. If sops exist, data should be a non-null array
       */
      void page
    },
  )

  test.fixme(
    'REQ-3 backward compat: SOP with no sop_departments rows visible to all workers',
    async ({ page }) => {
      /**
       * Steps after db push:
       * 1. Seed: 1 org, 1 worker with NO member_departments rows, 1 published SOP with
       *    NO sop_departments rows (pre-Phase-25 data shape)
       * 2. Authenticate as the worker via magic-link cookie
       * 3. Query: const { data } = await sb.from('sops').select('id').eq('id', sop_id)
       * 4. Assert data has 1 row (backward compat: empty sop_departments = no gate)
       */
      void page
    },
  )
})
