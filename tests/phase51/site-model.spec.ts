/**
 * Phase 51 -- Wave-0 site model contract (SIT-01..04). TDD RED->GREEN target
 * for Plan 51-01 Task 3: pure Zod validators (`src/lib/validators/site.ts`)
 * and pure scene helpers (`src/lib/site/scene.ts`).
 *
 * Static @/ imports only (CLAUDE.md 2026-06-24: dynamic import('@/...') fails
 * in Playwright's Node runner).
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test, expect } from '@playwright/test'
import {
  polygonSchema,
  upsertSiteMachineSchema,
  upsertSiteLayoutSchema,
} from '@/lib/validators/site'
import {
  scenePath,
  newMachineCode,
  MACHINE_CODE_PATTERN,
  polygonWithinScene,
  clampPoint,
  centroid,
  fitView,
  zoomAt,
  buildScenePrompt,
  buildGeminiImageRequest,
  extractGeminiImage,
  geminiEndpoint,
} from '@/lib/site/scene'

test.describe('polygonSchema', () => {
  test('accepts a simple triangle', () => {
    expect(polygonSchema.safeParse([[0, 0], [10, 0], [10, 10]]).success).toBe(true)
  })

  test('accepts a concave 6-point L-shape', () => {
    const lShape = [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]]
    expect(polygonSchema.safeParse(lShape).success).toBe(true)
  })

  test('rejects fewer than 3 points', () => {
    expect(polygonSchema.safeParse([[0, 0], [10, 0]]).success).toBe(false)
  })

  test('rejects a negative coordinate', () => {
    expect(polygonSchema.safeParse([[-1, 0], [10, 0], [10, 10]]).success).toBe(false)
  })

  test('rejects NaN', () => {
    expect(polygonSchema.safeParse([[NaN, 0], [10, 0], [10, 10]]).success).toBe(false)
  })

  test('rejects Infinity', () => {
    expect(polygonSchema.safeParse([[Infinity, 0], [10, 0], [10, 10]]).success).toBe(false)
  })

  test('rejects 201 points', () => {
    const many = Array.from({ length: 201 }, (_, i) => [i, i])
    expect(polygonSchema.safeParse(many).success).toBe(false)
  })
})

test.describe('upsertSiteMachineSchema', () => {
  const base = {
    siteLayoutId: '00000000-0000-0000-0000-000000000001',
    departmentId: null,
    polygon: [[0, 0], [10, 0], [10, 10]],
  }

  test('rejects empty name', () => {
    expect(upsertSiteMachineSchema.safeParse({ ...base, name: '' }).success).toBe(false)
  })

  test('rejects an 81-char name', () => {
    expect(upsertSiteMachineSchema.safeParse({ ...base, name: 'a'.repeat(81) }).success).toBe(false)
  })

  test('accepts departmentId null', () => {
    const result = upsertSiteMachineSchema.safeParse({ ...base, name: 'Furnace 1', departmentId: null })
    expect(result.success).toBe(true)
  })

  test('id is optional', () => {
    const result = upsertSiteMachineSchema.safeParse({ ...base, name: 'Furnace 1' })
    expect(result.success).toBe(true)
  })
})

test.describe('scenePath / upsertSiteLayoutSchema', () => {
  test("scenePath('org', 'lay', 'png') === 'org/lay/scene.png'", () => {
    expect(scenePath('org', 'lay', 'png')).toBe('org/lay/scene.png')
  })

  test("upsertSiteLayoutSchema rejects ext 'gif'", () => {
    const result = upsertSiteLayoutSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000001',
      ext: 'gif',
    })
    expect(result.success).toBe(false)
  })
})

test.describe('newMachineCode', () => {
  test('is 6 chars and matches MACHINE_CODE_PATTERN', () => {
    const code = newMachineCode()
    expect(code).toHaveLength(6)
    expect(MACHINE_CODE_PATTERN.test(code)).toBe(true)
  })

  test('2000 calls produce >= 1990 distinct codes', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => newMachineCode()))
    expect(codes.size).toBeGreaterThanOrEqual(1990)
  })
})

test.describe('polygonWithinScene', () => {
  test('true inside [0,w]x[0,h] (edges inclusive)', () => {
    expect(polygonWithinScene([[0, 0], [1600, 0], [1600, 900], [0, 900]], 1600, 900)).toBe(true)
  })

  test('false when any vertex exceeds w', () => {
    expect(polygonWithinScene([[0, 0], [1601, 0], [1600, 900]], 1600, 900)).toBe(false)
  })

  test('false when any vertex exceeds h', () => {
    expect(polygonWithinScene([[0, 0], [1600, 0], [1600, 901]], 1600, 900)).toBe(false)
  })
})

test.describe('clampPoint', () => {
  test('rounds to integers and clamps into the scene', () => {
    expect(clampPoint([-3.6, 950.4], 1600, 900)).toEqual([0, 900])
  })
})

test.describe('centroid', () => {
  test('centroid of a square is its centre', () => {
    expect(centroid([[0, 0], [2, 0], [2, 2], [0, 2]])).toEqual([1, 1])
  })
})

test.describe('fitView', () => {
  test('returns null for a 0x0 stage (pitfall)', () => {
    expect(fitView(0, 500, 1600, 900)).toBeNull()
  })

  test('fits and centres an 800x450 viewport around a 1600x900 scene', () => {
    const view = fitView(800, 450, 1600, 900)
    expect(view).not.toBeNull()
    expect(view!.s).toBeCloseTo(0.51, 5)
    const expectedX = (800 - 1600 * view!.s) / 2
    const expectedY = (450 - 900 * view!.s) / 2
    expect(Math.abs(view!.x - expectedX)).toBeLessThanOrEqual(1)
    expect(Math.abs(view!.y - expectedY)).toBeLessThanOrEqual(1)
  })
})

test.describe('zoomAt', () => {
  test('keeps the scene point under the pointer fixed', () => {
    const view = { x: 0, y: 0, s: 1 }
    const pointer = { x: 100, y: 100 }
    const before = { x: (pointer.x - view.x) / view.s, y: (pointer.y - view.y) / view.s }
    const next = zoomAt(view, pointer, -1, 0.1, 4)
    const after = { x: (pointer.x - next.x) / next.s, y: (pointer.y - next.y) / next.s }
    expect(Math.abs(after.x - before.x)).toBeLessThan(1e-6)
    expect(Math.abs(after.y - before.y)).toBeLessThan(1e-6)
  })

  test('clamps scale to [min, max]', () => {
    const view = { x: 0, y: 0, s: 1 }
    const pointer = { x: 0, y: 0 }
    const zoomedIn = zoomAt(view, pointer, -1000, 0.5, 1.05)
    expect(zoomedIn.s).toBeLessThanOrEqual(1.05)
    const zoomedOut = zoomAt(view, pointer, 1000, 0.5, 1.05)
    expect(zoomedOut.s).toBeGreaterThanOrEqual(0.5)
  })
})

test.describe('buildScenePrompt', () => {
  test('contains style tokens, the trimmed description, and never the {industry} placeholder', () => {
    const prompt = buildScenePrompt('  A glass plant: furnace left, two forming machines ...  ')
    expect(prompt).toContain('isometric')
    expect(prompt).toContain('#fafafa')
    expect(prompt).toContain('No people, no text, no labels, no logos')
    expect(prompt).toContain('A glass plant: furnace left, two forming machines ...')
    expect(prompt).not.toContain('{industry}')
  })
})

test.describe('buildGeminiImageRequest', () => {
  test('builds the expected request shape', () => {
    const req = buildGeminiImageRequest('a prompt')
    expect(req.contents[0].parts[0].text).toBe('a prompt')
    expect(req.generationConfig.responseModalities).toEqual(['IMAGE'])
    expect(req.generationConfig.imageConfig.aspectRatio).toBe('16:9')
    expect(req.generationConfig.imageConfig.imageSize).toBe('2K')
  })
})

test.describe('extractGeminiImage', () => {
  test('extracts camelCase inlineData', () => {
    const json = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'abc123' } }] } }] }
    expect(extractGeminiImage(json)).toEqual({ mimeType: 'image/png', data: 'abc123' })
  })

  test('extracts snake_case inline_data', () => {
    const json = { candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'abc123' } }] } }] }
    expect(extractGeminiImage(json)).toEqual({ mimeType: 'image/png', data: 'abc123' })
  })

  test('returns null for a text-only response', () => {
    const json = { candidates: [{ content: { parts: [{ text: 'no image here' }] } }] }
    expect(extractGeminiImage(json)).toBeNull()
  })

  test('returns null for an empty object', () => {
    expect(extractGeminiImage({})).toBeNull()
  })
})

test.describe('geminiEndpoint', () => {
  test('builds the generateContent URL', () => {
    expect(geminiEndpoint('m')).toBe('https://generativelanguage.googleapis.com/v1beta/models/m:generateContent')
  })
})
