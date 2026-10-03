/**
 * Phase 56 / 56-06 -- standards actions source contract (SOP-02, T-56-04, T-56-20, T-56-21).
 * Comment-stripped source reads. The database side (RLS, unique name, cascade) is
 * proven by schema-runtime.spec.ts.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (p: string) => strip(fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n'))

const ACTIONS = 'src/actions/standards.ts'
const src = read(ACTIONS)
const raw = fs.readFileSync(path.join(root, ACTIONS), 'utf8')

const exportMatches = [...src.matchAll(/^export async function (\w+)/gm)]

test.describe('standards actions', () => {
  test('use server, async-only exports, six of them', () => {
    expect(raw.trimStart().startsWith("'use server'")).toBe(true)
    expect(src.match(/^export\s/gm)?.length).toBe(exportMatches.length)
    expect(exportMatches.map((m) => m[1]).sort()).toEqual(
      ['createStandard', 'getSopStandardsPanel', 'listStandards', 'removeStandard', 'renameStandard', 'setStandardAttachment']
    )
  })

  test('every export opens with requireAdminContext() and takes no organisation', () => {
    for (const m of exportMatches) {
      const rest = src.slice(m.index!)
      const guard = rest.indexOf('requireAdminContext()')
      expect(guard, m[1]).toBeGreaterThan(-1)
      const head = rest.slice(0, guard).replace(/const ctx = await\s*$/, '')
      expect(head, `${m[1]} does work before the guard`).not.toMatch(/\b(await|return|const)\b/)
      expect(head, `${m[1]} signature`).not.toMatch(/organisation|orgId/i)
      expect(rest.slice(guard, guard + 160), m[1]).toContain("if ('error' in ctx)")
    }
  })

  test('standards, attachments, focus steps and sops are always filtered by the session organisation', () => {
    const chains = [...src.matchAll(/\.from\('(standards|standard_attachments|sop_focus_steps|sops)'\)/g)]
    expect(chains.length).toBeGreaterThanOrEqual(10)
    for (const c of chains) {
      const stmt = src.slice(c.index!).split(/\n\s*\n/)[0]
      expect(stmt, `${c[1]} chain`).toMatch(/\.eq\('organisation_id', orgId\)|organisation_id: orgId/)
    }
    expect(src).not.toMatch(/organisation_id', (input|parsed|row|data)/)
  })

  test('duplicate name maps 23505, attach treats 23505 as success, no service role', () => {
    expect(src).toContain('23505')
    expect(src).toContain('A standard with that name already exists')
    expect(src).not.toContain('createAdminClient')
  })

  test('the attachment write checks the standard and the target before inserting', () => {
    const fn = src.slice(src.indexOf('export async function setStandardAttachment'))
    const insertAt = fn.indexOf(".from('standard_attachments').insert(")
    expect(insertAt).toBeGreaterThan(-1)
    const before = fn.slice(0, insertAt)
    expect(before).toContain(".from('standards')")
    expect(before).toContain(".from('sop_focus_steps')")
    expect(before).toContain(".from('sops')")
    expect(before).toContain(".from('sop_sections')")
  })
})

const PANEL = 'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStandardsButton.tsx'
const SHELL = 'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx'

test.describe('standards panel wiring', () => {
  test('the Tools menu renders the panel button after the machines button', () => {
    const shell = read(SHELL)
    const machines = shell.indexOf('<BuilderMachinesButton')
    const standards = shell.indexOf('<BuilderStandardsButton')
    expect(machines).toBeGreaterThan(-1)
    expect(standards).toBeGreaterThan(machines)
  })

  test('each action call sits in a named handler that an onClick references', () => {
    const panel = read(PANEL)
    const handlers: Array<[string, string]> = [
      ['createStandard(', 'addStandard'],
      ['renameStandard(', 'saveRename'],
      ['removeStandard(', 'confirmRemove'],
      ['setStandardAttachment(', 'toggleStandard'],
    ]
    for (const [call, handler] of handlers) {
      const start = panel.indexOf(`async function ${handler}(`)
      expect(start, handler).toBeGreaterThan(-1)
      const body = panel.slice(start, panel.indexOf('\n  }\n', start))
      expect(body, `${handler} calls the action`).toContain(call)
      expect(panel, `${handler} wired to onClick`).toMatch(new RegExp(String.raw`onClick=\{[^}]*${handler}\(`))
    }
    expect(panel).toContain('data-testid="standards-panel"')
  })

  test('copy never says block', () => {
    expect(read(PANEL)).not.toMatch(/block/i)
  })

  test('the pathways map has the standards journey', () => {
    expect(read('src/lib/journeys/journeys.ts')).toContain("id: 'label-with-standards'")
  })

  test('no worker /sops file imports the admin panel', () => {
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []
      )
    for (const f of walk(path.join(root, 'src/app/(protected)/sops'))) {
      expect(fs.readFileSync(f, 'utf8'), f).not.toContain('BuilderStandardsButton')
    }
  })
})
