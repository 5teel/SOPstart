/**
 * SCP-PARSE-01..04 — Phase 20 conversion-pipeline contract.
 *
 * Phase 21 Wave 4 (Plan 21-04) — stubs flipped to LIVE source-contract tests.
 * Same Rule-3 downgrade rationale as scp-verify-checklist.test.ts (see file
 * header there).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
}

test.describe('SCP-PARSE — Phase 20 contract integration (Phase 21)', () => {
  test('SCP-PARSE-01: parse pipeline writes block_provenance on every produced block', () => {
    // The converter accepts a ProvenanceContext and stamps every Puck item.
    const conv = read('src/lib/parsers/parsed-sop-to-layout-data.ts')
    expect(conv).toContain('export interface ProvenanceContext')
    expect(conv).toContain('sourceKind')
    expect(conv).toContain("'pdf' | 'docx' | 'scan' | 'video' | 'ai_prompt'")
    expect(conv).toContain('buildBlockProvenance')
    expect(conv).toContain('BlockProvenanceSchema.safeParse')
    expect(conv).toContain('item.props.block_provenance = prov')

    // Parse route builds the context per file_type and calls the extractors.
    const route = read('src/app/api/sops/parse/route.ts')
    expect(route).toContain('ProvenanceContext')
    expect(route).toContain('extractDocxParagraphAnchors')
    expect(route).toContain('extractPdfBlockBboxes')
    expect(route).toContain('parser_run_id')
    expect(route).toContain('parser_version')
    // CLAUDE.md learning — fresh Uint8Array per call (extractPdfBlockBboxes
    // does that internally; route passes a Node Buffer each iteration).
    expect(route).toContain('Buffer.from(buffer)')
  })

  test('SCP-PARSE-02: parsed drafts land in /admin/sops/builder/[sopId] (legacy /review redirects 308)', () => {
    // Legacy redirect installed by Wave 2.
    const next = read('next.config.ts')
    expect(next).toContain("source: '/admin/sops/:sopId/review'")
    expect(next).toContain("destination: '/admin/sops/builder/:sopId'")
    expect(next).toContain('permanent: true')

    // Builder route exists + mounts the SOP via BuilderWithSourceViewer.
    const page = read('src/app/(protected)/admin/sops/builder/[sopId]/page.tsx')
    expect(page).toContain('BuilderWithSourceViewer')
    expect(page).toContain('layout_data')
  })

  test('SCP-PARSE-03: side-by-side source viewer mounted in builder', () => {
    const builder = read(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderWithSourceViewer.tsx',
    )
    // Source viewer dynamic-imported (D-21-09 bundle isolation).
    expect(builder).toContain('SourceViewerPane')
    expect(builder).toContain('dynamic(')
    expect(builder).toContain('SourceViewerSelectionProvider')
    // CONV-12 carve-out: AI-prompt SOPs skip the pane.
    expect(builder).toMatch(/showPane.*sourceFilePath/)
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

  test('Phase 23 G-01 compat: new sop_section_blocks rows start with verified_by_admin_id NULL', () => {
    // Wave 0 contract — the column has no DEFAULT, so newly inserted rows
    // naturally land as NULL. Phase 23 supersede flow relies on this.
    const migration = read(
      'supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql',
    )
    // No DEFAULT clause on verified_by_admin_id.
    expect(migration).not.toMatch(/verified_by_admin_id .* default/i)
    // D-21-05 documented in migration comment.
    expect(migration).toContain('D-21-05')
  })
})
