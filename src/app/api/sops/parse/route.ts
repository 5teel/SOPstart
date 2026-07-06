import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractDocx } from '@/lib/parsers/extract-docx'
import { extractDocxStructural } from '@/lib/parsers/extract-docx-structural'
import { structuredDocToPrompt } from '@/lib/parsers/structured-doc-to-prompt'
import {
  parsedSopToPerSectionLayoutData,
  materializeJunctionsForLayout,
} from '@/lib/parsers/parsed-sop-to-layout-data'
import { extractPdf } from '@/lib/parsers/extract-pdf'
import { extractXlsx } from '@/lib/parsers/extract-xlsx'
import { extractPptx } from '@/lib/parsers/extract-pptx'
import { extractTxt } from '@/lib/parsers/extract-txt'
import { extractImage } from '@/lib/parsers/extract-image'
import { ocrFallback } from '@/lib/parsers/ocr-fallback'
import { parseSop } from '@/lib/parsers/sop-parser'
import { uploadExtractedImages } from '@/lib/parsers/image-uploader'
import { triggerReviewerOnParseCompletion } from '@/lib/parsers/parse-pipeline'
import {
  extractDocxParagraphAnchors,
  extractPdfBlockBboxes,
} from '@/lib/parsers/source-viewer'
import type { ProvenanceContext } from '@/lib/parsers/parsed-sop-to-layout-data'
import type { ParsedSop } from '@/lib/validators/sop'
import type { SourceFileType } from '@/types/sop'

// Phase 21 (Plan 21-04 Task 3) — bump when the parsed-sop-to-layout-data
// shape changes in a way that downstream consumers must distinguish.
const PARSER_VERSION = '21.4.0'

