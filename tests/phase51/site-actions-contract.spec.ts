/**
 * Phase 51 -- SIT-03/SIT-04. Source-contract assertions for `src/actions/site.ts`
 * and `src/app/api/admin/site/generate/route.ts`.
 *
 * `actions` describe activated by Plan 51-03 Task 1.
 * `generate route + empty state` describe activated by Plan 51-03 Task 2.
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

const SITE_ACTIONS_PATH = 'src/actions/site.ts'
const GENERATE_ROUTE_PATH = 'src/app/api/admin/site/generate/route.ts'
const EMPTY_STATE_PATH = 'src/components/admin/site/SiteEmptyState.tsx'

const EXPECTED_EXPORTS = [
  'listSiteForOrg',
  'createSceneUploadUrl',
  'upsertSiteLayout',
  'upsertSiteMachine',
  'deleteSiteMachine',
  'setSopMachines',
  'listSopMachines',
  // Phase 54 (D-04): admin floor-health read, composed on top of listSiteForOrg.
  'listSiteHealthForOrg',
]

/** Splits the file into per-export bodies at each `export async function` boundary. */
function splitExports(src: string): Record<string, string> {
  const marker = /^export async function (\w+)/gm
  const hits: { name: string; index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = marker.exec(src))) {
    hits.push({ name: m[1], index: m.index })
  }
  const bodies: Record<string, string> = {}
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].index : src.length
    bodies[hits[i].name] = src.slice(hits[i].index, end)
  }
  return bodies
}

test.describe('actions', () => {
  test('every function in src/actions/site.ts opens with requireAdminContext()', () => {
    const src = read(SITE_ACTIONS_PATH)

    expect(src.trimStart().startsWith("'use server'")).toBe(true)

    const exportLines = src.split('\n').filter((l) => l.startsWith('export '))
    for (const line of exportLines) {
      expect(line.startsWith('export async function '), line).toBe(true)
    }

    const bodies = splitExports(src)
    for (const name of EXPECTED_EXPORTS) {
      expect(Object.keys(bodies), `${name} not exported`).toContain(name)
    }
    expect(Object.keys(bodies).sort()).toEqual([...EXPECTED_EXPORTS].sort())

    for (const [name, body] of Object.entries(bodies)) {
      const guardIndex = body.indexOf('requireAdminContext()')
      expect(guardIndex, `${name}: missing requireAdminContext()`).toBeGreaterThan(-1)
      const fromIndex = body.indexOf('.from(')
      const storageIndex = body.indexOf('.storage')
      if (fromIndex >= 0) expect(guardIndex, `${name}: requireAdminContext() must precede .from(`).toBeLessThan(fromIndex)
      if (storageIndex >= 0) expect(guardIndex, `${name}: requireAdminContext() must precede .storage`).toBeLessThan(storageIndex)
    }

    expect(src.includes('createAdminClient')).toBe(false)
  })

  test('setSopMachines org-filters both sopId and machineIds before writing (mirrors assignMemberDepartments, not assignSopDepartments)', () => {
    const src = read(SITE_ACTIONS_PATH)
    const body = splitExports(src)['setSopMachines']
    expect(body).toBeTruthy()

    const orgFilterIndex = body.indexOf(".eq('organisation_id'")
    const upsertIndex = body.indexOf('.upsert(')
    const deleteIndex = body.indexOf('.delete()')
    expect(orgFilterIndex).toBeGreaterThan(-1)
    expect(upsertIndex).toBeGreaterThan(-1)
    expect(deleteIndex).toBeGreaterThan(-1)
    expect(orgFilterIndex, 'org filter must precede the upsert').toBeLessThan(upsertIndex)
    expect(upsertIndex, 'insert-before-prune: upsert must precede delete').toBeLessThan(deleteIndex)
    expect(body.includes('ignoreDuplicates')).toBe(true)
    expect(body.includes(".not('machine_id'")).toBe(true)
  })

  test('createSiteMachine/updateSiteMachine/deleteSiteMachine use the session client (RLS-scoped), not the service-role client', () => {
    const src = read(SITE_ACTIONS_PATH)
    const bodies = splitExports(src)
    expect(bodies['upsertSiteMachine']).toBeTruthy()
    expect(bodies['deleteSiteMachine']).toBeTruthy()

    expect(bodies['upsertSiteMachine']).toContain('upsertSiteMachineSchema')
    expect(bodies['upsertSiteMachine']).toContain('polygonWithinScene(')
    expect(bodies['upsertSiteMachine']).toContain('newMachineCode(')
    expect(bodies['upsertSiteMachine']).toContain("from('departments')")

    expect(bodies['upsertSiteLayout']).toContain('sharp(')
    expect(bodies['upsertSiteLayout']).toContain('scenePath(')
    expect(bodies['upsertSiteLayout']).toContain('.remove(')

    expect(bodies['createSceneUploadUrl']).toContain('crypto.randomUUID()')
    expect(bodies['createSceneUploadUrl']).toContain('scenePath(')
    expect(bodies['createSceneUploadUrl']).toContain('createSignedUploadUrl(')

    // GEMINI_API_KEY appears exactly once in the whole file, and only as a boolean read.
    const geminiHits = src.match(/GEMINI_API_KEY/g) ?? []
    expect(geminiHits.length).toBe(1)
    expect(src).toContain('Boolean(process.env.GEMINI_API_KEY)')
  })
})

