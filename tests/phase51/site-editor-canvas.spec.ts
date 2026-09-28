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
  // activated by plan 51-04
  test.fixme('vertices are placed via layer.getRelativePointerPosition() (scene-px, transform-aware)', () => {})

  // activated by plan 51-04
  test.fixme('Draw mode closes the polygon on first-vertex click or double-click', () => {})

  // activated by plan 51-04
  test.fixme('dragging a vertex commits a scene-px point clamped via clampPoint()', () => {})

  // deferred to plan 51-05: delete lives in SiteWorkspace (51-04 objective —
  // SceneEditorProps has no onDelete callback; deleting a machine is a
  // server-action-backed action the workspace owns, not the canvas)
  test.fixme('Delete key and a delete button both remove the selected machine', () => {})
})
