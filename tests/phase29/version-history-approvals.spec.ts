import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 05 Task 3 — version-history approval log (source-contract,
 * no live DB required).
 *
 * Verifies:
 *   - The versions page imports and calls getApprovalHistory( for the version
 *     lineage in the same effect that loads getVersionHistory.
 *   - Approval rows are filtered per-version by `a.sopId === ver.id`.
 *   - The render block is read-only: no mutation action call (approveStep,
 *     requestChanges, cloneSopAsDraft, restoreVersionAsNew, uploadNewVersion)
 *     appears inside the approval-rows render block.
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROOT = process.cwd()
const VERSIONS_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', '[sopId]', 'versions', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('versions page — fetches approval history alongside version history', () => {
  const src = read(VERSIONS_PAGE)

  test('imports getApprovalHistory from src/actions/approvals', () => {
    expect(src).toContain("import { getApprovalHistory, type ApprovalHistoryRow } from '@/actions/approvals'")
  })

  test('calls getApprovalHistory( with the version id lineage inside loadVersions', () => {
    const fnMatch = src.match(/async function loadVersions\(\) \{([\s\S]*?)\n    \}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toContain('getApprovalHistory(result.versions.map((v) => v.id))')
  })

  test('filters approval rows by ver.id per version', () => {
    expect(src).toContain("approvals.filter((a) => a.sopId === ver.id)")
  })
})

test.describe('versions page — approval render block is read-only', () => {
  const src = read(VERSIONS_PAGE)

  test('renders approver label, action, step label, and date per row', () => {
    const blockMatch = src.match(/verApprovals\.map\(\(a\) => \(([\s\S]*?)\)\)\}/)
    expect(blockMatch).not.toBeNull()
    const block = blockMatch![1]
    expect(block).toContain('a.approverLabel')
    expect(block).toContain("a.action === 'approved'")
    expect(block).toContain('a.stepLabel')
    expect(block).toContain('formatDate(a.createdAt)')
  })

  test('no mutation action call inside the approval-rows render block', () => {
    const blockMatch = src.match(/\{verApprovals\.length > 0 && \(([\s\S]*?)\)\}/)
    expect(blockMatch).not.toBeNull()
    const block = blockMatch![1]
    for (const mutation of ['approveStep(', 'requestChanges(', 'cloneSopAsDraft(', 'restoreVersionAsNew(', 'uploadNewVersion(']) {
      expect(block).not.toContain(mutation)
    }
  })
})
