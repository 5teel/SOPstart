/**
 * Phase 53 -- PHN-02. Source-contract tests for the `/m/[code]` machine
 * page: org-scoped lookup, MachineView wiring, and the shared render for
 * the plate admin gate.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const PAGE_PATH = 'src/app/(protected)/m/[code]/page.tsx'
const MACHINE_VIEW_PATH = 'src/components/sop/plant/MachineView.tsx'
const MACHINE_PANEL_PATH = 'src/components/sop/plant/MachinePanel.tsx'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

// Copied from tests/phase41/merged-surface.spec.ts -- no shared test-utils
// module exists for this idiom in this codebase.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

test.describe('/m/[code] page', () => {
  test('code is validated against MACHINE_CODE_PATTERN (via normaliseMachineCode) before any query', () => {
    const src = stripComments(read(PAGE_PATH))
    const normaliseIdx = src.indexOf('normaliseMachineCode(')
    const firstFromIdx = src.indexOf(".from('")
    expect(normaliseIdx).toBeGreaterThan(-1)
    expect(firstFromIdx).toBeGreaterThan(-1)
    expect(normaliseIdx).toBeLessThan(firstFromIdx)
  })

  test('getSessionContext gates the route, redirects to /login?next=/m/<code> when unauthenticated', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).toContain('getSessionContext()')
    expect(src).toContain('redirect(`/login?next=${encodeURIComponent(`/m/${code}`)}`)')
  })

  test('every .from(...) query chain is filtered by .eq(\'organisation_id\', organisationId) -- the session org, never a fetched row (2026-07-28)', () => {
    const src = stripComments(read(PAGE_PATH))
    const fromMatches = [...src.matchAll(/\.from\('[a-z_]+'\)/g)]
    expect(fromMatches.length).toBeGreaterThanOrEqual(4) // site_machines, departments, sop_machines, sops
    for (const m of fromMatches) {
      const start = m.index as number
      const nextAwaitIdx = src.indexOf('await ', start)
      const end = nextAwaitIdx > start ? nextAwaitIdx : src.length
      const chain = src.slice(start, end)
      expect(chain, `chain after ${m[0]} at char ${start} is missing the org filter`).toContain(
        ".eq('organisation_id', organisationId)"
      )
    }
  })

  test('the site_machines lookup filters on the validated code and reads a single row', () => {
    const src = stripComments(read(PAGE_PATH))
    const idx = src.indexOf(".from('site_machines')")
    expect(idx).toBeGreaterThan(-1)
    const nextAwaitIdx = src.indexOf('await ', idx)
    const chain = src.slice(idx, nextAwaitIdx > idx ? nextAwaitIdx : src.length)
    expect(chain).toContain(".eq('code', code)")
    expect(chain).toContain('.maybeSingle()')
  })

  test('a malformed, unknown or foreign code all notFound() identically -- no distinguishing message (T-53-01)', () => {
    const src = stripComments(read(PAGE_PATH))
    const hits = src.match(/notFound\(\)/g) ?? []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  test('no admin client, no select-star', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).not.toContain('createAdminClient')
    expect(src).not.toContain("select('*')")
  })

  test('renders MachineView, imported from the plant directory', () => {
    const src = stripComments(read(PAGE_PATH))
    expect(src).toContain("import { MachineView } from '@/components/sop/plant/MachineView'")
    expect(src).toContain('<MachineView')
  })
})

test.describe('MachineView', () => {
  test('gathers data via the shared hooks -- useSopSync, useAssignedSops, useWorkerSops -- never a second derivation', () => {
    const src = stripComments(read(MACHINE_VIEW_PATH))
    expect(src).toContain("from '@/hooks/useWorkerSops'")
    expect(src).toContain("from '@/hooks/useAssignedSops'")
    expect(src).toContain("from '@/hooks/useSopSync'")
    expect(src).toContain('useSopSync(')
    expect(src).toContain('useAssignedSops(')
    expect(src).toContain('useWorkerSops(')
  })

  test('orders the machine\'s SOPs via the shared machineSops classifier, never its own sort', () => {
    const src = stripComments(read(MACHINE_VIEW_PATH))
    expect(src).toContain("from '@/lib/sop/worker-signal'")
    expect(src).toContain('machineSops(')
    expect(src).not.toContain('.sort(')
    expect(src).not.toContain('plantRelState(')
  })

  test('renders the shared MachinePanel in its inline placement', () => {
    const src = stripComments(read(MACHINE_VIEW_PATH))
    expect(src).toMatch(/<MachinePanel\s+inline\b/)
  })
})

test.describe('MachinePanel (shared, inline variant)', () => {
  test('onClose is optional -- the close control renders only when it is passed', () => {
    const src = stripComments(read(MACHINE_PANEL_PATH))
    const onCloseGuardIdx = src.indexOf('onClose && (')
    const closeTestIdIdx = src.indexOf('data-testid="plant-panel-close"')
    expect(onCloseGuardIdx).toBeGreaterThan(-1)
    expect(closeTestIdIdx).toBeGreaterThan(onCloseGuardIdx)
  })

  test('the inline placement carries no absolute positioning; the overlay placement is unchanged (w-95)', () => {
    const src = stripComments(read(MACHINE_PANEL_PATH))
    const inlineClassMatch = src.match(/const INLINE_CLASS = '([^']*)'/)
    expect(inlineClassMatch).not.toBeNull()
    expect(inlineClassMatch?.[1]).not.toContain('absolute')
    expect(src).toMatch(/\bw-95\b/)
  })
})
