import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { writeFile, readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAdminClient } from '@/lib/supabase/admin'
import { transcribeAudio } from '@/lib/parsers/transcribe-audio'
import { parseSopWithGPT } from '@/lib/parsers/gpt-parser'
import { verifyTranscriptVsSop, detectMissingSections } from '@/lib/parsers/verify-sop'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'

/**
 * Extract audio from video file server-side using ffmpeg-static.
 * Returns MP3 buffer. Falls back to original buffer if ffmpeg unavailable.
 */
async function extractAudioServerSide(videoBuffer: ArrayBuffer, inputExt: string): Promise<{ buffer: ArrayBuffer; ext: string; mime: string }> {
  try {
    const ffmpegPath = require('ffmpeg-static') as string
    const tmpDir = await mkdtemp(join(tmpdir(), 'sop-audio-'))
    const inputPath = join(tmpDir, `input.${inputExt}`)
    const outputPath = join(tmpDir, 'audio.mp3')

    await writeFile(inputPath, Buffer.from(videoBuffer))

    await new Promise<void>((resolve, reject) => {
      execFile(ffmpegPath, [
        '-i', inputPath,
        '-vn',                    // strip video
        '-acodec', 'libmp3lame',
        '-q:a', '4',             // VBR ~165kbps
        '-ac', '1',              // mono
        '-y',                    // overwrite
        outputPath,
      ], { timeout: 120_000 }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const audioData = await readFile(outputPath)
    // Cleanup
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})

    console.log(`[transcribe] Extracted audio: ${inputExt} ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)}MB → mp3 ${(audioData.byteLength / 1024 / 1024).toFixed(1)}MB`)
    return { buffer: audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength), ext: 'mp3', mime: 'audio/mpeg' }
  } catch (err) {
    console.warn('[transcribe] Server-side audio extraction failed, using raw file:', err)
    return { buffer: videoBuffer, ext: inputExt, mime: inputExt === 'webm' ? 'video/webm' : 'video/mp4' }
  }
}

export const maxDuration = 300 // Vercel Pro: 300s max

async function updateStage(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  stage: string,
) {
  await admin.from('parse_jobs')
    .update({ current_stage: stage, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sopId } = body as { sopId: string }

  if (!sopId) {
    return NextResponse.json({ error: 'sopId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find the latest parse job for this SOP
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

  // Mark job as processing and SOP as parsing
  await admin
    .from('parse_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id)
  await admin
    .from('sops')
    .update({ status: 'parsing' })
    .eq('id', sopId)

  try {
    // Stage 1: Download audio/video file from sop-videos bucket
    // May be extracted MP3 audio or raw webm video (mobile fallback)
    await updateStage(admin, job.id, 'extracting_audio')

    const { data: audioData, error: downloadError } = await admin.storage
      .from('sop-videos')
      .download(job.file_path)

    if (downloadError || !audioData) {
      throw new Error(`Failed to download audio file: ${downloadError?.message ?? 'unknown error'}`)
    }

    const rawBuffer = await audioData.arrayBuffer()

    // Determine file type from path extension
    const rawExt = job.file_path.split('.').pop()?.toLowerCase() ?? 'mp3'
    const isVideoFile = ['webm', 'mp4', 'mov'].includes(rawExt)

    // If video file: extract audio server-side to reduce size for OpenAI (25MB limit)
    // A 2-min webm at 2.5Mbps video = ~37MB; extracted MP3 = ~2MB
    let audioBuffer: ArrayBuffer
    let fileExt: string
    let mimeType: string

    if (isVideoFile) {
      const extracted = await extractAudioServerSide(rawBuffer, rawExt)
      audioBuffer = extracted.buffer
      fileExt = extracted.ext
      mimeType = extracted.mime
    } else {
      audioBuffer = rawBuffer
      fileExt = rawExt
      mimeType = 'audio/mpeg'
    }

    // Stage 2: Transcribe with gpt-4o-transcribe
    await updateStage(admin, job.id, 'transcribing')
    const segments = await transcribeAudio(audioBuffer, fileExt, mimeType)

    // Build full transcript text from segments
    const transcriptText = segments.map((s) => s.text).join(' ')

    // Validate transcript — reject if empty or too short (silence, no speech detected)
    if (!transcriptText || transcriptText.trim().length < 20) {
      await admin
        .from('parse_jobs')
        .update({
          status: 'failed',
          error_message: 'No speech detected in the recording. Please re-record with audible speech.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      await admin.from('sops').update({ status: 'draft' }).eq('id', sopId)
      return NextResponse.json({ error: 'No speech detected' }, { status: 422 })
    }

    // Persist transcript on the parse job for review UI (Pitfall 6)
    // Cast to unknown first — Supabase types use Json which doesn't accept typed arrays directly
    await admin
      .from('parse_jobs')
      .update({
        transcript_segments: segments as unknown as import('@/types/database.types').Json,
        transcript_text: transcriptText,
      })
      .eq('id', job.id)

    // Stage 3: Structure SOP with GPT-4o using video format hint
    await updateStage(admin, job.id, 'structuring')
    const parsed: ParsedSop = await parseSopWithGPT(transcriptText, 'video')

    // Stage 4: Adversarial verification (D-04) + missing section detection (VID-07)
    await updateStage(admin, job.id, 'verifying')
    const adversarialFlags = await verifyTranscriptVsSop(transcriptText, parsed)
    const missingSectionFlags = detectMissingSections(parsed)
    const allFlags: VerificationFlag[] = [...adversarialFlags, ...missingSectionFlags]

    // Store verification flags on parse job
    await admin
      .from('parse_jobs')
      .update({ verification_flags: allFlags as unknown as import('@/types/database.types').Json })
      .eq('id', job.id)

    // Stage 5: Write parsed SOP data to database (same pattern as parse/route.ts)
    // Get organisation_id for storage paths
    const { data: sop } = await admin
      .from('sops')
      .select('organisation_id')
      .eq('id', sopId)
      .single()

    const organisationId = sop?.organisation_id ?? ''

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
        is_ocr: false,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sopId)

    // Insert sections and steps (same pattern as parse/route.ts)
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

      if (section.steps && section.steps.length > 0) {
        for (const step of section.steps) {
          await admin
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
        }
      }
    }

    // Mark job completed
    await admin
      .from('parse_jobs')
      .update({
        status: 'completed',
        current_stage: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Suppress unused variable warning — organisationId reserved for future image storage
    void organisationId

    return NextResponse.json({ success: true, sopId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown transcription error'
    console.error('Video transcription pipeline error:', message)

    // Get current stage for error reporting
    const { data: currentJob } = await admin
      .from('parse_jobs')
      .select('current_stage')
      .eq('id', job.id)
      .single()

    await admin
      .from('parse_jobs')
      .update({
        status: 'failed',
        current_stage: 'failed',
        error_message: `Failed at ${currentJob?.current_stage ?? 'unknown'}: ${message}`,
        retry_count: (job.retry_count ?? 0) + 1,
      })
      .eq('id', job.id)

    await admin
      .from('sops')
      .update({ status: 'draft', parse_notes: `Transcription failed: ${message}` })
      .eq('id', sopId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
