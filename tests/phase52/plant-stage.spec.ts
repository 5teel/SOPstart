/**
 * Phase 52 -- HOM-01. Camera + scene render stub for PlantStage.
 * Plan 52-02 Task 1 activates the camera-maths describe block (RED -> GREEN).
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  ZOOM_MIN,
  ZOOM_MAX,
  PLANT_PANEL_WIDTH,
  FLY_SCALE,
  ZONE_FIT_MAX,
  CAMERA_MS,
  flyToView,
  fitBoxView,
  fitView,
  zoomAt,
  zoneColour,
} from '@/lib/site/scene'

test.describe('camera maths (src/lib/site/scene.ts)', () => {
  test('exports the camera constants: fit 1.02, zoom clamp 0.35/2.4, panel offset 380, fly-to scale 1.5, chip fit clamp 1.6, transition 350ms', () => {
    expect(ZOOM_MIN).toBe(0.35)
    expect(ZOOM_MAX).toBe(2.4)
    expect(PLANT_PANEL_WIDTH).toBe(380)
    expect(FLY_SCALE).toBe(1.5)
    expect(ZONE_FIT_MAX).toBe(1.6)
    expect(CAMERA_MS).toBe(350)
    expect(fitView(1000, 1000, 1000, 1000)?.s).toBe(1.02)
  })

  test('flyToView targets (W - 380) / 2 so the 380px panel never covers the clicked machine', () => {
    const v = flyToView(1000, 700, [500, 300])
    expect(v).toEqual({ s: 1.5, x: -440, y: -100 })
    expect(flyToView(0, 700, [500, 300])).toBeNull()
  })

  test('fitBoxView clamps to min((W-80)/bw, (H-120)/bh, 1.6) for a department chip bounding box', () => {
    const v = fitBoxView(1000, 700, [[[100, 100], [300, 100], [300, 200]]])
    expect(v).toEqual({ s: 1.6, x: 180, y: 110 })

    const capped = fitBoxView(2000, 1200, [[[0, 0], [1000, 0], [1000, 500]]])
    expect(capped?.s).toBe(1.6)

    const uncapped = fitBoxView(2000, 1200, [[[0, 0], [4000, 0], [4000, 2000]]])
    expect(uncapped?.s).toBe(0.48)
  })

  test('fitBoxView on a degenerate box (collinear on one axis) does not return NaN/Infinity', () => {
    const v = fitBoxView(1000, 700, [[[100, 100], [100, 100]], [[100, 300]]])
    expect(v).not.toBeNull()
    expect(Number.isFinite(v!.s)).toBe(true)
    expect(Number.isFinite(v!.x)).toBe(true)
    expect(Number.isFinite(v!.y)).toBe(true)

    expect(fitBoxView(0, 700, [[[0, 0], [1, 1]]])).toBeNull()
    expect(fitBoxView(1000, 700, [])).toBeNull()
  })

  test('zoomAt applied repeatedly never escapes the ZOOM_MIN/ZOOM_MAX clamp', () => {
    let v = { x: 0, y: 0, s: 1 }
    for (let i = 0; i < 40; i++) v = zoomAt(v, { x: 0, y: 0 }, -1, ZOOM_MIN, ZOOM_MAX)
    expect(v.s).toBeLessThanOrEqual(2.4)

    v = { x: 0, y: 0, s: 1 }
    for (let i = 0; i < 40; i++) v = zoomAt(v, { x: 0, y: 0 }, 1, ZOOM_MIN, ZOOM_MAX)
    expect(v.s).toBeGreaterThanOrEqual(0.35)
  })

  test('zoneColour falls back to the Forming/General/Engineering triple when a department has no colour set', () => {
    expect(zoneColour({ name: 'Anything', colour: '#ff0000' }, 0)).toBe('#ff0000')
    expect(zoneColour({ name: 'Forming', colour: '#3b82f6' }, 0)).toBe('var(--accent-voice)')
    expect(zoneColour({ name: 'General', colour: '#3b82f6' }, 0)).toBe('var(--accent-measure)')
    expect(zoneColour({ name: ' engineering ', colour: '#3b82f6' }, 0)).toBe('var(--accent-inspect)')

    const a = zoneColour({ name: 'Packaging', colour: '#3b82f6' }, 0)
    const b = zoneColour({ name: 'Packaging', colour: '#3b82f6' }, 1)
    expect(a).toMatch(/^var\(--accent-/)
    expect(b).toMatch(/^var\(--accent-/)
    expect(a).not.toBe(b)
  })
})

test.describe('PlantStage source contract', () => {
  const ROOT = path.resolve(__dirname, '..', '..')
  const SRC = fs.readFileSync(path.join(ROOT, 'src', 'components', 'sop', 'plant', 'PlantStage.tsx'), 'utf-8')
  const CSS = fs.readFileSync(path.join(ROOT, 'src', 'app', 'globals.css'), 'utf-8')

  test('imports the camera maths from @/lib/site/scene, no hand-rolled copies', () => {
    const imported = SRC.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/site\/scene['"]/)
    expect(imported).not.toBeNull()
    for (const name of ['fitView', 'zoomAt', 'flyToView', 'fitBoxView', 'centroid', 'ZOOM_MIN', 'ZOOM_MAX', 'CAMERA_MS']) {
      expect(imported![1]).toContain(name)
    }
  })

  test('re-measures fit via a ResizeObserver so a stage built while hidden (0x0) recovers on next paint', () => {
    expect(SRC).toContain('new ResizeObserver(')
  })

  test('wheel listener is registered non-passive and calls zoomAt on wheel', () => {
    expect(SRC).toMatch(/addEventListener\(\s*['"]wheel['"][\s\S]{0,120}\{\s*passive:\s*false\s*\}/)
    expect(SRC).toMatch(/zoomAt\([^)]*ZOOM_MIN,\s*ZOOM_MAX/)
  })

  test('a drag that starts on a machine polygon is ignored by the pan handler, before any pointer capture', () => {
    const bodyStart = SRC.indexOf('function handlePointerDown')
    const bodyEnd = SRC.indexOf('function handlePointerMove')
    const body = SRC.slice(bodyStart, bodyEnd)
    const polygonCheck = body.indexOf("tagName === 'polygon'")
    const setCapture = body.indexOf('setPointerCapture')
    expect(polygonCheck).toBeGreaterThan(-1)
    expect(setCapture).toBeGreaterThan(-1)
    expect(polygonCheck).toBeLessThan(setCapture)
  })

  test('useImperativeHandle exposes fit, flyTo and fitMachines', () => {
    const call = SRC.match(/useImperativeHandle\(ref,\s*\(\)\s*=>\s*\(\{([^}]*)\}/)
    expect(call).not.toBeNull()
    for (const name of ['fit', 'flyTo', 'fitMachines']) expect(call![1]).toContain(name)
  })

  test('a machine polygon click calls onMachineClick', () => {
    expect(SRC).toMatch(/onClick=\{\(\)\s*=>\s*onMachineClick\(m\.id\)\}/)
  })

  test('the scene <img> has loading="lazy" and decoding="async"', () => {
    const imgTag = SRC.slice(SRC.indexOf('<img'), SRC.indexOf('/>', SRC.indexOf('<img')))
    expect(imgTag).toContain('loading="lazy"')
    expect(imgTag).toContain('decoding="async"')
  })

  test('reduced-motion is respected', () => {
    expect(SRC).toMatch(/prefers-reduced-motion|motion-reduce:/)
  })

  test('testids present: plant-stage, plant-world, plant-machine, plant-pin, plant-label', () => {
    for (const testid of ['plant-stage', 'plant-world', 'plant-machine', 'plant-pin', 'plant-label']) {
      expect(SRC).toContain(`data-testid="${testid}"`)
    }
  })

  test('no useState initialiser reads window or navigator (2026-06-08 hydration class)', () => {
    for (const m of SRC.matchAll(/useState\(([^)]*)\)/g)) {
      expect(m[1]).not.toMatch(/window|navigator/)
    }
  })

  test('no import of konva, react-konva, next/navigation or a router', () => {
    expect(SRC).not.toMatch(/from ['"](react-)?konva['"]/)
    expect(SRC).not.toMatch(/from ['"]next\/navigation['"]/)
    expect(SRC).not.toMatch(/useRouter/)
  })

  test('globals.css declares .plant-pin-bob both as a rule and inside the reduced-motion block', () => {
    expect(CSS).toMatch(/\.plant-pin-bob\s*\{[^}]*animation:/)
    const reducedBlock = CSS.slice(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce) {\n  .plant-pin-bob'))
    expect(reducedBlock).toContain('.plant-pin-bob')
  })
})
