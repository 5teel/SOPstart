/**
 * Phase 26.5 — D-03/D-04/D-05/D-12/D-16: synthesis pipeline.
 * LIVE since Plan 26.5-04 (src/lib/agent-layer/synthesis.ts) via
 * source-contract assertions — runtime AI calls are mocked/deferred
 * (test.fixme below) since a real run requires live Voyage/Anthropic keys.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SYNTHESIS_PATH = path.join(REPO_ROOT, 'src', 'lib', 'agent-layer', 'synthesis.ts')
const PUBLISH_ROUTE_PATH = path.join(
  REPO_ROOT,
  'src',
  'app',
  'api',
  'sops',
  '[sopId]',
  'publish',
  'route.ts',
)

function readSynthesisSource(): string {
  return fs.readFileSync(SYNTHESIS_PATH, 'utf-8')
}

test('D-03/D-16: synthesis.ts uses shared EMBED_MODEL/SYNTHESIS_MODEL constants, no hardcoded model literals', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created — waiting for the synthesis plan')
    return
  }
  const src = readSynthesisSource()
  expect(src).toContain('model-constants')
  expect(src).toContain('EMBED_MODEL')
  expect(src).toContain('SYNTHESIS_MODEL')
  expect(src).toContain('getVoyageClient')
  expect(src).toContain('getAnthropic')
  expect(src).not.toContain("'voyage-3")
  expect(src).not.toContain("'claude-haiku")
})

test('D-04: publish route fires triggerAgentSynthesis non-blocking (never awaited, .catch logged)', () => {
  if (!fs.existsSync(SYNTHESIS_PATH) || !fs.existsSync(PUBLISH_ROUTE_PATH)) {
    test.skip(true, 'synthesis.ts or publish route not yet created')
    return
  }
  const publishRoute = fs.readFileSync(PUBLISH_ROUTE_PATH, 'utf-8')
  if (!publishRoute.includes('triggerAgentSynthesis')) {
    // Publish route wiring is Plan 26.5-05's job, not this plan's.
    test.skip(true, 'publish route not yet wired to triggerAgentSynthesis — deferred to Plan 26.5-05')
    return
  }
  expect(publishRoute).toContain('triggerAgentSynthesis')
  expect(publishRoute).not.toContain('await triggerAgentSynthesis')
})

test('D-12: synthesis.ts exposes deriveAssessment returning fresh|drifting|needs-review', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created')
    return
  }
  const src = readSynthesisSource()
  expect(src).toContain('deriveAssessment')
  expect(src).toContain("'fresh'")
  expect(src).toContain("'drifting'")
  expect(src).toContain("'needs-review'")
})

test('Pitfall 5: triggerAgentSynthesis is fire-and-forget — .catch wired, never re-throws', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created')
    return
  }
  const src = readSynthesisSource()
  const fnStart = src.indexOf('function triggerAgentSynthesis')
  expect(fnStart).toBeGreaterThan(-1)
  const fnBody = src.slice(fnStart, fnStart + 400)
  expect(fnBody).toContain('.catch(')
  expect(fnBody).not.toContain('throw')
})

test('T-26.5-04-01: every DB write in synthesis.ts sets organisation_id; layout_data is never referenced', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created')
    return
  }
  const src = readSynthesisSource()
  expect(src).not.toContain('layout_data')
  const writeCount = (src.match(/\.(insert|upsert)\(/g) ?? []).length
  const orgIdCount = (src.match(/organisation_id/g) ?? []).length
  expect(writeCount).toBeGreaterThan(0)
  expect(orgIdCount).toBeGreaterThanOrEqual(writeCount)
})

test.fixme('D-03: publish generates embedding via mocked Voyage client (injectable seam)', () => {
  // Behavioral test with fake embed/tag seams — deferred; would require
  // adding an injectable client seam to synthesis.ts (not required by
  // this plan's acceptance criteria).
})

test.fixme('D-04: draft saves never trigger synthesis (autosave path untouched)', () => {
  // Behavioral test — verified by code review that the autosave path never
  // imports synthesis.ts; triggerAgentSynthesis is only called from the
  // publish route (Plan 26.5-05).
})

test('null-clobber guard: failed steps are omitted from the upsert, not written as null/empty', () => {
  // 2026-07-05 incident: a backfill run without VOYAGE_API_KEY overwrote good
  // prod embeddings with null. Failed steps must be conditionally spread.
  const src = fs.readFileSync('src/lib/agent-layer/synthesis.ts', 'utf-8')
  expect(src).toMatch(/\.\.\.\(tagResult !== null &&/)
  expect(src).toMatch(/\.\.\.\(embedding !== null &&/)
  expect(src).toContain("'partial'")
  expect(src).not.toMatch(/embedding: embedding \? JSON\.stringify\(embedding\) : null/)
})
