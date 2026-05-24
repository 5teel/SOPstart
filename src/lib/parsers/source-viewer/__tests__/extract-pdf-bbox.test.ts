/**
 * Phase 21 (Plan 21-01 Task 2) — extract-pdf-bbox unit tests.
 *
 * Covers:
 *  - Block count regression vs Spike 001 corpus (large-rondot-probe.pdf)
 *  - DataCloneError regression guard: consecutive calls on same Buffer must
 *    not throw (Spike 001 finding #1 — pdfjs holds worker state on the input
 *    ArrayBuffer; fresh Uint8Array per call is required)
 *
 * Runs under the existing `phase20-parsers` Playwright project, which
 * already targets `src/lib/parsers/__tests__/*.test.ts`. To pick up the
 * source-viewer tests too, the project's testDir was widened in this plan;
 * if it wasn't, this file still runs via the top-level testDir glob.
 */

import { test, expect } from '@playwright/test'
import { readFile, access } from 'node:fs/promises'
import {
  extractPdfBlockBboxes,
} from '@/lib/parsers/source-viewer/extract-pdf-bbox'

// Spike 001 corpus lives under the main repo, NOT the worktree. The test
// references it by absolute path (same pattern as
// `src/lib/parsers/__tests__/extract-docx-structural.test.ts`).
const CORPUS_PDF =
  'C:\\Development\\SOPstart\\.planning\\spikes\\001-pdf-image-extraction-bundle-safe\\experiment\\corpus\\large-rondot-probe.pdf'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

test.describe('extractPdfBlockBboxes — Spike 001 corpus', () => {
  test('extracts >= 37 bboxes across all pages of large-rondot-probe.pdf', async () => {
    test.skip(
      !(await exists(CORPUS_PDF)),
      `corpus PDF missing at ${CORPUS_PDF} — run in main repo where Spike 001 corpus exists`,
    )

    const buf = await readFile(CORPUS_PDF)
    // Discover numPages by extracting page 1 first (Spike 001's large-rondot is 17 pages).
    // We don't need an exact upper bound — loop until we hit a page that returns [].
    let total = 0
    const MAX_PAGES = 50
    for (let p = 1; p <= MAX_PAGES; p++) {
      let blocks
      try {
        blocks = await extractPdfBlockBboxes(buf, p)
      } catch (err) {
        // Past last page — pdfjs throws on out-of-range; stop the walk.
        if (
          err instanceof Error &&
          /Invalid|out of range|Page index/i.test(err.message)
        ) {
          break
        }
        throw err
      }
      // pdfjs may also return empty array; only stop if we've passed numPages.
      // Heuristic: once we've seen >= 1 page with content AND now see 0, AND
      // we've extracted enough to satisfy the assertion, stop.
      total += blocks.length
    }

    // Spike 001 measured 37+ image-bearing bboxes on large-rondot-probe.pdf.
    expect(total).toBeGreaterThanOrEqual(37)
  })

  test('consecutive calls on the same Buffer do not throw DataCloneError', async () => {
    test.skip(
      !(await exists(CORPUS_PDF)),
      `corpus PDF missing at ${CORPUS_PDF}`,
    )

    const buf = await readFile(CORPUS_PDF)
    // The Spike 001 regression: a second call on the same Buffer used to
    // crash with `DataCloneError: Cannot transfer object of unsupported type`
    // at `LoopbackPort.postMessage` because pdfjs held internal worker state
    // on the input ArrayBuffer. The fix: fresh `new Uint8Array(buf)` per call.
    await extractPdfBlockBboxes(buf, 1)
    await expect(extractPdfBlockBboxes(buf, 1)).resolves.toBeDefined()
  })
})
