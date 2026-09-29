// Seed the real SOPstart org's site map: the sketch-007 plant scene, twelve machines
// with polygons (Forming / Engineering), four sprites, and SOP↔machine links by title.
// Run: node scripts/seed-site-sopstart.mjs   (reads .env.local; idempotent — re-run safely)
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ORG_PREFIX = 'bd2c2b88'
const ASSETS = '.planning/sketches/007-plant-floor-navigation/assets'
const SCENE_W = 2752, SCENE_H = 1536
const K = SCENE_W / 2000 // sketch polygons were authored on a 2000×1116 display of this scene
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const code = () => { const b = new Uint8Array(6); globalThis.crypto.getRandomValues(b); return [...b].map((x) => ALPHABET[x % 32]).join('') }
const scale = (poly) => poly.map(([x, y]) => [Math.round(x * K), Math.round(y * K)])

// name, department, sketch polygon, sprite file, title regexes that link SOPs here
const MACHINES = [
  { name: 'Furnace & forehearth', dept: 'Forming', poly: [[170,420],[350,360],[430,470],[300,610],[170,560]], link: [/forming area/i] },
  { name: 'IS Machine 1', dept: 'Forming', sprite: 'is-machine.jpg', poly: [[398,585],[540,520],[720,650],[905,845],[875,905],[650,860],[398,705]], link: [/hanger/i, /swab/i, /plenum/i, /deflector|gob loading/i, /adjacent section/i, /forming area/i] },
  { name: 'IS Machine 2', dept: 'Forming', sprite: 'is-machine.jpg', poly: [[528,485],[690,428],[1050,745],[1010,822],[890,770],[760,660]], link: [/hanger/i, /swab/i, /plenum/i, /deflector|gob loading/i, /adjacent section/i, /forming area/i] },
  { name: 'Annealing lehr', dept: 'Forming', sprite: 'lehr.jpg', poly: [[588,290],[705,228],[1002,428],[962,502],[860,470],[598,345]], link: [/otg probe/i, /forming area/i] },
  { name: 'Cold-end inspection line', dept: 'Forming', poly: [[1005,495],[1140,428],[1262,560],[1150,645],[1005,575]], link: [/sample challenge/i, /iri csv/i] },
  { name: 'Palletiser', dept: 'Forming', poly: [[1195,432],[1292,398],[1408,522],[1330,598],[1215,545]], link: [] },
  { name: 'Alkaline cleaning tank', dept: 'Engineering', sprite: 'cleaning-tank.jpg', poly: [[1308,195],[1455,150],[1502,232],[1380,332],[1308,300]], link: [/alkaline cleaning tank/i] },
  { name: 'Lathe', dept: 'Engineering', poly: [[1515,215],[1642,190],[1665,300],[1560,342],[1500,300]], link: [] },
  { name: 'Workbench', dept: 'Engineering', poly: [[1660,245],[1805,268],[1795,385],[1680,385]], link: [] },
  { name: 'Hot-melt gluer', dept: 'Engineering', sprite: 'gluer.jpg', poly: [[1430,345],[1560,330],[1585,455],[1450,470]], link: [/hot melt gluer/i] },
  { name: 'Racking', dept: 'Engineering', poly: [[1625,560],[1905,655],[1905,800],[1705,800],[1625,700]], link: [] },
  { name: 'Forklift', dept: 'Engineering', poly: [[1588,690],[1765,690],[1765,865],[1588,865]], link: [/tyre change/i, /forklift/i] },
  { name: 'Office terminal', dept: 'Engineering', poly: [[1440,800],[1622,800],[1622,962],[1440,962]], link: [/keyboard/i] },
]

const fail = (m) => { console.error('FAIL:', m); process.exit(1) }
const { data: orgs } = await sb.from('organisations').select('id,name')
const org = orgs?.find((o) => o.id.startsWith(ORG_PREFIX)) ?? fail('org not found')
const { data: depts } = await sb.from('departments').select('id,name').eq('organisation_id', org.id)
const deptId = Object.fromEntries((depts ?? []).map((d) => [d.name, d.id]))
for (const d of ['Forming', 'Engineering']) if (!deptId[d]) fail(`department ${d} missing in ${org.name}`)

