/**
 * Phase 51 -- SIT-01. Source-contract shape assertions for the site model
 * migration (`supabase/migrations/00067_site_model.sql`).
 *
 * Activated by Plan 51-02. Parses the migration the same paren-aware way
 * tests/lint/rls-org-scope.spec.ts does -- both stay independently correct
 * without sharing state (that spec is order-aware across the whole history;
 * this one only ever looks at 00067).
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { MACHINE_CODE_PATTERN } from '@/lib/site/scene'

const MIGRATION_PATH = path.join(process.cwd(), 'supabase', 'migrations', '00067_site_model.sql')

function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
}

function clause(body: string, keyword: string): string {
  const m = new RegExp(`${keyword}\\s*\\(`, 'i').exec(body)
  if (!m) return ''
  let depth = 0
  const start = m.index + m[0].length - 1
  for (let i = start; i < body.length; i++) {
    if (body[i] === '(') depth++
    else if (body[i] === ')') {
      depth--
      if (depth === 0) return body.slice(start + 1, i)
    }
  }
  return ''
}

type Policy = { table: string; name: string; using: string; check: string }

function parsePolicies(sql: string): Policy[] {
  const out: Policy[] = []
  const re = /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?"?([a-z0-9_.]+)"?\s+for\s+([a-z]+)\b/gi
  for (const m of sql.matchAll(re)) {
    const start = (m.index ?? 0) + m[0].length
    let depth = 0
    let end = start
    for (; end < sql.length; end++) {
      const ch = sql[end]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === ';' && depth === 0) break
    }
    const body = sql.slice(start, end)
    out.push({
      table: m[2].replace(/^public\./, ''),
      name: m[1],
      using: clause(body, 'using'),
      check: clause(body, 'with\\s+check'),
    })
  }
  return out
}

const raw = fs.readFileSync(MIGRATION_PATH, 'utf8')
const sql = stripComments(raw)

test.describe('SIT-01 -- site model migration shape (source-contract)', () => {
  test('site_layouts, site_machines, sop_machines tables all exist in the migration', () => {
    for (const t of ['site_layouts', 'site_machines', 'sop_machines']) {
      const re = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${t}\\s*\\(`, 'i')
      expect(re.test(sql), `create table public.${t} not found`).toBe(true)
    }
  })

  test('row level security is enabled exactly 3 times (all three tables)', () => {
    const matches = sql.match(/enable row level security/gi) ?? []
    expect(matches.length).toBe(3)
  })

  test('every policy on all three tables conjoins organisation_id = current_organisation_id()', () => {
    const policies = parsePolicies(sql).filter((p) =>
      ['site_layouts', 'site_machines', 'sop_machines'].includes(p.table)
    )
    expect(policies.length).toBeGreaterThanOrEqual(6)
    for (const p of policies) {
      expect(`${p.using} ${p.check}`, `${p.table}.${p.name} missing current_organisation_id`).toMatch(
        /current_organisation_id/
      )
    }
  })

  test('every WITH CHECK present restates the full USING predicate (D-03)', () => {
    const writePolicies = parsePolicies(sql).filter((p) => p.name.startsWith('admins_can_write_'))
    expect(writePolicies.length).toBe(3)
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    for (const p of writePolicies) {
      expect(p.check, `${p.name} has no WITH CHECK`).not.toBe('')
      expect(norm(p.check), `${p.name} WITH CHECK must equal USING`).toBe(norm(p.using))
    }
  })

  test('FK cascades match D-13: sop_id/machine_id ON DELETE CASCADE, department_id ON DELETE SET NULL', () => {
    expect(sql).toContain('references public.sops(id) on delete cascade')
    expect(sql).toContain('references public.departments(id) on delete set null')
    expect(sql).toContain('references public.site_layouts (id, organisation_id) on delete cascade')
    expect(sql).toContain('references public.site_machines (id, organisation_id) on delete cascade')
  })

  test('site-scenes storage bucket is private, 15728640 bytes, jpeg/png only', () => {
    const bucketMatch = /insert into storage\.buckets[\s\S]*?;/i.exec(sql)
    expect(bucketMatch, 'no storage.buckets insert found').not.toBeNull()
    const bucketSql = bucketMatch![0]
    expect(bucketSql).toContain('site-scenes')
    expect(bucketSql).toContain('false')
    expect(bucketSql).toContain('15728640')
    expect(bucketSql).toContain("'image/jpeg'")
    expect(bucketSql).toContain("'image/png'")
  })

  test('site_machines.code column constraint pattern equals MACHINE_CODE_PATTERN from src/lib/site/scene.ts', () => {
    expect(sql).toContain(MACHINE_CODE_PATTERN.source)
  })

  test('no security definer function is introduced', () => {
    expect(/security definer/i.test(sql)).toBe(false)
  })
})
