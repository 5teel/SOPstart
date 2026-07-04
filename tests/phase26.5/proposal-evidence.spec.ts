/**
 * Phase 26.5 — D-07/D-08: evidence-backed proposals + free-append memory
 * (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when the proposal/memory write path ships: asserts proposals carry
 * an evidence payload and are ALWAYS pending (no auto-apply tier), while memory
 * writes are ungated appends. Skips cleanly until then.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const AGENT_LAYER_DIR = path.join(REPO_ROOT, 'src', 'lib', 'agent-layer')

function findProposalSource(): string | null {
  if (!fs.existsSync(AGENT_LAYER_DIR)) return null
  for (const f of fs.readdirSync(AGENT_LAYER_DIR)) {
    const p = path.join(AGENT_LAYER_DIR, f)
    if (f.endsWith('.ts') && fs.readFileSync(p, 'utf-8').includes('createLearningProposal')) {
      return p
    }
  }
  return null
}

test('D-07: createLearningProposal inserts with evidence and status pending', () => {
  const file = findProposalSource()
  if (!file) {
    test.skip(true, 'createLearningProposal not yet created — waiting for the proposals plan')
    return
  }
  const src = fs.readFileSync(file, 'utf-8')
  expect(src).toContain('evidence')
  expect(src).toContain("'pending'")
  expect(src).toContain('organisation_id')
})

test.fixme('D-07: proposal insert carries source memory rows + signal counts (unit, injectable AdminInsertFn seam)', () => {
  // Fake-seam unit test, no live DB — implemented in the proposals plan.
})

test.fixme('D-08: memory writes append without any approval gate', () => {
  // Behavioral test — implemented in the memory plan.
})
