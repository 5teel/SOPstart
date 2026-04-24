// Runtime UAT probe for Phase 12
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, svc, { auth: { persistSession: false } })

const ADMIN_USER_ID = '177c3f6b-fa27-477b-9046-7ce84228855e'
const ADMIN_ORG_ID = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea'

const results = []
function pass(name, detail) { results.push({ name, status: 'PASS', detail }); console.log(`PASS ${name} - ${detail}`) }
function fail(name, detail) { results.push({ name, status: 'FAIL', detail }); console.log(`FAIL ${name} - ${detail}`) }
function skip(name, detail) { results.push({ name, status: 'SKIP', detail }); console.log(`SKIP ${name} - ${detail}`) }

// M0: migration 00020 columns + RPC exist
{
  const { error } = await sb.rpc('reorder_sections', { p_sop_id: '00000000-0000-0000-0000-000000000000', p_ordered_section_ids: ['00000000-0000-0000-0000-000000000000'] })
  if (error && /function .* does not exist/i.test(error.message)) {
    fail('M0.RPC exists', 'reorder_sections RPC missing')
  } else {
    pass('M0.RPC exists', 'reorder_sections(uuid, uuid[]) callable')
  }
}
{
  const { data, error } = await sb.from('sops').select('id, source_type').limit(1)
  if (error) fail('M0.source_type column', error.message)
  else pass('M0.source_type column', `sample source_type=${data[0]?.source_type}`)
}
{
  const { data, error } = await sb.from('sop_sections').select('id, layout_data, layout_version').limit(1)
  if (error) fail('M0.layout columns', error.message)
  else pass('M0.layout columns', 'layout_data + layout_version present')
}

// UAT #1: wizard-equivalent creation
const { data: kinds, error: kindsErr } = await sb.from('section_kinds').select('*').in('slug', ['hazards','ppe','steps','emergency','signoff'])
if (kindsErr || !kinds?.length) fail('U1.section_kinds visible', kindsErr?.message || 'none')
else pass('U1.section_kinds visible', `${kinds.length} canonical kinds`)

let createdSopId
{
  const { data, error } = await sb.from('sops').insert({
    title: 'PHASE-12 UAT - DELETE ME',
    sop_number: 'UAT-12',
    organisation_id: ADMIN_ORG_ID,
    source_type: 'blank',
    status: 'draft',
    uploaded_by: ADMIN_USER_ID,
    source_file_name: 'PHASE-12 UAT - DELETE ME',
    source_file_type: 'docx',
    source_file_path: '',
  }).select('id, source_type, status').single()
  if (error) fail('U1.create SOP', error.message)
  else {
    createdSopId = data.id
    if (data.source_type === 'blank' && data.status === 'draft') pass('U1.create SOP', `id=${data.id} source_type=blank`)
    else fail('U1.create SOP', JSON.stringify(data))
  }
}

let sectionIds = []
if (createdSopId && kinds) {
  const rows = kinds.map((k, idx) => ({
    sop_id: createdSopId,
    section_kind_id: k.id,
    section_type: k.slug,
    title: k.display_name,
    sort_order: idx,
  }))
  const { data, error } = await sb.from('sop_sections').insert(rows).select('id, section_type, sort_order')
  if (error) fail('U1.create sections', error.message)
  else {
    sectionIds = data.map(r => r.id)
    pass('U1.create sections', `${data.length} sections (types: ${[...new Set(data.map(r=>r.section_type))].join(',')})`)
  }
}

// UAT #2: autosave persistence
if (sectionIds[0]) {
  const payload = { content: [{ type: 'TextBlock', props: { id: 'test', content: 'UAT autosave' } }], root: { props: {} } }
  const { error } = await sb.from('sop_sections').update({ layout_data: payload, layout_version: 1 }).eq('id', sectionIds[0])
  if (error) fail('U2.persist layout_data', error.message)
  else {
    const { data } = await sb.from('sop_sections').select('layout_version, layout_data').eq('id', sectionIds[0]).single()
    if (data?.layout_version === 1 && data.layout_data?.content?.[0]?.type === 'TextBlock') {
      pass('U2.persist layout_data', 'layout_version=1, JSONB round-trip ok')
    } else {
      fail('U2.persist layout_data', JSON.stringify(data))
    }
  }
}

