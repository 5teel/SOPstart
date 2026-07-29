import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 02 Task 3 — governance queue classifier + isCallerNextApprover
 * (source-contract, no live DB required).
 *
 * Verifies:
 *   - classify.ts pushes the 'awaiting_approval' flag on hasPendingApproval,
 *     and GovernanceFlag includes it.
 *   - listGovernanceQueue selects approval_state/approval_snapshot/version
 *     and computes isCallerNextApprover via stepMatchesCaller/resolveNextStepIndex
 *     — ONLY for pending rows (the sop_approvals query is skipped for
 *     non-pending rows).
 *   - GovernanceRow carries isCallerNextApprover.
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROOT = process.cwd()
const CLASSIFY_PATH = path.join(ROOT, 'src', 'lib', 'governance', 'classify.ts')
const GOVERNANCE_ACTION = path.join(ROOT, 'src', 'actions', 'governance.ts')

function read(p: string): string {
  // Worktree checkouts can CRLF-normalize source files (repo has no
  // .gitattributes — CLAUDE.md 2026-07-18); normalize before matching
  // \n-joined literals so this spec doesn't depend on checkout line endings.
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('queue classifier — awaiting_approval', () => {
  const src = read(CLASSIFY_PATH)

  test('GovernanceFlag includes awaiting_approval', () => {
    expect(src).toMatch(/export type GovernanceFlag = [^\n]*'awaiting_approval'/)
  })

  test('GovernanceInput carries hasPendingApproval', () => {
    expect(src).toContain('hasPendingApproval: boolean')
  })

  test('classifyGovernanceRow pushes awaiting_approval on hasPendingApproval', () => {
    expect(src).toContain("if (input.hasPendingApproval) flags.push('awaiting_approval')")
  })

  test('isCallerNextApprover is NOT a field of GovernanceInput (per-viewer concern lives on GovernanceRow)', () => {
    const ifaceMatch = src.match(/export interface GovernanceInput \{([\s\S]*?)\n\}/)
    expect(ifaceMatch).not.toBeNull()
    expect(ifaceMatch![1]).not.toMatch(/^\s*isCallerNextApprover\s*:/m)
  })
})

test.describe('listGovernanceQueue — isCallerNextApprover computation', () => {
  const src = read(GOVERNANCE_ACTION)
  const fnMatch = src.match(/export async function listGovernanceQueue\(([\s\S]*)/)
  const body = fnMatch![0]

  test('selects approval_state, approval_snapshot, version on sops', () => {
    expect(body).toContain('approval_state')
    expect(body).toContain('approval_snapshot')
    expect(body).toContain('version')
  })

  test('computes isCallerNextApprover via stepMatchesCaller/resolveNextStepIndex', () => {
    expect(body).toContain('resolveNextStepIndex(')
    expect(body).toContain('stepMatchesCaller(')
    expect(body).toContain('isCallerNextApprover')
  })

  test('skips the sop_approvals query for non-pending rows (only pendingSopIds queried)', () => {
    expect(body).toContain('pendingSopIds')
    expect(body).toContain("approval_state === 'pending'")
  })

  test('GovernanceRow return object includes isCallerNextApprover', () => {
    expect(body).toContain('flags,\n      isCallerNextApprover,')
  })
})
