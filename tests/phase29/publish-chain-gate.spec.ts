import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Phase 29 Plan 02 Task 2 — publish-route chain gate (source-contract, no
 * live DB required).
 *
 * Verifies (D29-03 / plan-checker Blocker 1):
 *   - The route references approval_chains and diverts a chained-category SOP
 *     into approval_state='pending' + approval_snapshot, WITHOUT publishing.
 *   - assertPublishGates() runs BEFORE the pending divert (LOCKED ORDERING —
 *     an SOP with unapproved sections/unverified blocks can never enter
 *     pending_approval, chain or no chain).
 *   - The alreadyPending idempotent short-circuit exists (a second
 *     "request publish" click on an already-pending SOP is a no-op).
 *   - The no-chain branch still calls performPublish( — byte-identical path
 *     preserved for categories with no chain configured.
 *
 * Registration: playwright.config.ts `phase29` project
 *   testDir: '.', testMatch: /tests\/phase29\/.*\.(spec|test)\.ts$/
 */

const ROUTE_PATH = path.resolve(__dirname, '../../src/app/api/sops/[sopId]/publish/route.ts')

test.describe('chain gate — publish route divert into pending_approval', () => {
  const routeSrc = readFileSync(ROUTE_PATH, 'utf8')

  test('route references approval_chains', () => {
    expect(routeSrc).toContain(".from('approval_chains')")
  })

  test('diverts into approval_state pending + approval_snapshot, without publishing', () => {
    expect(routeSrc).toContain("approval_state: 'pending'")
    expect(routeSrc).toContain('approval_snapshot: chainRow.steps')
    expect(routeSrc).toContain('pendingApproval: true')
  })

  test('LOCKED ORDERING: assertPublishGates( runs BEFORE the pending divert', () => {
    const gateIdx = routeSrc.indexOf('assertPublishGates(')
    const divertIdx = routeSrc.indexOf("approval_state: 'pending'")
    expect(gateIdx).toBeGreaterThan(-1)
    expect(divertIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeLessThan(divertIdx)
  })

  test('alreadyPending idempotent short-circuit present', () => {
    expect(routeSrc).toContain('alreadyPending: true')
    // Must appear on the "already pending" read-path AND the 0-rows-updated race guard.
    const occurrences = routeSrc.split('alreadyPending: true').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  test('no-chain branch still calls performPublish( — byte-identical path preserved', () => {
    const noChainIdx = routeSrc.lastIndexOf('performPublish(')
    expect(noChainIdx).toBeGreaterThan(-1)
    expect(routeSrc).toContain('pipelineAutoQueued: result.pipelineAutoQueued')
  })
})
