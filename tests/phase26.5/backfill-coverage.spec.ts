/**
 * Phase 26.5 — D-15: backfill all currently-published SOPs (Wave-0 stub, Plan 26.5-01).
 *
 * Goes LIVE when the one-off backfill script ships: asserts it targets
 * published SOPs only and reuses the shared synthesis pipeline (no duplicate
 * embed/tag logic). Runtime row-count coverage is a manual + seeded-DB check
 * in the backfill plan. Skips cleanly until then.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function findBackfillScript(): string | null {
  for (const dir of [path.join(REPO_ROOT, 'scripts'), path.join(REPO_ROOT, 'src', 'lib', 'agent-layer')]) {
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (/backfill/i.test(f) && /agent|metadata|embed/i.test(fs.readFileSync(path.join(dir, f), 'utf-8'))) {
        return path.join(dir, f)
      }
    }
  }
  return null
}

test('D-15: backfill script exists and scopes to published SOPs', () => {
  const file = findBackfillScript()
  if (!file) {
    test.skip(true, 'backfill script not yet created — waiting for the backfill plan')
    return
  }
  const src = fs.readFileSync(file, 'utf-8')
  expect(src).toContain('published')
})

test('D-15: backfill reuses the shared synthesis pipeline (no duplicate embed logic)', () => {
  const file = findBackfillScript()
  if (!file) {
    test.skip(true, 'backfill script not yet created — waiting for the backfill plan')
    return
  }
  const src = fs.readFileSync(file, 'utf-8')
  expect(src).toMatch(/synthesis|triggerAgentSynthesis/)
})

test.fixme('D-15: backfill covers every currently-published SOP (seeded DB row-count assertion)', () => {
  // Integration/manual-verify against seeded published SOPs — backfill plan.
})
