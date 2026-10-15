/**
 * Demo content only: pictures and diagrams on the demo sites' SOP steps (Southern Rail, Kōwhai, Clearwater).
 * Never the real customer site. For each published SOP, Sonnet 5.5 picks 2-3 steps a picture really helps and
 * writes the prompt; OpenRouter gpt-5.4-image-2 draws it; the picture is attached the way the editor attaches one
 * (attachStepImage: storage path org/sop/steps/<step>/<uuid>.jpg, a sop_images row, then the step's image_paths).
 *
 *   --plan      plan only, write .autoresearch/demo-images/plan.json (no images)
 *   --apply     generate and attach every planned picture not yet attached (re-runnable)
 *   --undo      remove every picture this script attached (from manifest.json)
 *
 * Run: node --env-file=.env.local --env-file=.env node_modules/tsx/dist/cli.mjs scripts/demo-step-images.ts --plan|--apply|--undo
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { llmToolCall } from '@/lib/ai/llm'

const SITES: Record<string, { name: string; look: string }> = {
  '2bd50c2d-5668-41e0-8a0b-763d7ec87575': {
    name: 'Southern Rail Track Services',
    look: 'railway track maintenance in New Zealand: ballast, concrete sleepers, steel rail, hi-rail plant, workers in orange hi-vis with hard hats, overcast daylight',
  },
  'de28b00a-0a80-4cdc-a593-df6a1ac3edad': {
    name: 'Kōwhai Electrical Trades School',
    look: 'an electrical, plumbing and fabrication trades training workshop in New Zealand: benches, switchboards, cable, conduit, hand and power tools, students in work clothes',
  },
  '53c8b52c-9996-4d28-b2a3-7f26da252ab2': {
    name: 'Clearwater Beverages',
    look: 'a New Zealand beverage bottling plant: stainless steel filling and capping lines, conveyors, PET bottles, CIP pipework, operators in hairnets, white coats and safety glasses',
  },
}
const DIR = '.autoresearch/demo-images'
const PLAN = `${DIR}/plan.json`
const MANIFEST = `${DIR}/manifest.json`
const PLANNER = 'claude-sonnet-5-5'
const IMAGE_MODEL = 'openai/gpt-5.4-image-2'

type Pick = { step_id: string; style: 'photo' | 'diagram'; why: string; prompt: string }
type PlanRow = Pick & { org: string; sop: string; sopTitle: string; stepText: string }
type Done = { org: string; sop: string; step: string; path: string; imageRowId: string }

const db = createAdminClient()
const read = <T,>(f: string, d: T): T => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d)
mkdirSync(DIR, { recursive: true })

async function plan() {
  const out: PlanRow[] = []
  for (const [org, site] of Object.entries(SITES)) {
    const { data: sops } = await db.from('sops').select('id, title').eq('organisation_id', org).eq('status', 'published')
    for (const sop of sops ?? []) {
      const { data: steps } = await db
        .from('sop_focus_steps')
        .select('id, kind, text, sort_order, section_id, image_paths')
        .eq('sop_id', sop.id)
        .order('sort_order')
      const list = (steps ?? []).filter((s) => s.kind === 'step' && !(s.image_paths ?? []).length)
      if (list.length === 0) continue
      const r = (await llmToolCall({
        model: PLANNER,
        maxTokens: 4000,
        system: `You choose where pictures help a worker follow a SOP on a phone at ${site.name} (${site.look}). Pick 2 or 3 steps (1 if the SOP has under 4 steps) where a picture shows something words cannot: where a part is, a correct position or setting, what good looks like, or a layout or sequence. Skip steps a picture adds nothing to.
For each, choose "photo" (a realistic photo of that moment at this site) or "diagram" (a clean labelled line diagram: wiring, layouts, positions, clearances, sequences), and write an image prompt that:
- shows exactly what the step describes, from the worker's point of view;
- for a diagram: white background, black line art, at most 5 short English labels, metric units only, no title block;
- for a photo: realistic, no readable brand names or logos, nobody's face as the subject, correct PPE for the task;
- never shows anything unsafe the step warns against unless clearly marked as wrong.
Then call pick_images.`,
        messages: [{ role: 'user', content: `SOP: ${sop.title}\n\nSTEPS:\n${list.map((s) => `${s.id} | ${s.text}`).join('\n')}` }],
        tool: {
          name: 'pick_images',
          description: 'The steps to illustrate, with the image prompt for each.',
          input_schema: {
            type: 'object',
            required: ['picks'],
            properties: {
              picks: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['step_id', 'style', 'why', 'prompt'],
                  properties: { step_id: { type: 'string' }, style: { type: 'string', enum: ['photo', 'diagram'] }, why: { type: 'string' }, prompt: { type: 'string' } },
                },
              },
            },
          },
        },
      })) as { picks?: Pick[] }
      for (const p of r?.picks ?? []) {
        const step = list.find((s) => s.id === p.step_id)
        if (step) out.push({ ...p, org, sop: sop.id, sopTitle: sop.title ?? "", stepText: step.text })
      }
      console.log(`${site.name} · ${sop.title}: ${(r?.picks ?? []).length} picks`)
    }
  }
  writeFileSync(PLAN, JSON.stringify(out, null, 2))
  console.log(`${out.length} pictures planned -> ${PLAN}`)
}

async function draw(p: PlanRow): Promise<Buffer> {
  const style =
    p.style === 'diagram'
      ? 'A clean technical line diagram, black lines on white, sparse short labels, no title.'
      : `A realistic photograph at ${SITES[p.org].look}.`
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: '4:3' },
      messages: [{ role: 'user', content: `${style}\n\n${p.prompt}` }],
    }),
  })
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = (await res.json()) as { choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }> }
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url
  if (!url?.startsWith('data:')) throw new Error('no image in the reply')
  // Phone-sized JPEG, like a compressed step photo.
  return sharp(Buffer.from(url.split(',')[1], 'base64')).resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
}

async function attach(p: PlanRow, jpg: Buffer): Promise<Done> {
  const path = `${p.org}/${p.sop}/steps/${p.step_id}/${randomUUID()}.jpg`
  const up = await db.storage.from('sop-images').upload(path, jpg, { contentType: 'image/jpeg' })
  if (up.error) throw new Error(`upload: ${up.error.message}`)
  const { data: step } = await db.from('sop_focus_steps').select('image_paths, section_id').eq('id', p.step_id).eq('sop_id', p.sop).single()
  const paths = (step!.image_paths ?? []) as string[]
  const { data: row, error } = await db
    .from('sop_images')
    .insert({ sop_id: p.sop, section_id: step!.section_id, storage_path: path, content_type: 'image/jpeg', sort_order: paths.length })
    .select('id')
    .single()
  if (error || !row) throw new Error(`image row: ${error?.message}`)
  const upd = await db.from('sop_focus_steps').update({ image_paths: [...paths, path] }).eq('id', p.step_id).eq('organisation_id', p.org)
  if (upd.error) throw new Error(`step: ${upd.error.message}`)
  return { org: p.org, sop: p.sop, step: p.step_id, path, imageRowId: row.id }
}

async function apply() {
  const planned = read<PlanRow[]>(PLAN, [])
  const done = read<Done[]>(MANIFEST, [])
  const todo = planned.filter((p) => !done.some((d) => d.step === p.step_id)).slice(0, Number(process.env.LIMIT ?? 1e9))
  console.log(`${todo.length} to draw`)
  // ponytail: four at a time in plain chunks; fine for ~60 pictures.
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async (p) => {
        try {
          // A reply with no picture happens now and then: one more try.
          const d = await attach(p, await draw(p).catch(() => draw(p)))
          done.push(d)
          writeFileSync(MANIFEST, JSON.stringify(done, null, 2))
          console.log(`ok   ${p.style.padEnd(7)} ${p.sopTitle} · ${p.stepText.slice(0, 60)}`)
        } catch (e) {
          console.log(`FAIL ${p.sopTitle} · ${p.stepText.slice(0, 60)}: ${e instanceof Error ? e.message : e}`)
        }
      }),
    )
  }
  console.log(`${done.length} attached in all`)
}

async function undo() {
  const done = read<Done[]>(MANIFEST, [])
  for (const d of done) {
    const { data: step } = await db.from('sop_focus_steps').select('image_paths').eq('id', d.step).single()
    await db.from('sop_focus_steps').update({ image_paths: ((step?.image_paths ?? []) as string[]).filter((x) => x !== d.path) }).eq('id', d.step)
    await db.from('sop_images').delete().eq('id', d.imageRowId)
    await db.storage.from('sop-images').remove([d.path])
  }
  writeFileSync(MANIFEST, '[]')
  console.log(`${done.length} removed`)
}

const arg = process.argv[2]
;(arg === '--plan' ? plan() : arg === '--apply' ? apply() : arg === '--undo' ? undo() : Promise.reject(new Error('--plan | --apply | --undo'))).catch((e) => {
  console.error(e)
  process.exit(1)
})
