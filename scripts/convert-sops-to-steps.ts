/**
 * SOP -> focus-step conversion runner (Phase 56-02 dry run, 56-07 apply).
 *
 * Default is a read-only dry run. `--apply` (needs --sop, --org or --all) writes
 * ONLY public.sop_focus_steps and public.sop_conversion_runs. This file never
 * touches the old section or step tables: no insert, update or delete on them, so
 * the old SOP page and builder keep reading exactly what they read before.
 *
 * Run: npx tsx scripts/convert-sops-to-steps.ts --all --report <path.md>
 *      npx tsx scripts/convert-sops-to-steps.ts --apply --sop <uuid> | --org <uuid> | --all
 */
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { CONVERTER_VERSION, convertSop, planFocusStepWrites } from '../src/lib/sop/convert'
import type { ExistingFocusStep, SopConversion } from '../src/lib/sop/convert'
import type { Section } from '../src/lib/sop/sections'

const args = process.argv.slice(2)
const flag = (n: string) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : undefined
}

const APPLY = args.includes('--apply')
if (APPLY && !flag('--sop') && !flag('--org') && !args.includes('--all')) {
  console.error('--apply needs an explicit scope: --sop <uuid>, --org <uuid> or --all. Nothing was touched.')
  process.exit(2)
}

for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i).trim()]) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
}

// Production census from 56-RESEARCH.md (2026-10-04), for the byType comparison in the report.
const CENSUS: Record<string, number> = {
  StepBlock: 322, CalloutBlock: 175, HazardCardBlock: 164, StepWithPhotosBlock: 89,
  TextBlock: 79, PPECardBlock: 16, PhotoGridBlock: 4, HeadingBlock: 4,
}

