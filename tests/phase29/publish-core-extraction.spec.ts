import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Phase 29 Plan 01 Task 3 — proves performPublish() is the single relocated
// source of publish truth (D29-03), the route delegates to it (not a
// duplicated inline flip), and the no-chain route body does NOT yet branch
// on approval_chains (that lands in Plan 29-02).
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

  test('no-chain publish unchanged — route does NOT yet branch on approval_chains', () => {
    expect(routeSrc).not.toContain('approval_chains')
  })
})
