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
    expect(read('src/components/shell/AdminRoomBodies.tsx')).toMatch(/href="\/admin\/access"[^>]*room-office-access/)
    expect(placeForPath('/admin/access')).toBe('/?place=office')
  })

  test.fixme('list page and plant home are gone; proxy redirects the list and attention views [57-08]', () => {})
  test.fixme('library table and its helpers are gone; dropped-features entries are live [57-09]', () => {})
})