const SECTION_SELECT = '*, section_kind:section_kinds!section_kind_id ( * ), sop_steps ( * ), sop_images ( * )'
const chunk = <T,>(a: T[], n = 500): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n))
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim()

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const org = flag('--org')
  const only = flag('--sop')

  let q = sb.from('sops').select('id, title, organisation_id, status').order('organisation_id').order('title')
  let cq = sb.from('sops').select('id', { count: 'exact', head: true })
  if (org) { q = q.eq('organisation_id', org); cq = cq.eq('organisation_id', org) }
  if (only) { q = q.eq('id', only); cq = cq.eq('id', only) }
  const [{ data: sops, error }, { count }] = await Promise.all([q, cq])
  if (error) throw error

  const rows: Array<{ sop: NonNullable<typeof sops>[number]; c: SopConversion; imgTotal: number }> = []
  for (const sop of sops ?? []) {
    const [{ data: sections, error: se }, { data: imgs, error: ie }] = await Promise.all([
      sb.from('sop_sections').select(SECTION_SELECT).eq('sop_id', sop.id).order('sort_order'),
      sb.from('sop_images').select('storage_path').eq('sop_id', sop.id),
    ])
    if (se) throw se
    if (ie) throw ie
    const c = convertSop({
      sopId: sop.id,
      sections: (sections ?? []) as unknown as Section[],
      sopImagePaths: (imgs ?? []).map((i) => i.storage_path as string),
    })
    rows.push({ sop, c, imgTotal: c.before.images })
  }

  // ---- apply: per SOP, gate first; upsert before delete so a failure leaves a superset, never a loss.
  const action = new Map<string, 'converted' | 'unchanged' | 'failed'>()
  if (APPLY) {
    const runId = randomUUID()
    for (const { sop, c } of rows) {
      if (!sop.organisation_id) throw new Error(`SOP ${sop.id} has no organisation_id; refusing to write`)
      const runRow = {
        run_id: runId, organisation_id: sop.organisation_id, sop_id: sop.id, source: c.source,
        layout_hash: c.hash, converter_version: CONVERTER_VERSION, before: c.before, after: c.after,
      }
      if (!c.gate.ok) {
        const { error: e } = await sb.from('sop_conversion_runs').insert({ ...runRow, ok: false, failures: c.gate.failures })
        if (e) throw e
        action.set(sop.id, 'failed')
        continue
      }
      const { data: last, error: le } = await sb.from('sop_conversion_runs').select('ok, layout_hash, converter_version')
        .eq('sop_id', sop.id).order('created_at', { ascending: false }).limit(1)
      if (le) throw le
      if (last?.[0]?.ok && last[0].layout_hash === c.hash && last[0].converter_version === CONVERTER_VERSION) {
        action.set(sop.id, 'unchanged')
        continue
      }
      const { data: existing, error: ee } = await sb.from('sop_focus_steps').select('*').eq('sop_id', sop.id)
      if (ee) throw ee
      const plan = planFocusStepWrites(c.steps, (existing ?? []) as unknown as ExistingFocusStep[])
      const now = new Date().toISOString()
      for (const part of chunk(plan.upserts)) {
        const { error: ue } = await sb.from('sop_focus_steps').upsert(
          part.map((d) => ({
            organisation_id: sop.organisation_id, sop_id: sop.id, section_id: d.sectionId, kind: d.kind, text: d.text,
            tip: d.tip, photo_required: d.photoRequired, image_paths: d.imagePaths, required_tools: d.requiredTools,
            time_estimate_minutes: d.timeEstimateMinutes, sort_order: d.sortOrder, source_key: d.sourceKey,
            run_id: runId, updated_at: now,
          })),
          { onConflict: 'section_id,source_key' },
        )
        if (ue) throw ue
      }
      for (const part of chunk(plan.deleteIds)) {
        const { error: de } = await sb.from('sop_focus_steps').delete().in('id', part).eq('sop_id', sop.id)
        if (de) throw de
      }
      const { error: re } = await sb.from('sop_conversion_runs').insert({ ...runRow, ok: true, failures: [] })
      if (re) throw re
      action.set(sop.id, 'converted')
    }
    const n = (a: string) => [...action.values()].filter((v) => v === a).length
    console.log(`apply: ${n('converted')} converted / ${n('unchanged')} unchanged / ${n('failed')} failed (run ${runId})`)
  }

  const failing = rows.filter((r) => !r.c.gate.ok)
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0)
  const bySource = (s: string) => rows.filter((r) => r.c.source === s).length
  const byType: Record<string, number> = {}
  for (const r of rows) for (const [t, n] of Object.entries(r.c.before.byType)) byType[t] = (byType[t] ?? 0) + n

  const ppeCount = (r: (typeof rows)[number]) => {
    const text = r.c.steps.filter((s) => s.kind === 'ppe').map((s) => s.text).join('\n')
    return r.c.before.ppeItems.filter((i) => text.includes(i)).length
  }

  console.table(
    rows.map((r) => ({
      id: r.sop.id.slice(0, 8), org: (r.sop.organisation_id ?? 'none').slice(0, 8), title: (r.sop.title ?? '').slice(0, 40), src: r.c.source,
      hazard: `${r.c.before.hazardSources}->${r.c.after.hazard}`, ppe: `${r.c.before.ppeSources}->${r.c.after.ppe}`,
      step: r.c.after.step, check: r.c.after.check, ok: r.c.gate.ok,
    })),
  )
  console.log(`${rows.length} SOPs (count in scope ${count}), ${rows.length - failing.length} ok, ${failing.length} failing`)

  const reportPath = flag('--report')
  if (reportPath) {
    let sha = 'unknown'
    try { sha = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* not a repo */ }
    const scope = only ? `sop ${only}` : org ? `org ${org}` : 'all SOPs'
    const out: string[] = [
      APPLY ? '# Phase 56 - Conversion apply' : '# Phase 56 - Conversion dry run',
      '',
      `- Date: ${new Date().toISOString()}`,
      `- Commit: ${sha}`,
      `- Scope: ${scope}`,
      `- CONVERTER_VERSION: ${CONVERTER_VERSION}`,
      `- SOPs in scope at run time (\`select count(*) from sops\`): ${count}; rows below: ${rows.length}`,
      APPLY
        ? `- Applied: ${[...action.values()].filter((v) => v === 'converted').length} converted / ${[...action.values()].filter((v) => v === 'unchanged').length} unchanged / ${failing.length} failed`
        : '- Read-only: this run wrote nothing.',
      '',
      '## Totals',
      '',
      `- SOPs: ${rows.length}, ok: ${rows.length - failing.length}, failing: ${failing.length}`,
      `- Source: layout ${bySource('layout')}, rows ${bySource('rows')}, mixed ${bySource('mixed')}, empty ${bySource('empty')}`,
      `- Hazard sources -> hazard steps: ${sum((r) => r.c.before.hazardSources)} -> ${sum((r) => r.c.after.hazard)}`,
      `- PPE cards -> ppe steps: ${sum((r) => r.c.before.ppeSources)} -> ${sum((r) => r.c.after.ppe)} (items ${sum(ppeCount)}/${sum((r) => r.c.before.ppeItems.length)})`,
      `- Steps: ${sum((r) => r.c.after.step)}, checks: ${sum((r) => r.c.after.check)}, photo-required: ${sum((r) => r.c.after.photoRequired)}`,
      `- Images matched to sop_images: ${sum((r) => r.c.before.imagesMatched)}/${sum((r) => r.imgTotal)}`,
      `- Dropped: voice ${sum((r) => r.c.before.voiceDropped)}, video ${sum((r) => r.c.before.videoDropped)}, empty ${sum((r) => r.c.before.emptyDropped)}; tips folded ${sum((r) => r.c.before.tipsFolded)}; ids missing/duplicated ${sum((r) => r.c.before.missingIds)}`,
      '',
      '### Block types read vs census (56-RESEARCH 2026-10-04)',
      '',
      '| Type | Read now | Census |',
      '|---|---|---|',
      ...[...new Set([...Object.keys(byType), ...Object.keys(CENSUS)])].sort().map((t) => `| ${t} | ${byType[t] ?? 0} | ${CENSUS[t] ?? '-'} |`),
      '',
      '## Needs Simon',
      '',
      ...(failing.length
        ? ['| SOP title | SOP id | Failing source item | Simon\'s decision | decided on |', '|---|---|---|---|---|',
           ...failing.map((r) => `| ${cell(r.sop.title ?? '')} | ${r.sop.id} | ${cell(r.c.gate.failures.join(' '))} |  |  |`)]
        : ['Needs Simon: none']),
      '',
      '## Per SOP',
      '',
      '| Id | Title | Status | Source | Hazard before->after | PPE cards->steps (items) | Step | Check | Photo | Images matched/total | Dropped v/vid/empty | Tips folded | Result |' + (APPLY ? ' Action |' : ''),
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|' + (APPLY ? '---|' : ''),
      ...rows.map((r) => {
        const b = r.c.before
        return `| ${r.sop.id.slice(0, 8)} | ${cell(r.sop.title ?? '')} | ${r.sop.status} | ${r.c.source} | ${b.hazardSources}->${r.c.after.hazard} | ${b.ppeSources}->${r.c.after.ppe} (${ppeCount(r)}/${b.ppeItems.length}) | ${r.c.after.step} | ${r.c.after.check} | ${r.c.after.photoRequired} | ${b.imagesMatched}/${r.imgTotal} | ${b.voiceDropped}/${b.videoDropped}/${b.emptyDropped} | ${b.tipsFolded} | ${r.c.gate.ok ? 'ok' : cell(r.c.gate.failures.join(' '))} |${APPLY ? ` ${action.get(r.sop.id)} |` : ''}`
      }),
      '',
    ]
    fs.writeFileSync(reportPath, out.join('\n'))
    console.log(`report written: ${reportPath}`)
  }

  process.exit(failing.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(3)
})
