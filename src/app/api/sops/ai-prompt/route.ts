import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { assignSopDepartments } from '@/actions/departments'
import { parseSop } from '@/lib/parsers/sop-parser'
import {
  parsedSopToPerSectionLayoutData,
  materializeJunctionsForLayout,
} from '@/lib/parsers/parsed-sop-to-layout-data'
import { getOrgAiModels, resolveOrgModel } from '@/lib/ai/org-settings'
import { ensureSopTitle } from '@/lib/parsers/sop-title'
import { verifyTranscriptVsSop, detectMissingSections } from '@/lib/parsers/verify-sop'
import { aiPromptSchema } from '@/lib/validators/sop'
import type { ParsedSop } from '@/lib/validators/sop'
import type { VerificationFlag } from '@/types/sop'
import { isValidCategorySlug, normaliseToCategorySlug } from '@/lib/sop-categories'

// Phase 14-02: AI-prompt structured-draft pipeline.
// Near-clone of /api/sops/youtube/route.ts with three swaps:
//   - input_type = 'ai_prompt' (was 'youtube_url')
//   - source_type = 'ai' (drives D-05 library chip)
//   - parseSop called with sourceMode: 'prompt' (selects new FORMAT_HINTS.prompt)
// Plus one addition: section_kind_id resolver post-process (ROADMAP success #4).
export const maxDuration = 300

