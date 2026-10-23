import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Tenant-isolation guard over the whole migration history.
 *
 * Two holes in two days, both in policies that LOOKED scoped:
 *
 *   00061  public.sops had four SELECT policies and only one carried an org
 *          predicate. Postgres ORs permissive policies, so the scoped one was
 *          decorative and 15 of 30 SOPs were readable by every tenant.
 *   00062  organisation_members.admins_can_update_member_roles had an
 *          org-scoped USING and a WITH CHECK that mentioned only the role. A
 *          specified WITH CHECK REPLACES the USING fallback, so an admin could
 *          rewrite a member's organisation_id into another tenant.
 *
 * Both are shape errors a reviewer reads straight past, so they get a
 * mechanical check. This spec parses the migrations rather than the live DB so
 * it runs in CI without credentials; `scripts/`-style live assertions covered
 * the actual apply.
 *
 * ORDER-AWARE (CLAUDE.md [2026-07-28]): only the LAST definition of each
 * table+policy name counts, and a drop removes it from consideration — a policy
 * created unscoped and corrected later is fine.
 *
 * Registration: playwright.config.ts `phase15-stubs` project.
 */

const ROOT = process.cwd()
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')

/** Tables whose rows are tenant-owned. Derived from the schema, not a list. */
function tablesWithOrgColumn(sql: string, acc: Set<string>): void {
  // `create table … organisation_id …` and `alter table … add column organisation_id`
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\s*\);/gi)) {
    if (/\borganisation_id\b/i.test(m[2])) acc.add(m[1])
  }
  for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.)?"?([a-z0-9_]+)"?[\s\S]{0,200}?add\s+column\s+(?:if\s+not\s+exists\s+)?"?organisation_id"?/gi)) {
    acc.add(m[1])
  }
}

type Policy = { table: string; name: string; cmd: string; using: string; check: string }

/**
 * `create policy "n" on t for cmd … using (…) with check (…);`
 * Parenthesis-aware so nested subqueries don't truncate the clause.
 */
function parsePolicies(sql: string): { creates: Policy[]; drops: { table: string; name: string }[] } {
  const creates: Policy[] = []
  const drops: { table: string; name: string }[] = []

  for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+(?:public\.)?"?([a-z0-9_.]+)"?/gi)) {
    drops.push({ name: m[1], table: m[2].replace(/^public\./, '') })
  }

  const re = /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?"?([a-z0-9_.]+)"?\s+for\s+([a-z]+)\b/gi
  for (const m of sql.matchAll(re)) {
    const start = (m.index ?? 0) + m[0].length
    // Statement body runs to the next `;` at paren depth 0.
    let depth = 0
    let end = start
    for (; end < sql.length; end++) {
      const ch = sql[end]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === ';' && depth === 0) break
    }
    const body = sql.slice(start, end)
    creates.push({
      table: m[2].replace(/^public\./, ''),
      name: m[1],
      cmd: m[3].toUpperCase(),
      using: clause(body, 'using'),
      check: clause(body, 'with\\s+check'),
    })
  }
  return { creates, drops }
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

function stripComments(sql: string): string {
  return sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
}

/** Org scope, or an identity/role helper that self-scopes from auth.uid(). */
const SCOPED = /current_organisation_id|organisation_id|auth\.uid\(\)|is_platform_admin/i

function livePolicies(): { policies: Map<string, Policy>; orgTables: Set<string> } {
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  const policies = new Map<string, Policy>()
  const orgTables = new Set<string>()

  for (const file of files) {
    const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
    tablesWithOrgColumn(sql, orgTables)
    const { creates, drops } = parsePolicies(sql)
    for (const d of drops) policies.delete(`${d.table}::${d.name}`)
    for (const c of creates) policies.set(`${c.table}::${c.name}`, c)
  }
  return { policies, orgTables }
}

test('every policy on a tenant-owned table carries an org or identity predicate', () => {
  const { policies, orgTables } = livePolicies()
  expect(orgTables.size, 'should find tables carrying organisation_id').toBeGreaterThan(5)

  const unscoped = [...policies.values()]
    .filter((p) => orgTables.has(p.table))
    .filter((p) => !SCOPED.test(`${p.using} ${p.check}`))
    .map((p) => `${p.table}.${p.name} [${p.cmd}]`)

  expect(
    unscoped,
    `These policies sit on tenant-owned tables with no organisation or identity ` +
      `predicate. Postgres ORs permissive policies, so ONE of these makes every ` +
      `sibling policy's org check irrelevant: ${unscoped.join(', ')}`
  ).toEqual([])
})

