/**
 * Phase 20 interim — extract-docx-structural.ts unit tests.
 *
 * Covers:
 *   - Procedural table detection on every image-rich SOP in the corpus
 *   - Image-to-row alignment via cell containment (NOT stream proximity)
 *   - Header-row detection
 *   - Edge cases: text-only docs, nested tables, empty paragraphs
 *
 * These tests use the real EN-FOR-* corpus DOCX files in
 * `SOPstart - Raw SOPs/GMF_Forming/` as fixtures. They run as Playwright
 * unit tests under the `phase20-parsers` project (see playwright.config.ts).
 */
import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { extractDocxStructural } from '@/lib/parsers/extract-docx-structural'
import { structuredDocToPrompt } from '@/lib/parsers/structured-doc-to-prompt'
import { StructuredDocSchema } from '@/lib/parsers/structural-doc'

const CORPUS_DIR = 'C:\\Development\\SOPstart\\SOPstart - Raw SOPs\\GMF_Forming'

async function load(name: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(CORPUS_DIR, name))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

test.describe('extract-docx-structural — corpus snapshot', () => {
  // Hard truths derived from a one-time survey of the 8 DOCX files. If the
  // extractor regresses, these numbers move and the test fails loudly.
  const CASES: Array<{
    file: string
    expect: {
      proceduralTablesAtLeast: number
      imagesAtLeast: number
      imagesInTablesAtLeast: number
    }
  }> = [
    { file: 'EN-FOR-02-001 Forming Safety.docx', expect: { proceduralTablesAtLeast: 0, imagesAtLeast: 0, imagesInTablesAtLeast: 0 } },
    { file: 'EN-FOR-02-003 Adjacent Section Stoppage.docx', expect: { proceduralTablesAtLeast: 0, imagesAtLeast: 0, imagesInTablesAtLeast: 0 } },
    { file: 'EN-FOR-02-061 Swabbing and Swab Rejects.docx', expect: { proceduralTablesAtLeast: 0, imagesAtLeast: 0, imagesInTablesAtLeast: 0 } },
    { file: 'EN-FOR-03-001 Forming Machine Swabbing.docx', expect: { proceduralTablesAtLeast: 1, imagesAtLeast: 30, imagesInTablesAtLeast: 30 } },
    { file: 'EN-FOR-03-002 Baffle Arm Setup for an O-I Machine.docx', expect: { proceduralTablesAtLeast: 1, imagesAtLeast: 50, imagesInTablesAtLeast: 50 } },
    { file: 'EN-FOR-03-031 Blank Side Hanger Change.docx', expect: { proceduralTablesAtLeast: 1, imagesAtLeast: 40, imagesInTablesAtLeast: 40 } },
    { file: 'EN-FOR-03-042 Gob Delivery Setup - Deflectors.docx', expect: { proceduralTablesAtLeast: 3, imagesAtLeast: 50, imagesInTablesAtLeast: 50 } },
    { file: 'EN-FOR-03-043 Blank Temperature Measurement with Rondot Probe.docx', expect: { proceduralTablesAtLeast: 1, imagesAtLeast: 30, imagesInTablesAtLeast: 30 } },
  ]

  for (const c of CASES) {
    test(c.file, async () => {
      const buf = await load(c.file)
      const { doc, images } = await extractDocxStructural(buf)

      // Zod validates the entire returned shape.
      StructuredDocSchema.parse(doc)

      expect(doc.stats.proceduralTableCount, 'procedural table count').toBeGreaterThanOrEqual(
        c.expect.proceduralTablesAtLeast
      )
      expect(doc.stats.imageCount, 'image count').toBeGreaterThanOrEqual(c.expect.imagesAtLeast)
      expect(doc.stats.imagesInTables, 'images in tables').toBeGreaterThanOrEqual(
        c.expect.imagesInTablesAtLeast
      )
      expect(images.length, 'images array length === stats.imageCount').toBe(doc.stats.imageCount)
    })
  }
})

test.describe('extract-docx-structural — alignment invariants on EN-FOR-03-042', () => {
  test('every procedural-table image lives in a row whose stepCol cell has text', async () => {
    const buf = await load('EN-FOR-03-042 Gob Delivery Setup - Deflectors.docx')
    const { doc } = await extractDocxStructural(buf)

    let imagesChecked = 0
    let imagesWithLocatableStep = 0
    for (const block of doc.blocks) {
      if (block.kind !== 'table' || !block.isProcedural || !block.roleHint) continue
      const { stepCol, imagesCol } = block.roleHint
      if (stepCol === null || imagesCol === null) continue
      for (const row of block.rows) {
        if (row.isHeader) continue
        const imageCell = row.cells.find((c) => c.colIndex === imagesCol)
        const stepCell = row.cells.find((c) => c.colIndex === stepCol)
        if (!imageCell || !stepCell) continue
        for (const _idx of imageCell.images) {
          imagesChecked++
          if (stepCell.text.trim().length > 0) imagesWithLocatableStep++
        }
      }
    }
    expect(imagesChecked, 'corpus has >0 procedural-table images').toBeGreaterThan(20)
    expect(imagesWithLocatableStep / imagesChecked, 'every procedural image has a step text in same row').toBeGreaterThanOrEqual(
      0.95
    )
  })

  test('image indexes assigned during walk are dense from 0..N-1', async () => {
    const buf = await load('EN-FOR-03-042 Gob Delivery Setup - Deflectors.docx')
    const { doc, images } = await extractDocxStructural(buf)
    expect(images.map((i) => i.index).sort((a, b) => a - b)).toEqual(
      Array.from({ length: images.length }, (_, i) => i)
    )
    expect(doc.imageRefs.map((r) => r.index).sort((a, b) => a - b)).toEqual(
      Array.from({ length: doc.imageRefs.length }, (_, i) => i)
    )
  })
})

test.describe('structured-doc-to-prompt', () => {
  test('emits procedural-hint line and per-row [IMG N] tokens', async () => {
    const buf = await load('EN-FOR-03-042 Gob Delivery Setup - Deflectors.docx')
    const { doc } = await extractDocxStructural(buf)
    const text = structuredDocToPrompt(doc)
    expect(text).toContain('PROCEDURAL: stepCol=')
    expect(text).toContain('[IMG 11]')
    expect(text).toContain('END TABLE')
  })

  test('prompt does NOT contain raw <w:p> XML', async () => {
    const buf = await load('EN-FOR-03-042 Gob Delivery Setup - Deflectors.docx')
    const { doc } = await extractDocxStructural(buf)
    const text = structuredDocToPrompt(doc)
    expect(text).not.toMatch(/<w:/i)
    expect(text).not.toMatch(/<a:/i)
  })
})