// Vercel Pro: 300s max; Hobby: 10s — parsing requires Pro for large docs
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sopId } = body as { sopId: string }

  if (!sopId) {
    return NextResponse.json({ error: 'sopId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find the parse job for this SOP
  const { data: job, error: jobError } = await admin
    .from('parse_jobs')
    .select('*')
    .eq('sop_id', sopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Parse job not found' }, { status: 404 })
  }

  // Guard: don't re-process completed or already-processing jobs
  if (job.status === 'completed') {
    return NextResponse.json({ message: 'Already completed' })
  }
  if (job.status === 'processing') {
    return NextResponse.json({ message: 'Already processing' })
  }

  // Mark job as processing
  await admin
    .from('parse_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id)

  try {
    // 1. Download the source file from Storage (using admin client — bypasses Storage RLS)
    const { data: fileData, error: downloadError } = await admin.storage
      .from('sop-documents')
      .download(job.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message ?? 'unknown error'}`)
    }

    const buffer = await fileData.arrayBuffer()

    // 2. Extract text (and images for .docx)
    let extractedText = ''
    let extractedImages: { base64: string; contentType: string; index: number }[] = []
    let isOcr = false

    const fileType = job.file_type as SourceFileType

    if (fileType === 'docx') {
      // Phase 20 forward-compat: structural extractor preserves table-row
      // containment so image_indexes alignment is exact (not stream-proximity
      // guessing). The legacy flat extractor is kept exported for tests + as a
      // fallback if the structural walk throws.
      try {
        const structural = await extractDocxStructural(buffer)
        extractedText = structuredDocToPrompt(structural.doc)
        extractedImages = structural.images
        console.log(
          `[parse] docx structural: ${structural.doc.stats.blockCount} blocks, ` +
            `${structural.doc.stats.proceduralTableCount}/${structural.doc.stats.tableCount} procedural tables, ` +
            `${structural.doc.stats.imageCount} images (${structural.doc.stats.imagesInTables} in tables)`
        )
      } catch (err) {
        console.error('[parse] structural docx extract failed, falling back to flat:', err)
        const result = await extractDocx(buffer)
        extractedText = result.text
        extractedImages = result.images
      }
    } else if (fileType === 'pdf') {
      const result = await extractPdf(buffer)
      extractedText = result.text
      // PDF image extraction skipped for v1 (Research Pitfall 5)
    } else if (fileType === 'image') {
      // GPT-4o vision is the primary OCR for image files (replaces Tesseract)
      const result = await extractImage(buffer)
      extractedText = result.text
      isOcr = true
    } else if (fileType === 'xlsx') {
      const result = await extractXlsx(buffer)
      extractedText = result.text
    } else if (fileType === 'pptx') {
      const result = await extractPptx(buffer)
      extractedText = result.text
    } else if (fileType === 'txt') {
      const result = await extractTxt(buffer)
      extractedText = result.text
    }

    // 3. OCR fallback if text extraction yielded too little content (scanned PDFs)
    if (extractedText.length < 50 && fileType !== 'image') {
      // Likely a scanned PDF or image-only document
      const ocr = await ocrFallback(buffer, fileType === 'pdf' ? 'application/pdf' : 'image/jpeg')
      if (ocr.text.length > extractedText.length) {
        extractedText = ocr.text
        isOcr = true
      }
    }

    if (extractedText.length < 10) {
      throw new Error('Could not extract meaningful text from the document. The file may be empty or corrupted.')
    }

    // 4. Parse with GPT-4o — pass file_type for format-specific prompt hints
    const parsed: ParsedSop = await parseSop(extractedText, { sourceMode: fileType })

    // 5. Get the SOP's organisation_id for image storage paths
    const { data: sop } = await admin
      .from('sops')
      .select('organisation_id')
      .eq('id', sopId)
      .single()

    const organisationId = sop?.organisation_id ?? ''

    // 6. Upload extracted images to Storage
    const uploadedImages = await uploadExtractedImages(organisationId, sopId, extractedImages)

    // 7. Write parsed data to database
    // Phase 20 CONV-03 — for DOCX parses, also emit Puck layout_data PER
    // SECTION (layout_data lives on sop_sections per migration 00020, NOT
    // on sops). Each procedural section's row gets its own StepWithPhotos
    // / PhotoGrid tree so the Phase 12 builder renders side-by-side step+
    // photo. Worker walkthrough continues reading sop_steps until that
    // codepath migrates separately.
    //
    // Phase 21 (Plan 21-04 Task 3) — build a ProvenanceContext so every
    // emitted Puck item carries `block_provenance`. Image-bearing blocks
    // get a precise region (PDF: page+bbox; DOCX: paragraph anchor).
    // Non-image blocks fall through to fallbackRegion so the verify gate
    // still has SOMETHING to point at.
    let provenanceContext: ProvenanceContext | undefined
    if (fileType === 'docx' || fileType === 'pdf' || fileType === 'image') {
      const sourceKind: ProvenanceContext['sourceKind'] =
        fileType === 'pdf' ? 'pdf' : fileType === 'docx' ? 'docx' : 'scan'
      const ctx: ProvenanceContext = {
        sourceKind,
        parser_run_id: job.id,
        parser_version: PARSER_VERSION,
        fallbackRegion:
          sourceKind === 'pdf'
            ? { kind: 'pdf', page: 1, bbox: [0, 0, 0, 0], pageWidth: 1, pageHeight: 1 }
            : sourceKind === 'docx'
              ? { kind: 'docx', paragraph_id: 'unknown', run_start: 0, run_end: 0 }
              : { kind: 'scan', image_crop: [0, 0, 0, 0] },
      }

      // DOCX: build the index → paragraph anchor map from
      // extractDocxParagraphAnchors. Wraps the structural extractor, so we
      // can co-run it with the parse path without re-parsing the file.
      if (sourceKind === 'docx') {
        try {
          const anchors = await extractDocxParagraphAnchors(Buffer.from(buffer))
          const m = new Map<number, { paragraph_id: string; run_start: number; run_end: number }>()
          for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i]
            if (a.region.kind === 'docx') {
              m.set(i, {
                paragraph_id: a.region.paragraph_id,
                run_start: a.region.run_start,
                run_end: a.region.run_end,
              })
            }
          }
          ctx.paragraphOfImageIndex = m
        } catch (err) {
          console.warn('[parse] extractDocxParagraphAnchors failed — using fallback region only', err)
        }
      }

      // PDF: per-page bbox extraction. CLAUDE.md learning: pdfjs needs a
      // FRESH Uint8Array per call — extractPdfBlockBboxes already does that
      // internally; we just pass the same Node Buffer each iteration.
      if (sourceKind === 'pdf') {
        try {
          const m = new Map<number, { page: number; bbox: [number, number, number, number]; pageWidth: number; pageHeight: number }>()
          // We don't know the page count up-front without a separate doc-open;
          // walk extracted images by their `index` and probe pages 1..N where
          // N is bounded by uploadedImages.length (one page per image upper bound).
          // Most SOPs are <50 pages, so this is cheap.
          const maxPages = Math.max(1, Math.min(50, uploadedImages.length + 5))
          let imgIdx = 0
          for (let p = 1; p <= maxPages && imgIdx < uploadedImages.length; p++) {
            const blocks = await extractPdfBlockBboxes(Buffer.from(buffer), p)
            for (const b of blocks) {
              if (b.region.kind === 'pdf') {
                m.set(imgIdx, {
                  page: b.region.page,
                  bbox: b.region.bbox,
                  pageWidth: b.region.pageWidth,
                  pageHeight: b.region.pageHeight,
                })
                imgIdx++
              }
            }
          }
          ctx.pageOfImageIndex = m
        } catch (err) {
          console.warn('[parse] extractPdfBlockBboxes failed — using fallback region only', err)
        }
      }

      provenanceContext = ctx
    }

    const perSectionLayouts =
      fileType === 'docx'
        ? parsedSopToPerSectionLayoutData(parsed, uploadedImages, { provenanceContext })
        : null

    // Update SOP metadata
    await admin
      .from('sops')
      .update({
        title: parsed.title,
        sop_number: parsed.sop_number ?? null,
        revision_date: parsed.revision_date ?? null,
        author: parsed.author ?? null,
        category: parsed.category ?? null,
        related_sops: parsed.related_sops ?? null,
        applicable_equipment: parsed.applicable_equipment ?? null,
        required_certifications: parsed.required_certifications ?? null,
        overall_confidence: parsed.overall_confidence,
        parse_notes: parsed.parse_notes ?? null,
        is_ocr: isOcr,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sopId)

    // Track which image indexes have been attached to a step so we can surface
    // unattributed images (cover photos, appendix figures) at SOP-level rather
    // than dropping them on the floor (legacy bug — Phase 20 fixes this properly).
    const attachedImageIndexes = new Set<number>()
    let firstSectionId: string | null = null

    // Insert sections
    for (const section of parsed.sections) {
      const sectionLayout = perSectionLayouts?.layouts.get(section.order) ?? null
      // Step 1: insert section WITHOUT layout_data first — Plan 21-05 needs
      // the section.id to materialize junctions, and the junction ids get
      // stamped onto the Puck items before layout_data is written.
      const { data: sectionRow, error: sectionError } = await admin
        .from('sop_sections')
        .insert({
          sop_id: sopId,
          section_type: section.type,
          title: section.title,
          content: section.content ?? null,
          sort_order: section.order,
          confidence: section.confidence,
          approved: false,
        })
        .select('id')
        .single()

      if (sectionError || !sectionRow) {
        console.error('Section insert error:', sectionError)
        continue
      }
      if (firstSectionId === null) firstSectionId = sectionRow.id

      // Plan 21-05 — materialize library blocks + junctions per Puck item,
      // stamping props.junctionId onto each item, then write the now-stamped
      // layout_data onto the section row. ANY failure throws and is caught
      // by the outer try/catch (parse_job marked failed; no partial junctions
      // because the section row is the only artifact and gets cleaned up
      // alongside the SOP rollback path).
      if (sectionLayout && sectionLayout.content.length > 0) {
        await materializeJunctionsForLayout({
          organisationId,
          sectionId: sectionRow.id,
          puckItems: sectionLayout.content,
          createdByUserId: null,
        })
        // Now write layout_data WITH the junctionId-stamped items.
        const { error: updErr } = await admin
          .from('sop_sections')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({
            layout_data: sectionLayout as unknown as object,
            layout_version: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .eq('id', sectionRow.id)
        if (updErr) {
          throw new Error(
            `Section ${sectionRow.id} layout_data write failed: ${updErr.message}`,
          )
        }
      }

      // Insert steps if present
      if (section.steps && section.steps.length > 0) {
        for (const step of section.steps) {
          const { data: stepRow } = await admin
            .from('sop_steps')
            .insert({
              section_id: sectionRow.id,
              step_number: step.order,
              text: step.text,
              warning: step.warning ?? null,
              caution: step.caution ?? null,
              tip: step.tip ?? null,
              required_tools: step.required_tools ?? null,
              time_estimate_minutes: step.time_estimate_minutes ?? null,
            })
            .select('id')
            .single()

          if (!stepRow) continue

          // Primary path: use GPT's image_indexes (Phase 20 interim — sourced from
          // [IMAGE N] tokens preserved through HTML-strip). Each index can only
          // be attached once.
          const requestedIndexes = (step.image_indexes ?? []).filter(
            (n) => !attachedImageIndexes.has(n)
          )
          for (const idx of requestedIndexes) {
            const img = uploadedImages.find((u) => u.index === idx)
            if (img) {
              await admin.from('sop_images').insert({
                sop_id: sopId,
                section_id: sectionRow.id,
                step_id: stepRow.id,
                storage_path: img.storagePath,
                content_type: img.contentType,
              })
              attachedImageIndexes.add(idx)
            }
          }

          // Legacy fallback: positional `step.order - 1` (still kept for SOPs
          // that round-trip through this code BEFORE GPT-image-token support
          // lands). Skips indexes already attached above.
          if (requestedIndexes.length === 0 && step.has_image) {
            const fallback = uploadedImages.find(
              (img) => img.index === step.order - 1 && !attachedImageIndexes.has(img.index)
            )
            if (fallback) {
              await admin.from('sop_images').insert({
                sop_id: sopId,
                section_id: sectionRow.id,
                step_id: stepRow.id,
                storage_path: fallback.storagePath,
                content_type: fallback.contentType,
              })
              attachedImageIndexes.add(fallback.index)
            }
          }
        }
      }
    }

    // Surface any unattributed images at SOP-level so the admin can re-anchor
    // them from the review surface instead of losing them. Attached to the
    // first section with step_id = null so SectionEditor renders them in its
    // inline-images gallery.
    if (firstSectionId !== null) {
      const orphans = uploadedImages.filter((img) => !attachedImageIndexes.has(img.index))
      for (const img of orphans) {
        await admin.from('sop_images').insert({
          sop_id: sopId,
          section_id: firstSectionId,
          step_id: null,
          storage_path: img.storagePath,
          content_type: img.contentType,
        })
      }
    }

    // 8. Mark job completed
    await admin
      .from('parse_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Phase 21 (Plan 21-03 Task 2) — auto-trigger AI reviewer. Fire-and-forget;
    // MUST NOT await — parse-completion response should not block on
    // Anthropic latency. Failures are logged inside the helper.
    void triggerReviewerOnParseCompletion(job.id)

    return NextResponse.json({ success: true, sopId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error'
    console.error('Parse pipeline error:', message)

    // Mark job failed
    await admin
      .from('parse_jobs')
      .update({
        status: 'failed',
        error_message: message,
        retry_count: (job.retry_count ?? 0) + 1,
      })
      .eq('id', job.id)

    // Update SOP status to reflect failure
    await admin
      .from('sops')
      .update({ status: 'draft', parse_notes: `Parse failed: ${message}` })
      .eq('id', sopId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
