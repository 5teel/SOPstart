/**
 * Phase 57 -- retirement sweep (stub; Wave 0 / 57-01).
 * Filled by: 57-06, 57-07, 57-08, 57-09. Negative assertions that quote a
 * retired literal live here (the repoint inventory walk excludes this folder).
 * Registration: playwright.config.ts `phase57` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { roleHome } from '@/lib/auth/role-home'
import { placeForPath } from '@/lib/shell/place'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

function walkSrc(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkSrc(full, out)
    else if (/\.tsx?$/.test(e.name)) out.push(full)
  }
  return out
}

test.describe('retire sweep', () => {
  test('retire header: roleHome sends every role to / and no role to /pending', () => {
    for (const role of ['worker', 'supervisor', 'safety_manager', 'admin']) expect(roleHome(role), role).toBe('/')
    for (const role of [null, undefined, 'x']) expect(roleHome(role), String(role)).toBe('/pending')
  })

  test('retire header: the dashboard is a fixed server redirect and nothing in src names it', () => {
    const config = read('next.config.ts')
    expect(config).toMatch(/source: '\/dashboard',\s*destination: '\/',\s*permanent: false/)
    expect(fs.existsSync(path.join(ROOT, 'src/app/(protected)/dashboard'))).toBe(false)
    const offenders = walkSrc(path.join(ROOT, 'src'))
      .filter((f) => /['"`]\/dashboard/.test(stripComments(fs.readFileSync(f, 'utf-8'))))
      .map((f) => path.relative(ROOT, f))
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  test('retire header: auth actions and the role maps never send anyone to the dashboard', () => {
    expect(stripComments(read('src/actions/auth.ts'))).not.toContain("redirect('/dashboard')")
    expect(stripComments(read('src/lib/journeys/roles.ts'))).not.toContain("'/dashboard'")
    expect(stripComments(read('src/lib/journeys/journeys.ts'))).not.toContain("'/dashboard'")
  })

  test('retire header: /governance survives as the Office bridge, not a redirect (D-17)', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/(protected)/governance/page.tsx'))).toBe(true)
    expect(read('next.config.ts')).not.toMatch(/source: '\/governance'/)
  })

  test('retire access: the bridge page is admin-gated, UUID-pins the SOP and mounts the lens', () => {
    const page = stripComments(read('src/app/(protected)/admin/access/page.tsx'))
    expect(page.indexOf('requireAdminContext()')).toBeGreaterThan(-1)
    expect(page.indexOf('requireAdminContext()')).toBeLessThan(page.indexOf('<AdminAccessLens'))
    expect(page).toMatch(/UUID\.test\(sop\)/)
    expect(page).toContain('<AdminAccessLens pinnedSopId={pinnedSopId} />')
    expect(read('src/components/sop/lenses/AdminAccessLens.tsx')).not.toContain('onBack')
    expect(read('src/components/shell/AdminRoomBodies.tsx')).not.toContain('/admin/access')
    expect(placeForPath('/admin/access')).toBe('/?place=office')
  })

  test('retire list: the proxy redirects every list address to a fixed destination, server-side', () => {
    const proxy = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(proxy).toContain("path === '/sops'")
    expect(proxy).toContain("view === 'attention'")
    expect(proxy).toContain("destination = '/governance'")
    expect(proxy).toContain(": '/admin/access'")
    expect(proxy).toMatch(/let destination = '\/'/)
    expect(proxy).toMatch(/sop && SOP_ID\.test\(sop\)/)
    expect(proxy).toContain('/admin/access?sop=${sop}')
    // /governance?view=library is the retired library scope: it goes home (D-17).
    expect(proxy).toMatch(/path === '\/governance' && request\.nextUrl\.searchParams\.get\('view'\) === 'library'/)
    // refreshed session cookies survive the hop; the redirect is built from a fixed string
    expect(proxy).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
    expect(proxy).toContain('NextResponse.redirect(new URL(destination, request.url))')
    // no client-side copy of the redirect may come back (CLAUDE.md 2026-09-29)
    const clientCopies = walkSrc(path.join(ROOT, 'src'))
      .filter((f) => /router\.(replace|push)\(\s*['"`]\/governance['"`]\s*\)/.test(stripComments(fs.readFileSync(f, 'utf-8'))))
      .map((f) => path.relative(ROOT, f))
    expect(clientCopies, clientCopies.join(', ')).toEqual([])
  })

  test('retire list: legacy admin bookmarks still reach the proxy block; every redirect destination is a fixed path', () => {
    const config = read('next.config.ts')
    expect(config).toMatch(/source: '\/admin\/sops',\s*destination: '\/sops'/)
    const destinations = [...config.matchAll(/destination:\s*'([^']*)'/g)].map((m) => m[1])
    for (const d of destinations) {
      expect(d.startsWith('/'), d).toBe(true)
      expect(d.startsWith('//'), d).toBe(false)
      expect(d, d).not.toMatch(/http|\$\{/)
    }
  })

  test('retire list: the list page, its loading boundary and the plant home surfaces are gone', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/(protected)/sops/page.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/app/(protected)/sops/loading.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(ROOT, 'src/app/(protected)/sops/[sopId]/page.tsx'))).toBe(true)
    for (const f of [
      'src/components/sop/plant/PlantHome.tsx',
      'src/components/sop/plant/PlantAskBar.tsx',
      'src/components/sop/WorkerSimpleList.tsx',
      'src/components/sop/CategoryBottomSheet.tsx',
      'src/components/sop/SopLibraryCard.tsx',
    ]) {
      expect(fs.existsSync(path.join(ROOT, f)), f).toBe(false)
    }
    // the overlay machine panel went; the body and rows the detail pane renders stayed
    const panel = read('src/components/sop/plant/MachinePanel.tsx')
    expect(panel).not.toContain('export function MachinePanel(')
    expect(panel).toContain('export function MachineBody(')
    expect(panel).toContain('No procedures for this machine yet.')
  })

  test('retire list: nothing in src links to, pushes to or revalidates the list address', () => {
    const link = /(href=|push\(|replace\(|redirect\(|revalidatePath\(|redirectTo=)\s*\{?\s*['"`]\/sops['"`?]/
    const offenders = walkSrc(path.join(ROOT, 'src'))
      .filter((f) => link.test(stripComments(fs.readFileSync(f, 'utf-8'))))
      .map((f) => path.relative(ROOT, f))
    expect(offenders, offenders.join(', ')).toEqual([])
  })

  test('retire list: no source file still names a deleted list surface', () => {
    const names = /PlantHome|PlantAskBar|WorkerSimpleList|CategoryBottomSheet|SopLibraryCard|AdminLibraryTable|AdminFloorHealth|libraryNavToUrl|resolveLibraryNav|deriveChecks/
    const offenders = walkSrc(path.join(ROOT, 'src'))
      .filter((f) => names.test(stripComments(fs.readFileSync(f, 'utf-8'))))
      .map((f) => path.relative(ROOT, f))
    expect(offenders, offenders.join(', ')).toEqual([])
  })

  // Survivors moved here from the whole-subject specs deleted in 57-08.
  test('retire list: the plant is reached only by the shell (survivor of plant-render-seam)', () => {
    const staticImport = /^\s*import\s+[^;]*from\s+'@\/components\/sop\/plant\//m
    const violations = walkSrc(path.join(ROOT, 'src'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
      .filter((f) => !f.startsWith('src/components/sop/plant/') && !f.startsWith('src/components/shell/'))
      .filter((f) => staticImport.test(read(f)))
    expect(violations).toEqual([])
  })

  test('retire list: the site-worker query has no persister (survivor of plant-render-seam, T-52-02)', () => {
    const src = read('src/components/shell/WorkerShell.tsx')
    const idx = src.indexOf("queryKey: ['site-worker']")
    expect(idx).toBeGreaterThan(-1)
    expect(src.slice(idx, idx + 200)).not.toContain('persister')
  })

  test('retire list: the worker list is derived in exactly one place (survivor of merged-surface)', () => {
    const owners = walkSrc(path.join(ROOT, 'src'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
      .filter((f) => stripComments(read(f)).includes("queryKey: ['worker-last-completions']"))
    expect(owners).toEqual(['src/hooks/useWorkerSops.ts'])
    const hook = read('src/hooks/useWorkerSops.ts')
    expect(hook).toContain(".eq('worker_id'")
    expect(hook).toContain('getUserSopAssignments')
    expect(hook).toContain('refresherDueDate')
    expect(hook).toContain('library-sops')
    const shell = stripComments(read('src/components/shell/WorkerShell.tsx'))
    for (const key of ["queryKey: ['worker-last-completions']", "queryKey: ['sop-refresher-intervals']", "queryKey: ['library-sops']"]) {
      expect(shell).not.toContain(key)
    }
    expect(shell).not.toContain('getUserSopAssignments')
  })

  test('retire list: the library table and its helpers are gone, the list address is quoted nowhere but the proxy, and the access view address is not spelled in src', () => {
    for (const f of ['src/components/admin/AdminLibraryTable.tsx', 'src/components/admin/governance/AdminFloorHealth.tsx']) {
      expect(fs.existsSync(path.join(ROOT, f)), f).toBe(false)
    }
    const rows = read('src/lib/sop-list/admin-rows.ts')
    const health = read('src/lib/sop/admin-health.ts')
    for (const name of ['libraryNavToUrl', 'resolveLibraryNav', 'DEFAULT_LIBRARY_NAV', 'deriveChecks', 'tableStatus', 'CHECK_ORDER']) {
      expect(rows + health, name).not.toContain(name)
    }
    // what the one screen still reads stays
    for (const name of ['adminSopBadge', 'machinePanelSops', 'noticeboardSops', 'healthPinCount', 'machineHealth']) {
      expect(health, name).toContain(`export function ${name}(`)
    }
    // the quoted bare list address, with or without a query, outside the proxy
    const bareList = /['"`]\/sops(?:['"`?]|$)/m
    const accessView = /sops\?view=access|view=access/
    const listHits: string[] = []
    const accessHits: string[] = []
    for (const f of walkSrc(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/')
      const code = stripComments(fs.readFileSync(f, 'utf-8'))
      if (rel !== 'src/lib/supabase/middleware.ts' && bareList.test(code)) listHits.push(rel)
      if (accessView.test(code)) accessHits.push(rel)
    }
    expect(listHits, listHits.join(', ')).toEqual([])
    expect(accessHits, accessHits.join(', ')).toEqual([])
  })

  test('retire list: the dropped list records the list-page feature and the phase55 sweep runs it live', () => {
    const dropped = JSON.parse(read('scripts/dropped-features.json')) as { entries: Array<{ feature: string; kind: string; path?: string }> }
    const mine = dropped.entries.filter((e) => e.feature === 'list-page')
    const files = mine.filter((e) => e.kind === 'file').map((e) => e.path)
    for (const f of [
      'src/app/(protected)/sops/page.tsx',
      'src/app/(protected)/sops/loading.tsx',
      'src/components/sop/plant/PlantHome.tsx',
      'src/components/sop/plant/PlantAskBar.tsx',
      'src/components/sop/WorkerSimpleList.tsx',
      'src/components/sop/CategoryBottomSheet.tsx',
      'src/components/sop/SopLibraryCard.tsx',
      'src/components/admin/AdminLibraryTable.tsx',
      'src/components/admin/governance/AdminFloorHealth.tsx',
    ]) {
      expect(files, f).toContain(f)
    }
    // the dropped list holds no symbol for the bare list address: the redirect specs quote it
    expect(mine.filter((e) => e.kind === 'symbol').length).toBe(1)
    const sweep = read('tests/phase55/deletion-sweep.spec.ts')
    expect(sweep.match(/'list-page'/g)?.length).toBe(2)
  })
})
