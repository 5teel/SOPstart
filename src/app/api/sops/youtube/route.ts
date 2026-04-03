import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchYouTubeTranscript } from '@/lib/parsers/fetch-youtube-transcript'
import { parseSopWithGPT } from '@/lib/parsers/gpt-parser'
import { verifyTranscriptVsSop, detectMissingSections } from '@/lib/parsers/verify-sop'
import { youtubeUrlSchema, extractYouTubeId } from '@/lib/validators/sop'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  // --- Server-side auth (same pattern as createUploadSession) ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Derive organisationId and role from JWT claims
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }
  const role = jwtClaims['user_role']
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return NextResponse.json({ error: 'You need admin access to create SOPs.' }, { status: 403 })
  }

  const uploadedBy = user.id

  // --- Parse request body (client sends only url + termsAccepted) ---
  const body = await request.json()
  const { url, termsAccepted } = body as {
    url: string
    termsAccepted: boolean
  }

  if (!termsAccepted) {
    return NextResponse.json({ error: 'Terms must be accepted' }, { status: 400 })
  }

  // Validate YouTube URL
  const urlResult = youtubeUrlSchema.safeParse(url)
  if (!urlResult.success) {
    return NextResponse.json(
      { error: urlResult.error.issues[0]?.message ?? 'Invalid YouTube URL' },
      { status: 400 }
    )
  }

  const videoId = extractYouTubeId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'Could not extract video ID from URL' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Fetch YouTube captions
  const result = await fetchYouTubeTranscript(url)

  if ('noCaption' in result) {
    return NextResponse.json(
      { noCaption: true, message: result.message },
      { status: 200 } // Not an error — expected case per D-08
    )
  }

  const { segments } = result
  const transcriptText = segments.map((s) => s.text).join(' ')

  // 2. Create SOP record (organisationId and uploadedBy from server-side auth)
  const { data: sop, error: sopError } = await admin
    .from('sops')
    .insert({
      organisation_id: organisationId,
      title: null,
      status: 'parsing',
      version: 1,
      source_file_path: `youtube/${videoId}`,
      source_file_type: 'video',
      source_file_name: `YouTube: ${videoId}`,
      is_ocr: false,
      uploaded_by: uploadedBy,
    })
    .select('id')
    .single()

  if (sopError || !sop) {
    return NextResponse.json({ error: 'Failed to create SOP record' }, { status: 500 })
  }

  // 3. Create parse job
  const { data: job, error: jobError } = await admin
    .from('parse_jobs')
    .insert({
      organisation_id: organisationId,
      sop_id: sop.id,
      status: 'processing',
      file_path: `youtube/${videoId}`,
      file_type: 'video',
      input_type: 'youtube_url',
      current_stage: 'structuring',
      transcript_segments: segments as unknown as import('@/types/database.types').Json,
      transcript_text: transcriptText,
      youtube_url: url,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Failed to create parse job' }, { status: 500 })
  }

  try {
    // 4. Structure SOP with GPT-4o using video format hint
    const parsed: ParsedSop = await parseSopWithGPT(transcriptText, 'video')

    // 5. Adversarial verification + missing section detection
    await admin.from('parse_jobs')
      .update({ current_stage: 'verifying', updated_at: new Date().toISOString() })
      .eq('id', job.id)

    const adversarialFlags = await verifyTranscriptVsSop(transcriptText, parsed)
    const missingSectionFlags = detectMissingSections(parsed)
    const allFlags: VerificationFlag[] = [...adversarialFlags, ...missingSectionFlags]

    await admin.from('parse_jobs')
      .update({ verification_flags: allFlags as unknown as import('@/types/database.types').Json })
      .eq('id', job.id)

    // 6. Write parsed SOP data
    await admin.from('sops')
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
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sop.id)

    for (const section of parsed.sections) {
      const { data: sectionRow, error: sectionError } = await admin
        .from('sop_sections')
        .insert({
          sop_id: sop.id,
          section_type: section.type,
          title: section.title,
          content: section.content ?? null,
          sort_order: section.order,
          confidence: section.confidence,
          approved: false,
        })
        .select('id')
        .single()

      if (sectionError || !sectionRow) continue

      if (section.steps?.length) {
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
          })
        }
      }
    }

    // 7. Mark complete
    await admin.from('parse_jobs')
      .update({
        status: 'completed',
        current_stage: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return NextResponse.json({ success: true, sopId: sop.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('YouTube pipeline error:', message)

    const { data: currentJob } = await admin
      .from('parse_jobs')
      .select('current_stage')
      .eq('id', job.id)
      .single()

    await admin.from('parse_jobs')
      .update({
        status: 'failed',
        current_stage: 'failed',
        error_message: `Failed at ${currentJob?.current_stage ?? 'unknown'}: ${message}`,
        retry_count: 1,
      })
      .eq('id', job.id)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