export async function POST(request: NextRequest) {
  // --- 1. Auth + role guard (mirrors youtube/route.ts lines 14-35) ---
  const { userId, role, organisationId } = await getSessionContext()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!organisationId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 403 })
  }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return NextResponse.json({ error: 'You need admin access to create SOPs.' }, { status: 403 })
  }
  const uploadedBy = userId

  // --- 2. Validate body via aiPromptSchema (D-06: min 20 / max 2000) ---
  const body = await request.json()
  const parseResult = aiPromptSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message ?? 'Invalid prompt' },
      { status: 400 },
    )
  }
  const { promptText, categorySlug, title, detailLevel } = parseResult.data
  // Phase 25 REQ-9, D-04: optional department fields from request body (not in aiPromptSchema — read directly).
  const departmentIds: string[] = Array.isArray(body.departmentIds) ? body.departmentIds : []
  const allDepartments: boolean = body.allDepartments === true

  const admin = createAdminClient()

  // --- 3. Create SOP row (source_type='ai' per D-05; library chip in 14-03).
  // source_file_type='txt' is verified safe per W-2: column is NOT NULL (00003) and
  // CHECK currently permits 'txt' alongside docx/pdf/image/xlsx/pptx/video (00012). ---
  const { data: sop, error: sopError } = await admin
    .from('sops')
    .insert({
      organisation_id: organisationId,
      title: title ?? null,
      status: 'parsing',
      version: 1,
      source_file_path: `ai-prompt/${userId}/${Date.now()}`,
      source_file_type: 'txt',
      source_file_name: 'AI prompt',
      source_type: 'ai',
      category_slug: isValidCategorySlug(categorySlug) ? categorySlug : null,
      is_ocr: false,
      uploaded_by: uploadedBy,
    })
    .select('id')
    .single()
  if (sopError || !sop) {
    return NextResponse.json({ error: 'Failed to create SOP record' }, { status: 500 })
  }

  // Phase 33 SC-3/SC-4: department assignment funnels through the single
  // grant-backed write path (assignSopDepartments) — sop_departments is
  // 100% derived, never inserted directly.
  if (allDepartments || departmentIds.length > 0) {
    await assignSopDepartments(sop.id, departmentIds, allDepartments)
  }

  // --- 4. Create parse_jobs row (D-04: persist prompt_text for audit) ---
  const { data: job, error: jobError } = await admin
    .from('parse_jobs')
    .insert({
      organisation_id: organisationId,
      sop_id: sop.id,
      status: 'processing',
      file_path: `ai-prompt/${userId}`,
      file_type: 'txt',
      input_type: 'ai_prompt',
      current_stage: 'prompting',
      prompt_text: promptText,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (jobError || !job) {
    return NextResponse.json({ error: 'Failed to create parse job' }, { status: 500 })
  }

  // (No idempotency guard — see 14-02 plan Task 2 rationale. Each POST creates a
  // fresh SOP+job; admin dedupes from the library.)

  try {
    // --- 5. Drafting stage — call Claude via the extended parseSop signature ---
    await admin
      .from('parse_jobs')
      .update({ current_stage: 'drafting', updated_at: new Date().toISOString() })
      .eq('id', job.id)

    const orgModels = await getOrgAiModels(admin, organisationId)
    const parsed: ParsedSop = await parseSop(promptText, {
      sourceMode: 'prompt',
      detailLevel,
      models: {
        triage: resolveOrgModel('parse-triage', orgModels),
        simple: resolveOrgModel('parse-simple', orgModels),
        complex: resolveOrgModel('parse-complex', orgModels),
      },
    })
    // Phase 40 CRE (A2): admin-supplied title wins over the AI-derived
    // fallback -- only derive a title when the request didn't supply one.
    parsed.title = title?.trim() || await ensureSopTitle({
      title: parsed.title,
      extractedText: promptText,
      model: resolveOrgModel('parse-simple', orgModels),
    })

    // --- 6. Verifying stage — adversarial verifier in PROMPT mode (D-02; mode param implemented in 14-03) ---
    await admin
      .from('parse_jobs')
      .update({ current_stage: 'verifying', updated_at: new Date().toISOString() })
      .eq('id', job.id)

    const adversarialFlags = await verifyTranscriptVsSop(promptText, parsed, { mode: 'prompt' })
    const missingSectionFlags = detectMissingSections(parsed)
    const allFlags: VerificationFlag[] = [...adversarialFlags, ...missingSectionFlags]

    await admin
      .from('parse_jobs')
      .update({ verification_flags: allFlags as unknown as import('@/types/database.types').Json })
      .eq('id', job.id)

    // --- 7. Resolve section_kind_id for each parsed section (ROADMAP success #4).
    // One-shot fetch of canonical kinds; build slug -> id map for substring-match lookup. ---
    const { data: kindRows } = await admin.from('section_kinds').select('id, slug')
    const slugToKindId = new Map<string, string>()
    for (const k of kindRows ?? []) {
      slugToKindId.set(k.slug.toLowerCase(), k.id)
    }
    function resolveKindId(sectionType: string): string | null {
      const t = sectionType.toLowerCase()
      // Exact match first
      const exact = slugToKindId.get(t)
      if (exact) return exact
      // Substring match against canonical slugs (legacy renderer fallback shape)
      for (const [slug, id] of slugToKindId) {
        if (t.includes(slug)) return id
      }
      return null
    }

    // --- 8. Persist parsed SOP fields ---
    await admin
      .from('sops')
      .update({
        title: parsed.title,
        sop_number: parsed.sop_number ?? null,
        revision_date: parsed.revision_date ?? null,
        author: parsed.author ?? null,
        category_slug: (isValidCategorySlug(categorySlug) ? categorySlug : null) ?? normaliseToCategorySlug(parsed.category),
        related_sops: parsed.related_sops ?? null,
        applicable_equipment: parsed.applicable_equipment ?? null,
        required_certifications: parsed.required_certifications ?? null,
        overall_confidence: parsed.overall_confidence,
        parse_notes: parsed.parse_notes ?? null,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sop.id)

    // --- 9. Persist sections + steps with section_kind_id resolved.
    // Field-name mapping (verified in src/lib/validators/sop.ts):
    //   SopSectionSchema.order  -> sop_sections.sort_order
    //   SopStepSchema.order     -> sop_steps.step_number ---

    // Builder canvas renders exclusively from per-section layout_data — without
    // it an AI/voice draft opens as an empty canvas (bug fixed 2026-07-07).
    const perSectionLayouts = parsedSopToPerSectionLayoutData(parsed, [])

    for (const section of parsed.sections) {
      const sectionKindId = resolveKindId(section.type)
      const { data: sectionRow, error: sectionError } = await admin
        .from('sop_sections')
        .insert({
          sop_id: sop.id,
          section_type: section.type,
          section_kind_id: sectionKindId,
          title: section.title,
          content: section.content ?? null,
          sort_order: section.order,
          confidence: section.confidence,
          approved: false,
        })
        .select('id')
        .single()

      if (sectionError || !sectionRow) continue

      // Write layout_data (with junction-stamped items) so the builder shows
      // the draft. Fail-open: a layout failure must not lose the draft itself —
      // sections/steps remain and the canvas degrades to empty for that section.
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
          console.error('[ai-prompt] layout_data write failed for section', sectionRow.id, err)
        }
      }

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

    // --- 10. Mark job completed ---
    await admin
      .from('parse_jobs')
      .update({
        status: 'completed',
        current_stage: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return NextResponse.json({ success: true, sopId: sop.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    // Don't leak Anthropic errors verbatim to clients — log original, return generic.
    console.error('AI prompt pipeline error:', message)

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
        retry_count: 1,
      })
      .eq('id', job.id)

    return NextResponse.json(
      { error: 'AI draft generation failed. Please try again or contact support.' },
      { status: 500 },
    )
  }
}
