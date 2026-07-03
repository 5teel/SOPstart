/**
 * Phase 26 Plan 26-11 (R5, D-03 slice 2) — annotation tool-model, behavioural.
 *
 * Konva CANVAS rendering (draw feel, transform handles, palm-rejection) is
 * device-dependent and cannot be proven headless — that is the Task-3 human-verify
 * gate. What IS provable in-process is the PURE tool model that the Konva editor
 * drives: primitive factories, the scene-JSON shape, snapshot undo/redo, the
 * pointer-type palm-rejection filter, and DiagramHotspotBlock callout coordinate
 * stability across a serialize → re-open round-trip.
 *
 * Same in-process pattern as visual-block.spec (the phase26 project has NO `@/`
 * alias and can't load react-konva / React barrels): `annotation-tools.ts` is
 * deliberately PURE (no konva, no React) so it loads here directly. The Konva
 * leaf (`AnnotationEditor.tsx`, `DiagramHotspotBlock.tsx`) is proven Konva-isolated
 * by the sibling konva-worker-isolation spec, and eyeballed at the human gate.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  emptyScene,
  createArrow,
  createRect,
  createEllipse,
  createText,
  createCallout,
  createFreehand,
  addShape,
  initHistory,
  commitScene,
  undo,
  redo,
  serializeScene,
  deserializeScene,
  acceptsPointer,
  SEMANTIC_ACCENTS,
  type Scene,
} from '../../src/components/admin/builder-v2/visual/annotation-tools'

const ROOT = path.resolve(__dirname, '..', '..')

function sceneWithOneOfEach(): Scene {
  let scene = emptyScene(1600, 1200)
  scene = addShape(scene, createArrow({ points: [10, 10, 200, 200] }))
  scene = addShape(scene, createRect({ x: 20, y: 20, width: 100, height: 80 }))
  scene = addShape(scene, createEllipse({ x: 300, y: 200, radiusX: 60, radiusY: 40 }))
  scene = addShape(scene, createText({ x: 40, y: 50, text: 'Torque to 90 Nm' }))
  scene = addShape(scene, createCallout(scene, { x: 440, y: 290, label: 'Pressure gauge' }))
  scene = addShape(scene, createFreehand({ points: [0, 0, 5, 8, 12, 20] }))
  return scene
}

test.describe('annotation primitives — each tool appears in the scene JSON (R5)', () => {
  test('all six primitives create their Konva node type', () => {
    const scene = sceneWithOneOfEach()
    const types = scene.shapes.map((s) => s.type)
    expect(types).toEqual(['Arrow', 'Rect', 'Ellipse', 'Text', 'Label', 'Line'])
    // Every shape has a stable id (needed for select/transform + undo).
    expect(new Set(scene.shapes.map((s) => s.id)).size).toBe(6)
  })

  test('stroke colours default to the semantic accents, not arbitrary', () => {
    const arrow = createArrow({ points: [0, 0, 1, 1] })
    const warn = createRect({ x: 0, y: 0, width: 1, height: 1, accent: 'warning' })
    expect(arrow.stroke).toBe(SEMANTIC_ACCENTS.primary)
    expect(warn.stroke).toBe(SEMANTIC_ACCENTS.warning)
  })

  test('numbered callouts auto-increment their number', () => {
    let scene = emptyScene(800, 600)
    const c1 = createCallout(scene, { x: 10, y: 10, label: 'First' })
    scene = addShape(scene, c1)
    const c2 = createCallout(scene, { x: 20, y: 20, label: 'Second' })
    scene = addShape(scene, c2)
    expect(c1.number).toBe(1)
    expect(c2.number).toBe(2)
    // The rendered tag text carries the number.
    expect(c1.text.text).toContain('1')
    expect(c2.text.text).toContain('2')
  })
})

test.describe('undo / redo via scene-JSON snapshots', () => {
  test('undo removes the last shape; redo restores it', () => {
    let h = initHistory(emptyScene(800, 600))
    h = commitScene(h, addShape(h.present, createRect({ x: 0, y: 0, width: 10, height: 10 })))
    h = commitScene(h, addShape(h.present, createArrow({ points: [0, 0, 1, 1] })))
    expect(h.present.shapes.map((s) => s.type)).toEqual(['Rect', 'Arrow'])

    h = undo(h)
    expect(h.present.shapes.map((s) => s.type)).toEqual(['Rect'])

    h = redo(h)
    expect(h.present.shapes.map((s) => s.type)).toEqual(['Rect', 'Arrow'])
  })

  test('a new commit after undo clears the redo future', () => {
    let h = initHistory(emptyScene(800, 600))
    h = commitScene(h, addShape(h.present, createRect({ x: 0, y: 0, width: 10, height: 10 })))
    h = undo(h)
    expect(h.present.shapes).toHaveLength(0)
    h = commitScene(h, addShape(h.present, createEllipse({ x: 0, y: 0, radiusX: 5, radiusY: 5 })))
    // Redo is now dead — the future was branched away.
    const after = redo(h)
    expect(after.present.shapes.map((s) => s.type)).toEqual(['Ellipse'])
  })
})

test.describe('non-destructive serialize — image URL stays OUT of the scene', () => {
  test('serialized scene contains the shapes but no image reference', () => {
    const scene = sceneWithOneOfEach()
    const json = serializeScene(scene)
    // Round-trip: re-open the exact scene.
    const reopened = deserializeScene(json)
    expect(reopened.shapes.map((s) => s.type)).toEqual(scene.shapes.map((s) => s.type))
    // No image/src/url key anywhere — the background image is referenced OUTSIDE
    // the scene (Konva pitfall #8) and rehydrated at load time.
    expect(json).not.toMatch(/"(src|image|imageUrl|url|storage_path)"/i)
  })

  test('draw a rect → serialize → re-open → rect present (behavioural round-trip)', () => {
    let scene = emptyScene(1024, 768)
    scene = addShape(scene, createRect({ x: 100, y: 120, width: 260, height: 180 }))
    const reopened = deserializeScene(serializeScene(scene))
    const rect = reopened.shapes.find((s) => s.type === 'Rect')
    expect(rect).toBeTruthy()
    expect(rect).toMatchObject({ x: 100, y: 120, width: 260, height: 180 })
  })
})

test.describe('stylus palm rejection — pen-only filter', () => {
  test('pen-only rejects finger/mouse but accepts pen', () => {
    expect(acceptsPointer('pen', { penOnly: true })).toBe(true)
    expect(acceptsPointer('touch', { penOnly: true })).toBe(false)
    expect(acceptsPointer('mouse', { penOnly: true })).toBe(false)
  })

  test('pen-only OFF accepts every pointer type', () => {
    for (const t of ['pen', 'touch', 'mouse'] as const) {
      expect(acceptsPointer(t, { penOnly: false })).toBe(true)
    }
  })
})

test.describe('DiagramHotspotBlock — freeform numbered callouts in natural-image space', () => {
  test('two callouts persist their x/y + numbering across a serialize → re-open', () => {
    let scene = emptyScene(1600, 1200)
    const c1 = createCallout(scene, { x: 440, y: 290, label: 'Pressure gauge' })
    scene = addShape(scene, c1)
    const c2 = createCallout(scene, { x: 980, y: 610, label: 'Relief valve' })
    scene = addShape(scene, c2)

    // Re-open the persisted scene (the DiagramHotspotBlock reloads it by annotationId).
    const reopened = deserializeScene(serializeScene(scene))
    const labels = reopened.shapes.filter((s) => s.type === 'Label')
    expect(labels).toHaveLength(2)
    // Coordinate stability: natural-image-space x/y unchanged (pitfall #2).
    expect(labels[0]).toMatchObject({ x: 440, y: 290, number: 1 })
    expect(labels[1]).toMatchObject({ x: 980, y: 610, number: 2 })
  })

  test('DiagramHotspotBlock is Konva-backed and links its scene via annotationId (source-contract)', () => {
    const src = readFileSync(
      path.join(ROOT, 'src/components/admin/builder-v2/visual/DiagramHotspotBlock.tsx'),
      'utf8'
    )
    // The single freeform-positioning surface — placed callouts, natural-image space.
    expect(src).toContain('annotationId')
    expect(src).toContain('createCallout')
    // Reuses the shared editor scene model, not a bespoke one.
    expect(src).toContain('annotation-tools')
  })
})

test.describe('Konva leaf stays admin-only + isolated (source-contract)', () => {
  test('annotation-tools.ts is PURE — no konva / react import (loads in-process)', () => {
    const src = readFileSync(
      path.join(ROOT, 'src/components/admin/builder-v2/visual/annotation-tools.ts'),
      'utf8'
    )
    expect(src).not.toMatch(/from ['"]konva['"]/)
    expect(src).not.toMatch(/from ['"]react/)
  })

  test('AnnotationEditor drives the pure tools + tears the stage down (pitfall 5)', () => {
    const src = readFileSync(
      path.join(ROOT, 'src/components/admin/builder-v2/visual/AnnotationEditor.tsx'),
      'utf8'
    )
    expect(src).toContain('annotation-tools')
    expect(src).toMatch(/Transformer/)
    expect(src).toMatch(/\.destroy\(\)/)
    expect(src).toMatch(/pointerType/)
  })
})
