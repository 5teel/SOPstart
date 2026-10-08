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

  // 59-14: the governance page and the access bridge page are deleted; the redirects are proved by
  // tests/phase59/legacy-redirects.spec.ts and the 59-14 retirement sweep.
  test('retire access: the lens has no back handler (the old access address is quoted nowhere in src: see the sweep below)', () => {
    expect(read('src/components/sop/lenses/AdminAccessLens.tsx')).not.toContain('onBack')
  })

  test('retire list: the proxy redirects every list address to a fixed destination, server-side (Phase 59: the Office places)', () => {
    const proxy = stripComments(read('src/lib/supabase/middleware.ts'))
    expect(proxy).toContain("path === '/sops'")
    expect(proxy).toContain('legacyPathRedirect(path, request.nextUrl.search)')
    const helper = stripComments(read('src/lib/shell/home-state.ts'))
    expect(helper).toContain("view === 'attention'")
    expect(helper).toContain("at('signoffs')")
    expect(helper).toContain("pin: params.get('sop')")
    expect(helper).toContain("tab: 'access'")
    // the library scope is retired: it goes home (D-17).
    expect(helper).toContain("view === 'library' ? '/' :")
    // refreshed session cookies survive the hop; the redirect is built from a fixed string
    expect(proxy).toContain('response.cookies.getAll().forEach((c) => redirect.cookies.set(c))')
    expect(proxy).toContain('NextResponse.redirect(new URL(office, request.url))')
    // no client-side copy of the redirect may come back (CLAUDE.md 2026-09-29)
    const clientCopies = walkSrc(path.join(ROOT, 'src'))
      .filter((f) => /router\.(replace|push)\(\s*['"`]\/(governance|admin\/team|admin\/access)['"`]\s*\)/.test(stripComments(fs.readFileSync(f, 'utf-8'))))
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
  test('retire list: the plant folder is gone and nothing imports it (63-20)', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/components/sop/plant'))).toBe(false)
    const staticImport = /from\s+'@\/components\/sop\/plant\//m
    const violations = walkSrc(path.join(ROOT, 'src'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
      .filter((f) => staticImport.test(read(f)))
    expect(violations).toEqual([])
  })

  test('retire list: the worker list is derived in exactly one place, useLibrary (survivor of merged-surface)', () => {
    // 63-20: the old per-SOP due / refresher derivation (worker-last-completions) went with the rooms.
    const owners = walkSrc(path.join(ROOT, 'src'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'))
      .filter((f) => stripComments(read(f)).includes("queryKey: ['worker-last-completions']"))
    expect(owners).toEqual([])
    const hook = stripComments(read('src/hooks/useLibrary.ts'))
    expect(hook).toContain(".eq('worker_id'")
    expect(hook).not.toContain('getUserSopAssignments')
    expect(hook).toContain('library-sops')
    const shell = stripComments(read('src/components/home/HomeShell.tsx'))
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
    expect(fs.existsSync(path.join(ROOT, 'src/lib/sop/admin-health.ts'))).toBe(false)
    for (const name of ['libraryNavToUrl', 'resolveLibraryNav', 'DEFAULT_LIBRARY_NAV', 'deriveChecks', 'tableStatus', 'CHECK_ORDER']) {
      expect(rows, name).not.toContain(name)
    }
    // the quoted bare list address, with or without a query, outside the proxy
    const bareList = /['"`]\/sops(?:['"`?]|$)/m
    const accessView = /sops\?view=access|view=access/
    const listHits: string[] = []
    const accessHits: string[] = []
    for (const f of walkSrc(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/')
      const code = stripComments(fs.readFileSync(f, 'utf-8'))
      // Phase 59: the proxy and the pure helpers it calls (place.ts, home-state.ts) are the homes of the list address
      if (rel !== 'src/lib/supabase/middleware.ts' && rel !== 'src/lib/shell/place.ts' && rel !== 'src/lib/shell/home-state.ts' && bareList.test(code)) listHits.push(rel)
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
