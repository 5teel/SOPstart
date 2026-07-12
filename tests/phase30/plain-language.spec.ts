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
  test('stage chips read Edit / Check / Send to workers (BuilderStage union unchanged)', () => {
    const src = read(STEPPER)
    expect(src).toContain("label: 'Edit'")
    expect(src).toContain("label: 'Check'")
    expect(src).toContain("label: 'Send to workers'")
    // Engineer-speak display labels are gone.
    expect(src).not.toContain("label: 'Build'")
    expect(src).not.toContain("label: 'Review & verify'")
    expect(src).not.toContain("label: 'Publish'")
    // Route/state names unchanged — the union stays.
    expect(src).toContain("'build' | 'review' | 'publish'")
    expect(src).toContain("stage: 'build'")
    expect(src).toContain("stage: 'review'")
    expect(src).toContain("stage: 'publish'")
  })

  test('KIND_LABEL maps all 5 reviewer kinds to plain outcomes AND is rendered', () => {
    const src = read(FLAG_BADGE)
    expect(src).toMatch(/KIND_LABEL:\s*Record<ReviewerFlagKind,\s*string>/)
    expect(src).toContain("hallucination: 'Made-up content'")
    expect(src).toContain("omission: 'Missing content'")
    expect(src).toContain("anchoring: 'Picture not linked to its step'")
    expect(src).toContain("table_fidelity: 'Table may be scrambled'")
    expect(src).toContain("terminology: 'Wording changed'")
    // WIRING (CLAUDE.md 2026-06-05): the plain title is actually rendered,
    // not just declared — and the raw kind no longer appears in the title attr.
    expect(src).toContain('KIND_LABEL[flag.kind]')
    expect(src).toMatch(/\{plainTitle\}/)
    expect(src).not.toMatch(/title=\{`[^`]*\$\{flag\.kind\}/)
  })

  test('flag UI never says "block N" — human step/section names only', () => {
    const dir = path.join(ROOT, 'src', 'components', 'admin', 'ai-reviewer')
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
      const src = read(path.join(dir, f))
      expect(src, `${f} must not render "block N" titles`).not.toMatch(/[Bb]lock \$\{/)
      expect(src, `${f} must not render "block N" titles`).not.toContain('block N')
    }
    // FlagBadge surfaces the human location hint ("page 3 step 7" / "section 2.1").
    expect(read(FLAG_BADGE)).toContain('flag.source_location_hint')
  })

  test('publish surface states reversibility ("You can unpublish or edit later")', () => {
    const src = read(PUBLISH_STAGE)
    expect(src).toContain('You can unpublish or edit later')
  })

  test('offline pill is plain-languaged', () => {
    const src = read(
      path.join(ROOT, 'src', 'components', 'layout', 'OnlineStatusBanner.tsx'),
    )
    expect(src).not.toContain('Offline — changes saved locally')
    expect(src).toContain('No internet — your work is saved on this device')
  })
})
