// READ ONLY — this script never writes
/**
 * Phase 40 DAT-01 / D-01: read-only survey of the real values living in the
 * two category columns that plan 40-04 retires (sops.category free text,
 * sops.category_tag block_categories slug), plus the downstream consumers
 * keyed by the same free-text value (sop_review_cadences.category,
 * approval_chains.category) and collections.name (auto-created per distinct
 * sops.category by ensureSopCollectionsForOrg). Output seeds SOP_CATEGORIES
 * in src/lib/sop-categories.ts (this plan) and the AI-mapping pass in
 * plan 40-06's backfill script.
 *
 * Run: node scripts/survey-sop-categories.mjs
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

function tally(rows, key) {
  const counts = new Map()
  for (const row of rows ?? []) {
    const v = row[key]
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function printTable(title, pairs) {
  console.log(`\n=== ${title} (${pairs.length} distinct) ===`)
  for (const [value, count] of pairs) {
    console.log(`  ${count.toString().padStart(5)}  ${value === null ? '(null)' : value}`)
  }
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: sops, error: sopsErr } = await admin
    .from('sops')
    .select('category, category_tag')
  if (sopsErr) throw new Error(`fetch sops failed: ${sopsErr.message}`)

  const { data: cadences, error: cadErr } = await admin
    .from('sop_review_cadences')
    .select('category')
  if (cadErr) throw new Error(`fetch sop_review_cadences failed: ${cadErr.message}`)

  const { data: chains, error: chainErr } = await admin
    .from('approval_chains')
    .select('category')
  if (chainErr) throw new Error(`fetch approval_chains failed: ${chainErr.message}`)

  const { data: collections, error: collErr } = await admin
    .from('collections')
    .select('name')
  if (collErr) throw new Error(`fetch collections failed: ${collErr.message}`)

  printTable('sops.category', tally(sops, 'category'))
  printTable('sops.category_tag', tally(sops, 'category_tag'))
  printTable('sop_review_cadences.category', tally(cadences, 'category'))
  printTable('approval_chains.category', tally(chains, 'category'))
  printTable('collections.name', tally(collections, 'name'))

  console.log(`\nTotal sops rows: ${sops?.length ?? 0}`)
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
