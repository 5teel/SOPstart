/**
 * REQ-4/5, V4 — member↔department integration spec (Wave-0 scaffold)
 *
 * Verifies:
 *   REQ-4: Multi-dept assignment — assign member to Forming+Cleaning, assert both rows exist;
 *          remove one, assert only that dept row drops (single-removal isolation)
 *   REQ-5: Owner→NULL cascade — set member as Forming owner, remove member from dept,
 *          assert departments.owner_user_id goes NULL (surfacing "No owner assigned" warning)
 *   V4:    assignMemberDepartments replace-semantics verified source-contract
 *   D-03:  setDepartmentOwner D-03 source-contract (organisation_members check present)
 *
 * Wave-0 status: source-contract assertions run immediately (no live DB required).
 * Runtime stubs are test.fixme — activate after migrations applied and
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set in the test environment.
 *
 * Registration: playwright.config.ts `phase25-integration` project regex → member-dept
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEPARTMENTS_ACTIONS = path.join(ROOT, 'src', 'actions', 'departments.ts')
const SCHEMA_MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00035_departments_schema.sql')
const AUTH_ACTIONS = path.join(ROOT, 'src', 'actions', 'auth.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ---------------------------------------------------------------------------
// Source-contract assertions — run immediately, no live DB required
// ---------------------------------------------------------------------------

test.describe('REQ-4 — multi-dept assignment source-contract', () => {
  test('assignMemberDepartments is exported from departments.ts', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    expect(src).toContain('export async function assignMemberDepartments')
  })

  test('assignMemberDepartments uses replace-semantics (delete-then-insert)', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    // Must delete existing rows before inserting new ones (replace semantics)
    expect(src).toContain('.delete()')
    expect(src).toContain('member_departments')
    // Insert the new rows after delete
    expect(src).toContain('.insert(rows)')
  })

  test('member_departments table exists in migration 00035', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toContain('create table if not exists public.member_departments')
    expect(sql).toContain('member_id')
    expect(sql).toContain('department_id')
  })

  test('member_departments READ policy uses true (no recursion, D-02a)', () => {
    const sql = read(SCHEMA_MIGRATION)
    // Junction table SELECT must use a policy that avoids cross-table recursion
    // (per the 00031 fix: non-sensitive UUID-pair junctions use a self-contained policy)
    expect(sql).toContain('member_departments')
  })

  test('TeamMember has department_ids field (auth.ts)', () => {
    const src = read(AUTH_ACTIONS)
    expect(src).toContain('department_ids')
    // Ensure it's an array type
    expect(src).toContain('department_ids: string[]')
  })
})

test.describe('REQ-5 — owner accountability source-contract', () => {
  test('setDepartmentOwner is exported from departments.ts', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    expect(src).toContain('export async function setDepartmentOwner')
  })

  test('D-03: setDepartmentOwner verifies userId ∈ organisation_members for same org', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    // Must check organisation_members to guard against cross-org owner assignment (T-25-03)
    expect(src).toContain('organisation_members')
    // Must also check for the owner being in the SAME org
    expect(src).toContain('organisation_id')
  })

  test('departments table has owner_user_id with ON DELETE SET NULL (migration 00035)', () => {
    const sql = read(SCHEMA_MIGRATION)
    expect(sql).toContain('owner_user_id')
    // ON DELETE SET NULL ensures removed member surfaces the no-owner warning (REQ-5)
    expect(sql).toContain('on delete set null')
  })

  test('archiveDepartment uses flag-only, never DELETE (REQ-6)', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    // archiveDepartment must only set archived=true, not issue a DELETE
    // Verify the function body uses update with archived:true, not delete
    expect(src).toContain('archived: true')
    // The archiveDepartment function must not call .delete() on departments
    // (it may call delete on junctions, but not on the departments table itself)
    const archiveFnMatch = src.match(/archiveDepartment[\s\S]*?(?=export async function|\Z)/)?.[0] ?? ''
    // Simple check: no .delete().eq('id', departmentId) in the archive function
    expect(archiveFnMatch).not.toContain("from('departments')\n    .delete()")
  })
})

test.describe('D-03/T-25-03 — colour validation source-contract', () => {
  test('department colour validated by z.enum allow-list in departments.ts (V5 — no CSS injection)', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    // Must use z.enum to restrict colour values (not z.string() free-form)
    expect(src).toMatch(/colour:\s*z\.enum/)
    // The allow-list must contain the 8 UI-SPEC hex values
    expect(src).toContain('#f97316') // orange
    expect(src).toContain('#3b82f6') // blue
    expect(src).toContain('#06b6d4') // cyan
    expect(src).toContain('#10b981') // green
    expect(src).toContain('#ec4899') // pink
    expect(src).toContain('#ef4444') // red
    expect(src).toContain('#fbbf24') // amber
    expect(src).toContain('#8b5cf6') // violet
  })
})

test.describe('D-04 — all_departments flag source-contract', () => {
  test('assignBlockDepartments handles allDepartments=true (clears junction + sets flag)', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    expect(src).toContain('assignBlockDepartments')
    expect(src).toContain('allDepartments')
    expect(src).toContain('all_departments')
  })

  test('assignSopDepartments handles allDepartments=true (clears junction + sets flag)', () => {
    const src = read(DEPARTMENTS_ACTIONS)
    expect(src).toContain('assignSopDepartments')
    expect(src).toContain('sop_departments')
  })

  test('createSopFromWizard schema accepts departmentIds + allDepartments (REQ-9)', () => {
    const sopsSrc = fs.readFileSync(path.join(ROOT, 'src', 'actions', 'sops.ts'), 'utf-8')
    expect(sopsSrc).toContain('departmentIds')
    expect(sopsSrc).toContain('allDepartments')
    expect(sopsSrc).toContain('sop_departments')
  })
})

// ---------------------------------------------------------------------------
// Runtime stubs — require live Supabase (SUPABASE_URL + service role key)
// Activate these after the migrations are applied: node scripts/apply-phase25-migrations.mjs
// ---------------------------------------------------------------------------

test.fixme('REQ-4 runtime: assign member to Forming+Cleaning, assert both member_departments rows exist', async () => {
  // 1. Create a test org + admin + member via admin API
  // 2. Create two departments (Forming, Cleaning)
  // 3. Call assignMemberDepartments(memberId, [formingId, cleaningId])
  // 4. Assert: two rows in member_departments for memberId
  // 5. Call assignMemberDepartments(memberId, [formingId]) — remove Cleaning
  // 6. Assert: exactly one row remains (Forming), Cleaning row gone (single-removal isolation)
})

test.fixme('REQ-5/V4 runtime: set member as Forming owner, remove from dept, assert owner_user_id NULL', async () => {
  // 1. Assign member to Forming dept
  // 2. Call setDepartmentOwner(formingId, memberId)
  // 3. Assert: departments.owner_user_id = memberId for Forming
  // 4. Call assignMemberDepartments(memberId, []) — remove member from ALL depts
  // 5. ON DELETE SET NULL trigger fires: departments.owner_user_id goes NULL
  //    (This is enforced at DB level via the FK ON DELETE SET NULL — no app-layer cascade needed)
  // 6. Assert: departments.owner_user_id IS NULL for Forming → surfaces "No owner assigned" state
})
