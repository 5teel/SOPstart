// Generator: reads global-blocks.json and emits migration 00023.
// Usage: node .planning/phases/13-reusable-block-library/seed-source/generate-migration.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = '.planning/phases/13-reusable-block-library/seed-source/global-blocks.json'
const OUT = 'supabase/migrations/00023_phase13_nz_global_block_seed.sql'

const data = JSON.parse(readFileSync(SRC, 'utf8'))
const blocks = data.blocks

// SQL string-literal escape: double single-quotes
const sq = (s) => String(s).replace(/'/g, "''")

const tagsArrayLiteral = (arr) => {
  if (!arr || arr.length === 0) return "ARRAY[]::text[]"
  return `ARRAY[${arr.map((t) => `'${sq(t)}'`).join(', ')}]::text[]`
}

const buildContentExpr = (content) => {
  switch (content.kind) {
    case 'hazard':
      return `jsonb_build_object('kind', 'hazard', 'text', '${sq(content.text)}', 'severity', '${sq(content.severity)}')`
    case 'ppe': {
      const itemsLit = content.items.map((it) => `'${sq(it)}'`).join(', ')
      return `jsonb_build_object('kind', 'ppe', 'items', jsonb_build_array(${itemsLit}))`
    }
    case 'step': {
      const parts = [`'kind'`, `'step'`, `'text'`, `'${sq(content.text)}'`]
      if (content.warning !== undefined) {
        parts.push(`'warning'`, `'${sq(content.warning)}'`)
      }
      if (content.tip !== undefined) {
        parts.push(`'tip'`, `'${sq(content.tip)}'`)
      }
      return `jsonb_build_object(${parts.join(', ')})`
    }
    default:
      throw new Error(`Unsupported content.kind: ${content.kind}`)
  }
}

const groupHeader = (title) => `\n  -- ============================================================\n  -- ${title}\n  -- ============================================================`

const renderEntry = (b, idx) => {
  const tagsLit = tagsArrayLiteral(b.category_tags)
  const freeTextLit = tagsArrayLiteral(b.free_text_tags)
  const contentExpr = buildContentExpr(b.content)
  return [
    `  -- Block ${idx}: ${b.name}`,
    `  insert into public.blocks (organisation_id, kind_slug, name, category_tags, free_text_tags, created_by)`,
    `    values (null, '${sq(b.kind_slug)}', '${sq(b.name)}', ${tagsLit}, ${freeTextLit}, null)`,
    `    returning id into v_block_id;`,
    `  insert into public.block_versions (block_id, version_number, content, change_note, created_by)`,
    `    values (v_block_id, 1, ${contentExpr}, 'Initial NZ global seed (D-Global-03)', null)`,
    `    returning id into v_version_id;`,
    `  update public.blocks set current_version_id = v_version_id where id = v_block_id;`,
    ``,
  ].join('\n')
}

const hazards = blocks.filter((b) => b.kind_slug === 'hazard')
const ppes = blocks.filter((b) => b.kind_slug === 'ppe')
const steps = blocks.filter((b) => b.kind_slug === 'step')

let body = ''
body += groupHeader('Hazard blocks') + '\n\n'
hazards.forEach((b, i) => { body += renderEntry(b, i + 1) })
body += groupHeader('PPE blocks') + '\n\n'
ppes.forEach((b, i) => { body += renderEntry(b, i + 1) })
body += groupHeader('Step pattern blocks') + '\n\n'
steps.forEach((b, i) => { body += renderEntry(b, i + 1) })

const header = `-- ============================================================
-- Migration 00023: Phase 13 NZ Global Block Library Seed (D-Global-03 auto-seed)
-- Source: .planning/phases/13-reusable-block-library/seed-source/global-blocks.json
-- Counts: ${hazards.length} hazard + ${ppes.length} PPE + ${steps.length} step = ${blocks.length} global blocks
-- Per D-Global-03: auto-seed full list with no human review pass; Summit cleans up post-launch.
-- All rows are organisation_id = NULL (global, read-only to every authenticated org via 00019 RLS).
-- ============================================================

begin;

-- Idempotency guard: skip if globals already seeded.
do $$
declare
  v_block_id uuid;
  v_version_id uuid;
begin
  if exists (select 1 from public.blocks where organisation_id is null and kind_slug = 'hazard' limit 1) then
    raise notice 'Phase 13 global hazard seed already present — skipping seed insert';
    return;
  end if;
`

const footer = `\nend $$;\n\ncommit;\n`

const sql = header + body + footer
writeFileSync(OUT, sql, 'utf8')
console.log(`Wrote ${OUT} (${sql.length} bytes, ${blocks.length} blocks)`)
