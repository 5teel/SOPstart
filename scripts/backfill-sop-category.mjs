#!/usr/bin/env node
/**
 * scripts/backfill-sop-category.mjs
 *
 * Phase 40 DAT-01/D-02/SC-5 — three-pass, null-clobber-safe SOP category
 * backfill: deterministic exact/label match (idempotent re-run of migration
 * 00058's SQL), AI-mapping of the residue (mapped per DISTINCT VALUE, never
 * per row), then a settings-table remap (sop_review_cadences, approval_chains)
 * keyed by the same old free-text category value. Only after all of that
 * succeeds does it null the two retired columns (sops.category,
 * sops.category_tag) — the change SC-5 is graded on.
 *
 * Default mode is --dry-run (no writes at all). A live write requires the
 * explicit --apply flag.
 *
 * Null-clobber rule (CLAUDE.md [2026-07-05], non-negotiable): every write
 * payload is built by conditional spread, never an unconditional
 * `category_slug: null` — a value the model could not map, or a failed
 * call, results in NO write for those rows, never a blanket null. See the
 * backfill-agent-metadata.mjs incident this rule exists to prevent.
 *
 * Org-scoping rule (CLAUDE.md [2026-06-15]/[2026-07-05]/[2026-07-28]): the
 * service-role client bypasses RLS and has no automatic org scoping. Every
 * settings-table write below carries `.eq('organisation_id', row.organisation_id)`
 * derived from the ROW BEING PROCESSED, never from a supplied parameter.
 *
 * Usage (must run via tsx — this file dynamically imports TypeScript source
 * modules, same requirement as scripts/backfill-agent-metadata.mjs):
 *   npx tsx scripts/backfill-sop-category.mjs --dry-run   (default; explicit form)
 *   npx tsx scripts/backfill-sop-category.mjs --apply
 *
 * Requirements (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY (or the provider key matching CATEGORY_MAP_MODEL) —
 *     only needed if any residue remains after the deterministic pass.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// .env-loading preamble (mirrors scripts/backfill-owner-review.mjs).
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

const APPLY = process.argv.includes('--apply')
const AUDIT_PATH = path.join(
  ROOT,
  '.planning/phases/40-shared-creation-foundation/category-backfill-audit.json'
)

// Named model constant with env override — never a bare hard-coded model id
// (CLAUDE.md [2026-06-02] VERIFY_MODEL-rot lesson).
const CATEGORY_MAP_MODEL = process.env.CATEGORY_MAP_MODEL || 'claude-haiku-4-5-20251001'

function normalize(v) {
  return (v ?? '').toString().trim().toLowerCase()
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const { SOP_CATEGORIES, isValidCategorySlug, normaliseToCategorySlug } = await import(
    '../src/lib/sop-categories.ts'
  )
  const { llmToolCall } = await import('../src/lib/ai/llm.ts')

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  console.log(`=== SOP Category Backfill (${APPLY ? 'APPLY' : 'DRY RUN'}) ===`)
  console.log('')

  // ---------------------------------------------------------------------
  // Step 0 — audit record, written BEFORE any write. This file is the only
  // rollback record once step 4 nulls the retired columns.
  // ---------------------------------------------------------------------
  const { data: sopsRows, error: sopsErr } = await admin
    .from('sops')
    .select('id, organisation_id, category, category_tag, category_slug')
  if (sopsErr) {
    console.error('FAILED to read sops:', sopsErr.message)
    process.exit(1)
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    rows: sopsRows.map((r) => ({
      id: r.id,
      organisation_id: r.organisation_id,
      category: r.category,
      category_tag: r.category_tag,
      category_slug: r.category_slug,
    })),
    aiMappingDictionary: null, // filled in after step 2
  }
  try {
    fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true })
    fs.writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2))
  } catch (e) {
    console.error('FAILED to write audit file — refusing to continue:', e.message)
    process.exit(1)
  }
  console.log(`[step 0] audit record written: ${AUDIT_PATH} (${audit.rows.length} row(s))`)

  // ---------------------------------------------------------------------
  // Step 1 — deterministic pass (idempotent re-run of migration 00058's SQL).
  // Rows already carrying category_slug are never touched.
  // ---------------------------------------------------------------------
  const resolvedMap = new Map() // normalized old value -> slug, built as rows resolve
  const pass1Writes = []
  for (const row of sopsRows) {
    if (row.category_slug) continue
    const slug = normaliseToCategorySlug(row.category_tag) ?? normaliseToCategorySlug(row.category)
    if (!slug) continue
    pass1Writes.push({ id: row.id, slug })
    if (row.category_tag) resolvedMap.set(normalize(row.category_tag), slug)
    if (row.category) resolvedMap.set(normalize(row.category), slug)
  }
  if (APPLY) {
    for (const w of pass1Writes) {
      const { error } = await admin
        .from('sops')
        .update({ category_slug: w.slug })
        .eq('id', w.id)
        .is('category_slug', null)
      if (error) console.error(`  [step 1] write FAILED for ${w.id}:`, error.message)
    }
  }
  console.log(`[step 1] deterministic pass: ${pass1Writes.length} row(s) ${APPLY ? 'written' : 'would be written'}`)

  // ---------------------------------------------------------------------
  // Step 2 — AI mapping of the residue, per DISTINCT VALUE, not per row.
  // ---------------------------------------------------------------------
  const pass1Ids = new Set(pass1Writes.map((w) => w.id))
  const stillUnresolvedRows = sopsRows.filter((r) => !r.category_slug && !pass1Ids.has(r.id))
  const distinctValues = new Set()
  for (const row of stillUnresolvedRows) {
    if (row.category_tag) distinctValues.add(row.category_tag)
    if (row.category) distinctValues.add(row.category)
  }

  let aiDictionary = {} // originalValue -> slug | null
  let pass2Status = 'ok'
  if (distinctValues.size > 0) {
    try {
      const vocabList = SOP_CATEGORIES.map((c) => `${c.slug} (${c.label})`).join(', ')
      const tool = {
        name: 'map_categories',
        description:
          'Map each raw legacy SOP category value onto the closest matching vocabulary slug, or null if no reasonable conceptual match exists.',
        input_schema: {
          type: 'object',
          properties: {
            mappings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  slug: { type: ['string', 'null'] },
                },
                required: ['value', 'slug'],
              },
            },
          },
          required: ['mappings'],
        },
      }
      const result = await llmToolCall({
        model: CATEGORY_MAP_MODEL,
        system: `You map legacy free-text SOP category values onto a fixed vocabulary. Vocabulary: ${vocabList}. Return slug:null for a value if none of the vocabulary entries is a reasonable conceptual match. Never invent a slug outside the vocabulary.`,
        messages: [{ role: 'user', content: `Map these values:\n${[...distinctValues].join('\n')}` }],
        tool,
        maxTokens: 2048,
      })
      const mappings = Array.isArray(result?.mappings) ? result.mappings : []
      for (const m of mappings) {
        if (!m?.value) continue
        aiDictionary[m.value] = m.slug && isValidCategorySlug(m.slug) ? m.slug : null
      }
    } catch (e) {
      // Fail open, never fail-open-and-report-ok (CLAUDE.md 2026-07-05): mark
      // this run partial so step 4 refuses to destroy the source columns.
      console.error('[step 2] AI mapping call FAILED:', e.message)
      pass2Status = 'partial'
    }
  }

  const pass2Writes = []
  for (const row of stillUnresolvedRows) {
    const slug = (row.category_tag && aiDictionary[row.category_tag]) || (row.category && aiDictionary[row.category]) || null
    if (!slug) continue
    pass2Writes.push({ id: row.id, slug })
    if (row.category_tag && aiDictionary[row.category_tag]) resolvedMap.set(normalize(row.category_tag), slug)
    if (row.category && aiDictionary[row.category]) resolvedMap.set(normalize(row.category), slug)
  }
  if (APPLY) {
    for (const w of pass2Writes) {
      // Conditional-spread payload — a value the model could not map never
      // produces a write at all for that row, let alone a blanket null.
      const payload = { ...(w.slug ? { category_slug: w.slug } : {}) }
      if (Object.keys(payload).length === 0) continue
      const { error } = await admin.from('sops').update(payload).eq('id', w.id).is('category_slug', null)
      if (error) console.error(`  [step 2] write FAILED for ${w.id}:`, error.message)
    }
  }
  audit.aiMappingDictionary = aiDictionary
  try {
    fs.writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2))
  } catch (e) {
    console.error('WARN: failed to append AI mapping dictionary to audit file:', e.message)
  }
  console.log(
    `[step 2] AI mapping pass (${distinctValues.size} distinct value(s)): ${pass2Writes.length} row(s) ${APPLY ? 'written' : 'would be written'} — status: ${pass2Status}`
  )
  if (Object.keys(aiDictionary).length > 0) {
    console.log('  AI mapping dictionary:')
    for (const [k, v] of Object.entries(aiDictionary)) {
      console.log(`    ${JSON.stringify(k)} -> ${v ?? 'null (no reasonable match)'}`)
    }
  }

  const pass2Ids = new Set(pass2Writes.map((w) => w.id))
  const leftUncategorised = sopsRows.filter(
    (r) => !r.category_slug && !pass1Ids.has(r.id) && !pass2Ids.has(r.id)
  ).length

  // ---------------------------------------------------------------------
  // Step 3 — remap the two settings tables keyed by the old free-text
  // category value, using the SAME resolved dictionary (deterministic +
  // AI). Collections are deliberately NOT renamed (plan 40-05 decision) —
  // only reported here, read-only.
  // ---------------------------------------------------------------------
  async function remapSettingsTable({ table, pickRowWins, describeCompare }) {
    const { data: rows, error } = await admin.from(table).select('*')
    if (error) {
      console.error(`  [step 3] ${table} read FAILED:`, error.message)
      return { remapped: 0, collisions: 0 }
    }
    let remapped = 0
    let collisions = 0
    for (const row of rows ?? []) {
      const slug = resolvedMap.get(normalize(row.category))
      if (!slug || slug === row.category) continue

      const { data: existing, error: exErr } = await admin
        .from(table)
        .select('*')
        .eq('organisation_id', row.organisation_id)
        .eq('category', slug)
        .maybeSingle()
      if (exErr) {
        console.error(`  [step 3] ${table} collision-check FAILED for org ${row.organisation_id}:`, exErr.message)
        continue
      }

      if (existing) {
        collisions++
        const rowWins = pickRowWins(row, existing)
        const loser = rowWins ? existing : row
        console.log(
          `  [step 3] COLLISION ${table} org=${row.organisation_id} "${row.category}" -> "${slug}": kept ${
            rowWins ? describeCompare(row) : describeCompare(existing)
          }, dropped ${describeCompare(loser)}`
        )
        if (APPLY) {
          const { error: delErr } = await admin
            .from(table)
            .delete()
            .eq('organisation_id', row.organisation_id)
            .eq('category', loser.category)
          if (delErr) {
            console.error(`    delete loser FAILED:`, delErr.message)
            continue
          }
          if (rowWins) {
            const { error: updErr } = await admin
              .from(table)
              .update({ category: slug })
              .eq('organisation_id', row.organisation_id)
              .eq('category', row.category)
            if (updErr) console.error(`    winner rename FAILED:`, updErr.message)
          }
        }
      } else if (APPLY) {
        const { error: updErr } = await admin
          .from(table)
          .update({ category: slug })
          .eq('organisation_id', row.organisation_id)
          .eq('category', row.category)
        if (updErr) {
          console.error(`  [step 3] ${table} remap FAILED for org ${row.organisation_id}:`, updErr.message)
          continue
        }
      }
      remapped++
    }
    return { remapped, collisions }
  }

  const cadenceResult = await remapSettingsTable({
    table: 'sop_review_cadences',
    // Safer of two conflicting cadences = the more frequent (shorter months).
    pickRowWins: (row, existing) => row.months < existing.months,
    describeCompare: (r) => `months=${r.months}`,
  })
  const chainResult = await remapSettingsTable({
    table: 'approval_chains',
    // Stricter of two conflicting chains = more steps; never silently drop a chain.
    pickRowWins: (row, existing) => (row.steps?.length ?? 0) > (existing.steps?.length ?? 0),
    describeCompare: (r) => `steps=${r.steps?.length ?? 0}`,
  })
  console.log(
    `[step 3] sop_review_cadences: ${cadenceResult.remapped} remapped, ${cadenceResult.collisions} collision(s)`
  )
  console.log(
    `[step 3] approval_chains: ${chainResult.remapped} remapped, ${chainResult.collisions} collision(s)`
  )

  // Read-only report: collections whose name matches no vocabulary label
  // (plan 40-05 decision — collections are never renamed/merged here).
  const { data: collections } = await admin.from('collections').select('organisation_id, name')
  const vocabLabels = new Set(SOP_CATEGORIES.map((c) => c.label))
  const nonMatching = (collections ?? []).filter((c) => !vocabLabels.has(c.name))
  if (nonMatching.length > 0) {
    console.log('')
    console.log(
      `[step 3] info: ${nonMatching.length} collection(s) whose name matches no vocabulary label (will stop gaining members via category auto-add unless an admin renames them):`
    )
    for (const c of nonMatching) console.log(`    org=${c.organisation_id} "${c.name}"`)
  }

  // ---------------------------------------------------------------------
  // Step 4 — retire the old data. Only after steps 1-3 complete without a
  // fatal error, and only under --apply.
  // ---------------------------------------------------------------------
  let step4Rows = 0
  const runStatus = pass2Status === 'partial' ? 'partial' : 'ok'
  if (APPLY) {
    if (!fs.existsSync(AUDIT_PATH)) {
      console.error('[step 4] REFUSED — audit file is missing on disk; retired columns were NOT nulled.')
    } else if (runStatus === 'partial') {
      console.error(
        '[step 4] REFUSED — pass 2 (AI mapping) reported partial status; re-run with the model reachable before destroying source data.'
      )
    } else {
      const orgIds = [...new Set(sopsRows.map((r) => r.organisation_id))]
      const toRetireCount = sopsRows.filter((r) => r.category !== null || r.category_tag !== null).length
      for (const orgId of orgIds) {
        const { error } = await admin
          .from('sops')
          .update({ category: null, category_tag: null })
          .eq('organisation_id', orgId)
          .or('category.not.is.null,category_tag.not.is.null')
        if (error) {
          console.error(`  [step 4] org ${orgId} FAILED:`, error.message)
          continue
        }
      }
      step4Rows = toRetireCount
      console.log(`[step 4] retired category/category_tag on ${step4Rows} row(s) (org-scoped batches)`)
    }
  } else {
    console.log('[step 4] dry-run — skipped (no writes)')
  }

  // ---------------------------------------------------------------------
  // Step 5 — summary. Never print `ok` when any step failed.
  // ---------------------------------------------------------------------
  console.log('')
  console.log('=== Step 5 — Summary ===')
  const summary = {
    rowsTotal: sopsRows.length,
    resolvedByPass1: pass1Writes.length,
    resolvedByPass2: pass2Writes.length,
    leftUncategorised,
    cadenceRowsRemapped: cadenceResult.remapped,
    cadenceCollisions: cadenceResult.collisions,
    chainRowsRemapped: chainResult.remapped,
    chainCollisions: chainResult.collisions,
    retiredColumnRowsNulled: step4Rows,
    status: runStatus,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (runStatus !== 'ok') process.exit(1)
  process.exit(0)
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
