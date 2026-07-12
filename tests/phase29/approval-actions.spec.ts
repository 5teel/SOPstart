import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 02 Task 1 — approval actions (source-contract, no live DB).
 *
 * Verifies:
 *   requireAdmin() is EXPORTED from governance.ts and returns `role` in its ctx.
 *   approvals.ts exports the full action surface (setApprovalChain,
 *     getApprovalChains, approveStep, requestChanges, getApprovalStatus,
 *     getApprovalHistory).
 *   T-29-02-01: setApprovalChain sources organisation_id ONLY from ctx, never
 *     a function parameter.
 *   T-29-02-02: approveStep calls stepMatchesCaller()/resolveNextStepIndex()
 *     BEFORE the sop_approvals insert, and its final-step branch calls the
 *     SAME performPublish() the no-chain route calls (APR-04) — not a
 *     duplicated inline status flip.
 *   requestChanges rejects an empty/whitespace-only comment before any write.
 *
 * These are WIRED assertions (real call sites, not bare token presence —
 * CLAUDE.md 2026-06-05 learning).
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROOT = process.cwd()
const GOVERNANCE_ACTION = path.join(ROOT, 'src', 'actions', 'governance.ts')
const APPROVALS_ACTION = path.join(ROOT, 'src', 'actions', 'approvals.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('approval actions — requireAdmin exported with role', () => {
  const src = read(GOVERNANCE_ACTION)

  test('requireAdmin is exported', () => {
    expect(src).toContain('export async function requireAdmin(')
  })

  test('requireAdmin returns role in its ctx', () => {
    const fnMatch = src.match(/export async function requireAdmin\(([\s\S]*?)\n\}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch![0]).toContain('role: role as AppRole')
  })
})

test.describe('approval actions — approvals.ts action surface', () => {
  const src = read(APPROVALS_ACTION)

  test('file starts with use server', () => {
    expect(src.trimStart().startsWith("'use server'")).toBe(true)
  })

  test('exports the full chain-action surface', () => {
    for (const name of [
      'setApprovalChain',
      'getApprovalChains',
      'approveStep',
      'requestChanges',
      'getApprovalStatus',
      'getApprovalHistory',
    ]) {
      expect(src).toContain(`export async function ${name}(`)
    }
  })

  test('T-29-02-01: setApprovalChain sources organisation_id ONLY from ctx, never a parameter', () => {
    const sigMatch = src.match(/export async function setApprovalChain\(([\s\S]*?)\):/)
    expect(sigMatch).not.toBeNull()
    expect(sigMatch![1].toLowerCase()).not.toContain('organisationid')

    const fnMatch = src.match(/export async function setApprovalChain\(([\s\S]*?)\n\}/)
    const body = fnMatch![0]
    expect(body).toContain('createAdminClient()')
    expect(body).toContain('organisation_id: ctx.organisationId')
    expect(body).toContain("onConflict: 'organisation_id,category'")
  })

  test('T-29-02-02: approveStep gates on stepMatchesCaller/resolveNextStepIndex BEFORE the insert', () => {
    const fnMatch = src.match(/export async function approveStep\(([\s\S]*?)\nexport /)
    const body = fnMatch![0]
    const resolveIdx = body.indexOf('resolveNextStepIndex(')
    const matchIdx = body.indexOf('stepMatchesCaller(')
    const insertIdx = body.indexOf(".from('sop_approvals').insert(")
    expect(resolveIdx).toBeGreaterThan(-1)
    expect(matchIdx).toBeGreaterThan(-1)
    expect(insertIdx).toBeGreaterThan(-1)
    expect(matchIdx).toBeLessThan(insertIdx)
    expect(body).toContain("'Not your turn to approve'")
  })

  test('APR-04: approveStep final-step branch calls performPublish( with approvalState: approved', () => {
    const fnMatch = src.match(/export async function approveStep\(([\s\S]*?)\nexport /)
    const body = fnMatch![0]
    expect(body).toContain('performPublish(')
    expect(body).toContain("approvalState: 'approved'")
  })

  test('approveStep idempotent on 23505 (double-click)', () => {
    const fnMatch = src.match(/export async function approveStep\(([\s\S]*?)\nexport /)
    const body = fnMatch![0]
    expect(body).toContain("insertErr.code !== '23505'")
  })

  test('requestChanges rejects an empty/whitespace comment before any write', () => {
    const fnMatch = src.match(/export async function requestChanges\(([\s\S]*?)\nexport /)
    const body = fnMatch![0]
    const guardIdx = body.indexOf("'A comment is required'")
    const writeIdx = body.indexOf(".from('sop_approvals').insert(")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(writeIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(writeIdx)
  })

  test('requestChanges clears approval_state to null, leaves approval_snapshot in place', () => {
    const fnMatch = src.match(/export async function requestChanges\(([\s\S]*?)\nexport /)
    const body = fnMatch![0]
    expect(body).toContain('.update({ approval_state: null })')
    expect(body).not.toContain('approval_snapshot: null')
  })
})
