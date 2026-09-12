/**
 * Phase 15 / Wave 4 — Bundle-isolation CI gate (LIVE / hard-fail mode).
 * Phase 41 / Plan 41-01 — generalised to a route array (SB-LINE-06 now
 * gates BOTH `/sops/[sopId]/page` and `/sops/page`; see Pitfall 1 in
 * 41-RESEARCH.md — the single-route hardcode would have stayed green
 * after the surface merge while proving nothing about the list route).
 *
 * Runs after `next build` (wired via `postbuild` script in package.json).
 *
 * Enforced contracts, per entry in GATED_ROUTES:
 *
 *   1. **Delta gate.** First Load JS for the route must stay within
 *      `baseline + TOLERANCE_KB` of `.bundle-baseline.json`.
 *
 *   2. **Forbidden-marker gate.** None of the route's `forbiddenMarkers`
 *      string literals may appear in that route's own chunk set. Route A
 *      additionally keeps its two POSITIVE chunk-existence assertions
 *      (`DesktopWalkthrough`, `WalkthroughVoiceModal` must exist somewhere
 *      in the build) — that check is scoped to route A only.
 *
 *   3. **Marker self-validation (new in 41-01).** Every forbidden marker,
 *      across every route, must be found SOMEWHERE in the overall build
 *      output (static chunks + all gated routes' server page bundles +
 *      the admin/sops server tree). A marker absent from the entire build
 *      means the literal was renamed or typo'd — the absence assertion
 *      would otherwise pass vacuously (CLAUDE.md 2026-05-25 / 2026-06-05
 *      vacuous-guard class) while proving nothing about the leak it
 *      claims to guard.
 *
 * Both gates HARD-FAIL the build on violation — no carve-outs, no env
 * toggles.
 *
 * Manifest sources (Next.js 16 + webpack):
 *   - `.next/build-manifest.json` → root shell chunks
 *   - `.next/server/app/(protected)/<route>/page_client-reference-manifest.js`
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
const TOLERANCE_KB = 2

type ForbiddenMarkerGroup = { label: string; markers: string[] }
type GatedRoute = {
  route: string
  rscManifestPath: string
  pageBundlePath: string
  forbiddenMarkers: ForbiddenMarkerGroup[]
}

// Phase 41 note: `/sops/page`'s forbidden markers are STRING LITERALS taken
// verbatim from the admin lens components, not component/identifier names —
// production minification renames identifiers but preserves string literals.
const GATED_ROUTES: GatedRoute[] = [
  {
    route: '/sops/[sopId]/page',
    rscManifestPath: path.join(
      NEXT_DIR, 'server', 'app', '(protected)', 'sops', '[sopId]',
      'page_client-reference-manifest.js'
    ),
    pageBundlePath: path.join(
      NEXT_DIR, 'server', 'app', '(protected)', 'sops', '[sopId]', 'page.js'
    ),
    forbiddenMarkers: [
      { label: 'pdfjs-dist (D-21-09)', markers: ['pdfjs-dist', 'PDFWorker', 'getDocument'] },
      { label: 'mammoth (D-21-09)', markers: ['mammoth', 'convertToHtml'] },
      { label: 'konva (26-05 D-03)', markers: ['react-konva', 'konva'] },
    ],
  },
  {
    route: '/sops/page',
    rscManifestPath: path.join(
      NEXT_DIR, 'server', 'app', '(protected)', 'sops', 'page_client-reference-manifest.js'
    ),
    pageBundlePath: path.join(NEXT_DIR, 'server', 'app', '(protected)', 'sops', 'page.js'),
    forbiddenMarkers: [
      {
        label: 'status lens (SopMillerBrowser.tsx)',
        markers: ['Pick another scope on the left.', 'Pick a SOP to see its detail here.'],
      },
      {
        label: 'governance/attention lens (GovernanceQueueRow.tsx)',
        markers: ['Owner role gone'],
      },
      {
        label: 'access lens (WiringPatchBay.tsx)',
        markers: ['Search org or collections…', 'follows collection'],
      },
    ],
  },
]

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

const buildManifest = JSON.parse(fs.readFileSync(BUILD_MANIFEST, 'utf-8')) as BuildManifest
const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8')) as Baseline

const sharedChunks = new Set<string>()
for (const f of buildManifest.rootMainFiles ?? []) sharedChunks.add(f)
for (const f of buildManifest.polyfillFiles ?? []) sharedChunks.add(f)

let appBuildManifest: { pages?: Record<string, string[]> } | null = null
if (fs.existsSync(APP_BUILD_MANIFEST)) {
  appBuildManifest = JSON.parse(fs.readFileSync(APP_BUILD_MANIFEST, 'utf-8'))
}

function resolveChunkSet(entry: GatedRoute): Set<string> {
  const chunkSet = new Set(sharedChunks)
  const appChunks = appBuildManifest?.pages?.[entry.route] ?? []
  if (appChunks.length > 0) {
    for (const c of appChunks) chunkSet.add(c)
    return chunkSet
  }
  if (!fs.existsSync(entry.rscManifestPath)) {
    fail(
      `Neither ${APP_BUILD_MANIFEST} nor ${entry.rscManifestPath} present for route ${entry.route}. Re-run \`npm run build\`.`
    )
  }
  const requireFromHere = createRequire(import.meta.url)
  ;(globalThis as unknown as { __RSC_MANIFEST: Record<string, unknown> }).__RSC_MANIFEST = {}
  requireFromHere(entry.rscManifestPath)
  const rsc = (globalThis as unknown as {
    __RSC_MANIFEST: Record<string, { clientModules?: Record<string, { chunks?: unknown[] }> }>
  }).__RSC_MANIFEST
  const routeKey = `/(protected)${entry.route}`
  const routeManifest = rsc[routeKey] ?? rsc[entry.route]
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
  return chunkSet
}

function chunkBodies(chunkSet: Set<string>): string {
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

// ---------------------------------------------------------------------------
// Per-route delta gate + forbidden-marker gate.
// ---------------------------------------------------------------------------
const routeChunkSets = new Map<string, Set<string>>()

for (const entry of GATED_ROUTES) {
  const chunkSet = resolveChunkSet(entry)
  routeChunkSets.set(entry.route, chunkSet)

  let totalBytes = 0
  for (const chunkPath of chunkSet) {
    const fullPath = path.join(NEXT_DIR, chunkPath)
    if (fs.existsSync(fullPath)) totalBytes += fs.statSync(fullPath).size
  }
  const currentKB = Math.round(totalBytes / 1024)
  const baselineKB = baseline.routes[entry.route]
  if (typeof baselineKB !== 'number' || baselineKB <= 0) {
    fail(`baseline missing or invalid for route ${entry.route}.`)
  }
  const deltaKB = currentKB - baselineKB
  const sign = deltaKB > 0 ? '+' : ''

  console.log(
    `check-bundle-size: ${entry.route} = ${currentKB} KB (baseline ${baselineKB} KB, Δ ${sign}${deltaKB} KB, tolerance ±${TOLERANCE_KB} KB)`
  )

  if (deltaKB > TOLERANCE_KB) {
    console.error(
      `check-bundle-size: ❌ Bundle bloat: ${entry.route} grew by ${deltaKB} KB (tolerance ${TOLERANCE_KB} KB).`
    )
    console.error(`  Chunks counted (${chunkSet.size}):`)
    for (const c of [...chunkSet].slice(0, 25)) console.error(`    - ${c}`)
    process.exit(1)
  }

  const joined = chunkBodies(chunkSet)
  for (const group of entry.forbiddenMarkers) {
    const leaks = group.markers.filter((m) => joined.includes(m))
    if (leaks.length > 0) {
      fail(
        `${group.label} leaked into bundle ${entry.route} (markers: ${leaks.join(', ')}). ` +
          'This code must be reached only through a next/dynamic({ ssr: false }) boundary.'
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Route-A-only positive chunk-existence assertions (Wave 4 — LIVE, no
// carve-out). Both DesktopWalkthrough and WalkthroughVoiceModal must exist
// as their own dynamic chunks somewhere in the build. If either is absent,
// somebody statically imported them outside of WalkthroughSwitcher.tsx —
// which would silently inflate the mobile First Load JS even if delta
// hasn't tripped yet.
// ---------------------------------------------------------------------------
function findSymbolInBuildOutput(symbol: string, pageBundlePath: string): { found: boolean; locations: string[] } {
  const locations: string[] = []

  if (fs.existsSync(pageBundlePath)) {
    const body = fs.readFileSync(pageBundlePath, 'utf-8')
    if (body.includes(symbol)) locations.push(pageBundlePath)
  }

  const loadableManifest = path.join(NEXT_DIR, 'server', 'middleware-react-loadable-manifest.js')
  if (fs.existsSync(loadableManifest)) {
    const body = fs.readFileSync(loadableManifest, 'utf-8')
    if (body.includes(symbol)) locations.push(loadableManifest)
  }

  const staticChunksDir = path.join(NEXT_DIR, 'static', 'chunks')
  if (fs.existsSync(staticChunksDir)) {
    for (const entry of fs.readdirSync(staticChunksDir)) {
      const full = path.join(staticChunksDir, entry)
      const stat = fs.statSync(full)
      if (!stat.isFile() || !entry.endsWith('.js')) continue
      if (
        entry.startsWith('webpack-') ||
        entry.startsWith('polyfills-') ||
        entry.startsWith('main-app-') ||
        entry.startsWith('framework-')
      ) {
        continue
      }
      if (stat.size > 2 * 1024 * 1024) continue
      const body = fs.readFileSync(full, 'utf-8')
      if (body.includes(symbol)) {
        locations.push(full)
        break
      }
    }
  }

  return { found: locations.length > 0, locations }
}

const routeA = GATED_ROUTES[0]
const desktopFound = findSymbolInBuildOutput('DesktopWalkthrough', routeA.pageBundlePath)
const voiceFound = findSymbolInBuildOutput('WalkthroughVoiceModal', routeA.pageBundlePath)

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

console.log(
  `check-bundle-size: ✓ Bundle isolation OK (chunks present, delta within tolerance) — DesktopWalkthrough at ${desktopFound.locations[0]}, WalkthroughVoiceModal at ${voiceFound.locations[0]}`
)
console.log(
  `check-bundle-size: ✓ Source-viewer isolation OK — pdfjs + mammoth not in ${routeA.route} bundle (D-21-09).`
)
console.log(
  `check-bundle-size: ✓ Konva isolation OK — konva + react-konva not in ${routeA.route} bundle (26-05 D-03).`
)

// ---------------------------------------------------------------------------
// Marker self-validation (Phase 41 / 41-01) — every forbidden marker, across
// every gated route, must appear SOMEWHERE in the overall build output.
// Scanned surfaces: .next/static/chunks/*.js, every gated route's own server
// page bundle, and the admin/sops server tree (where the admin lens source
// literals are expected to still live post-merge). A marker absent from all
// of these means the literal was renamed or typo'd — the per-route absence
// check above would otherwise pass vacuously.
// ---------------------------------------------------------------------------
function collectSelfValidationCorpus(): string {
  const bodies: string[] = []

  const staticChunksDir = path.join(NEXT_DIR, 'static', 'chunks')
  if (fs.existsSync(staticChunksDir)) {
    for (const entry of fs.readdirSync(staticChunksDir)) {
      const full = path.join(staticChunksDir, entry)
      const stat = fs.statSync(full)
      if (!stat.isFile() || !entry.endsWith('.js')) continue
      if (stat.size > 2 * 1024 * 1024) continue
      bodies.push(fs.readFileSync(full, 'utf-8'))
    }
  }

  for (const entry of GATED_ROUTES) {
    if (fs.existsSync(entry.pageBundlePath)) {
      bodies.push(fs.readFileSync(entry.pageBundlePath, 'utf-8'))
    }
  }

  const adminSopsDir = path.join(NEXT_DIR, 'server', 'app', '(protected)', 'admin', 'sops')
  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walkDir(full)
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const stat = fs.statSync(full)
        if (stat.size > 4 * 1024 * 1024) continue
        bodies.push(fs.readFileSync(full, 'utf-8'))
      }
    }
  }
  walkDir(adminSopsDir)

  return bodies.join('\n')
}

const selfValidationCorpus = collectSelfValidationCorpus()
for (const entry of GATED_ROUTES) {
  for (const group of entry.forbiddenMarkers) {
    for (const marker of group.markers) {
      if (!selfValidationCorpus.includes(marker)) {
        fail(
          `forbidden marker "${marker}" not present anywhere in the build — the absence assertion for ${entry.route} would pass vacuously. Re-derive the marker from the lens source.`
        )
      }
    }
  }
}

console.log('check-bundle-size: ✓ Marker self-validation OK — every forbidden marker is present somewhere in the build.')
