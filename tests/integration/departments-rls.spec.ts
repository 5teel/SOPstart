/**
 * T-25-01/02/03 — departments RLS source-contract + runtime stubs
 *
 * Verifies:
 *   REQ-1: Cross-tenant department isolation — org B's session cannot read org A's departments
 *   D-02a: No 42P17 RLS infinite recursion on `sops` SELECT after the department policy is live
 *   T-25-01: departments_org_read policy uses current_organisation_id() (org isolation)
 *   T-25-03: departments_admin_insert WITH CHECK pins organisation_id = current_organisation_id()
 *
 * Wave-0 status: source-contract assertions run immediately (no live DB required).
 * Runtime stubs are test.fixme — they activate after `node scripts/apply-phase25-migrations.mjs`
 * and `npm run test:integration` confirms the live DB state.
 *
 * Registration: playwright.config.ts `phase25-integration` project regex → departments-rls
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCHEMA_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00035_departments_schema.sql')
const DATA_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00036_departments_data.sql')
const CLEANUP_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00037_departments_rls_cleanup.sql')
const SOP_TYPES = path.join(ROOT, 'src', 'types', 'sop.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Source-contract assertions — run immediately, no live DB required
// ---------------------------------------------------------------------------

test.describe('T-25-01 — departments RLS source-contract', () => {
  test('migration 00035 exists with departments table DDL', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toContain('create table if not exists public.departments')
    expect(sql).toContain('organisation_id')
    expect(sql).toContain('primary key')
  })

  test('REQ-1: departments_org_read policy uses current_organisation_id() for cross-tenant isolation', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toContain('departments_org_read')
    // Isolation gate: only rows where organisation_id matches the caller's org
    expect(sql).toMatch(/organisation_id\s*=\s*public\.current_organisation_id\(\)/)
  })

  test('T-25-03: departments_admin_insert WITH CHECK pins organisation_id = current_organisation_id()', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toContain('departments_admin_insert')
    expect(sql).toContain('with check')
    // Prevents privilege escalation: org B admin cannot insert depts into org A
    expect(sql).toMatch(/organisation_id\s*=\s*public\.current_organisation_id\(\)/)
  })

  test('D-02a: junction SELECT policies use using(true) — NOT a reference to sops/blocks table', () => {
    const sql = read(SCHEMA_MIGRATION)
    // All three junctions must use using(true) to avoid 42P17 recursion
    expect(sql).toContain('block_departments_read_all_auth')
    expect(sql).toContain('sop_departments_read_all_auth')
    expect(sql).toContain('member_departments_self_read')

    // Recursion guard: no junction policy body should reference public.sops or public.blocks
    // Extract policy definitions and verify they don't cross-reference the parent tables
    const junctionPolicies = sql.match(/create policy "(?:block|sop|member)_departments[\s\S]*?;/g) ?? []
    for (const policy of junctionPolicies) {
      // block_departments and sop_departments MUST use using(true), not a subquery to parent
      if (policy.includes('block_departments_read_all_auth') || policy.includes('sop_departments_read_all_auth')) {
        expect(policy).toContain('using (true)')
        expect(policy).not.toMatch(/from public\.sops/)
        expect(policy).not.toMatch(/from public\.blocks/)
      }
    }
  })

  test('D-02a: SECURITY DEFINER helpers exist (current_user_department_ids, sop_in_user_departments)', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toContain('current_user_department_ids')
    expect(sql).toContain('sop_in_user_departments')
    // Must be security definer to bypass RLS in the helper — same pattern as sub_trade helpers
    expect(sql.toLowerCase()).toContain('security definer')
  })

  test('sops_visible_by_department additive policy calls SECURITY DEFINER helper (not inline EXISTS)', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toContain('sops_visible_by_department')
    // Must call the helper, not inline the junction EXISTS (recursion trap)
    expect(sql).toContain('sop_in_user_departments(sops.id)')
    // Must also have the backward-compat arm for SOPs with no sop_departments rows
    expect(sql).toMatch(/not exists[\s\S]*?sop_departments/)
  })

  test('D-04: all_departments column added to both blocks and sops', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toMatch(/alter table public\.blocks[\s\S]*?all_departments/)
    expect(sql).toMatch(/alter table public\.sops[\s\S]*?all_departments/)
  })

  test('D-01: data migration does not UPDATE blocks in-place (per-org copy pattern)', () => {
    const sql = read(DATA_MIGRATION)
    // In-place update would lose cross-org access during the migration loop
    expect(sql).not.toMatch(/update public\.blocks\s+set\s+organisation_id/i)
    // Must use INSERT ... SELECT per-org
    expect(sql).toMatch(/insert into public\.blocks/i)
  })

  test('D-01: data migration has fail-fast assertion for zero null-org blocks', () => {
    const sql = read(DATA_MIGRATION)
    // Must assert zero orphans after the DELETE
    expect(sql).toMatch(/RAISE EXCEPTION/i)
    expect(sql).toMatch(/organisation_id IS NULL/i)
  })

  test('00037 cleanup drops the retired global-model policies', () => {
    const sql = read(CLEANUP_MIGRATION)
    expect(sql).toContain('blocks_read_global_plus_org')
    expect(sql).toContain('blocks_summit_admin_global_write')
    expect(sql).toContain('block_suggestions')
    expect(sql).toContain('drop table if exists public.block_suggestions')
  })

  test('TypeScript types export Department, DepartmentWithCounts, MemberDepartment', () => {
    const types = read(SOP_TYPES)
    expect(types).toContain('export interface Department')
    expect(types).toContain('export interface DepartmentWithCounts')
    expect(types).toContain('export interface MemberDepartment')
    // Core fields present
    expect(types).toMatch(/organisation_id:\s*string/)
    expect(types).toMatch(/owner_user_id:\s*string \| null/)
    expect(types).toMatch(/archived:\s*boolean/)
  })
})

// ---------------------------------------------------------------------------
// Runtime RLS UAT — activate after `node scripts/apply-phase25-migrations.mjs`
// ---------------------------------------------------------------------------

test.describe('T-25-01 — runtime cross-tenant isolation (activate post-push)', () => {
  test.fixme(
    'REQ-1: org B session returns 0 rows when querying org A departments',
    async ({ page }) => {
      /**
       * Steps after db push:
       * 1. Seed two orgs: org A (insert 1 department), org B (insert 1 department)
       * 2. Authenticate as an org B member via magic-link cookie (uat-session.mjs)
       * 3. Install cookie at baseURL, navigate to /dashboard (session active)
       * 4. Direct Supabase JS query with org B session:
       *    const { data } = await sb.from('departments').select('id').eq('id', orgA_dept_id)
       *    expect(data).toHaveLength(0)  — RLS blocks cross-org read
       * 5. Verify org B can read its own department:
       *    const { data: ownData } = await sb.from('departments').select('id')
       *    expect(ownData?.some(d => d.id === orgB_dept_id)).toBe(true)
       */
      void page
    },
  )

  test.fixme(
    'T-25-03: org B admin cannot insert department with org A organisation_id',
    async ({ page }) => {
      /**
       * Steps after db push:
       * 1. Authenticate as org B admin via magic-link cookie
       * 2. Attempt INSERT into departments with organisation_id = org_A_id
       *    const { error } = await sb.from('departments').insert({
       *      organisation_id: orgA_id, name: 'Test', code: 'TST', colour: '#000'
       *    })
       * 3. Expect error (RLS WITH CHECK violation: 42501 or empty-result from policy)
       * 4. Confirm org A's department count is unchanged
       */
      void page
    },
  )

  test.fixme(
    'D-02a: SELECT from sops does not error 42P17 after department policy is live',
    async ({ page }) => {
      /**
       * Steps after db push:
       * 1. Authenticate as any org member via magic-link cookie
       * 2. Direct Supabase JS query:
       *    const { data, error } = await sb.from('sops').select('id').limit(1)
       * 3. Expect error to be null (no 42P17 recursion)
       * 4. Optionally navigate to /sops and confirm the page loads without 500
       */
      void page
    },
  )
})
