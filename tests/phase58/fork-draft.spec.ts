/**
 * Phase 58 -- SOP-04 (D-11, D-18): forkDraft copies the whole SOP.
 * Registration: playwright.config.ts `phase58` project.
 *
 * The census is keyed on the DATA (CLAUDE.md 2026-07-29): every table whose
 * migration references public.sops(id) must be copied by forkDraft or sit on
 * the reasoned allow-list below. A new SOP-keyed table fails until classified.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MIGRATIONS = path.join(process.cwd(), 'supabase', 'migrations')
const SRC = fs.readFileSync(path.join(process.cwd(), 'src', 'actions', 'versions.ts'), 'utf8')

const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

function forkBody(): string {
  const start = SRC.indexOf('export async function forkDraft')
  const end = SRC.indexOf('export type LineageVersion')
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

/** Tables with a `references [public.]sops(id)` column, walking migrations in order. */
function sopKeyedTables(): Set<string> {
  const tables = new Set<string>()
  let current = ''
  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const raw of fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').split('\n')) {
      const line = raw.replace(/--.*$/, '')
      const drop = line.match(/^\s*drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/i)
      if (drop) tables.delete(drop[1].toLowerCase())
      const t = line.match(/^\s*(?:create\s+table(?:\s+if\s+not\s+exists)?|alter\s+table(?:\s+only)?(?:\s+if\s+exists)?)\s+(?:public\.)?"?(\w+)"?/i)
      if (t) current = t[1].toLowerCase()
      if (/references\s+(?:public\.)?sops\s*\(\s*id\s*\)/i.test(line) && current) tables.add(current)
    }
  }
  return tables
}

/** Columns of public.sops, walking create/add/drop/rename in migration order (review WR-01). */
function sopsColumns(): Set<string> {
  const cols = new Set<string>()
  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs
      .readFileSync(path.join(MIGRATIONS, file), 'utf8')
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('--'))
      .join('\n')
    const ct = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?sops\s*\(([\s\S]*?)\n\);/i.exec(sql)
    if (ct) {
      for (const l of ct[1].split('\n')) {
        const m = l.match(/^\s*"?([a-z_]+)"?\s+\S/)
        if (m && !/^(constraint|unique|primary|check|foreign)$/.test(m[1])) cols.add(m[1])
      }
    }
    for (const m of sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.)?sops\b([\s\S]*?);/gi)) {
      for (const c of m[1].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-z_]+)"?/gi)) cols.add(c[1])
      for (const c of m[1].matchAll(/drop\s+column\s+(?:if\s+exists\s+)?"?([a-z_]+)"?/gi)) cols.delete(c[1])
      for (const c of m[1].matchAll(/rename\s+column\s+"?([a-z_]+)"?\s+to\s+"?([a-z_]+)"?/gi)) {
        cols.delete(c[1])
        cols.add(c[2])
      }
    }
  }
  return cols
}

/** sops columns a fork must NOT carry over, each with its reason. */
const SOPS_COLUMNS_NOT_COPIED: Record<string, string> = {
  id: 'the new version has its own id',
  created_at: 'db default',
  updated_at: 'db default',
  published_at: 'a draft is not published',
  status: "set to 'draft'",
  version: 'computed by computeNextVersionLineage',
  parent_sop_id: 'computed by computeNextVersionLineage',
  superseded_by: 'written by publish, never by a fork',
  uploaded_by: 'the forking admin',
  placement: 'trigger-synced from sop_machines',
  approval_state: 'the fork runs its own approval chain at publish',
  approval_snapshot: 'the fork runs its own approval chain at publish',
  review_due_at: 'review cadence restarts when the new version publishes',
  last_reviewed_at: 'review history belongs to the version that was reviewed',
  last_reviewed_by: 'review history belongs to the version that was reviewed',
  fts: 'generated search column',
}

const COPIED = [
  'sops',
  'sop_sections',
  'sop_focus_steps',
  'sop_images',
  'standard_attachments',
  'sop_machines',
  'sop_departments',
  'sops_sub_trades',
  'sop_collections',
  'access_grants',
  'sop_access_people',
]

const NOT_COPIED: Record<string, string> = {
  parse_jobs: 'a parse record belongs to the document that produced that version; a fork has no source parse',
  sop_completions: 'a completion records the version that was walked and stays on it (D-12)',
  worker_notifications: 'sent at publish by notifyAssignedWorkers, not copied',
  sop_assignments: 're-pointed to the new version at publish by 58-05 (notifyAssignedWorkers)',
  video_generation_jobs: 'tied to the source video of the version it was generated for',
  sop_voice_notes: 'field recordings made during a walk of that version',
  escalation_reports: 'raised against the version the worker was walking',
  walkthrough_progress: 'legacy per-user progress of the old walkthroughs; replaced by sop_walks',
  ai_review_rate_limits: 'per-SOP review throttle; the fork starts with a fresh allowance',
  sop_agent_metadata: 'regenerated by triggerAgentSynthesis when the fork publishes',
  block_agent_metadata: 'keyed to block junctions, a model the focus screen retires',
  agent_memory: 'agent learnings tied to the version they observed',
  agent_learning_proposals: 'proposals about the version they were raised on',
  sop_voice_qa_log: 'log of questions put to that specific version',
  sop_review_events: 'review history of that specific version',
  sop_approvals: 'approval is per version; the fork runs its own chain at publish',
  sop_observations: 'supervisor observations of that version being practised',
  sop_walks: 'a worker walk finishes on the version it started on (D-12)',
  sop_ai_findings: 'findings belong to the draft they were raised on; the reviewer re-runs on the fork',
  sop_conversion_runs: 'conversion report for the rows of that specific SOP',
}

