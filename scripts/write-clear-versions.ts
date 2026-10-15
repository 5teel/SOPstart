/**
 * ADR-0015 backfill: writes the clear version beside existing SOPs. Writes ONLY sops.clear_version
 * (and clears clear_approved_*); never the sections or steps, so nothing workers see changes until an
 * admin approves a clear version in Read.
 *
 * The direct translation it rewrites from is parsed in memory from the source file, as a new upload would be.
 * Skips a SOP that already has a clear version unless --force.
 *
 * --model <id> parses the direct translation with that model instead of the org's AI Settings.
 *
 * Run: node --env-file=.env.local --env-file=.env node_modules/tsx/dist/cli.mjs scripts/write-clear-versions.ts --org <uuid> | --sop <uuid> [--force] [--model <id>]
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { extractDocxStructural } from '@/lib/parsers/extract-docx-structural'
import { structuredDocToPrompt } from '@/lib/parsers/structured-doc-to-prompt'
import { extractPdf } from '@/lib/parsers/extract-pdf'
import { extractTxt } from '@/lib/parsers/extract-txt'
import { parseSop } from '@/lib/parsers/sop-parser'
import { writeClearVersion } from '@/lib/parsers/enhance-sop'
import { getOrgAiModels, resolveOrgModel } from '@/lib/ai/org-settings'

const args = process.argv.slice(2)
const flag = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined)
const org = flag('--org')
const one = flag('--sop')
const pin = flag('--model')
if (!org && !one) {
  console.error('needs --org <uuid> or --sop <uuid>. Nothing was touched.')
  process.exit(2)
}

async function main() {
  const db = createAdminClient()
  let q = db.from('sops').select('id, organisation_id, title, status, source_file_type, source_file_path, clear_version').in('status', ['published', 'draft'])
  q = one ? q.eq('id', one) : q.eq('organisation_id', org!)
  const { data, error } = await q
  if (error) throw error
  const todo = (data ?? []).filter((s) => s.source_file_path && ['docx', 'pdf', 'txt'].includes(s.source_file_type) && (args.includes('--force') || !s.clear_version))
  console.log(`${todo.length} SOPs to write`)
  const t00 = Date.now()
  // ponytail: four at a time, plain chunks; a queue if the SOP count grows past a few dozen.
  for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(run))
  console.log(`done in ${Math.round((Date.now() - t00) / 60000)} min`)

  async function run(s: (typeof todo)[number]) {
    const t0 = Date.now()
    try {
      const { data: file, error: dl } = await db.storage.from('sop-documents').download(s.source_file_path!)
      if (dl || !file) throw new Error(`download: ${dl?.message}`)
      const buf = await file.arrayBuffer()
      let text = ''
      let images: Array<{ index: number; storagePath: string }> = []
      if (s.source_file_type === 'docx') {
        const x = await extractDocxStructural(buf)
        text = structuredDocToPrompt(x.doc)
        // Same paths the parse route uploaded to (image-uploader.ts); only the ones that exist.
        const { data: listed } = await db.storage.from('sop-images').list(`${s.organisation_id}/${s.id}/images`, { limit: 1000 })
        const have = new Set((listed ?? []).map((f) => f.name))
        images = x.images.flatMap((im) => {
          const name = `img_${im.index}.${im.contentType === 'image/png' ? 'png' : 'jpg'}`
          return have.has(name) ? [{ index: im.index, storagePath: `${s.organisation_id}/${s.id}/images/${name}` }] : []
        })
      } else if (s.source_file_type === 'pdf') text = (await extractPdf(buf)).text
      else text = (await extractTxt(buf)).text
      if (text.length < 50) throw new Error('too little text')

      const models = await getOrgAiModels(db, s.organisation_id)
      const direct = await parseSop(text, {
        sourceMode: s.source_file_type as 'docx' | 'pdf' | 'txt',
        faithful: true,
        models: pin ? { triage: pin, simple: pin, complex: pin } : { triage: resolveOrgModel('parse-triage', models), simple: resolveOrgModel('parse-simple', models), complex: resolveOrgModel('parse-complex', models) },
      })
      const clear = await writeClearVersion(db, {
        organisationId: s.organisation_id,
        sopId: s.id,
        sourceText: text,
        direct,
        images,
        model: resolveOrgModel('parse-enhance', models),
        checkModel: resolveOrgModel('parse-enhance-check', models),
      })
      const issues = clear.check?.issues ?? []
      console.log(`ok   ${s.id} ${s.status} "${s.title}" check=${issues.length} (${issues.filter((i) => i.severity === 'critical').length} critical) open=${clear.openItems.length} ${Math.round((Date.now() - t0) / 1000)}s`)
    } catch (e) {
      console.log(`FAIL ${s.id} "${s.title}" ${e instanceof Error ? e.message.slice(0, 200) : e}`)
    }
  }
}
main()
