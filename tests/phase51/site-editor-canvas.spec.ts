/**
 * Phase 51 -- SIT-02/SIT-03. Source-contract assertions for the Konva
 * site editor canvas (`src/components/admin/site/SiteEditor.tsx`).
 *
 * `scene` describe activated by Plan 51-04 Task 1.
 * `drawing` describe activated by Plan 51-04 Task 2.
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

const LOADER_PATH = 'src/components/admin/site/SiteEditorLoader.tsx'
const EDITOR_PATH = 'src/components/admin/site/SiteEditor.tsx'

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

test.describe('scene', () => {
  test('SiteEditorLoader dynamic-imports SiteEditor with ssr: false', () => {
    const src = read(LOADER_PATH)
    expect(src.trimStart().startsWith("'use client'")).toBe(true)
    expect(src).toContain('dynamic(')
    expect(src).toContain("import('./SiteEditor')")
    expect(src).toContain('ssr: false')
  })

  test('SiteEditor renders the scene at natural width/height inside a Stage transformed by view {x,y,s}', () => {
    const src = read(EDITOR_PATH)
    expect(src.trimStart().startsWith("'use client'")).toBe(true)
    expect(src).toContain('export default function SiteEditor')
    expect(src).toContain('KonvaImage')
    expect(src).toContain('width={sceneWidth}')
    expect(src).toContain('height={sceneHeight}')
    expect(src).toContain('data-testid="site-canvas"')
    expect(src).toContain('data-scale=')
  })

  test('fit() re-runs on a ResizeObserver of the container, not just on mount (Pitfall 5)', () => {
    const src = read(EDITOR_PATH)
    expect(src).toContain('ResizeObserver')
    expect(src).toContain('fitView(')
  })

  test('wheel zoom is zoom-to-cursor and clamps scale via scene.ts zoomAt', () => {
    const src = read(EDITOR_PATH)
    expect(src).toContain('onWheel')
    expect(src).toContain('zoomAt(')
  })

  test('dragging empty canvas pans the stage; a machine/vertex drag does not', () => {
    const src = read(EDITOR_PATH)
    expect(src).toContain('draggable={!drawing}')
    expect(src).toContain('getStage()')
  })

  test('colour tokens are read from CSS custom properties, never hardcoded hex', () => {
    const src = read(EDITOR_PATH)
    expect(src).toContain('getComputedStyle')
    const hexHits = src.match(/#[0-9a-fA-F]{6}/g) ?? []
    expect(hexHits).toEqual([])
  })
})

test.describe('drawing', () => {
  test('vertices are placed via layer.getRelativePointerPosition() (scene-px, transform-aware), never raw pointer arithmetic', () => {
    const src = read(EDITOR_PATH)
    const relHits = (src.match(/getRelativePointerPosition\(/g) ?? []).length
    expect(relHits, 'expected at least placement + vertex-drag call sites').toBeGreaterThanOrEqual(2)
    expect(src).toContain('clampPoint(')
    expect(src).toContain('onCreate(')

    // getPointerPosition() (raw, non-transform-aware) is only legitimate inside
    // the wheel handler — zoom-to-cursor needs the raw stage-local pointer.
    const [wheelStart, wheelEnd] = functionSpan(src, 'handleWheel')
    const rawHits: number[] = []
    const re = /getPointerPosition\(/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) rawHits.push(m.index)
    expect(rawHits.length, 'expected the zoom handler to read the raw pointer position').toBeGreaterThan(0)
    for (const idx of rawHits) {
      expect(
        idx >= wheelStart && idx < wheelEnd,
        `getPointerPosition( at offset ${idx} is outside handleWheel — draw/drag must use getRelativePointerPosition()`
      ).toBe(true)
    }
  })

  test('Draw mode closes the polygon on first-vertex click or double-click', () => {
    const src = read(EDITOR_PATH)
    expect(src).toContain('onDblClick')
    expect(src).toContain('CLOSE_SNAP_PX')
    expect(src).toContain('onCreate(draft)')
  })

  test('dragging a vertex commits a scene-px point clamped via clampPoint(), rendered as screen-constant sizes', () => {
    const src = read(EDITOR_PATH)
    expect(src).toContain('onPolygonChange(')
    const circleBlocks = src.match(/<Circle[\s\S]*?\/>/g) ?? []
    expect(circleBlocks.some((b) => b.includes('draggable') && b.includes('onDragEnd'))).toBe(true)
    expect(src).toContain('centroid(')
    // Screen-constant sizing: stroke/label/handle dimensions divide by view.s.
    expect(src).toContain('/ view.s')
  })

  // Resolved in 51-05: SceneEditorProps (frozen 51-01) has no onDelete
  // callback by design — delete is a server-action-backed workspace concern,
  // not a canvas concern. Coverage lives in
  // tests/phase51/site-workspace-wiring.spec.ts's "workspace" describe
  // ("Draw / Delete / rename / department-select / link / unlink handlers
  // are wired..."), which asserts the Delete button's onClick, the
  // window keydown listener (Delete/Backspace, ignored while typing), and
  // deleteSiteMachine( wiring in SiteWorkspace.tsx. Left fixme here — SiteEditor
  // itself never gains an onDelete path.
  test.fixme('Delete key and a delete button both remove the selected machine — see site-workspace-wiring.spec.ts', () => {})
})
