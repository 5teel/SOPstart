/**
 * SCP-PARSE -- Phase 20 conversion-pipeline contract, cut down in Phase 58-16.
 *
 * The converter halves (block provenance, junction materialisation, the plain core module the parser
 * used for blocks) and the builder halves (the builder route, the source-viewer pane) went with the
 * block model. What stays is the part of the contract the focus screen still relies on: the review
 * address redirect, the AI check firing after a parse, the bundle isolation markers, and the publish
 * gate counting focus steps.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

test.describe('SCP-PARSE -- Phase 20 contract integration (cut down in 58-16)', () => {
  test('SCP-PARSE-01/05: the parse route lands focus steps, never a layout or junctions (D-19)', () => {
    const route = read('src/app/api/sops/parse/route.ts')
    expect(route).not.toContain('ProvenanceContext')
    expect(route).toContain('writeFocusStepsForSop(')
    expect(route).not.toContain('materializeJunctionsForLayout')
    expect(route.indexOf('writeFocusStepsForSop(')).toBeLessThan(route.indexOf("status: 'completed'"))
  })

  test('SCP-PARSE-02: the legacy review address redirects to the focus editor', () => {
    const next = read('next.config.ts')
    expect(next).toContain("source: '/admin/sops/:sopId/review'")
    // Phase 58-14 (D-23): the review address lands on the focus editor.
    expect(next).toContain("destination: '/sops/:sopId?mode=edit'")
  })

  test('SCP-PARSE-03: pdfjs and mammoth stay out of the worker route (bundle gate markers)', () => {
    // D-21-09 bundle isolation is enforced structurally by the postbuild gate.
    const bundleGate = read('scripts/check-bundle-size.ts')
    expect(bundleGate).toContain('pdfjs-dist')
    expect(bundleGate).toContain('mammoth')
  })

  test('SCP-PARSE-04: AI reviewer auto-invocation wired into parse-pipeline', () => {
    // Auto-trigger helper consumed by every parse-completion path.
    const pipeline = read('src/lib/parsers/parse-pipeline.ts')
    expect(pipeline).toContain('triggerReviewerOnParseCompletion')
    // All five jobs run by default.
    expect(pipeline).toMatch(/AUTO_JOBS:\s*ReviewerJobId\[\]\s*=\s*\['A', 'B', 'C', 'D', 'E'\]/)
    // CONV-12 carve-out: AI-prompt SOPs skip reviewer.
    expect(pipeline).toMatch(/inputType === 'ai_prompt'/)

    // Parse route invokes it fire-and-forget after parse completes.
    const route = read('src/app/api/sops/parse/route.ts')
    expect(route).toMatch(/void triggerReviewerOnParseCompletion\(job\.id\)/)
  })

  test('Phase 23 G-01 compat: verified_by_admin_id has no default, so a new row starts unticked', () => {
    // Wave 0 contract -- the column has no DEFAULT, so newly inserted rows naturally land as NULL.
    const migration = read('supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql')
    expect(migration).not.toMatch(/verified_by_admin_id .* default/i)
    // D-21-05 documented in migration comment.
    expect(migration).toContain('D-21-05')
  })

  test('SCP-PARSE-06: the publish gate counts focus steps and findings (D-16)', () => {
    // Phase 58 D-16 re-keyed the gate onto focus steps; the focus publish bar answers from the same counts.
    const action = read('src/actions/publish-gate.ts')
    expect(action).toContain('ready: reasons.length === 0')
    expect(action).toContain("from('sop_focus_steps')")
    expect(read('src/components/focus/admin/PublishBar.tsx')).toContain('getPublishGateStatus')
  })
})
