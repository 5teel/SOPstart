/**
 * Phase 15 / Wave 0 — Bundle-isolation CI gate.
 *
 * Runs after `next build` (wired via `postbuild` script in package.json).
 * Compares the current First Load JS for `/sops/[sopId]/page` against the
 * pre-Phase-15 baseline at `.bundle-baseline.json`. Fails the build if the
 * route grew by more than 2 KB (TOLERANCE_KB).
 *
 * Wave 4 additionally enforces that DesktopWalkthrough and
 * WalkthroughVoiceModal appear as separate dynamic chunks (proving the
 * code-split per Pitfall 5). Those assertions are gated on
 * `process.env.WAVE_4_GATE !== 'false'` AND on the presence of either
 * chunk in any manifest — during Wave 0..2 neither component exists yet,
 * so the chunk-existence assertions silently no-op. Once Wave 2 introduces
 * `next/dynamic` imports for these components the assertion auto-activates.
 *
 * Wave-0 carve-out summary (delete after Wave 4 ships):
 *   - delta check: ACTIVE (current build = baseline build → delta = 0)
 *   - DesktopWalkthrough chunk check: NO-OP until a chunk filename matches
 *   - WalkthroughVoiceModal chunk check: NO-OP until a chunk filename matches
 *
 * TODO(wave-4): tighten the chunk-existence assertions to hard-fail when
 * the components are expected to exist (gate on env or a manifest sentinel).
 *
 * Manifest sources (Next.js 16 + webpack):
 *   - `.next/build-manifest.json` → root shell chunks
 *   - `.next/server/app/(protected)/sops/[sopId]/page_client-reference-manifest.js`
 *     → per-route client chunks
 *   - (Turbopack only) `.next/app-build-manifest.json` keys routes directly
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const NEXT_DIR = path.join(ROOT, '.next')
const BUILD_MANIFEST = path.join(NEXT_DIR, 'build-manifest.json')
const APP_BUILD_MANIFEST = path.join(NEXT_DIR, 'app-build-manifest.json')
const BASELINE_FILE = path.join(ROOT, '.bundle-baseline.json')
const RSC_MANIFEST_PATH = path.join(
  NEXT_DIR,
  'server',
  'app',
  '(protected)',
  'sops',
  '[sopId]',
  'page_client-reference-manifest.js'
)
const ROUTE = '/sops/[sopId]/page'
const TOLERANCE_KB = 2

function fail(msg: string): never {
  console.error(`check-bundle-size: ❌ ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(BUILD_MANIFEST)) {
  fail(`missing ${BUILD_MANIFEST} — did \`next build\` run?`)
}
if (!fs.existsSync(BASELINE_FILE)) {
  fail(`missing ${BASELINE_FILE} — run \`npx tsx scripts/capture-bundle-baseline.ts\` first.`)
}

type BuildManifest = {
  polyfillFiles?: string[]
  rootMainFiles?: string[]
  pages?: Record<string, string[]>
}
type Baseline = { routes: Record<string, number> }

const buildManifest = JSON.parse(
  fs.readFileSync(BUILD_MANIFEST, 'utf-8')
) as BuildManifest
const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8')) as Baseline

const chunkSet = new Set<string>()
for (const f of buildManifest.rootMainFiles ?? []) chunkSet.add(f)
for (const f of buildManifest.polyfillFiles ?? []) chunkSet.add(f)

let foundRouteChunks = false
let appBuildManifestRaw = ''
if (fs.existsSync(APP_BUILD_MANIFEST)) {
  appBuildManifestRaw = fs.readFileSync(APP_BUILD_MANIFEST, 'utf-8')
  const appManifest = JSON.parse(appBuildManifestRaw) as {
    pages?: Record<string, string[]>
  }
  const chunks = appManifest.pages?.[ROUTE] ?? []
  if (chunks.length > 0) {
    for (const c of chunks) chunkSet.add(c)
    foundRouteChunks = true
  }
}

let rscManifestRaw = ''
if (!foundRouteChunks) {
  if (!fs.existsSync(RSC_MANIFEST_PATH)) {
    fail(
      `Neither ${APP_BUILD_MANIFEST} nor ${RSC_MANIFEST_PATH} present. Re-run \`npm run build\`.`
    )
  }
  rscManifestRaw = fs.readFileSync(RSC_MANIFEST_PATH, 'utf-8')
  const requireFromHere = createRequire(import.meta.url)
  ;(globalThis as unknown as { __RSC_MANIFEST: Record<string, unknown> }).__RSC_MANIFEST = {}
  requireFromHere(RSC_MANIFEST_PATH)
  const rsc = (globalThis as unknown as {
    __RSC_MANIFEST: Record<string, { clientModules?: Record<string, { chunks?: unknown[] }> }>
  }).__RSC_MANIFEST
  const routeKey = `/(protected)${ROUTE}`
  const routeManifest = rsc[routeKey] ?? rsc[ROUTE]
  if (!routeManifest) {
    fail(`RSC manifest missing route ${routeKey}.`)
  }
  const clientModules = routeManifest.clientModules ?? {}
  for (const moduleId of Object.keys(clientModules)) {
    const chunks = clientModules[moduleId].chunks ?? []
    for (let i = 0; i < chunks.length; i += 2) {
      const file = chunks[i + 1]
      if (typeof file === 'string') chunkSet.add(file)
    }
  }
}

let totalBytes = 0
for (const chunkPath of chunkSet) {
  const fullPath = path.join(NEXT_DIR, chunkPath)
  if (fs.existsSync(fullPath)) totalBytes += fs.statSync(fullPath).size
}

const currentKB = Math.round(totalBytes / 1024)
const baselineKB = baseline.routes[ROUTE]
if (typeof baselineKB !== 'number' || baselineKB <= 0) {
  fail(`baseline missing or invalid for route ${ROUTE}.`)
}
const deltaKB = currentKB - baselineKB
const sign = deltaKB > 0 ? '+' : ''

console.log(
  `check-bundle-size: ${ROUTE} = ${currentKB} KB (baseline ${baselineKB} KB, Δ ${sign}${deltaKB} KB, tolerance ±${TOLERANCE_KB} KB)`
)

if (deltaKB > TOLERANCE_KB) {
  console.error(
    `check-bundle-size: ❌ Bundle bloat: ${ROUTE} grew by ${deltaKB} KB (tolerance ${TOLERANCE_KB} KB).`
  )
  console.error(`  Chunks counted (${chunkSet.size}):`)
  for (const c of [...chunkSet].slice(0, 25)) console.error(`    - ${c}`)
  process.exit(1)
}

// Chunk-existence assertions (Wave 4). Auto-active when matching chunk names
// appear; no-op during Wave 0..2.
const wave4Active = process.env.WAVE_4_GATE !== 'false'
const haystack = appBuildManifestRaw + '\n' + rscManifestRaw + '\n' + JSON.stringify(buildManifest)
const desktopChunkPresent = haystack.includes('DesktopWalkthrough')
const voiceChunkPresent = haystack.includes('WalkthroughVoiceModal')

// Wave-0 carve-out: if NEITHER chunk has appeared yet AND delta ≤ 0, skip the
// chunk assertions silently. They auto-fire once Wave 2 emits the chunks.
const waveZeroCarveOut = !desktopChunkPresent && !voiceChunkPresent && deltaKB <= 0

if (wave4Active && !waveZeroCarveOut) {
  if (!desktopChunkPresent) {
    console.error(
      'check-bundle-size: ❌ DesktopWalkthrough chunk not found — was the component statically imported instead of via next/dynamic()?'
    )
    process.exit(1)
  }
  if (!voiceChunkPresent) {
    console.error(
      'check-bundle-size: ❌ WalkthroughVoiceModal chunk not found — was the component statically imported instead of via next/dynamic()?'
    )
    process.exit(1)
  }
}

console.log('check-bundle-size: ✓ Bundle isolation OK')
