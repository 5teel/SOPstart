import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 03 — approval chains config panel (source-contract, no live DB).
 * Repointed in 30-08 (UX-03): the editor relocated from the retired
 * /admin/governance page to the /admin/settings hub.
 *
 * Verifies:
 *   - ApprovalChainEditor.tsx imports @dnd-kit and calls setApprovalChain(
 *   - role/member pickers are restricted to admin/safety_manager (Pitfall 3)
 *   - admin/settings/page.tsx mounts <ApprovalChainEditor and calls getApprovalChains(
 *   - no new route was added (D29-05); the governance shim no longer mounts it
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROOT = process.cwd()
const EDITOR = path.join(ROOT, 'src', 'components', 'admin', 'governance', 'ApprovalChainEditor.tsx')
const SETTINGS_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'settings', 'page.tsx')
const GOVERNANCE_SHIM = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('ApprovalChainEditor — dnd-kit reorder wired to setApprovalChain', () => {
  const src = read(EDITOR)

  test('imports @dnd-kit/core and @dnd-kit/sortable useSortable', () => {
    expect(src).toContain("from '@dnd-kit/core'")
    expect(src).toContain("from '@dnd-kit/sortable'")
    expect(src).toContain('useSortable(')
  })

  test('role options limited to admin/safety_manager (Pitfall 3)', () => {
    expect(src).toContain("CHAIN_ROLES = ['admin', 'safety_manager']")
  })

  test('save button calls setApprovalChain( inside a transition and surfaces errors inline', () => {
    const fnMatch = src.match(/function handleSave\(\)[\s\S]*?\n  \}/)
    expect(fnMatch).not.toBeNull()
    const body = fnMatch![0]
    expect(body).toContain('startTransition(async ()')
    expect(body).toContain('setApprovalChain(category, payload)')
    expect(body).toContain("setError(result.error)")
  })

  test('step count bounded 1..4', () => {
    expect(src).toContain('steps.length >= 4')
    expect(src).toContain('steps.length <= 1')
  })
})

test.describe('admin/settings/page.tsx — mounts ApprovalChainEditor (relocated in 30-08)', () => {
  const src = read(SETTINGS_PAGE)

  test('imports and renders ApprovalChainEditor', () => {
    expect(src).toContain("import { ApprovalChainEditor")
    expect(src).toContain('<ApprovalChainEditor')
  })

  test('fetches existing chains via getApprovalChains(', () => {
    expect(src).toContain('getApprovalChains(')
  })

  test('guards the admin/safety_manager role', () => {
    expect(src).toContain("['admin', 'safety_manager'].includes(member.role)")
  })

  test('no new route file exists for approval chain config', () => {
    const newRoutePath = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'approval-chains', 'page.tsx')
    expect(fs.existsSync(newRoutePath)).toBe(false)
  })

  test('the governance shim no longer mounts the editor', () => {
    expect(read(GOVERNANCE_SHIM)).not.toContain('ApprovalChainEditor')
  })
})
