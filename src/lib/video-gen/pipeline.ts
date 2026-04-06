/**
 * Video generation pipeline orchestrator.
 *
 * Drives the full generation flow for a video_generation_jobs record:
 *   analyzing → generating_audio → rendering → ready (or failed)
 *
 * Called fire-and-forget from POST /api/sops/generate-video.
 * All DB writes use the admin Supabase client (bypasses RLS).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { generateSectionAudio } from './tts'
import { submitShotstackRender, getShotstackRender } from './shotstack-client'
import { buildSlideshowEdit } from './render-slides'
import { buildScrollEdit } from './render-scroll'
import type { SectionWithAudio } from './types'
import type { ChapterMarker, VideoFormat } from '@/types/sop'
import type { Json } from '@/types/database.types'

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 240000 // 4 minutes

/** Update job status and current_stage in one call */
async function updateJobStatus(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
  status: string,
  stage: string,
  extra: Record<string, unknown> = {},
) {
  console.log(`[video-pipeline] Job ${jobId} → ${status} (${stage})`)
  const { error } = await admin
    .from('video_generation_jobs')
    .update({
      status: status as 'queued' | 'analyzing' | 'generating_audio' | 'rendering' | 'ready' | 'failed',
      current_stage: stage,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq('id', jobId)

  if (error) {
    console.error(`[video-pipeline] updateJobStatus failed for ${jobId}:`, error)
  }
}

/**
 * Build the HTML and plain-text representations of a section's content.
 * For 'steps' sections, each step is rendered as a numbered item.
 */
function buildSectionContent(
  section: {
    section_type: string
    content: string | null
    sop_steps?: { step_number: number; text: string; warning: string | null }[]
  },
): { contentHtml: string; contentText: string } {
  const steps = section.sop_steps ?? []

  if (steps.length > 0) {
    // Steps section — render numbered list
    const listItems = steps
      .sort((a, b) => a.step_number - b.step_number)
      .map((step) => {
        const warning = step.warning ? ` Warning: ${step.warning}` : ''
        return `<li>${step.text}${warning}</li>`
      })
    const contentHtml = `<ol>${listItems.join('')}</ol>`

    const contentText = steps
      .sort((a, b) => a.step_number - b.step_number)
      .map((step) => {
        const warning = step.warning ? ` Warning: ${step.warning}` : ''
        return `${step.step_number}. ${step.text}${warning}`
      })
      .join('\n')

    return { contentHtml, contentText }
  }

  // Non-steps section — use content field
  const text = section.content ?? ''
  const paragraphs = text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  const contentHtml = paragraphs || `<p>${text}</p>`
  const contentText = text

  return { contentHtml, contentText }
}

/**
 * Upload audio buffer to Supabase Storage.
 * Path: {orgId}/{sopId}/audio/{sectionId}.mp3 in sop-generated-videos bucket.
 * Returns the full public/signed URL for the uploaded file.
 */
async function uploadAudioBuffer(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  sopId: string,
  sectionId: string,
  buffer: Buffer,
): Promise<string> {
  const path = `${orgId}/${sopId}/audio/${sectionId}.mp3`

  const { error } = await admin.storage
    .from('sop-generated-videos')
    .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })

  if (error) {
    throw new Error(`Failed to upload audio for section ${sectionId}: ${error.message}`)
  }

  // Bucket is private — Shotstack needs a signed URL to fetch the audio during rendering.
  // 1 hour expiry is plenty for a render that takes 30-120 seconds.
  const { data: signedData, error: signedError } = await admin.storage
    .from('sop-generated-videos')
    .createSignedUrl(path, 3600)

  if (signedError || !signedData) {
    throw new Error(`Failed to create signed URL for section ${sectionId}: ${signedError?.message ?? 'unknown'}`)
  }

  return signedData.signedUrl
}

/**
 * Download video from Shotstack URL and re-upload to Supabase Storage.
 * Path: {orgId}/{sopId}/video/{jobId}.mp4 in sop-generated-videos bucket.
 */
