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

    // Builder route exists + mounts the SOP via BuilderStageShell
    // (Phase 26 superseded the legacy shell — 30-01 repoint).
    const page = read('src/app/(protected)/admin/sops/builder/[sopId]/page.tsx')
    expect(page).toContain('BuilderStageShell')
    expect(page).toContain('layout_data')
  })

  test('SCP-PARSE-03: side-by-side source viewer mounted in builder', () => {
    // Repointed Phase 30 / 30-01: BuilderStageShell owns the provider +
    // CONV-12 carve-out; ReviewStation (its Review stage) mounts the pane.
    const shell = read(
      'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx',
    )
    expect(shell).toContain('SourceViewerSelectionProvider')
    // CONV-12 carve-out: AI-prompt SOPs skip the pane.
    expect(shell).toMatch(/showPane = !!sourceFilePath/)
    const reviewStation = read(
      'src/app/(protected)/admin/sops/builder/[sopId]/ReviewStation.tsx',
    )
    expect(reviewStation).toContain('SourceViewerPane')
    // D-21-09 bundle isolation is enforced structurally by the postbuild
    // gate: pdfjs/mammoth marker scan over the WORKER route's chunk set
    // (the source-viewer chain is admin-route-only).
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

  // -------------------------------------------------------------------------
  // Plan 21-05 — gap closure (verifier PASS-WITH-NOTES + UAT 2026-05-25).
  // The verify checklist walks sop_section_blocks; until 21-05 the parser
  // never wrote junctions, so the publish gate was 0===0 no-op. These tests
  // assert the contract from the integration side.
  // -------------------------------------------------------------------------

  test('SCP-PARSE-05: parser materializes junctions per Puck item with block_provenance', () => {
    const conv = read('src/lib/parsers/parsed-sop-to-layout-data.ts')
    // Public export the parse route consumes.
    expect(conv).toContain('export async function materializeJunctionsForLayout')
    // category='parsed_inline' enforced inside the loop (T-21-05-01).
    expect(conv).toContain("category: 'parsed_inline'")
    // junctionId stamped on the Puck item AFTER addBlockToSection resolves.
    expect(conv).toContain('item.props.junctionId = addRes.junction.id')
    // Throws on partial failure (T-21-05-02) — no orphan junctions.
    expect(conv).toMatch(/throw new Error\(\s*`\[materializeJunctionsForLayout\]/)
    // Strict adapter Zod-validates on the way out (T-21-05-03).
    expect(conv).toContain('BlockContentSchema.safeParse(candidate)')

    const route = read('src/app/api/sops/parse/route.ts')
    expect(route).toContain('materializeJunctionsForLayout')
    // Section row inserted FIRST without layout_data so we have an id to
    // attach junctions to. layout_data UPDATE happens after junctions are
    // materialized + props.junctionId is stamped.
    expect(route).toContain('// Step 1: insert section WITHOUT layout_data first')
  })

  test('SCP-PARSE-06: publish-gate gates on parser-created junctions (no longer a 0===0 no-op)', () => {
    // The plan deliverable: parsed SOPs now have N>0 junctions so the
    // existing gate (Wave 4) actually fires. Wave 4 already enforces
    // "publish requires verifiedCount === totalCount" — see getPublishGateStatus.
    const action = read('src/actions/sop-section-blocks.ts')
    // getPublishGateStatus returns ready=false when total>0 AND unverified>0.
    expect(action).toContain('ready: totalNum > 0 && unverifiedNum === 0')
    // Plan 21-05 wires the materializer through addBlockToSection — accepts
    // blockProvenance + serviceRole signature additions.
    expect(action).toContain('blockProvenance: BlockProvenanceSchema.optional()')
    expect(action).toContain('serviceRole: z.boolean().optional()')
    // The junction insert forwards block_provenance into the column.
    expect(action).toContain('block_provenance: data.blockProvenance ?? null')
  })

  test('SCP-PARSE-07: library picker filters parsed_inline by default (T-21-05-01)', () => {
    const blocksAction = read('src/actions/blocks.ts')
    // ListBlocksOptions has the new flag.
    expect(blocksAction).toContain('includeParsedInline?: boolean')
    // Defaulted false in listBlocks().
    expect(blocksAction).toContain('includeParsedInline: false')
    // The actual exclusion clause (PostgREST `category.neq.parsed_inline`
    // wrapped in an OR so NULL rows still pass).
    expect(blocksAction).toContain("category.is.null,category.neq.parsed_inline")
    // createBlock honours the `category` field + service-role parser path.
    expect(blocksAction).toContain('category: z.string().max(60).nullable().optional()')
    expect(blocksAction).toContain('serviceRole: z')
  })
})
