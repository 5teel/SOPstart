/**
 * Phase 25 Plan 06 — Wizard SOP department write spec (REQ-9, D-04).
 *
 * Source-contract tests asserting:
 *  - WizardClient.tsx includes departmentIds/allDepartments in createSopFromWizard call (REQ-9)
 *  - WizardClient uses localOnly DepartmentPicker (A4 — no server action on toggle during create)
 *  - createSopFromWizard in sops.ts writes sop_departments junction rows (REQ-9)
 *  - allDepartments=true path sets sops.all_departments flag (D-04)
 *  - PromptClient.tsx includes departmentIds/allDepartments in POST body (A3)
 *  - Both blank/page.tsx and ai/page.tsx call listDepartments() (Surface 4)
 *
 * Runtime tests (marked test.fixme) — require live Supabase + migrations applied:
 *  - createSopFromWizard with 2 dept IDs inserts 2 sop_departments rows
 *  - createSopFromWizard with allDepartments=true sets sops.all_departments=true + 0 junction rows
 *
 * Registration: playwright.config.ts phase25-integration project.
 * CLAUDE.md 2026-05-25: spec file MUST be registered in a project regex to run.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const SRC = path.join(ROOT, 'src')

// ── Source-contract helpers ──────────────────────────────────────────────────

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), 'utf-8')
}

// ── REQ-9: WizardClient passes departmentIds + allDepartments ───────────────

test('WizardClient includes departmentIds in createSopFromWizard call', () => {
  const src = readSrc('app/(protected)/admin/sops/new/blank/WizardClient.tsx')
  expect(src).toContain('departmentIds')
})

test('WizardClient includes allDepartments in createSopFromWizard call', () => {
  const src = readSrc('app/(protected)/admin/sops/new/blank/WizardClient.tsx')
  expect(src).toContain('allDepartments')
})

test('WizardClient uses DepartmentPicker (localOnly) for department field', () => {
  const src = readSrc('app/(protected)/admin/sops/new/blank/WizardClient.tsx')
  expect(src).toContain('DepartmentPicker')
  expect(src).toContain('localOnly')
})

test('WizardClient passes departmentIds state into createSopFromWizard arguments', () => {
  const src = readSrc('app/(protected)/admin/sops/new/blank/WizardClient.tsx')
  // The submit call must reference the local departmentIds state variable
  expect(src).toMatch(/createSopFromWizard[\s\S]{0,300}departmentIds/)
})

// ── A4: localOnly = no server action on toggle during create ─────────────────

test('DepartmentPicker in wizard mode uses sopId sentinel __new__ (A4)', () => {
  const src = readSrc('app/(protected)/admin/sops/new/blank/WizardClient.tsx')
  expect(src).toContain('__new__')
})

// ── REQ-9 / D-04: sops.ts writes sop_departments ────────────────────────────

test('createSopFromWizard Zod schema accepts departmentIds array', () => {
  const src = readSrc('actions/sops.ts')
  expect(src).toContain('departmentIds')
})

test('createSopFromWizard writes sop_departments rows for individual depts', () => {
  const src = readSrc('actions/sops.ts')
  expect(src).toContain('sop_departments')
})

test('createSopFromWizard sets all_departments flag when allDepartments=true (D-04)', () => {
  const src = readSrc('actions/sops.ts')
  expect(src).toContain('all_departments')
})

// ── A3: PromptClient POSTs departmentIds + allDepartments ───────────────────

test('PromptClient includes departmentIds in POST body to /api/sops/ai-prompt (A3)', () => {
  const src = readSrc('app/(protected)/admin/sops/new/ai/PromptClient.tsx')
  expect(src).toContain('departmentIds')
})

test('PromptClient includes allDepartments in POST body (A3)', () => {
  const src = readSrc('app/(protected)/admin/sops/new/ai/PromptClient.tsx')
  expect(src).toContain('allDepartments')
})

test('PromptClient uses DepartmentPicker (localOnly) for department field (A3)', () => {
  const src = readSrc('app/(protected)/admin/sops/new/ai/PromptClient.tsx')
  expect(src).toContain('DepartmentPicker')
  expect(src).toContain('localOnly')
})

// ── Surface 4: both server pages fetch departments ───────────────────────────

test('blank/page.tsx calls listDepartments()', () => {
  const src = readSrc('app/(protected)/admin/sops/new/blank/page.tsx')
  expect(src).toContain('listDepartments')
})

test('blank/page.tsx passes departments prop to WizardClient', () => {
  const src = readSrc('app/(protected)/admin/sops/new/blank/page.tsx')
  expect(src).toContain('departments={departments}')
})

test('ai/page.tsx calls listDepartments()', () => {
  const src = readSrc('app/(protected)/admin/sops/new/ai/page.tsx')
  expect(src).toContain('listDepartments')
})

test('ai/page.tsx passes departments prop to PromptClient', () => {
  const src = readSrc('app/(protected)/admin/sops/new/ai/page.tsx')
  expect(src).toContain('departments={departments}')
})

// ── ai-prompt route writes sop_departments (A3) ─────────────────────────────

test('ai-prompt route reads departmentIds from request body', () => {
  const src = readSrc('app/api/sops/ai-prompt/route.ts')
  expect(src).toContain('departmentIds')
})

// ── Runtime stubs — require live Supabase + migrations 00035/00036 applied ──

test.fixme('createSopFromWizard with 2 dept IDs inserts 2 sop_departments rows (REQ-9)', async () => {
  // Activate after migrations 00035/00036 applied to live DB.
  // 1. Create two departments via createDepartment() for the test org.
  // 2. Call createSopFromWizard({ ..., departmentIds: [deptId1, deptId2], allDepartments: false }).
  // 3. Query sop_departments WHERE sop_id = result.sopId.
  // 4. Assert count === 2 and both department_ids are present.
})

test.fixme('createSopFromWizard with allDepartments=true sets flag + 0 junction rows (D-04)', async () => {
  // Activate after migrations 00035/00036 applied to live DB.
  // 1. Call createSopFromWizard({ ..., departmentIds: [], allDepartments: true }).
  // 2. Query sops WHERE id = result.sopId, assert all_departments = true.
  // 3. Query sop_departments WHERE sop_id = result.sopId, assert count === 0.
})
