/**
 * Phase 15 / Wave 4 — Bundle-isolation CI gate (LIVE / hard-fail mode).
 *
 * Runs after `next build` (wired via `postbuild` script in package.json).
 *
 * Two enforced contracts:
 *
 *   1. **Delta gate.** First Load JS for `/sops/[sopId]/page` must stay
 *      within `baseline + TOLERANCE_KB` of `.bundle-baseline.json`. The
 *      baseline was re-captured at the end of Wave 2 to absorb the
 *      one-time +7 KB cost of splitting MobileWalkthrough out of
 *      WalkthroughTab and adding the WalkthroughVoiceButton static
 *      import; from this baseline forward, any further drift is a
 *      regression that must be investigated.
 *
 *   2. **Chunk-existence gate.** `DesktopWalkthrough` AND
 *      `WalkthroughVoiceModal` MUST appear as separate dynamic chunks
 *      somewhere in the build manifests. If either is missing, that
 *      means a static `import { X }` snuck in somewhere outside
 *      WalkthroughSwitcher.tsx — which would have hard-blown the mobile
 *      First Load JS. This gate is the second line of defence after the
 *      Wave-0 lint guard (`tests/lint/no-static-desktop-import.spec.ts`).
 *
 * Both gates HARD-FAIL the build on violation — no carve-outs, no env
 * toggles. The Wave-0 carve-out is gone as of Wave 4.
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

// ---------------------------------------------------------------------------
// Chunk-existence assertions (Wave 4 — LIVE, no carve-out).
//
// Both DesktopWalkthrough and WalkthroughVoiceModal must exist as their
// own dynamic chunks. If either is absent, somebody statically imported
// them outside of WalkthroughSwitcher.tsx — which silently inflates the
// mobile First Load JS even if delta hasn't tripped yet.
//
// We look in three places:
//   1. The route's page server bundle (.next/server/app/.../page.js) —
//      this contains the dynamic-import call sites pointing at the
//      chunk filenames.
//   2. The middleware-react-loadable-manifest.js — the canonical record
//      of `next/dynamic` chunk mappings.
//   3. The chunk file contents themselves in .next/static/chunks/*.js
//      (last-resort scan; the component name appears in the minified
//      output via React's debug names).
// ---------------------------------------------------------------------------
function findSymbolInBuildOutput(symbol: string): { found: boolean; locations: string[] } {
  const locations: string[] = []

  // 1. Server page bundle for the route — references the dynamic-import path.
  const pageBundle = path.join(
    NEXT_DIR,
    'server',
    'app',
    '(protected)',
    'sops',
    '[sopId]',
    'page.js',
  )
  if (fs.existsSync(pageBundle)) {
    const body = fs.readFileSync(pageBundle, 'utf-8')
    if (body.includes(symbol)) locations.push(pageBundle)
  }

  // 2. React-loadable manifest — canonical next/dynamic registry.
  const loadableManifest = path.join(
    NEXT_DIR,
    'server',
    'middleware-react-loadable-manifest.js',
  )
  if (fs.existsSync(loadableManifest)) {
    const body = fs.readFileSync(loadableManifest, 'utf-8')
    if (body.includes(symbol)) locations.push(loadableManifest)
  }

  // 3. Static client chunks under .next/static/chunks (top-level, no recursion
  //    into subdirectories — those are route bundles, not dynamic chunks).
  const staticChunksDir = path.join(NEXT_DIR, 'static', 'chunks')
  if (fs.existsSync(staticChunksDir)) {
    for (const entry of fs.readdirSync(staticChunksDir)) {
      const full = path.join(staticChunksDir, entry)
      const stat = fs.statSync(full)
      if (!stat.isFile() || !entry.endsWith('.js')) continue
      // Skip the polyfills + webpack runtime + main-app + framework chunks
      // explicitly — they always exist and would false-positive a substring scan.
      if (
        entry.startsWith('webpack-') ||
        entry.startsWith('polyfills-') ||
        entry.startsWith('main-app-') ||
        entry.startsWith('framework-')
      ) {
        continue
      }
      // Only read files smaller than 2 MB to keep this gate fast.
      if (stat.size > 2 * 1024 * 1024) continue
      const body = fs.readFileSync(full, 'utf-8')
      if (body.includes(symbol)) {
        locations.push(full)
        // We only need one positive proof per symbol.
        break
      }
    }
  }

  return { found: locations.length > 0, locations }
}

const desktopFound = findSymbolInBuildOutput('DesktopWalkthrough')
const voiceFound = findSymbolInBuildOutput('WalkthroughVoiceModal')

if (!desktopFound.found) {
  fail(
    'DesktopWalkthrough chunk not found in any build manifest or chunk — was the component statically imported instead of via next/dynamic({ ssr: false })?'
  )
}
if (!voiceFound.found) {
  fail(
    'WalkthroughVoiceModal chunk not found in any build manifest or chunk — was the component statically imported instead of via next/dynamic({ ssr: false })?'
  )
}

// ---------------------------------------------------------------------------
// Phase 21 Plan 21-02 — pdfjs / mammoth must NOT ship in the worker
// `/sops/[sopId]/page` bundle. Both are heavy (pdfjs ~ 300 KB minified)
// and only the admin source viewer (BuilderStageShell → ReviewStation →
// SourceViewerPane) needs them. The source-viewer chain is admin-route-only
// so pdfjs / mammoth must never reach the worker route — verify that
// boundary by scanning the worker route's chunk set.
//
// The negative assertion checks the SAME chunkSet that drove the size
// gate above, so if pdfjs ever leaks in, both the delta gate AND this
// gate should trip — but this one gives a clearer error message.
// ---------------------------------------------------------------------------
function workerChunkBodies(): string {
  const bodies: string[] = []
  for (const chunkPath of chunkSet) {
    const fullPath = path.join(NEXT_DIR, chunkPath)
    if (!fs.existsSync(fullPath)) continue
    const stat = fs.statSync(fullPath)
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024) continue
    bodies.push(fs.readFileSync(fullPath, 'utf-8'))
  }
  return bodies.join('\n')
}

const workerJoined = workerChunkBodies()
const PDFJS_MARKERS = ['pdfjs-dist', 'PDFWorker', 'getDocument']
const pdfjsLeaks = PDFJS_MARKERS.filter((m) => workerJoined.includes(m))
if (pdfjsLeaks.length > 0) {
  fail(
    `pdfjs-dist leaked into worker bundle ${ROUTE} (markers: ${pdfjsLeaks.join(', ')}). ` +
      'SourceViewerPane MUST stay on the admin builder chain (BuilderStageShell → ReviewStation) ' +
      '(D-21-09). Check for accidental `import { SourceViewerPane }` on a worker-side route.'
  )
}
const MAMMOTH_MARKERS = ['mammoth', 'convertToHtml']
const mammothLeaks = MAMMOTH_MARKERS.filter((m) => workerJoined.includes(m))
if (mammothLeaks.length > 0) {
  fail(
    `mammoth leaked into worker bundle ${ROUTE} (markers: ${mammothLeaks.join(', ')}). ` +
      'DocxPreview MUST be reached only through the dynamic-imported SourceViewerPane.'
  )
}

// ---------------------------------------------------------------------------
// Phase 26 Plan 26-05 (D-03 / R8) — konva / react-konva must NOT ship in the
// worker `/sops/[sopId]/page` bundle. The Konva annotation editor is admin-only
// and reached exclusively through AnnotationEditorLoader (dynamic ssr:false).
// A static `import ... from 'react-konva'` anywhere on the worker path would
// pull the whole canvas engine into every worker's First Load JS.
//
// Same negative-assertion shape as the pdfjs/mammoth gates above: scan the
// SAME worker chunkSet that drove the size gate. `konva` is not an English word
// so a substring hit is a genuine leak, not a false positive.
// ---------------------------------------------------------------------------
const KONVA_MARKERS = ['react-konva', 'konva']
const konvaLeaks = KONVA_MARKERS.filter((m) => workerJoined.includes(m))
if (konvaLeaks.length > 0) {
  fail(
    `konva leaked into worker bundle ${ROUTE} (markers: ${konvaLeaks.join(', ')}). ` +
      'AnnotationEditor MUST be reached only through AnnotationEditorLoader ' +
      '(dynamic({ ssr: false })) from admin builder-v2 (D-03). Check for an ' +
      "accidental static `import ... from 'react-konva'` or a direct AnnotationEditor import."
  )
}

console.log(
  `check-bundle-size: ✓ Bundle isolation OK (chunks present, delta within tolerance) — DesktopWalkthrough at ${desktopFound.locations[0]}, WalkthroughVoiceModal at ${voiceFound.locations[0]}`
)
console.log(
  `check-bundle-size: ✓ Source-viewer isolation OK — pdfjs + mammoth not in ${ROUTE} bundle (D-21-09).`
)
console.log(
  `check-bundle-size: ✓ Konva isolation OK — konva + react-konva not in ${ROUTE} bundle (26-05 D-03).`
)