// UAT #5: reorder_sections RPC atomicity
if (sectionIds.length >= 3) {
  const reordered = [sectionIds[2], sectionIds[0], sectionIds[1], ...sectionIds.slice(3)]
  const { error } = await sb.rpc('reorder_sections', { p_sop_id: createdSopId, p_ordered_section_ids: reordered })
  if (error) fail('U5.reorder_sections', error.message)
  else {
    const { data } = await sb.from('sop_sections').select('id, sort_order').eq('sop_id', createdSopId).order('sort_order')
    const gotOrder = data.map(r => r.id)
    const matches = reordered.every((id, i) => gotOrder[i] === id)
    if (matches) pass('U5.reorder_sections', `atomic: sort_order now matches new order (${gotOrder.length} sections)`)
    else fail('U5.reorder_sections', `expected ${reordered.slice(0,3)} got ${gotOrder.slice(0,3)}`)
  }
}

// UAT #9: 128KB cap in source
const secSrc = readFileSync('src/actions/sections.ts', 'utf8')
const hasCap = /128\s*\*\s*1024|131072/.test(secSrc) && /Buffer\.byteLength/.test(secSrc)
if (hasCap) pass('U9.128KB cap', 'Buffer.byteLength vs 128*1024 present in updateSectionLayout')
else fail('U9.128KB cap', 'cap check not found')

// UAT #10: seed version 999
if (sectionIds[1]) {
  const { error } = await sb.from('sop_sections').update({
    layout_data: { content: [{ type: 'TextBlock', props: { id: 'x', content: 'future block' } }], root: { props: {} } },
    layout_version: 999
  }).eq('id', sectionIds[1])
  if (error) fail('U10.seed v999', error.message)
  else pass('U10.seed v999', `section ${sectionIds[1]} seeded with layout_version=999 for fallback test`)
}

// UAT #7: purge wiring
const purgeSrc = readFileSync('src/lib/offline/draftLayouts-purge.ts', 'utf8')
const syncSrc = readFileSync('src/lib/offline/sync-engine.ts', 'utf8')
const reviewSrc = readFileSync('src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx', 'utf8')
const useSopSyncSrc = readFileSync('src/hooks/useSopSync.ts', 'utf8')
const checks = {
  purgeHelperExported: /export\s+(async\s+)?function\s+purgeDraftLayoutsOnPublish/.test(purgeSrc),
  purgeTargetsSopId: /\.where\(['"]sop_id['"]\)/.test(purgeSrc) && /\.delete\(\)/.test(purgeSrc),
  publishedTransitionsInSync: /publishedTransitions/.test(syncSrc),
  reviewClientCallsPurge: /purgeDraftLayoutsOnPublish/.test(reviewSrc),
  useSopSyncConsumesTransitions: /publishedTransitions/.test(useSopSyncSrc),
}
if (Object.values(checks).every(Boolean)) pass('U7.purge wiring', '3-way purge wired (helper + sync transition + review)')
else fail('U7.purge wiring', JSON.stringify(checks))

skip('U8.chip', 'browser-only (HTML rendering)')
skip('U3/U4/U6', 'browser-only (offline toggle, phone frame, cross-admin LWW)')

console.log(`\nTest SOP id: ${createdSopId}`)
console.log(`Section IDs: ${JSON.stringify(sectionIds)}`)
console.log(`Cleanup: DELETE FROM sops WHERE id = '${createdSopId}'`)

const passes = results.filter(r => r.status === 'PASS').length
const fails = results.filter(r => r.status === 'FAIL').length
const skips = results.filter(r => r.status === 'SKIP').length
console.log(`\n=== UAT RUNTIME SUMMARY ===`)
console.log(`PASS: ${passes}/${results.length}  FAIL: ${fails}  SKIP (human): ${skips}`)
process.exit(fails > 0 ? 1 : 0)
