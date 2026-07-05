#!/usr/bin/env node
/**
 * scripts/backfill-agent-metadata.mjs
 *
 * Phase 26.5 D-15 — one-off backfill: synthesize agent metadata for every
 * currently-published SOP, across every organisation, so the agent-layer
 * panel/dashboard is populated on day one instead of only after the next
 * publish.
 *
 * Reuses the exact same synthesizeSop() pipeline the publish route wires via
 * triggerAgentSynthesis (Plan 26.5-05 Task 1) — no duplicate embed/tag logic.
 * Unlike the publish-route hook (fire-and-forget), this script runs
 * sequentially and awaited, since it's a manual one-off batch job, not a
 * per-request path.
 *
 * Usage (must run via tsx — this file imports TypeScript source modules):
 *   npx tsx scripts/backfill-agent-metadata.mjs
 *
 * Requirements (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (createAdminClient)
 *   VOYAGE_API_KEY     (embeddings — synthesizeSop's embed step fails open if unset)
 *   ANTHROPIC_API_KEY  (tag/summary extraction — also fails open if unset)
 *
 * Cost guardrail (T-26.5-05-04): a per-org SOP ceiling (default 200, override
 * via BACKFILL_MAX_SOPS_PER_ORG) — hitting it logs a warning and skips the
 * remainder for that org rather than letting one run away a bill.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// .env.local loader (mirrors apply-phase26.5-migration.mjs — no dotenv dep)
try {
  const envText = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
} catch (e) {
  console.error('Could not read .env.local:', e.message)
  process.exit(1)
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}
if (!process.env.VOYAGE_API_KEY) {
  console.warn('WARN: VOYAGE_API_KEY not set — embeddings will be skipped this run (synthesizeSop embed step fails open).')
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('WARN: ANTHROPIC_API_KEY not set — tag/summary extraction will be skipped this run (fails open).')
}

// Dynamic import AFTER .env.local is loaded — model-constants.ts reads
// process.env.EMBED_MODEL/SYNTHESIS_MODEL at module-evaluation time (falls
// back to a default if unset), so env must be populated before this import
// resolves for any .env.local override to take effect.
const { synthesizeSop } = await import('../src/lib/agent-layer/synthesis.ts')
const { createAdminClient } = await import('../src/lib/supabase/admin.ts')

const MAX_SOPS_PER_ORG = Number(process.env.BACKFILL_MAX_SOPS_PER_ORG) || 200

async function main() {
  const admin = createAdminClient()

  const { data: orgs, error: orgsErr } = await admin.from('organisations').select('id, name')
  if (orgsErr) {
    console.error('Failed to load organisations:', orgsErr.message)
    process.exit(1)
  }

  let sopsProcessed = 0
  let sopsSkipped = 0
  let sopsFailed = 0

  for (const org of orgs ?? []) {
    const { data: sops, error: sopsErr } = await admin
      .from('sops')
      .select('id, title')
      .eq('organisation_id', org.id)
      .eq('status', 'published')

    if (sopsErr) {
      console.error(`[${org.name}] failed to load published SOPs:`, sopsErr.message)
      continue
    }

    const rows = sops ?? []
    const toProcess = rows.slice(0, MAX_SOPS_PER_ORG)
    const overCap = rows.length - toProcess.length

    console.log(
      `[${org.name}] ${rows.length} published SOP(s)` +
        (overCap > 0
          ? ` — processing ${toProcess.length}, SKIPPING ${overCap} (per-org cap ${MAX_SOPS_PER_ORG})`
          : '')
    )

    for (const sop of toProcess) {
      // WR-05 (review fix): synthesizeSop never throws — it returns
      // { ok, error }, so check the result instead of a dead catch branch.
      // Previously an all-failing run (bad VOYAGE/ANTHROPIC key) printed
      // 100% OK (the 2026-06-02 "all-error run is invisible" failure mode).
      const result = await synthesizeSop(sop.id, org.id)
      if (result?.ok) {
        sopsProcessed++
        console.log(`  OK    ${sop.title} (${sop.id})`)
      } else {
        sopsFailed++
        console.error(`  FAIL  ${sop.title} (${sop.id}): ${result?.error ?? 'unknown synthesis failure'}`)
      }
    }
    sopsSkipped += overCap
  }

  console.log('')
  console.log('=== Backfill complete ===')
  console.log(JSON.stringify({ orgs: (orgs ?? []).length, sopsProcessed, sopsFailed, sopsSkipped }))
  if (sopsFailed > 0) {
    console.error(`ERROR: ${sopsFailed} SOP(s) failed synthesis — see FAIL lines above.`)
    process.exit(1)
  }
}

await main()
