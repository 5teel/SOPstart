import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractDocx } from '@/lib/parsers/extract-docx'
import { extractPdf } from '@/lib/parsers/extract-pdf'
import { extractXlsx } from '@/lib/parsers/extract-xlsx'
import { extractPptx } from '@/lib/parsers/extract-pptx'
import { extractTxt } from '@/lib/parsers/extract-txt'
import { extractImage } from '@/lib/parsers/extract-image'
import { ocrFallback } from '@/lib/parsers/ocr-fallback'
import { parseSopWithGPT } from '@/lib/parsers/gpt-parser'
import { uploadExtractedImages } from '@/lib/parsers/image-uploader'
import type { ParsedSop } from '@/lib/validators/sop'
import type { SourceFileType } from '@/types/sop'

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
      const result = await extractDocx(buffer)
      extractedText = result.text
      extractedImages = result.images
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
    const parsed: ParsedSop = await parseSopWithGPT(extractedText, fileType)

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

    // Insert sections
    for (const section of parsed.sections) {
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

          // Link images to steps if the step flagged has_image
          if (step.has_image && stepRow) {
            const matchingImage = uploadedImages.find((img) => img.index === step.order - 1)
            if (matchingImage) {
              await admin.from('sop_images').insert({
                sop_id: sopId,
                section_id: sectionRow.id,
                step_id: stepRow.id,
                storage_path: matchingImage.storagePath,
                content_type: matchingImage.contentType,
              })
            }
          }
        }
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
