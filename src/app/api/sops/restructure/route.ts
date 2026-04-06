import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSopWithGPT } from '@/lib/parsers/gpt-parser'
import { verifyTranscriptVsSop, detectMissingSections } from '@/lib/parsers/verify-sop'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sopId } = body as { sopId: string }

  if (!sopId) {
    return NextResponse.json({ error: 'sopId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find the latest parse job — must have transcript_text already
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

  const transcriptText = (job as Record<string, unknown>).transcript_text as string | null
  if (!transcriptText || transcriptText.trim().length < 20) {
    return NextResponse.json({ error: 'No transcript available — use full re-transcribe' }, { status: 400 })
  }

  if (job.status === 'processing') {
    return NextResponse.json({ message: 'Already processing' })
  }

  // Mark as processing
  await admin
    .from('parse_jobs')
    .update({ status: 'processing', current_stage: 'structuring', started_at: new Date().toISOString() })
    .eq('id', job.id)
  await admin
    .from('sops')
    .update({ status: 'parsing' })
    .eq('id', sopId)

  try {
    // Structure with Claude (skips download + transcription)
    console.log(`[Restructure] Parsing ${transcriptText.length} chars of transcript for SOP ${sopId}`)
    const parsed: ParsedSop = await parseSopWithGPT(transcriptText, 'video')

    // Adversarial verification + missing sections
    await admin.from('parse_jobs')
      .update({ current_stage: 'verifying' })
      .eq('id', job.id)

    const adversarialFlags = await verifyTranscriptVsSop(transcriptText, parsed)
    const missingSectionFlags = detectMissingSections(parsed)
    const allFlags: VerificationFlag[] = [...adversarialFlags, ...missingSectionFlags]

    await admin.from('parse_jobs')
      .update({ verification_flags: allFlags as unknown as import('@/types/database.types').Json })
      .eq('id', job.id)

    // Write parsed SOP to database
    const { data: sop } = await admin
      .from('sops')
      .select('organisation_id')
      .eq('id', sopId)
      .single()

    await admin.from('sops').update({
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
      status: 'draft',
      updated_at: new Date().toISOString(),
    }).eq('id', sopId)

    // Insert sections and steps
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

      if (section.steps) {
        for (const step of section.steps) {
          await admin.from('sop_steps').insert({
            section_id: sectionRow.id,
            step_number: step.order,
            text: step.text,
            warning: step.warning ?? null,
            caution: step.caution ?? null,
            tip: step.tip ?? null,
            required_tools: step.required_tools ?? null,
            time_estimate_minutes: step.time_estimate_minutes ?? null,
            photo_required: false,
          })
        }
      }
    }

    // Mark complete
    await admin.from('parse_jobs').update({
      status: 'completed',
      current_stage: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', job.id)

    return NextResponse.json({ success: true, sopId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Restructure] Error:', message)

    await admin.from('parse_jobs').update({
      status: 'failed',
      current_stage: 'failed',
      error_message: `Re-structure failed: ${message}`,
    }).eq('id', job.id)

    await admin.from('sops').update({
      status: 'draft',
      parse_notes: `Re-structure failed: ${message}`,
    }).eq('id', sopId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
