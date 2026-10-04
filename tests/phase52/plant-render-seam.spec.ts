/**
 * Phase 52 -- HOM-01..06. Render-seam specs for the /sops page and PlantHome.
 * Live from Plan 52-04 (0 test.fixme).
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const PAGE_PATH = 'src/app/(protected)/sops/page.tsx'
const PLANT_HOME_PATH = 'src/components/sop/plant/PlantHome.tsx'
const PLANT_DIR = 'src/components/sop/plant/'
// Phase 57: the one screen is the plant's new home; the worker SOP route's isolation is held by the bundle gate.
const SHELL_DIR = 'src/components/shell/'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

function walk(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) return out
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(rel, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(rel)
    }
  }
  return out
}

/** Naive brace-matched body of `function <name>(...) { ... }` in `src`. */
function functionBody(src: string, name: string): string {
  const sigIdx = src.indexOf(`function ${name}(`)
  if (sigIdx === -1) return ''
  const braceStart = src.indexOf('{', sigIdx)
  if (braceStart === -1) return ''
  let depth = 0
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(braceStart, i + 1)
    }
  }
  return src.slice(braceStart)
}

test.describe('render seam', () => {
  test('PlantHome is loaded only via next/dynamic({ ssr: false }) -- no static import', () => {
    const src = read(PAGE_PATH)
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/sop\/plant\/PlantHome'\)/)
    expect(src).toContain('ssr: false')
    expect(src).not.toMatch(/^import .* from '@\/components\/sop\/plant/m)
  })

  test('no static import of @/components/sop/plant/ anywhere outside the plant directory', () => {
    const staticImport = /^\s*import\s+[^;]*from\s+'@\/components\/sop\/plant\//m
    const files = walk('src')
    const violations = files
      .filter((f) => !f.startsWith(PLANT_DIR) && !f.startsWith(SHELL_DIR))
      .filter((f) => staticImport.test(read(f)))
    expect(violations).toEqual([])
  })

  test('the render gate is !isAdmin && desktop viewport', () => {
    expect(read(PAGE_PATH)).toContain("!isAdmin && viewport === 'desktop'")
  })

  test('plantSite requires the site query to have resolved a layout AND at least one machine', () => {
    const src = read(PAGE_PATH)
    expect(src).toContain('useViewport()')
    expect(src).toMatch(/siteResult\.layout/)
    expect(src).toMatch(/machines\.length > 0/)
  })

  test('the ["site-worker"] query has no persister -- never cached to Dexie/localStorage (T-52-02)', () => {
    const src = read(PAGE_PATH)
    const idx = src.indexOf("queryKey: ['site-worker']")
    expect(idx).toBeGreaterThan(-1)
    const scope = src.slice(idx, idx + 400)
    expect(scope).toContain('enabled: wantsPlant')
    expect(scope).not.toContain('persister')
  })

  test('the toolbar search input is hidden when the plant is rendering (it becomes the ask bar inside PlantHome)', () => {
    expect(read(PAGE_PATH)).toContain('!takeover && !plantSite')
  })

  test('the admin branch renders the library table (Phase 54: isAdmin && viewport === "desktop" ? <AdminLibraryTable ...)', () => {
    expect(read(PAGE_PATH)).toMatch(/isAdmin\s*&&\s*viewport\s*===\s*'desktop'\s*\?\s*\(\s*<AdminLibraryTable/)
  })

  test('the PlantHome slot renders after every hook in SopsSection (hook-order safety)', () => {
    const src = read(PAGE_PATH)
    const sectionStart = src.indexOf('function SopsSection(')
    expect(sectionStart).toBeGreaterThan(-1)
    const sectionSrc = src.slice(sectionStart)
    const slotIdx = sectionSrc.indexOf('if (plant && onQueryChange) return <PlantHome')
    expect(slotIdx).toBeGreaterThan(-1)
    // Phase 53-02: the worker-list queries moved into useWorkerSops(); the
    // hook call is now the last data-fetching statement before the slot.
    const lastQueryIdx = sectionSrc.lastIndexOf('useWorkerSops(', slotIdx)
    expect(lastQueryIdx).toBeGreaterThan(-1)
    expect(slotIdx).toBeGreaterThan(lastQueryIdx)
  })

  test('the slot hands PlantHome the exact list SopsSection already built (sops={workerSops})', () => {
    expect(read(PAGE_PATH)).toContain('sops={workerSops}')
  })

  test('page.tsx contains no router.push and no next/link (phase41 invariants)', () => {
    const src = read(PAGE_PATH)
    expect(src).not.toContain('router.push')
    expect(src).not.toContain('next/link')
  })
})

test.describe('PlantHome wiring', () => {
  test('exports PlantHome', () => {
    expect(read(PLANT_HOME_PATH)).toContain('export function PlantHome')
  })

  test('composes every derivation it renders from -- no local re-implementation', () => {
    const src = read(PLANT_HOME_PATH)
    for (const call of ['derivePlantPins(', 'pickNowQueue(', 'askMatches(', 'machineSops(', 'narrowForAsk(', 'zoneColour(']) {
      expect(src, `missing call to ${call}`).toContain(call)
    }
  })

  test('open() flies the camera to the clicked machine and selects it', () => {
    const body = functionBody(read(PLANT_HOME_PATH), 'open')
    expect(body).toContain('setSelectedId(')
    expect(body).toContain('stageRef.current?.flyTo(')
  })

  test('close() clears the selection and fits the whole site again', () => {
    const body = functionBody(read(PLANT_HOME_PATH), 'close')
    expect(body).toContain('setSelectedId(null)')
    expect(body).toContain('stageRef.current?.fit()')
  })

  test("clicking a department chip calls fitMachines for that department's bounding box", () => {
    const body = functionBody(read(PLANT_HOME_PATH), 'pickZone')
    expect(body).toContain('fitMachines(')
  })

  test('the stage, the Now card and the panel all reuse the same open/close handlers, and the ask bar is wired', () => {
    const src = read(PLANT_HOME_PATH)
    for (const wiring of [
      'onMachineClick={open}',
      'onShowMe={open}',
      'onClose={close}',
      'onChange={onQueryChange}',
    ]) {
      expect(src, `missing ${wiring}`).toContain(wiring)
    }
  })

  test('the Now card is hidden while the site query is loading, never a flash of "Nothing due"', () => {
    expect(read(PLANT_HOME_PATH)).toMatch(/!loading\s*&&\s*<NowCard/)
  })

  test('no router, konva, isRefresher or hasNewerVersion anywhere in the file', () => {
    const src = read(PLANT_HOME_PATH)
    expect(src).not.toContain('router')
    expect(src).not.toMatch(/konva/i)
    expect(src).not.toContain('isRefresher')
    expect(src).not.toContain('hasNewerVersion')
  })
})
