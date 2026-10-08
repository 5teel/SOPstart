/**
 * Phase 51 -- SIT-02/SIT-03/SIT-04. Source-contract assertions for
 * `SiteWorkspace.tsx` and (63-19) the Manage > Site & departments surface that mounts it in `SiteEditSurface.tsx`.
 *
 * `workspace` describe activated by Plan 51-05 Task 1.
 * `route` describe activated by Plan 51-05 Task 2.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

const WORKSPACE_PATH = 'src/components/admin/site/SiteWorkspace.tsx'
const EMPTY_STATE_PATH = 'src/components/admin/site/SiteEmptyState.tsx'
const SHELL_PATH = 'src/components/admin/site/SiteEditSurface.tsx'
const JOURNEYS_PATH = 'src/lib/journeys/journeys.ts'

/** Returns the [start, end) character span of a top-level `function <name>(` body. */
function functionSpan(src: string, name: string): [number, number] {
  const marker = new RegExp(`function ${name}\\(`)
  const m = marker.exec(src)
  if (!m) throw new Error(`${name} not found in source`)
  const start = m.index
  let i = src.indexOf('{', m.index)
  let depth = 1
  i++
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  return [start, i]
}

test.describe('workspace', () => {
  test('Draw / Delete / rename / department-select / link / unlink handlers are wired to src/actions/site.ts, not stubs', () => {
    const src = read(WORKSPACE_PATH)

    // Toolbar affordances exist and are wired, not just present as tokens.
    expect(src).toContain('data-testid="site-draw-machine"')
    expect(src).toContain('onClick={() => setDrawing((d) => !d)}')
    expect(src).toContain('data-testid="site-delete-machine"')
    expect(src).toContain('onClick={deleteSelected}')
    expect(src).toContain('data-testid="site-save-status"')

    // The keydown listener deletes on Delete/Backspace and cancels on Escape.
    expect(src).toContain("e.key === 'Delete'")
    expect(src).toContain('deleteSelected(')

    // onCreate: saves the new machine and selects it.
    const [createStart, createEnd] = functionSpan(src, 'handleCreate')
    const createBody = src.slice(createStart, createEnd)
    expect(createBody).toContain('upsertSiteMachine(')
    expect(createBody).toContain('setSelectedId(')

    // onPolygonChange: saves the dragged polygon.
    const [polyStart, polyEnd] = functionSpan(src, 'handlePolygonChange')
    expect(src.slice(polyStart, polyEnd)).toContain('upsertSiteMachine(')

    // Department select saves immediately on change.
    const [deptStart, deptEnd] = functionSpan(src, 'handleDepartmentChange')
    expect(src.slice(deptStart, deptEnd)).toContain('upsertSiteMachine(')
    expect(src).toContain('onChange={(e) => void handleDepartmentChange(')

    // Rename is debounced 600ms.
    const [renameStart, renameEnd] = functionSpan(src, 'handleRenameChange')
    const renameBody = src.slice(renameStart, renameEnd)
    expect(renameBody).toContain('setTimeout(')
    expect(renameBody).toContain('RENAME_DEBOUNCE_MS')
    expect(src).toContain('RENAME_DEBOUNCE_MS = 600')

    // Link/unlink both call setSopMachines (>= 2 occurrences: one per handler).
    const setSopMachinesHits = (src.match(/setSopMachines\(/g) ?? []).length
    expect(setSopMachinesHits).toBeGreaterThanOrEqual(2)
    const [linkStart, linkEnd] = functionSpan(src, 'linkSop')
    expect(src.slice(linkStart, linkEnd)).toContain('setSopMachines(')
    const [unlinkStart, unlinkEnd] = functionSpan(src, 'unlinkSop')
    expect(src.slice(unlinkStart, unlinkEnd)).toContain('setSopMachines(')
  })

  test('machine list right panel shows name, department, linked-SOP count, and a Show SOPs affordance', () => {
    const src = read(WORKSPACE_PATH)
    expect(src).toContain('data-testid="site-machine-row"')
    expect(src).toContain('data-testid="site-machine-name"')
    expect(src).toContain('aria-label="Machine name"')
    expect(src).toContain('data-testid="site-machine-department"')
    expect(src).toContain('aria-label="Department"')
    expect(src).toContain('data-testid="site-machine-sops-toggle"')
    expect(src).toContain('data-testid="site-link-sop-input"')
    expect(src).toContain('aria-label="Find a SOP to link"')
    expect(src).toContain('Show SOPs')
    expect(src).toContain('No machines yet')
  })

  test('empty state (no layout) offers Generate-from-description and Upload as the only two choices', () => {
    const src = read(EMPTY_STATE_PATH)
    // Generate is gated behind canGenerate (D-06: absent key -> hidden control, not broken).
    expect(src).toMatch(/\{canGenerate\s*&&\s*\(/)
    expect(src).toContain('data-testid="site-generate-button"')
    expect(src).toContain('data-testid="site-upload-input"')
    // Exactly these two on-ramps, no third choice.
    const testIds = src.match(/data-testid="site-[a-z-]+"/g) ?? []
    const topLevelChoiceIds = testIds.filter((t) => t.includes('generate-button') || t.includes('upload-input'))
    expect(topLevelChoiceIds.length).toBe(2)
  })

  test('SiteWorkspace imports SiteEditor only via SiteEditorLoader, never directly', () => {
    const src = read(WORKSPACE_PATH)
    expect(src).not.toContain("from './SiteEditor'")
    const loaderImports = (src.match(/from '\.\/SiteEditorLoader'/g) ?? []).length
    expect(loaderImports).toBe(1)
  })
})

test.describe('route', () => {
  test('the site is edited from Manage > Site & departments; the read self-guards with requireAdminContext() (Phase 57 D-10)', () => {
    const src = read(SHELL_PATH)
    expect(src).not.toContain('createAdminClient')
    expect(src).toContain('listSiteForOrg()')
    expect(src).toContain('<SiteWorkspace')
    expect(src).toContain('<SiteEmptyState')
    expect(src).toContain('canGenerate')
    const action = read('src/actions/site.ts')
    const fn = action.slice(action.indexOf('export async function listSiteForOrg('))
    expect(fn.indexOf('requireAdminContext()')).toBeGreaterThan(-1)
    expect(fn.indexOf('requireAdminContext()')).toBeLessThan(fn.indexOf('.from('))
  })

  test('journeys.ts maps the site edit mode in Manage SOPs', () => {
    const src = read(JOURNEYS_PATH)
    expect(src).toContain('view=site')
    expect(src).toContain("id: 'map-the-site'")
  })
})
