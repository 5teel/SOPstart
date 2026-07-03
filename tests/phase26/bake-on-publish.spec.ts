/**
 * Phase 26 Plan 26-13 (D-03, R5/R8) — persist + bake annotations, behavioural.
 *
 * Closes the absorbed Phase 17 arc slice 3. Like every phase26 spec, the DB
 * write + Konva raster are device/server surfaces that can't run headless here
 * (no `@/` alias, no browser) — so this proves the PURE versioning core in
 * process and asserts the security/wiring source-contracts (createAdminClient +
 * org self-enforce + parseJwtPayload, toDataURL bake, baked-vs-raw worker read,
 * Konva stays out of the worker). The full save→publish→worker path is the
 * device-UAT residual carried from 26-11 (`p26-annotation-editor-feel`).
 *
 * Pure module only (`baked-path.ts`) is imported directly; the 'use server'
 * action + Konva leaves are read as source (readFileSync) — NEVER dynamically
 * imported (CLAUDE.md 2026-06-24: `import('@/...')` fails outside a testDir project).
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { bakedStoragePath, nextBakedVersion } from '../../src/lib/builder/baked-path'

const ROOT = path.resolve(__dirname, '..', '..')
function src(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

test.describe('baked-path — content-versioned baked PNG storage path (26-13)', () => {
  test('bakedStoragePath is baked/{sop}/{image}.v{N}.png', () => {
    expect(bakedStoragePath('sop1', 'img1', 1)).toBe('baked/sop1/img1.v1.png')
    expect(bakedStoragePath('sop1', 'img1', 3)).toBe('baked/sop1/img1.v3.png')
  })

  test('nextBakedVersion bumps off the existing path (beats CDN cache); none → 1', () => {
    expect(nextBakedVersion(null)).toBe(1)
    expect(nextBakedVersion(undefined)).toBe(1)
    expect(nextBakedVersion('baked/sop1/img1.v1.png')).toBe(2)
    expect(nextBakedVersion('baked/sop1/img1.v9.png')).toBe(10)
  })

  test('re-publishing an edited diagram mints a fresh version (new URL, no stale CDN copy)', () => {
    let p: string | null = null
    p = bakedStoragePath('s', 'i', nextBakedVersion(p))
    expect(p).toBe('baked/s/i.v1.png')
    p = bakedStoragePath('s', 'i', nextBakedVersion(p))
    expect(p).toBe('baked/s/i.v2.png')
  })
})

test.describe('saveAnnotation — service-role, org self-enforcing, parseJwtPayload (T-26-13-01/03)', () => {
  const s = src('src/actions/annotations.ts')

  test("async-only 'use server' module — no sync value export (CLAUDE.md 2026-06-27)", () => {
    expect(s).toMatch(/^\s*['"]use server['"]/)
    const exportedFns = [...s.matchAll(/export\s+(async\s+)?function\s+\w+/g)]
    expect(exportedFns.length).toBeGreaterThan(0)
    // every EXPORTED function must be async (a sync export breaks next build)
    for (const m of exportedFns) expect(m[1]).toBe('async ')
    // no `export const X = ...` value exports — pure helpers live in src/lib/builder
    expect(s).not.toMatch(/export\s+const\s+\w+\s*=/)
  })

  test('writes via createAdminClient and self-enforces .eq(organisation_id, …)', () => {
    expect(s).toContain('createAdminClient')
    expect(s).toMatch(/\.eq\(\s*['"]organisation_id['"]/)
  })

  test('reads the caller org via parseJwtPayload, NEVER atob (CLAUDE.md 2026-06-26)', () => {
    expect(s).toContain('parseJwtPayload')
    expect(s).not.toMatch(/\batob\s*\(/)
  })

  test('exports both the save and the bake write paths', () => {
    expect(s).toMatch(/export\s+async\s+function\s+saveAnnotation/)
    expect(s).toMatch(/export\s+async\s+function\s+bakeAnnotation/)
  })
})

test.describe('bake-on-publish + Konva-free worker read (T-26-13-02/04, R8)', () => {
  test('bake-on-publish rasterises via stage.toDataURL and delegates versioning/upload to the action', () => {
    const s = src('src/components/admin/builder-v2/visual/bake-on-publish.ts')
    expect(s).toContain('toDataURL')
    expect(s).toContain('bakeAnnotation')
  })

  test('VisualBlock prefers the baked <img> for a diagram and imports NO Konva (worker read path)', () => {
    const s = src('src/components/admin/builder-v2/visual/VisualBlock.tsx')
    // baked-vs-raw selection: a baked diagram wins over the raw source.
    expect(s).toContain('bakedSrc')
    // the worker read path must never pull Konva or the editor leaf into its bundle
    expect(s).not.toMatch(/from ['"](react-)?konva['"]/)
    expect(s).not.toMatch(/import[^\n]*AnnotationEditor/)
  })

  test('the baked path carries through the media model + the private-bucket signer', () => {
    expect(src('src/components/admin/builder-v2/visual/media-adapter.ts')).toContain('bakedSrc')
    // worker read signs the raw baked path like every other sop-images ref
    expect(src('src/lib/builder/sign-layout-data-images.ts')).toContain('bakedSrc')
  })

  test('the annotation editor is launched from the admin diagram edit surface (26-11 reachable)', () => {
    const grid = src('src/components/admin/builder-v2/visual/MediaGrid.tsx')
    // opens Konva via the sanctioned dynamic loader path — never the leaf directly
    expect(grid).toMatch(/AnnotationEditorLoader|DiagramAnnotateModal/)
  })

  test('the 26-05 throwaway Konva spike route is deleted (real wiring replaces it)', () => {
    expect(
      existsSync(path.join(ROOT, 'src/app/(protected)/admin/builder-v2-konva-spike/page.tsx'))
    ).toBe(false)
  })
})
