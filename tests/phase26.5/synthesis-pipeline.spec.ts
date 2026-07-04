/**
 * Phase 26.5 — D-03/D-04: synthesis pipeline (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when src/lib/agent-layer/synthesis.ts ships: asserts the pipeline
 * imports the shared model constants (no hardcoded model literals — CLAUDE.md
 * 2026-06-02 model-rot learning) and the publish route triggers it fire-and-forget.
 * Skips cleanly until then (phase22 fs.existsSync + test.skip convention).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SYNTHESIS_PATH = path.join(REPO_ROOT, 'src', 'lib', 'agent-layer', 'synthesis.ts')

test('D-03: synthesis.ts uses shared EMBED_MODEL/SYNTHESIS_MODEL constants, no hardcoded model literals', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created — waiting for the synthesis plan')
    return
  }
  const src = fs.readFileSync(SYNTHESIS_PATH, 'utf-8')
  expect(src).toContain('model-constants')
  expect(src).not.toContain("'voyage-3")
  expect(src).not.toContain("'claude-haiku")
})

test('D-04: publish route fires triggerAgentSynthesis non-blocking (never awaited, .catch logged)', () => {
  if (!fs.existsSync(SYNTHESIS_PATH)) {
    test.skip(true, 'synthesis.ts not yet created — waiting for the synthesis plan')
    return
  }
  const publishRoute = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'app', 'api', 'sops', '[sopId]', 'publish', 'route.ts'),
    'utf-8',
  )
  expect(publishRoute).toContain('triggerAgentSynthesis')
  expect(publishRoute).not.toContain('await triggerAgentSynthesis')
})

test.fixme('D-03: publish generates embedding via mocked Voyage client (injectable seam)', () => {
  // Behavioral test with fake embed/tag seams — implemented in the synthesis plan.
})

test.fixme('D-04: draft saves never trigger synthesis (autosave path untouched)', () => {
  // Behavioral test — implemented in the synthesis plan.
})