test('a WITH CHECK never drops an org predicate its USING clause has', () => {
  const { policies } = livePolicies()

  // Omitting WITH CHECK is SAFE — Postgres falls back to USING. Specifying one
  // REPLACES that fallback, so a check written to express a different rule can
  // silently discard the org rule. That is exactly the 00062 hole.
  const weakened = [...policies.values()]
    .filter((p) => /current_organisation_id/i.test(p.using))
    .filter((p) => p.check.trim() !== '' && !/current_organisation_id/i.test(p.check))
    .map((p) => `${p.table}.${p.name} [${p.cmd}]`)

  expect(
    weakened,
    `These policies restrict WHICH rows may be written by organisation, but ` +
      `their WITH CHECK does not constrain what the row may BECOME — so the ` +
      `organisation_id can be rewritten to another tenant: ${weakened.join(', ')}. ` +
      `Restate the org predicate inside WITH CHECK alongside whatever else it asserts.`
  ).toEqual([])
})

test('no SELECT policy set on one table disagrees about org scope', () => {
  const { policies, orgTables } = livePolicies()
  const byTable = new Map<string, Policy[]>()
  for (const p of policies.values()) {
    if (p.cmd !== 'SELECT' || !orgTables.has(p.table)) continue
    byTable.set(p.table, [...(byTable.get(p.table) ?? []), p])
  }

  const mixed: string[] = []
  for (const [table, ps] of byTable) {
    if (ps.length < 2) continue
    const scoped = ps.filter((p) => /current_organisation_id/i.test(p.using))
    const unscoped = ps.filter((p) => !/current_organisation_id/i.test(p.using))
    if (scoped.length > 0 && unscoped.length > 0) {
      mixed.push(`${table} (unscoped: ${unscoped.map((p) => p.name).join(', ')})`)
    }
  }

  expect(
    mixed,
    `These tables mix org-scoped and unscoped SELECT policies. Permissive ` +
      `policies are OR'd, so the unscoped one wins and the scoped ones are ` +
      `decorative — this is exactly how public.sops leaked 15 of 30 rows to ` +
      `every tenant (migration 00061): ${mixed.join('; ')}`
  ).toEqual([])
})

/** Every `exists ( … )` subquery in a clause, paren-aware. */
function existsSubqueries(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/exists\s*\(/gi)) {
    const start = (m.index ?? 0) + m[0].length - 1
    let depth = 0
    for (let i = start; i < text.length; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')') {
        depth--
        if (depth === 0) {
          out.push(text.slice(start, i + 1))
          break
        }
      }
    }
  }
  return out
}

/**
 * 64-REVIEW ME-03: an arm that asks "is the CALLER an admin" (a members-table subquery on the
 * caller's id and role, with no organisation in it) says nothing about which tenant the ROW
 * belongs to. Unless the rest of the policy ties the row to an organisation, every tenant's rows
 * pass. The subquery itself is fine: it runs under the members table's own org-scoped policy.
 */
function looseAdminArm(p: Pick<Policy, 'using' | 'check'>): boolean {
  const text = `${p.using} ${p.check}`
  const arms = existsSubqueries(text).filter(
    (s) => /organisation_members/i.test(s) && /\brole\b/i.test(s) && /auth\.uid\(\)/i.test(s) && !/organisation_id/i.test(s),
  )
  if (arms.length === 0) return false
  let rest = text
  for (const a of arms) rest = rest.replace(a, '')
  return !/organisation_id/i.test(rest)
}

test('a caller-is-admin arm never stands without tying the row to the organisation (64-REVIEW ME-03)', () => {
  const { policies } = livePolicies()
  const loose = [...policies.values()].filter(looseAdminArm).map((p) => `${p.table}.${p.name} [${p.cmd}]`)
  expect(
    loose,
    `These policies let any admin read every tenant's rows: the admin arm checks the caller's ` +
      `role but nothing ties the row to current_organisation_id(). Join the row to its ` +
      `organisation (00048 / 00083 shape): ${loose.join(', ')}`,
  ).toEqual([])
})

test('the ME-03 matcher flags the 00035 shape and passes the 00048 shape (not vacuous)', () => {
  const loose = `member_id = auth.uid() or exists (select 1 from public.organisation_members om
    where om.user_id = auth.uid() and om.role in ('admin', 'safety_manager'))`
  const scoped00048 = `member_id = auth.uid() or exists (select 1 from public.organisation_members om
    join public.organisation_members target on target.organisation_id = om.organisation_id
    where om.user_id = auth.uid() and om.role in ('admin', 'safety_manager') and target.user_id = sop_access_people.member_id)`
  const outerScoped = `organisation_id = public.current_organisation_id() and exists (select 1 from public.organisation_members om
    where om.user_id = auth.uid() and om.role in ('admin', 'safety_manager'))`
  expect(looseAdminArm({ using: loose, check: '' })).toBe(true)
  expect(looseAdminArm({ using: scoped00048, check: '' })).toBe(false)
  expect(looseAdminArm({ using: outerScoped, check: '' })).toBe(false)
})