async function downloadAndReuploadVideo(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  sopId: string,
  jobId: string,
  shotstackUrl: string,
): Promise<string> {
  const response = await fetch(shotstackUrl)
  if (!response.ok) {
    throw new Error(`Failed to download rendered video from Shotstack: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const path = `${orgId}/${sopId}/video/${jobId}.mp4`

  const { error } = await admin.storage
    .from('sop-generated-videos')
    .upload(path, buffer, { contentType: 'video/mp4', upsert: true })

  if (error) {
    throw new Error(`Failed to upload rendered video to Storage: ${error.message}`)
  }

  // Return the storage path — consumers generate signed URLs at playback time
  // via /api/videos/[jobId]/stream. The bucket is private so public URLs don't work.
  return path
}

/**
 * Poll Shotstack until the render is done or failed, with timeout guard.
 */
async function pollUntilDone(renderId: string): Promise<{ url: string }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

    const render = await getShotstackRender(renderId)

    if (render.status === 'done') {
      if (!render.url) throw new Error('Shotstack render done but no URL returned')
      return { url: render.url }
    }

    if (render.status === 'failed') {
      throw new Error(`Shotstack render failed: ${render.error ?? 'unknown error'}`)
    }

    // Still queued/fetching/rendering/saving — keep polling
  }

  throw new Error(`Shotstack render timed out after ${POLL_TIMEOUT_MS / 1000}s`)
}

/**
 * Main pipeline orchestrator. Called fire-and-forget from the API route.
 *
 * Steps:
 *   1. Analyzing — fetch SOP + sections + steps, build content scripts
 *   2. Generating audio — parallel TTS per section, upload buffers to Storage
 *   3. Compute chapter markers from cumulative durations
 *   4. Build Shotstack timeline (slideshow or scroll)
 *   5. Rendering — submit to Shotstack, store render ID
 *   6. Polling — wait for done, re-upload to Storage, mark ready
 *
 * Error handling: any failure marks the job as 'failed' with the error message.
 */
export async function runVideoGenerationPipeline(jobId: string): Promise<void> {
  console.log(`[video-pipeline] Starting pipeline for job ${jobId}`)
  const admin = createAdminClient()

  try {
    // -------------------------------------------------------------------
    // Stage 1: Analyzing
    // -------------------------------------------------------------------
    await updateJobStatus(admin, jobId, 'analyzing', 'analyzing')

    // Fetch the job record to get sop_id, format, organisation_id
    const { data: job, error: jobError } = await admin
      .from('video_generation_jobs')
      .select('id, sop_id, format, organisation_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error(`Job ${jobId} not found: ${jobError?.message ?? 'unknown'}`)
    }

    const { sop_id: sopId, format, organisation_id: orgId } = job
    const videoFormat = format as VideoFormat

    // Fetch the SOP
    const { data: sop, error: sopError } = await admin
      .from('sops')
      .select('id, title, organisation_id')
      .eq('id', sopId)
      .single()

    if (sopError || !sop) {
      throw new Error(`SOP ${sopId} not found: ${sopError?.message ?? 'unknown'}`)
    }

    // Fetch sections sorted by sort_order
    const { data: sections, error: sectionsError } = await admin
      .from('sop_sections')
      .select('id, section_type, title, content, sort_order')
      .eq('sop_id', sopId)
      .order('sort_order', { ascending: true })

    if (sectionsError || !sections || sections.length === 0) {
      throw new Error(`No sections found for SOP ${sopId}`)
    }

    // Fetch steps for all sections in one query
    const sectionIds = sections.map((s) => s.id)
    const { data: allSteps } = await admin
      .from('sop_steps')
      .select('id, section_id, step_number, text, warning')
      .in('section_id', sectionIds)
      .order('step_number', { ascending: true })

    // Group steps by section_id
    const stepsBySection: Record<string, typeof allSteps> = {}
    for (const step of allSteps ?? []) {
      if (!stepsBySection[step.section_id]) stepsBySection[step.section_id] = []
      stepsBySection[step.section_id]!.push(step)
    }

    // Build content scripts per section
    const sectionScripts = sections.map((section) => {
      const sectionSteps = (stepsBySection[section.id] ?? []).map((s) => ({
        step_number: s.step_number,
        text: s.text,
        warning: s.warning ?? null,
      }))

      const { contentHtml, contentText } = buildSectionContent({
        section_type: section.section_type,
        content: section.content ?? null,
        sop_steps: sectionSteps,
      })

      return {
        sectionId: section.id,
        title: section.title,
        sectionType: section.section_type,
        contentHtml,
        contentText,
      }
    })

    // -------------------------------------------------------------------
    // Stage 2: Generating audio (parallel via Promise.all per Pitfall 3)
    // -------------------------------------------------------------------
    await updateJobStatus(admin, jobId, 'generating_audio', 'generating_audio')

    const audioResults = await Promise.all(
      sectionScripts.map((script) =>
        generateSectionAudio(script.contentText, script.sectionType),
      ),
    )

    // Upload all audio buffers to Storage
    const audioUrls = await Promise.all(
      sectionScripts.map((script, i) =>
        uploadAudioBuffer(admin, orgId, sopId, script.sectionId, audioResults[i]!.buffer),
      ),
    )

    // Build SectionWithAudio array
    const sectionsWithAudio: SectionWithAudio[] = sectionScripts.map((script, i) => ({
      sectionId: script.sectionId,
      title: script.title,
      contentHtml: script.contentHtml,
      contentText: script.contentText,
      sectionType: script.sectionType,
      audioStorageUrl: audioUrls[i]!,
      audioDuration: audioResults[i]!.durationEstimateSeconds,
    }))

    // -------------------------------------------------------------------
    // Stage 3: Compute chapter markers (VGEN-04)
    // -------------------------------------------------------------------
    let cumulative = 0
    const chapters: ChapterMarker[] = sectionsWithAudio.map((s) => {
      const marker: ChapterMarker = { sectionId: s.sectionId, title: s.title, timestamp: cumulative }
      cumulative += s.audioDuration
      return marker
    })

    await admin
      .from('video_generation_jobs')
      .update({
        chapter_markers: chapters as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // -------------------------------------------------------------------
    // Stage 4: Build timeline
    // -------------------------------------------------------------------
    const edit =
      videoFormat === 'narrated_slideshow'
        ? buildSlideshowEdit(sectionsWithAudio)
        : buildScrollEdit(sectionsWithAudio)

    // -------------------------------------------------------------------
    // Stage 5: Rendering — submit to Shotstack
    // -------------------------------------------------------------------
    await updateJobStatus(admin, jobId, 'rendering', 'rendering')

    const renderId = await submitShotstackRender(edit)
    console.log(`[video-pipeline] Shotstack render submitted: ${renderId}`)

    await admin
      .from('video_generation_jobs')
      .update({
        shotstack_render_id: renderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // -------------------------------------------------------------------
    // Stage 6: Polling until done
    // Poll within the remaining function time budget, leaving 30s margin
    // for download + re-upload after render completes.
    // -------------------------------------------------------------------
    const remainingMs = Math.max(POLL_TIMEOUT_MS, 250_000) // at least 4 min
    const pollDeadline = Date.now() + remainingMs - 30_000 // 30s margin

    let shotstackUrl: string | null = null

    while (Date.now() < pollDeadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      const render = await getShotstackRender(renderId)
      console.log(`[video-pipeline] Poll: ${render.status}`)

      if (render.status === 'done') {
        if (!render.url) throw new Error('Shotstack render done but no URL returned')
        shotstackUrl = render.url
        break
      }
      if (render.status === 'failed') {
        throw new Error(`Shotstack render failed: ${render.error ?? 'unknown error'}`)
      }
    }

    if (!shotstackUrl) {
      // Render still in progress — save state so it can be picked up later
      console.log(`[video-pipeline] Render ${renderId} still in progress — will be picked up by status check`)
      await admin
        .from('video_generation_jobs')
        .update({
          current_stage: 'rendering_pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
      return // Exit without marking failed — render is still running on Shotstack
    }

    // Download from Shotstack and re-upload to our Storage
    const storageUrl = await downloadAndReuploadVideo(admin, orgId, sopId, jobId, shotstackUrl)

    // Mark ready
    await updateJobStatus(admin, jobId, 'ready', 'ready', {
      video_url: storageUrl,
      completed_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[video-pipeline] Job ${jobId} failed:`, message)

    // Mark job failed — use upsert-style update so it still works even if status is mid-transition
    try {
      await admin
        .from('video_generation_jobs')
        .update({
          status: 'failed',
          current_stage: 'failed',
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    } catch (dbErr) {
      console.error(`[video-pipeline] Failed to update job ${jobId} to failed status:`, dbErr)
    }
  }
}