// 1. layout (reuse the org's first layout if one exists)
let { data: layout } = await sb.from('site_layouts').select('id,name,scene_path').eq('organisation_id', org.id).order('created_at').limit(1).maybeSingle()
if (!layout) {
  const r = await sb.from('site_layouts').insert({ organisation_id: org.id, name: 'Main plant', scene_width: SCENE_W, scene_height: SCENE_H }).select('id,name,scene_path').single()
  if (r.error) fail(r.error.message); layout = r.data; console.log('created layout', layout.id)
} else console.log('reusing layout', layout.id, layout.name)

// 2. scene image
const scenePath = `${org.id}/${layout.id}/scene.jpg`
const up = await sb.storage.from('site-scenes').upload(scenePath, fs.readFileSync(`${ASSETS}/plant.jpg`), { contentType: 'image/jpeg', upsert: true })
if (up.error) fail(`scene upload: ${up.error.message}`)
const lu = await sb.from('site_layouts').update({ scene_path: scenePath, scene_width: SCENE_W, scene_height: SCENE_H, updated_at: new Date().toISOString() }).eq('id', layout.id)
if (lu.error) fail(lu.error.message)
console.log('scene uploaded', scenePath)

// 3. machines (upsert by name within the layout)
const { data: existing } = await sb.from('site_machines').select('id,name').eq('site_layout_id', layout.id)
const byName = Object.fromEntries((existing ?? []).map((m) => [m.name, m.id]))
const machineId = {}
let sort = 0
for (const m of MACHINES) {
  let spritePath = null
  if (m.sprite) {
    spritePath = `${org.id}/${layout.id}/sprites/${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`
    const s = await sb.storage.from('site-scenes').upload(spritePath, fs.readFileSync(`${ASSETS}/${m.sprite}`), { contentType: 'image/jpeg', upsert: true })
    if (s.error) fail(`sprite ${m.name}: ${s.error.message}`)
  }
  const row = { site_layout_id: layout.id, organisation_id: org.id, name: m.name, department_id: deptId[m.dept], polygon: scale(m.poly), sprite_path: spritePath, sort: sort++, updated_at: new Date().toISOString() }
  if (byName[m.name]) {
    const r = await sb.from('site_machines').update(row).eq('id', byName[m.name]).select('id').single()
    if (r.error) fail(`${m.name}: ${r.error.message}`); machineId[m.name] = r.data.id
  } else {
    const r = await sb.from('site_machines').insert({ ...row, code: code() }).select('id').single()
    if (r.error) fail(`${m.name}: ${r.error.message}`); machineId[m.name] = r.data.id
  }
}
console.log('machines', Object.keys(machineId).length)

// 4. SOP links by title
const { data: sops } = await sb.from('sops').select('id,title').eq('organisation_id', org.id)
const links = []
for (const s of sops ?? []) {
  const t = s.title ?? ''
  for (const m of MACHINES) if (m.link.some((re) => re.test(t))) links.push({ sop_id: s.id, machine_id: machineId[m.name], organisation_id: org.id })
}
const lk = await sb.from('sop_machines').upsert(links, { onConflict: 'sop_id,machine_id', ignoreDuplicates: true })
if (lk.error) fail(lk.error.message)
const linked = new Set(links.map((l) => l.sop_id))
console.log(`links ${links.length} across ${linked.size} SOPs`)
for (const s of sops ?? []) if (linked.has(s.id)) console.log('  ', (s.title ?? '').slice(0, 60).padEnd(62), MACHINES.filter((m) => m.link.some((re) => re.test(s.title ?? ''))).map((m) => m.name).join(', '))
console.log('unlinked:', (sops ?? []).filter((s) => !linked.has(s.id)).map((s) => (s.title ?? '(untitled)').slice(0, 40)).join(' | '))