test.describe('generate route + empty state', () => {
  test('POST /api/admin/site/generate returns 503 (not a broken 200) when GEMINI_API_KEY is unset', () => {
    const src = read(GENERATE_ROUTE_PATH)
    expect(src).toContain('export async function POST')
    expect(src).toContain('export const maxDuration')

    const guardIndex = src.indexOf('requireAdminContext()')
    const keyIndex = src.indexOf('GEMINI_API_KEY')
    const fetchIndex = src.indexOf('fetch(')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(keyIndex).toBeGreaterThan(-1)
    expect(fetchIndex).toBeGreaterThan(-1)
    expect(guardIndex, 'requireAdminContext() must run before the env read').toBeLessThan(keyIndex)
    expect(keyIndex, 'the key must be checked before the paid fetch').toBeLessThan(fetchIndex)

    expect(src).toContain('status: 503')
    expect(src).toContain('status: 409')
    expect(src).toContain('x-goog-api-key')
    expect(src).toContain('generateSceneSchema')
    expect(src).toContain('AbortSignal.timeout(')
    expect(src).toContain('upsertSiteLayout(')
    expect(src.includes('?key=')).toBe(false)
  })

  test('the Generate control only renders when canGenerate (key present) is true; Upload always renders', () => {
    const src = read(EMPTY_STATE_PATH)
    expect(src.trimStart().startsWith("'use client'")).toBe(true)

    const gateIndex = src.indexOf('canGenerate &&')
    const genButtonIndex = src.indexOf('site-generate-button')
    const genDescIndex = src.indexOf('site-generate-description')
    expect(gateIndex).toBeGreaterThan(-1)
    expect(genButtonIndex).toBeGreaterThan(-1)
    expect(genDescIndex).toBeGreaterThan(-1)
    expect(gateIndex, 'the canGenerate gate must precede the generate controls').toBeLessThan(genButtonIndex)
    expect(gateIndex, 'the canGenerate gate must precede the generate controls').toBeLessThan(genDescIndex)

    expect(src).toContain('accept="image/jpeg,image/png"')
    expect(src).toContain('createSceneUploadUrl(')
    expect(src).toContain('uploadToSignedUrl(')
    expect(src).toContain('upsertSiteLayout(')
    expect(src).toContain('router.refresh()')
    expect(src).toContain('/api/admin/site/generate')
  })

  test('GEMINI_API_KEY is never included in any response body sent to the client', () => {
    const src = read(GENERATE_ROUTE_PATH)
    // No NextResponse.json( call's argument text may reference process.env —
    // scan each call's balanced-paren argument text.
    const callRegex = /NextResponse\.json\(/g
    let m: RegExpExecArray | null
    while ((m = callRegex.exec(src))) {
      let depth = 1
      let i = m.index + m[0].length
      const start = i
      while (i < src.length && depth > 0) {
        if (src[i] === '(') depth++
        else if (src[i] === ')') depth--
        i++
      }
      const argText = src.slice(start, i - 1)
      expect(argText.includes('process.env'), `NextResponse.json call at ${m.index} references process.env`).toBe(false)
    }
  })

  test('generateSceneSchema rejects a description under 20 chars and over 1200 chars before any fetch call', () => {
    const validatorSrc = read('src/lib/validators/site.ts')
    expect(validatorSrc).toContain('min(20)')
    expect(validatorSrc).toContain('max(1200)')

    const routeSrc = read(GENERATE_ROUTE_PATH)
    const parseIndex = routeSrc.indexOf('generateSceneSchema')
    const fetchIndex = routeSrc.indexOf('fetch(')
    expect(parseIndex).toBeGreaterThan(-1)
    expect(fetchIndex).toBeGreaterThan(-1)
    expect(parseIndex, 'schema validation must run before the paid fetch call').toBeLessThan(fetchIndex)
  })
})
