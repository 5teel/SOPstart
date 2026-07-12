import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Phase 29 Plan 01 Task 3 — proves performPublish() is the single relocated
// source of publish truth (D29-03), the route delegates to it (not a
// duplicated inline flip). Plan 29-02 added the chain-gate divert — see the
// updated assertions below for the post-chain-gate contract.
const ROUTE_PATH = path.resolve(__dirname, '../../src/app/api/sops/[sopId]/publish/route.ts')
const CORE_PATH = path.resolve(__dirname, '../../src/lib/governance/publish-core.ts')

test.describe('performPublish shared — publish-core extraction', () => {
  const routeSrc = readFileSync(ROUTE_PATH, 'utf8')
  const coreSrc = readFileSync(CORE_PATH, 'utf8')

  test('route imports and calls performPublish', () => {
    expect(routeSrc).toContain("from '@/lib/governance/publish-core'")
    expect(routeSrc).toContain('performPublish(')
  })

  test('publish-core.ts contains the unapproved-sections gate', () => {
    expect(coreSrc).toContain(".eq('approved', false)")
  })

  test('publish-core.ts contains the unverified_blocks gate', () => {
    expect(coreSrc).toContain('unverified_blocks')
  })

  test('publish-core.ts contains the status: published UPDATE', () => {
    expect(coreSrc).toContain("status: 'published'")
  })

  test('publish-core.ts calls triggerAgentSynthesis', () => {
    expect(coreSrc).toContain('triggerAgentSynthesis(')
  })

  test('publish-core.ts calls enqueueVideoGenerationForPipeline', () => {
    expect(coreSrc).toContain('enqueueVideoGenerationForPipeline(')
  })

  test('exports both performPublish and assertPublishGates', () => {
    expect(coreSrc).toContain('export async function performPublish(')
    expect(coreSrc).toContain('export async function assertPublishGates(')
  })

  // Phase 29 Plan 02 — the route now branches on approval_chains (chain-gate
  // divert). Replaces the pre-Plan-02 "no branch yet" assertion above with the
  // post-chain-gate contract: the route references approval_chains, and
  // assertPublishGates() runs BEFORE the pending_approval write (locked
  // ordering, D29-03/plan-checker Blocker 1) — without removing this
  // assertion, a Wave-4 gate would fail on the (now expected) approval_chains
  // reference.
  test('route references approval_chains (chain-gate divert, Plan 29-02)', () => {
    expect(routeSrc).toContain('approval_chains')
  })

  test('assertPublishGates( runs BEFORE the approval_state pending divert (locked ordering)', () => {
    const gateIdx = routeSrc.indexOf('assertPublishGates(')
    const divertIdx = routeSrc.indexOf("approval_state: 'pending'")
    expect(gateIdx).toBeGreaterThan(-1)
    expect(divertIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeLessThan(divertIdx)
  })

  test('no-chain branch still calls performPublish( — byte-identical path preserved', () => {
    expect(routeSrc).toContain('performPublish(')
  })
})
