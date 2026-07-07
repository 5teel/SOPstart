/**
 * One-time backfill: generate layout_data for existing sections that have
 * content/steps but NULL layout_data (AI/voice/pdf/txt drafts created before
 * the 2026-07-07 fix — the builder canvas renders only layout_data, so these
 * opened as an empty canvas). Reconstructs a ParsedSop from DB rows and runs
 * the same converter + junction materialization the parse route uses.
 *
 * Run: npx tsx scripts/backfill-section-layouts.ts
 */
import fs from 'node:fs'

for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  }
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { parsedSopToPerSectionLayoutData, materializeJunctionsForLayout } = await import(
    '../src/lib/parsers/parsed-sop-to-layout-data'
  )
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: sops } = await admin
    .from('sops')
    .select('id, title, organisation_id, status')
    .in('status', ['draft', 'published'])
  let fixedSops = 0

  for (const sop of sops ?? []) {
    const { data: sections } = await admin
      .from('sop_sections')
      .select('id, title, section_type, content, sort_order, confidence, layout_data')
      .eq('sop_id', sop.id)
      .order('sort_order')
    if (!sections?.length) continue
    // Only touch SOPs where EVERY section lacks layout_data (pre-fix drafts) —
    // never overwrite anything an admin may have edited in the builder.
    if (sections.some((s) => s.layout_data !== null)) continue

    const parsedSections = []
    for (const sec of sections) {
      const { data: steps } = await admin
        .from('sop_steps')
        .select('step_number, text, warning, caution, tip, required_tools, time_estimate_minutes')
        .eq('section_id', sec.id)
        .order('step_number')
      parsedSections.push({
        order: sec.sort_order,
        type: sec.section_type ?? 'procedure',
        title: sec.title ?? 'Untitled Section',
        content: sec.content ?? null,
        confidence: sec.confidence ?? 0.7,
        steps: steps?.length
          ? steps.map((st) => ({
              order: st.step_number,
              text: st.text ?? '',
              warning: st.warning ?? null,
              caution: st.caution ?? null,
              tip: st.tip ?? null,
              required_tools: st.required_tools ?? null,
              time_estimate_minutes: st.time_estimate_minutes ?? null,
              has_image: false,
              image_indexes: null,
            }))
          : null,
      })
    }
    const hasContent = parsedSections.some((s) => (s.steps?.length ?? 0) > 0 || s.content)
    if (!hasContent) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = {
      title: sop.title ?? 'Untitled SOP',
      sop_number: null, revision_date: null, author: null, category: null,
      related_sops: null, applicable_equipment: null, required_certifications: null,
      overall_confidence: 0.7, parse_notes: null,
      sections: parsedSections,
    }
    const { layouts } = parsedSopToPerSectionLayoutData(parsed, [])
    let wrote = 0
    for (const sec of sections) {
      const layout = layouts.get(sec.sort_order)
      if (!layout || layout.content.length === 0) continue
      try {
        await materializeJunctionsForLayout({
          organisationId: sop.organisation_id,
          sectionId: sec.id,
          puckItems: layout.content,
          createdByUserId: null,
        })
        const { error } = await admin
          .from('sop_sections')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ layout_data: layout as unknown as object, layout_version: 1 } as any)
          .eq('id', sec.id)
        if (error) throw new Error(error.message)
        wrote++
      } catch (err) {
        console.error(`  section ${sec.id} FAILED:`, err instanceof Error ? err.message : err)
      }
    }
    if (wrote > 0) {
      fixedSops++
      console.log(`OK "${sop.title}" (${sop.id}): ${wrote}/${sections.length} sections`)
    }
  }
  console.log(`Done — ${fixedSops} SOPs backfilled.`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
