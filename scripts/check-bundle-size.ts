/**
 * Phase 15 / Wave 4 — Bundle-isolation CI gate (LIVE / hard-fail mode).
 * Phase 41 / Plan 41-01 — generalised to a route array (SB-LINE-06 gated
 * BOTH `/sops/[sopId]/page` and the list page; see Pitfall 1 in
 * 41-RESEARCH.md — the single-route hardcode would have stayed green
 * after the surface merge). Phase 57-08 retired the list page: the gate now
 * covers `/sops/[sopId]/page` and `/page` (the one screen) only.
 *
 * Runs after `next build` (wired via `postbuild` script in package.json).
 *
 * Phase 57 / Plan 57-04 — a third route, `/page` (the one screen at `/`).
 * It is recorded in the baseline by hand, once, as a decision artefact, AFTER
 * the lazy admin seam exists (so the admin plan changes only the lazy chunk,
 * never the baseline). It forbids the admin site editor, konva, pdfjs and
 * mammoth. A missing baseline still fails the build, but the measured size is
 * printed first so it can be recorded by hand.
 *
 * Enforced contracts, per entry in GATED_ROUTES:
 *
 *   1. **Delta gate.** First Load JS for the route must stay within
 *      `baseline + TOLERANCE_KB` of `.bundle-baseline.json`.
 *
 *   2. **Forbidden-marker gate.** None of the route's `forbiddenMarkers`
 *      string literals may appear in that route's own chunk set.
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

// Phase 41 note: forbidden markers are STRING LITERALS taken
// verbatim from the source components, not component/identifier names —
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
      { label: 'one screen machine body (MachineBody)', markers: ['No procedures for this machine yet.'] },
    ],
  },
  {
    // Phase 57: the one screen. The Next.js app-router key for src/app/page.tsx.
    route: '/page',
    rscManifestPath: path.join(NEXT_DIR, 'server', 'app', 'page_client-reference-manifest.js'),
    pageBundlePath: path.join(NEXT_DIR, 'server', 'app', 'page.js'),
    forbiddenMarkers: [
      { label: 'pdfjs-dist (D-21-09)', markers: ['pdfjs-dist', 'PDFWorker', 'getDocument'] },
      { label: 'mammoth (D-21-09)', markers: ['mammoth', 'convertToHtml'] },
      { label: 'konva (57 D-03)', markers: ['react-konva', 'konva'] },
      {
        label: 'site editor (SiteWorkspace.tsx -- admin module must stay lazy)',
        markers: ['Draw machine'],
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
  const routeDir = path
    .relative(path.join(NEXT_DIR, 'server', 'app'), path.dirname(entry.rscManifestPath))
    .split(path.sep)
    .filter(Boolean)
  const excluded: string[] = []
  for (const moduleId of Object.keys(clientModules)) {
    const chunks = clientModules[moduleId].chunks ?? []
    for (let i = 0; i < chunks.length; i += 2) {
      const file = chunks[i + 1]
      if (typeof file !== 'string') continue
      if (ownsSegmentChunk(file, routeDir)) chunkSet.add(file)
      else if (!excluded.includes(file)) excluded.push(file)
    }
  }
  if (excluded.length > 0) {
    console.log(
      `check-bundle-size: ${entry.route} not charged for ${excluded.length} other-route segment chunk(s): ${excluded.join(', ')}`
    )
  }
  return chunkSet
}

// Phase 57-04: a route's client-reference manifest lists the client modules of
// EVERY route in the app (57 entries, identical for /, /sops, /sops/[sopId]),
// each with its chunks. Summing them all charged a route for sibling routes'
// own segment chunks (the new root `app/page-*.js`, `app/(auth)/layout-*.js`),
// moving /sops by +4 KB when only a new route was added. Segment chunks under
// static/chunks/app/<dir>/ belong to a route only when <dir> is the route's
// own dir or an ancestor. The ROOT `page-*` is never an ancestor's page. A
// non-root ancestor page stays charged on purpose (the list page that once
// made this matter is gone in 57-08, the rule is kept for any future one). Shared numbered
// chunks are still counted: the manifest cannot say who loads them.
function ownsSegmentChunk(file: string, routeDir: string[]): boolean {
  const m = /^static\/chunks\/app\/(.+)\/([^/]+)$/.exec(file) ?? /^static\/chunks\/app\/()([^/]+)$/.exec(file)
  if (!m) return true
  const dir = m[1].split('/').filter(Boolean).map(decodeURIComponent)
  const isPage = m[2].startsWith('page-')
  if (dir.length > routeDir.length || (isPage && dir.length === 0 && routeDir.length > 0)) return false
  return dir.every((seg, i) => seg === routeDir[i])
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
    console.error(`check-bundle-size: measured ${entry.route} = ${currentKB} KB (no baseline recorded yet).`)
    fail(
      `baseline missing or invalid for route ${entry.route}. Record the measured value by hand in .bundle-baseline.json (routes + history) as a decision artefact; never re-capture it.`
    )
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
// Phase 58-11: the Route-A positive assertion ("DesktopWalkthrough must exist
// as its own lazy chunk") is retired. The SOP route is now the server-resolved
// focus screen and mounts no old walkthrough, so that chunk is no longer in the
// build -- and its absence from the route is exactly what the marker gate above
// proves. 58-13 adds the lazy FocusEditor seam and its own positive marker.
// ---------------------------------------------------------------------------
const routeA = GATED_ROUTES[0]

console.log('check-bundle-size: ✓ Bundle isolation OK (delta within tolerance, no forbidden marker in a gated route)')
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

  function walkDir(dir: string, maxBytes: number) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walkDir(full, maxBytes)
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const stat = fs.statSync(full)
        if (stat.size > maxBytes) continue
        bodies.push(fs.readFileSync(full, 'utf-8'))
      }
    }
  }

  // Phase 54: walked RECURSIVELY (not a flat readdir) so route-level chunks
  // — e.g. /governance's, which now carries GovernanceQueueRow's
  // 'Owner role gone' literal now that the old admin-attention lens is gone
  // from /sops — still count as "somewhere in the build". A flat scan would
  // miss any chunk Next.js nests under a route subdirectory.
  walkDir(path.join(NEXT_DIR, 'static', 'chunks'), 2 * 1024 * 1024)

  for (const entry of GATED_ROUTES) {
    if (fs.existsSync(entry.pageBundlePath)) {
      bodies.push(fs.readFileSync(entry.pageBundlePath, 'utf-8'))
    }
  }

  walkDir(path.join(NEXT_DIR, 'server', 'app', '(protected)', 'admin', 'sops'), 4 * 1024 * 1024)
  walkDir(path.join(NEXT_DIR, 'server', 'app', '(protected)', 'governance'), 4 * 1024 * 1024)

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
