import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Every SELECT policy on public.sops must be org-scoped.
 *
 * Postgres OR-combines permissive policies for the same command. `sops` had
 * four SELECT policies and only ONE carried an org predicate, so the org-scoped
 * one was decorative: `sops_visible_by_department`'s "SOP has no department
 * tags" arm matched any untagged SOP in ANY organisation. Measured live on
 * 2026-08-04, 15 of 30 SOPs were readable by every authenticated user of every
 * tenant, and the admin library was rendering 7 foreign-org SOPs to a user with
 * exactly one membership. Migration 00061 conjoined the org predicate onto
 * every arm.
 *
 * This is the [2026-07-20] class in CLAUDE.md recurring on a new table, so it
 * gets a permanent guard rather than a one-off fix.
 *
 * The scan is ORDER-AWARE (CLAUDE.md [2026-07-28]): a policy created unscoped
 * in an early migration and corrected later is fine — only the LAST definition
 * of each policy name counts, and a dropped policy stops counting entirely.
 *
 * Registration: playwright.config.ts `phase15-stubs` project.
 */

const ROOT = process.cwd()
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')

/** `create policy "name" on public.sops for select …` up to the next statement. */
const CREATE_RE =
  /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?sops\s+for\s+select\b([\s\S]*?);/gi
const DROP_RE = /drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+(?:public\.)?sops/gi

function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
}

test('every live SELECT policy on public.sops is org-scoped', () => {
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  expect(files.length, 'migrations directory should not be empty').toBeGreaterThan(0)

  // policy name -> the body of its most recent CREATE, or null once dropped.
  const live = new Map<string, string | null>()

  for (const file of files) {
    const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
    // Interleave drops and creates in source order within the file.
    const events: { at: number; kind: 'drop' | 'create'; name: string; body?: string }[] = []
    for (const m of sql.matchAll(DROP_RE)) {
      events.push({ at: m.index ?? 0, kind: 'drop', name: m[1] })
    }
    for (const m of sql.matchAll(CREATE_RE)) {
      events.push({ at: m.index ?? 0, kind: 'create', name: m[1], body: m[2] })
    }
    events.sort((a, b) => a.at - b.at)
    for (const e of events) {
      if (e.kind === 'drop') live.set(e.name, null)
      else live.set(e.name, e.body ?? '')
    }
  }

  const surviving = [...live.entries()].filter(([, body]) => body !== null) as [string, string][]
  expect(surviving.length, 'sops should have SELECT policies at all').toBeGreaterThan(0)

  const unscoped = surviving
    .filter(([, body]) => !/current_organisation_id/i.test(body))
    .map(([name]) => name)

  expect(
    unscoped,
    `These SELECT policies on public.sops have no organisation predicate. ` +
      `Postgres ORs permissive policies together, so ONE unscoped arm makes ` +
      `every other policy's org check irrelevant and exposes rows to every ` +
      `tenant: ${unscoped.join(', ')}. Conjoin ` +
      `\`organisation_id = public.current_organisation_id() AND (…)\` onto the arm.`
  ).toEqual([])
})

test('00061 conjoins the org predicate rather than OR-ing it', () => {
  const sql = stripComments(
    fs.readFileSync(path.join(MIGRATIONS, '00061_sops_select_org_scope.sql'), 'utf8')
  )
  for (const m of sql.matchAll(CREATE_RE)) {
    const body = m[2]
    // The org check must GATE the arm. An `or` between the org predicate and
    // the rest would reintroduce exactly the hole this migration closes.
    expect(
      body,
      `${m[1]}: the org predicate must be conjoined with AND, not OR`
    ).toMatch(/organisation_id\s*=\s*public\.current_organisation_id\(\)\s*\n?\s*and\b/i)
  }
  // A scoping fix must not become a removal — the narrowing logic survives.
  expect(sql).toContain('all_departments = true')
  expect(sql).toContain('sop_in_user_departments(id)')
  expect(sql).toContain('sub_trade_id_intersects(id)')
  expect(sql).toContain('sop_in_user_person_grants(id)')
})
