/**
 * CAP-01 -- the capability matrix document.
 *
 * `.planning/codebase/CAPABILITY-MATRIX.md` is the single reference for
 * "who can see/do what" across the app: rows are the four org roles
 * (`worker`, `supervisor`, `admin`, `safety_manager`), plus a footnote row
 * for the orthogonal `platform_admin` Potenco axis. Columns are the app's
 * real capabilities. D1 (obligation != access) requires the doc to carry
 * two distinct channel headings rather than describing visibility and
 * obligation as one thing. CLAUDE.md's Pathways Map convention is the
 * precedent for referencing a living doc from CLAUDE.md itself.
 *
 * Activated by Plan 46-02 Task 2 -- CAPABILITY-MATRIX.md and the CLAUDE.md
 * pointer now exist, so these assertions run for real (previously deferred
 * markers, per CLAUDE.md 2026-05-25: deferred assertions stay listed, never
 * silently passed).
 *
 * Registration: playwright.config.ts `phase46` project
 *   testDir: '.', testMatch: /tests\/phase46\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase46`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MATRIX_PATH = path.join(ROOT, '.planning', 'codebase', 'CAPABILITY-MATRIX.md')
const CLAUDE_PATH = path.join(ROOT, 'CLAUDE.md')

// CRLF-normalise per CLAUDE.md 2026-07-18: worktree checkouts smudge to CRLF
// and break \n-literal source-contract matching.
function read(p: string): string {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
}

test.describe('CAP-01 -- capability matrix document (source-contract)', () => {
  // activated by plan 46-02
  test('CAPABILITY-MATRIX.md exists at .planning/codebase/', () => {
    expect(fs.existsSync(MATRIX_PATH)).toBe(true)
  })

  // activated by plan 46-02
  test('contains each org role token: worker, supervisor, admin, safety_manager', () => {
    const doc = read(MATRIX_PATH)
    expect(doc).toContain('worker')
    expect(doc).toContain('supervisor')
    expect(doc).toContain('admin')
    expect(doc).toContain('safety_manager')
  })

  // activated by plan 46-02
  test('contains platform_admin as the orthogonal Potenco footnote axis', () => {
    const doc = read(MATRIX_PATH)
    expect(doc).toContain('platform_admin')
  })

  // activated by plan 46-02
  test('contains all three legend markers as literal strings', () => {
    const doc = read(MATRIX_PATH)
    expect(doc).toContain('shipped-and-enforced')
    expect(doc).toContain('shipped-but-unenforced')
    expect(doc).toContain('planned')
  })

  // activated by plan 46-02 -- D1: obligation != access, must be two channels
  test('contains both D1 channel headings: Access channel and Obligation channel', () => {
    const doc = read(MATRIX_PATH)
    expect(doc).toContain('Access channel')
    expect(doc).toContain('Obligation channel')
  })

  // activated by plan 46-02 -- one expect() per label so a failure names the
  // missing row, not just "some rows missing" (CLAUDE.md 2026-06-05 class).
  test('contains every required capability row label', () => {
    const doc = read(MATRIX_PATH)
    expect(doc).toContain('Read SOP')
    expect(doc).toContain('Walk SOP')
    expect(doc).toContain('Self-add SOP')
    expect(doc).toContain('Record completion')
    expect(doc).toContain('Sign off completion')
    expect(doc).toContain('Record observation')
    expect(doc).toContain('Create SOP')
    expect(doc).toContain('Edit SOP content')
    expect(doc).toContain('Verify blocks')
    expect(doc).toContain('Publish SOP')
    expect(doc).toContain('Delete SOP')
    expect(doc).toContain('Version history')
    expect(doc).toContain('Governance queue')
    expect(doc).toContain('Approval chains')
    expect(doc).toContain('Manage team')
    expect(doc).toContain('Manage departments')
    expect(doc).toContain('Manage blocks library')
    expect(doc).toContain('AI settings')
    expect(doc).toContain('Training matrix')
    expect(doc).toContain('Assessor governance')
    expect(doc).toContain('Export training records')
    expect(doc).toContain('Own profile')
  })

  // Repointed by the A1 resolution (Simon, 2026-08-25): sign-off authority =
  // approval-chain approvers, not sops.owner_user_id. The doc must carry the
  // resolved mapping and the RLS helper it is enforced by.
  test('contains the CAP-02 approver overlay tokens: sign-off authority, A1 RESOLVED, is_sop_sign_off_approver, chain approver column', () => {
    const doc = read(MATRIX_PATH)
    expect(doc).toContain('sign-off authority')
    expect(doc).toContain('A1 RESOLVED')
    expect(doc).toContain('is_sop_sign_off_approver')
    expect(doc).toContain('Chain approver (any role)')
    // The retired owner-mapping column must not resurface.
    expect(doc).not.toContain('SOP owner (any role)')
  })

  // activated by plan 46-02 -- deferred capabilities documented as planned,
  // not silently omitted (Phases 44a/44b/45/47/48).
  test('contains forward-reference phase markers for deferred/planned capabilities', () => {
    const doc = read(MATRIX_PATH)
    expect(doc).toContain('Phase 44a')
    expect(doc).toContain('Phase 44b')
    expect(doc).toContain('Phase 45')
    expect(doc).toContain('Phase 47')
    expect(doc).toContain('Phase 48')
  })

  // activated by plan 46-02 -- mirrors the Pathways Map CLAUDE.md pointer convention
  test('CLAUDE.md references the matrix doc path', () => {
    const claude = read(CLAUDE_PATH)
    expect(claude).toContain('.planning/codebase/CAPABILITY-MATRIX.md')
  })
})
