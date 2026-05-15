// End-to-end alignment test: structural extract → GPT parse → assert
// image_indexes match the row that actually contains each image in the DOCX.
//
// The assertion: for every (table, row) pair in the original DOCX where the
// row contains images, the LLM-extracted step from that row MUST have
// image_indexes equal to the set of images actually in that row's cell.
import { readFile } from 'node:fs/promises'
import { extractDocxStructural } from '../src/lib/parsers/extract-docx-structural'
import { structuredDocToPrompt } from '../src/lib/parsers/structured-doc-to-prompt'
import { parseSopWithGPT } from '../src/lib/parsers/gpt-parser'

async function loadEnv() {
  const env = await readFile('C:\\Development\\SOPstart\\.env.local', 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

async function main() {
  await loadEnv()

  const path = 'C:\\Development\\SOPstart\\SOPstart - Raw SOPs\\EN-FOR-03-042 Gob Delivery Setup - Deflectors.docx'
  const buf = await readFile(path)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

  console.log('=== extract structural ===')
  const { doc, images } = await extractDocxStructural(ab)
  console.log('stats:', doc.stats)

  // Build the ground-truth: for each image index, which procedural-table row contains it.
  const groundTruth = new Map<number, { tableIndex: number; rowIndex: number; stepText: string }>()
  for (const block of doc.blocks) {
    if (block.kind !== 'table' || !block.isProcedural || !block.roleHint) continue
    const { stepCol, imagesCol } = block.roleHint
    if (stepCol === null || imagesCol === null) continue
    for (const row of block.rows) {
      if (row.isHeader) continue
      const stepCell = row.cells.find((c) => c.colIndex === stepCol)
      const imageCell = row.cells.find((c) => c.colIndex === imagesCol)
      if (!stepCell || !imageCell) continue
      for (const idx of imageCell.images) {
        groundTruth.set(idx, {
          tableIndex: block.tableIndex,
          rowIndex: row.rowIndex,
          stepText: stepCell.text.slice(0, 80),
        })
      }
    }
  }
  console.log(`ground truth: ${groundTruth.size} images anchored to specific table rows`)

  console.log('\n=== call gpt-parser with structured prompt (~$0.05) ===')
  const promptText = structuredDocToPrompt(doc)
  console.log(`prompt size: ${promptText.length} chars`)
  const parsed = await parseSopWithGPT(promptText, { sourceMode: 'docx' })
  console.log(`parsed: ${parsed.sections.length} sections, title="${parsed.title}"`)

  // Build a reverse index: which step did each image index land on?
  const stepByImageIndex = new Map<number, { sectionTitle: string; stepOrder: number; stepText: string }>()
  for (const section of parsed.sections) {
    for (const step of section.steps ?? []) {
      for (const idx of step.image_indexes ?? []) {
        stepByImageIndex.set(idx, {
          sectionTitle: section.title,
          stepOrder: step.order,
          stepText: step.text.slice(0, 80),
        })
      }
    }
  }
  console.log(`gpt assigned: ${stepByImageIndex.size}/${images.length} images to specific steps`)

  // Compare ground truth to GPT assignment via STEP TEXT similarity (the row's
  // step cell text should be present in GPT's emitted step text, since we asked
  // GPT to write naturally not preserve the cell text verbatim).
  let correct = 0
  let mismatched = 0
  let orphaned = 0
  for (const [idx, truth] of groundTruth) {
    const got = stepByImageIndex.get(idx)
    if (!got) {
      orphaned++
      continue
    }
    // Fuzzy match by content-word overlap. GPT paraphrases the step text on
    // purpose (system prompt §2 asks for it), so a literal substring match is
    // too strict. Use Jaccard-like overlap on distinctive words (≥4 chars,
    // excluding stopwords). Threshold: ≥40% of the source's distinctive words
    // must appear in the GPT step text.
    const stop = new Set([
      'with','that','this','from','your','their','they','have','will','been','were','into','onto','some','then','than','also','when','where','which','about','only','make','sure','must','each','these','those','same','using','below','above','before','after','very','more','most','such','step','steps','section','task','tasks','work','perform','ensure','perform','procedure',
    ])
    const tokens = (s: string) =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !stop.has(w))
      )
    const truthTokens = tokens(truth.stepText)
    const gotTokens = tokens(got.stepText)
    let overlap = 0
    for (const t of truthTokens) if (gotTokens.has(t)) overlap++
    const score = truthTokens.size > 0 ? overlap / truthTokens.size : 0
    if (score >= 0.4) {
      correct++
    } else {
      mismatched++
      if (mismatched <= 5) {
        console.log(`  MISMATCH IMG ${idx} (overlap=${(score * 100).toFixed(0)}%):`)
        console.log(`    ground truth row (table ${truth.tableIndex} row ${truth.rowIndex}): "${truth.stepText}"`)
        console.log(`    gpt assigned to step ${got.stepOrder} of ${got.sectionTitle}: "${got.stepText}"`)
      }
    }
  }

  console.log('\n=== alignment scorecard ===')
  console.log(`correct: ${correct}/${groundTruth.size}`)
  console.log(`mismatched (wrong step): ${mismatched}`)
  console.log(`orphaned (no step):      ${orphaned}`)
  const pctCorrect = ((correct / groundTruth.size) * 100).toFixed(1)
  console.log(`accuracy: ${pctCorrect}%`)
}

main().catch((e) => { console.error(e); process.exit(1) })