test.describe('SOP-04 forkDraft', () => {
  test('census: every table referencing public.sops(id) is copied or on an explicit allow-list (D-11)', () => {
    const body = strip(forkBody())
    const found = [...sopKeyedTables()]
    expect(found.length).toBeGreaterThan(20) // a parser that finds nothing passes vacuously

    for (const table of COPIED) {
      expect(new RegExp(`from\\('${table}'\\)\\s*\\.insert\\(`).test(body), `${table} must be inserted by forkDraft`).toBe(true)
    }
    for (const [table, reason] of Object.entries(NOT_COPIED)) {
      expect(reason.length, `${table} needs a reason`).toBeGreaterThanOrEqual(10)
    }
    const unclassified = found.filter((t) => !COPIED.includes(t) && !(t in NOT_COPIED))
    expect(unclassified, `unclassified sop-keyed tables: ${unclassified.join(', ')}`).toEqual([])
    // Entries that no longer exist rot the list.
    const stale = [...COPIED, ...Object.keys(NOT_COPIED)].filter((t) => !found.includes(t))
    expect(stale, `classified but not in the migrations: ${stale.join(', ')}`).toEqual([])
  })

  test('column census: every sops column is copied by the fork or on an explicit skip-list (review WR-01)', () => {
    const body = strip(forkBody())
    const cols = [...sopsColumns()]
    expect(cols.length).toBeGreaterThan(30) // a parser that finds nothing passes vacuously
    const insertStart = body.search(/from\('sops'\)\s*\.insert\(\{/)
    expect(insertStart).toBeGreaterThan(-1)
    const insert = body.slice(insertStart, body.indexOf('})', insertStart))
    const keys = new Set([...insert.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]))

    const missing = cols.filter((c) => !keys.has(c) && !(c in SOPS_COLUMNS_NOT_COPIED))
    expect(missing, `sops columns dropped by forkDraft: ${missing.join(', ')}`).toEqual([])
    const stale = Object.keys(SOPS_COLUMNS_NOT_COPIED).filter((c) => !cols.includes(c))
    expect(stale, `skip-listed but not a sops column: ${stale.join(', ')}`).toEqual([])
    const contradicted = Object.keys(SOPS_COLUMNS_NOT_COPIED).filter((c) => keys.has(c) && !['status', 'version', 'parent_sop_id', 'uploaded_by'].includes(c))
    expect(contradicted, `skip-listed yet written: ${contradicted.join(', ')}`).toEqual([])
  })

  test('forkDraft guards, scopes to the session org and reuses an open draft (D-18)', () => {
    const body = strip(forkBody())
    expect((strip(SRC).match(/requireAdminContext\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(body).toMatch(/\.eq\('organisation_id', orgId\)/)
    expect(body).toMatch(/organisation_id: orgId/)
    expect(body).not.toMatch(/organisation_id: source\./)
    expect(body).toMatch(/status === 'draft'/)
    expect(body).toMatch(/openDraft/)
    expect(body).toContain('computeNextVersionLineage(')
    expect(strip(SRC)).not.toContain('superseded_by')
    expect(SRC).toMatch(/^'use server'/)
    // Writes: the button calls it; a mount effect never does.
    expect(SRC).not.toMatch(/useEffect/)
  })

  test('id maps are built by array index, never by sort_order or step_number', () => {
    const body = strip(forkBody())
    expect(body).toContain('randomUUID()')
    expect(body).toMatch(/sections\.map\(\(s, i\) => \[s\.id, sectionIds\[i\]\]\)/)
    expect(body).toMatch(/steps\.map\(\(s, i\) => \[s\.id as string, stepIds\[i\]\]\)/)
    expect(body).not.toMatch(/sort_order\s*===/)
    expect(body).not.toContain('step_number')
  })

  test('the tick is carried on copied steps (A2)', () => {
    const body = strip(forkBody())
    for (const col of ['verified_by_admin_id', 'verified_at', 'needs_recheck']) {
      expect(body).toContain(`${col}: s.${col}`)
    }
  })

  test('a failed copy removes the partial draft', () => {
    const body = strip(forkBody())
    expect(body).toMatch(/\.from\('sops'\)\.delete\(\)\.eq\('id', newId\)\.eq\('organisation_id', orgId\)/)
  })
})
