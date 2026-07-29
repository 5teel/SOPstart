#!/usr/bin/env node
/**
 * scripts/verify-category-backfill.mjs
 *
 * Phase 40 DAT-01 / SC-5 — the live production proof. Read-only, no flags,
 * safe to run any time. Pins BOTH retired columns (category AND
 * category_tag) — an assertion that checks only one is exactly the
 * CLAUDE.md [2026-07-28] partial-pin failure. Exit code 1 if either of the
 * first two counts is non-zero, so this doubles as a CI-usable regression
 * guard as well as an operator command.
 *
 * Usage (must run via tsx — this file dynamically imports
 * src/lib/sop-categories.ts, same requirement as scripts/backfill-agent-metadata.mjs):
 *   npx tsx scripts/verify-category-backfill.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

for (const f of ['.env', '.env.local']) {
  const p = path.join(ROOT, f)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0) {
      const k = line.slice(0, i).trim()
      if (k && !process.env[k]) process.env[k] = line.slice(i + 1).trim()
    }
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const { SOP_CATEGORIES } = await import('../src/lib/sop-categories.ts')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const vocabSlugs = SOP_CATEGORIES.map((c) => c.slug)
  const vocabInList = `(${vocabSlugs.join(',')})`

  console.log('=== SC-5 Category Backfill Proof ===')
  console.log('')

  let hadError = false

  async function countQuery(label, sql, run) {
    const { count, error } = await run()
    if (error) {
      console.error(`  ERROR  ${label}`)
      console.error(`    SQL: ${sql}`)
      console.error(`    ${error.message}`)
      hadError = true
      return null
    }
    console.log(`  ${label}`)
    console.log(`    SQL: ${sql}`)
    console.log(`    count = ${count}`)
    return count
  }

  const categoryNotNull = await countQuery(
    'category is not null (must be 0)',
    'select count(*) from public.sops where category is not null',
    () => admin.from('sops').select('*', { count: 'exact', head: true }).not('category', 'is', null)
  )

  const categoryTagNotNull = await countQuery(
    'category_tag is not null (must be 0)',
    'select count(*) from public.sops where category_tag is not null',
    () => admin.from('sops').select('*', { count: 'exact', head: true }).not('category_tag', 'is', null)
  )

  await countQuery(
    'category_slug is null (reported — uncategorised rows are legitimate per D-02)',
    'select count(*) from public.sops where category_slug is null',
    () => admin.from('sops').select('*', { count: 'exact', head: true }).is('category_slug', null)
  )

  await countQuery(
    'sop_review_cadences.category not in vocabulary (reported — non-zero means legacy cadence keys survive)',
    `select count(*) from public.sop_review_cadences where category not in ${vocabInList}`,
    () => admin.from('sop_review_cadences').select('*', { count: 'exact', head: true }).not('category', 'in', vocabInList)
  )

  await countQuery(
    'approval_chains.category not in vocabulary (reported — non-zero means legacy chain keys survive)',
    `select count(*) from public.approval_chains where category not in ${vocabInList}`,
    () => admin.from('approval_chains').select('*', { count: 'exact', head: true }).not('category', 'in', vocabInList)
  )

  console.log('')
  const sc5Failed = hadError || categoryNotNull === null || categoryTagNotNull === null || categoryNotNull > 0 || categoryTagNotNull > 0
  if (sc5Failed) {
    console.error('=== SC-5 FAILED — one or both retired columns still carry data (or a query errored) ===')
    process.exit(1)
  }
  console.log('=== SC-5 PASSED — zero rows carry either retired column ===')
  process.exit(0)
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
