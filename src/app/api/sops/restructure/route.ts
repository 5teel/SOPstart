import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSop } from '@/lib/parsers/sop-parser'
import {
  parsedSopToPerSectionLayoutData,
  materializeJunctionsForLayout,
} from '@/lib/parsers/parsed-sop-to-layout-data'
import { verifyTranscriptVsSop, detectMissingSections } from '@/lib/parsers/verify-sop'
import { triggerReviewerOnParseCompletion } from '@/lib/parsers/parse-pipeline'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'
import { normaliseToCategorySlug } from '@/lib/sop-categories'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sopId, detailLevel } = body as { sopId: string; detailLevel?: number }

  if (!sopId) {
    return NextResponse.json({ error: 'sopId is required' }, { status: 400 })
  }

  // Session + admin role + session-org guard (40-REVIEW.md CR-02 / T-40-12-01..04):
  // this route previously flipped an arbitrary sopId's parse_jobs/sops status
  // and burned OpenAI/Anthropic spend for any authenticated user. Guard runs
  // before any admin-client read/write below.
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Org mismatch returns 404 (not 403) so the endpoint never confirms the
  // existence of another org's SOP. Right-hand side is the SESSION org, not
  // a value derived from the fetched row.
  const { data: sopOrg } = await admin
    .from('sops')
    .select('organisation_id')
    .eq('id', sopId)
    .maybeSingle()
  if (!sopOrg || sopOrg.organisation_id !== organisationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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
    const parsed: ParsedSop = await parseSop(transcriptText, { sourceMode: 'video', detailLevel: detailLevel ?? 3 })

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

    // Write parsed SOP to database. organisationId is already the
    // session-verified value from the guard above — CLAUDE.md [2026-07-28]
    // CR-01: never re-derive it from the row.
    await admin.from('sops').update({
      title: parsed.title,
      sop_number: parsed.sop_number ?? null,
      revision_date: parsed.revision_date ?? null,
      author: parsed.author ?? null,
      category_slug: normaliseToCategorySlug(parsed.category),
      related_sops: parsed.related_sops ?? null,
      applicable_equipment: parsed.applicable_equipment ?? null,
      required_certifications: parsed.required_certifications ?? null,
      overall_confidence: parsed.overall_confidence,
      parse_notes: parsed.parse_notes ?? null,
      status: 'draft',
      updated_at: new Date().toISOString(),
    }).eq('id', sopId)

    // Insert sections and steps
    const perSectionLayouts = parsedSopToPerSectionLayoutData(parsed, [])
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

      // Builder canvas renders exclusively from per-section layout_data —
      // without it a video-derived draft opens as an empty canvas (2026-07-07
      // sweep, same fix as parse/ai-prompt). Fail-open: never lose the draft.
      const sectionLayout = perSectionLayouts.layouts.get(section.order) ?? null
      if (sectionLayout && sectionLayout.content.length > 0) {
        try {
          await materializeJunctionsForLayout({
            organisationId,
            sectionId: sectionRow.id,
            puckItems: sectionLayout.content,
            createdByUserId: null,
          })
          await admin
            .from('sop_sections')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ layout_data: sectionLayout as unknown as object, layout_version: 1 } as any)
            .eq('id', sectionRow.id)
        } catch (err) {
          console.error('[layout] section layout_data write failed', sectionRow.id, err)
        }
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

    // Phase 21 (Plan 21-03 Task 2) — auto-trigger AI reviewer.
    void triggerReviewerOnParseCompletion(job.id)

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
