/**
 * Phase 56 / Plan 56-03 -- source-level shape of migrations 00069 and 00070.
 *
 * Reads the SQL with line comments stripped (CLAUDE.md 2026-09-28: a comment
 * that quotes a forbidden literal must not trip, or hide, a guard). Live
 * behaviour (trigger refusal, placement flip, RLS probes) is proven by
 * schema-runtime.spec.ts in 56-04; this spec only pins what the files say.
 *
 * Registration: playwright.config.ts `phase56` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'supabase', 'migrations')

function read(file: string): string {
  return fs
    .readFileSync(path.join(DIR, file), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
}

const sql69 = read('00069_sop_kinds_placement_standards.sql')
const sql70 = read('00070_decisions_ledger.sql')

/** `create policy "name" on public.<table> for <cmd>` -> { name, table, cmd, body } */
function policies(sql: string) {
  const out: { name: string; table: string; cmd: string; body: string }[] = []
  const re = /create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-z_]+)\s+for\s+([a-z]+)\b([\s\S]*?);/gi
  for (const m of sql.matchAll(re)) out.push({ name: m[1], table: m[2], cmd: m[3].toLowerCase(), body: m[4] })
  return out
}

function withCheckOf(body: string): string {
  const i = body.search(/with\s+check\s*\(/i)
  return i === -1 ? '' : body.slice(i)
}

test.describe('00069 shape', () => {
  test('old step and section tables are not altered', () => {
    expect(sql69).not.toMatch(/alter\s+table\s+(public\.)?sop_steps/i)
    expect(sql69).not.toMatch(/alter\s+table\s+(public\.)?sop_sections/i)
  })

  test('every policy name is double-quoted (the RLS lint only sees quoted names)', () => {
    const all = [...sql69.matchAll(/create\s+policy\s+(\S+)/gi)].map((m) => m[1])
    expect(all.length).toBeGreaterThan(0)
    for (const n of all) expect(n, `unquoted policy name ${n}`).toMatch(/^"[^"]+"$/)
  })

  test('policy count per new table', () => {
    const counts: Record<string, number> = {}
    for (const p of policies(sql69)) counts[p.table] = (counts[p.table] ?? 0) + 1
    expect(counts).toEqual({
      sop_focus_steps: 1,
      sop_conversion_runs: 1,
      standards: 2,
      standard_attachments: 3,
    })
  })

  test('every policy carries the org conjunct and every WITH CHECK restates it', () => {
    for (const p of policies(sql69)) {
      expect(p.body, `${p.name} has no org predicate`).toMatch(/current_organisation_id/)
      const check = withCheckOf(p.body)
      if (check) expect(check, `${p.name} WITH CHECK drops the org predicate`).toMatch(/current_organisation_id/)
    }
  })

  test('placement trigger fires after insert or delete on sop_machines', () => {
    expect(sql69).toMatch(/drop\s+trigger\s+if\s+exists\s+sop_machines_sync_placement/i)
    expect(sql69).toMatch(
      /create\s+trigger\s+sop_machines_sync_placement\s+after\s+insert\s+or\s+delete\s+on\s+public\.sop_machines\s+for\s+each\s+row/i
    )
    expect(sql69).toMatch(/placement\s+text\s+not\s+null\s+default\s+'site'/i)
    expect(sql69).toMatch(/sops_placement_check/)
  })

  test('the six starter standards are seeded across every organisation, never by a literal id', () => {
    for (const n of ['LOTO', 'Hot Work', 'Confined Space', 'Working at Height', 'Manual Handling', 'Electrical Isolation']) {
      expect(sql69, n).toContain(`'${n}'`)
    }
    expect(sql69).toMatch(/from\s+public\.organisations\s+o\s+cross\s+join/i)
  })

  test('attachments pin exactly one target and one FK column per level', () => {
    expect(sql69).toMatch(/num_nonnulls\(sop_id,\s*section_id,\s*focus_step_id\)\s*=\s*1/)
    expect(sql69).toMatch(/focus_step_id\s+uuid\s+references\s+public\.sop_focus_steps\(id\)\s+on\s+delete\s+cascade/i)
    expect(sql69).toMatch(/foreign\s+key\s*\(standard_id,\s*organisation_id\)/i)
  })

  test('no function is declared with an elevated-privilege clause', () => {
    expect(sql69).not.toMatch(/security\s+definer/i)
  })
})

test.describe('00070 shape', () => {
  test('exactly one policy: a quoted, org-scoped SELECT; no write policy', () => {
    const ps = policies(sql70)
    expect(ps).toHaveLength(1)
    expect(ps[0].name).toBe('admins_can_read_decisions')
    expect(ps[0].cmd).toBe('select')
    expect(ps[0].body).toMatch(/current_organisation_id/)
    expect(sql70).not.toMatch(/create\s+policy[^;]*for\s+(insert|update|delete|all)\b/i)
  })

  test('both immutability triggers exist and are set to always fire', () => {
    expect(sql70).toMatch(/create\s+trigger\s+decisions_no_update_delete\s+before\s+update\s+or\s+delete\s+on\s+public\.decisions\s+for\s+each\s+row/i)
    expect(sql70).toMatch(/create\s+trigger\s+decisions_no_truncate\s+before\s+truncate\s+on\s+public\.decisions\s+for\s+each\s+statement/i)
    expect(sql70).toMatch(/alter\s+table\s+public\.decisions\s+enable\s+always\s+trigger\s+decisions_no_update_delete/i)
    expect(sql70).toMatch(/alter\s+table\s+public\.decisions\s+enable\s+always\s+trigger\s+decisions_no_truncate/i)
    expect(sql70).toMatch(/decisions_refuse_change/)
    expect(sql70).toMatch(/append-only/)
  })

  test('privileges are revoked from anon, authenticated and service_role', () => {
    expect(sql70).toMatch(/revoke\s+all\s+on\s+public\.decisions\s+from\s+anon/i)
    expect(sql70).toMatch(/revoke\s+insert,\s*update,\s*delete,\s*truncate\s+on\s+public\.decisions\s+from\s+authenticated/i)
    expect(sql70).toMatch(/revoke\s+update,\s*delete,\s*truncate\s+on\s+public\.decisions\s+from\s+service_role/i)
  })

  test('orphan block-update RPCs lose EXECUTE for public, anon and authenticated', () => {
    for (const fn of ['accept_block_update', 'decline_block_update']) {
      expect(sql70).toMatch(
        new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\(uuid,\\s*uuid,\\s*text\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`, 'i')
      )
    }
  })

  test('no foreign key except supersedes_decision_id, and no cascade or set-null action', () => {
    const refs = [...sql70.matchAll(/(\w+)\s+uuid\s+references/gi)].map((m) => m[1])
    expect(refs).toEqual(['supersedes_decision_id'])
    expect(sql70).not.toMatch(/\breferences\b(?![^,\n]*decisions\(id\))/i)
    expect(sql70).not.toMatch(/on\s+delete\s+cascade/i)
    expect(sql70).not.toMatch(/on\s+delete\s+set\s+null/i)
    expect(sql70).toMatch(/supersedes_decision_id\s+uuid\s+references\s+public\.decisions\(id\),/i)
  })

  test('an agent decision without a name is refused by a constraint', () => {
    expect(sql70).toMatch(/constraint\s+decisions_agent_named\s+check/i)
    expect(sql70).toMatch(/actor_kind\s*<>\s*'agent'\s+or\s*\(actor_name\s+is\s+not\s+null\s+and\s+btrim\(actor_name\)\s*<>\s*''\)/i)
  })

  test('backfill names all seven sources, is guarded, and asserts each count', () => {
    const sources = [
      'sop_approvals',
      'sop_completion_signatures',
      'sop_observations',
      'sop_review_events',
      'sop_block_update_decisions',
      'completion_sign_offs',
      'sop_assignments',
    ]
    for (const s of sources) {
      expect(sql70, `${s} backfill insert`).toContain(`'backfill', '${s}'`)
      expect(sql70, `${s} count assertion`).toContain(`count mismatch for ${s}`)
    }
    const guard = sql70.indexOf("where source = 'live'")
    const firstInsert = sql70.indexOf('insert into public.decisions')
    expect(guard, 'live-rows guard').toBeGreaterThan(-1)
    expect(guard).toBeLessThan(firstInsert)
    expect(sql70).toMatch(/on\s+conflict\s*\(legacy_table,\s*legacy_id\)\s*where\s+legacy_id\s+is\s+not\s+null\s+do\s+nothing/i)
  })

  test('no function is declared with an elevated-privilege clause', () => {
    expect(sql70).not.toMatch(/security\s+definer/i)
  })
})

test.describe('applier', () => {
  const applier = fs
    .readFileSync(path.join(process.cwd(), 'scripts', 'apply-phase56-migration.mjs'), 'utf8')
    .replace(/\r\n/g, '\n')

  test('MIGRATION_FILES lists 00069 before 00070 (apply order is load-bearing, CLAUDE.md 2026-07-28)', () => {
    const block = applier.slice(applier.indexOf('const MIGRATION_FILES'), applier.indexOf(']', applier.indexOf('const MIGRATION_FILES')))
    const i69 = block.indexOf('00069_sop_kinds_placement_standards.sql')
    const i70 = block.indexOf('00070_decisions_ledger.sql')
    expect(i69).toBeGreaterThan(-1)
    expect(i70).toBeGreaterThan(-1)
    expect(i69).toBeLessThan(i70)
  })

  test('the applier runs the append-only probe', () => {
    expect(applier).toContain('probe-decisions-immutable')
    expect(applier).toContain('probeDecisionsImmutable(managementSql)')
  })
})
