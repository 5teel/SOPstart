/**
 * UX-07 — Plain-language pass (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Plain-Language Sources — labels ONLY;
 * routes, state unions, DB enum values unchanged):
 *   - Builder stage chips (BuilderStageStepper.tsx): 'Build' → 'Edit',
 *     'Review & verify' → 'Check', 'Publish' → 'Send to workers'.
 *     BuilderStage union 'build'|'review'|'publish' UNCHANGED.
 *   - AI reviewer flag titles (FlagBadge.tsx): KIND_LABEL map —
 *     hallucination → 'Made-up content', omission → 'Missing content',
 *     anchoring → 'Picture not linked to its step', table_fidelity →
 *     'Table may be scrambled', terminology → 'Wording changed'.
 *     UI-side mapping only; job prompts untouched.
 *   - "block N" ban: flag display components render human step/section
 *     names, never raw block ids.
 *   - Reversibility near publish (PublishStage.tsx): "You can unpublish or
 *     edit later".
 *   - Offline pill (OnlineStatusBanner.tsx) plain-languaged.
 *
 * This file starts as test.fixme — the UX-07 plan flips it live.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STEPPER = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderStageStepper.tsx',
)
const FLAG_BADGE = path.join(ROOT, 'src', 'components', 'admin', 'ai-reviewer', 'FlagBadge.tsx')
const PUBLISH_STAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'PublishStage.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-07 — plain-language pass (labels only)', () => {
  test.fixme('stage chips read Edit / Check / Send to workers (BuilderStage union unchanged)', () => {
    const src = read(STEPPER)
    expect(src).toContain("'Edit'")
    expect(src).toContain("'Check'")
    expect(src).toContain("'Send to workers'")
    // Route/state names unchanged — the union stays.
    expect(src).toContain("'build' | 'review' | 'publish'")
  })

  test.fixme('KIND_LABEL maps all 5 reviewer kinds to plain outcomes', () => {
    const src = read(FLAG_BADGE)
    expect(src).toContain('Made-up content')
    expect(src).toContain('Missing content')
    expect(src).toContain('Picture not linked to its step')
    expect(src).toContain('Table may be scrambled')
    expect(src).toContain('Wording changed')
  })

  test.fixme('publish surface states reversibility ("You can unpublish or edit later")', () => {
    const src = read(PUBLISH_STAGE)
    expect(src).toContain('You can unpublish or edit later')
  })

  test.fixme('offline pill is plain-languaged', () => {
    const src = read(
      path.join(ROOT, 'src', 'components', 'layout', 'OnlineStatusBanner.tsx'),
    )
    expect(src).not.toContain('Offline — changes saved locally')
  })
})
