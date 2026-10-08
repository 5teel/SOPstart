/**
 * Phase 63 -- the library site map. Requirements MAP-02, MAP-03, MAP-04. Owner: 63-10.
 * Source-contract checks over src/components/home/map plus one real server render (the component is
 * rendered through tsx, because Playwright's transform cannot render React components). Geometry and
 * colour are judged by LOOKING at map-samples/*.png (scripts/render-map-samples.ts), not here.
 * Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(__dirname, '..', '..')
const DIR = path.join(ROOT, 'src/components/home/map')
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8')
const files = () => fs.readdirSync(DIR).filter((f) => /\.tsx?$/.test(f))
const all = () => files().map(read).join('\n')

test.describe('site map', () => {
  test('SiteMap, MapShapes and MapKey exist', () => {
    expect(files().sort()).toEqual(['MapKey.tsx', 'MapShapes.tsx', 'SiteMap.tsx'])
  })

  test('tokens only: no hex, no string markup, no stylesheet import, no server action', () => {
    const src = all()
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toContain('dangerouslySetInnerHTML')
    expect(src).not.toMatch(/\.css['"]/)
    expect(src).not.toMatch(/from ['"]@\/actions/)
    expect(src).not.toMatch(/\b(?:text|bg|border|fill|stroke)-(?:red|green|blue|amber|zinc|slate|gray)-\d/)
  })

  test('geometry comes from the shared layout module', () => {
    const src = read('SiteMap.tsx')
    expect(src).toContain('layoutSite(')
    expect(src).toContain('viewFor(')
    expect(src).toContain('byDepth(')
    expect(src).toContain('Esc for the whole site')
  })

  test('the zoom is a viewBox tween on a ref, with a direct cut under reduced motion', () => {
    const src = read('SiteMap.tsx')
    expect(src).toContain('requestAnimationFrame')
    expect(src).toContain("setAttribute('viewBox'")
    expect(src).toContain('dur-map-zoom')
    expect(src).toContain('prefers-reduced-motion')
    expect(src).toContain('cancelAnimationFrame')
    const css = fs.readFileSync(path.join(ROOT, 'src/styles/blueprint-theme.css'), 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.map-plate\s*\{\s*transition: none/)
    expect(css).toMatch(/\.map-plate\[data-state="dim"\]\s*\{\s*opacity/)
  })

  test('plates and objects are keyboard buttons with names and titles', () => {
    const src = read('SiteMap.tsx')
    expect(src).toContain("role: 'button'")
    expect(src).toContain('role="button"')
    expect(src).toContain('tabIndex')
    expect(src).toMatch(/aria-label/)
    expect(src).toContain('<title>')
    expect(src).toContain('onKeyDown')
    expect(src).toContain('data-testid="map-area"')
    expect(src).toContain('data-testid="map-object"')
  })

  test('name signs and phone markers are both drawn, with opposite lg visibility', () => {
    const src = read('SiteMap.tsx')
    expect(src).toContain('max-lg:hidden')
    expect(src).toMatch(/className="lg:hidden"/)
    expect(read('MapKey.tsx')).toContain('lg:hidden')
    expect(read('MapKey.tsx')).toContain('data-testid="map-key-item"')
    expect(read('MapKey.tsx')).toContain('min-h-tap')
  })

  test('a real render: one plate per area, objects only when open, titles escaped', () => {
    const probe = `
      const { renderToStaticMarkup } = require('react-dom/server');
      const { createElement } = require('react');
      const { SiteMap } = require('./src/components/home/map/SiteMap');
      const areas = [
        { id: 'a', name: 'Forming', colourVar: 'var(--area-1)', index: 1, sopIds: ['s1', 's2'] },
        { id: 'b', name: 'General', colourVar: 'var(--area-2)', index: 2, sopIds: ['s3'] },
      ];
      const evil = '<img src=x onerror=alert(1)>';
      const rows = [
        { id: 's1', title: evil, areaId: 'a', kind: 'conveyor', status: null },
        { id: 's2', title: 'Two', areaId: 'a', kind: 'tank', status: null },
        { id: 's3', title: 'Three', areaId: 'b', kind: 'board', status: { kind: 'signed', text: 'Signed off 2 Oct' } },
      ];
      const draw = (area) => renderToStaticMarkup(createElement(SiteMap, { areas, rows, area, onArea() {}, onOpenSop() {}, orgName: 'Org' }));
      process.stdout.write(JSON.stringify({ whole: draw(null), zoom: draw('a'), empty: renderToStaticMarkup(createElement(SiteMap, { areas: [], rows: [], area: null, onArea() {}, onOpenSop() {}, orgName: 'Org' })) }));
    `
    const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'), '-e', probe], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 })
    expect(r.status, r.stderr).toBe(0)
    const { whole, zoom, empty } = JSON.parse(r.stdout) as { whole: string; zoom: string; empty: string }
    const count = (s: string, needle: string) => s.split(needle).length - 1

    expect(count(whole, 'data-testid="map-area"')).toBe(2)
    expect(count(whole, 'data-testid="map-object"')).toBe(0) // not interactive until a plate is open
    expect(whole).toContain('Org · site map')
    expect(whole).toContain('click an area to open it')
    expect(count(whole, 'data-testid="map-key-item"')).toBe(2)

    expect(count(zoom, 'data-testid="map-object"')).toBe(2) // exactly the open area's SOPs
    expect(zoom).toContain('data-testid="map-crumb"')
    expect(zoom).toContain('Esc for the whole site')
    expect(zoom).not.toContain('data-testid="map-key"')
    expect(zoom).toContain('data-state="cur"')
    expect(zoom).toContain('data-state="dim"')

    // the typed title is text, never markup
    for (const html of [whole, zoom]) expect(html).not.toContain('<img')
    expect(zoom).toContain('&lt;img')

    expect(empty).toContain('No SOPs in your library yet.')
    expect(empty).not.toContain('<svg')
  })

  test('review evidence: the sample script covers every size and the PNGs are committed', () => {
    const script = fs.readFileSync(path.join(ROOT, 'scripts/render-map-samples.ts'), 'utf8')
    for (const id of ['1-area-1-sop', '3-areas-6-sops', '8-areas-mixed', '12-areas-15-sops', 'real-org-3-areas']) expect(script).toContain(id)
    expect(script).toContain('chromium')
    expect(script).toMatch(/1280/)
    expect(script).toMatch(/390/)
    const dir = path.join(ROOT, '.planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/map-samples')
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length).toBeGreaterThanOrEqual(10)
  })
})
