/**
 * Phase 15 / Wave 0 — Capture pre-Phase-15 First Load JS baseline.
 *
 * One-shot script that reads Next.js 16 webpack build artifacts, sums the
 * client chunk byte sizes for the `/sops/[sopId]/page` route, and writes
 * the result to `.bundle-baseline.json` at the repo root.
 *
 * The baseline is committed to git so it cannot drift mid-phase. Wave 4's
 * `scripts/check-bundle-size.ts` compares post-build size against this
 * baseline with a 2-KB tolerance, enforcing SB-LINE-06 (bundle isolation
 * on the mobile worker route).
 *
 * Manifest sources (Next.js 16 + webpack):
 *   - `.next/build-manifest.json` → `rootMainFiles` + `polyfillFiles` (shared shell)
 *   - `.next/server/app/(protected)/sops/[sopId]/page_client-reference-manifest.js`
 *     → per-route `clientModules` chunks (loaded by the RSC payload)
 *
 * NOTE: Turbopack emits `app-build-manifest.json` directly; the legacy webpack
 * builder used by this project (`next build --webpack`) does NOT. We derive
 * the equivalent chunk list from the RSC client-reference-manifest instead.
 *
 * Usage (after `npm run build`):
 *   npx tsx scripts/capture-bundle-baseline.ts
 *
 * Acceptance: `.bundle-baseline.json` contains a positive integer KB value
 * under `routes['/sops/[sopId]/page']`, captured before any Phase 15
 * source file is modified.
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
const ROUTE = '/sops/[sopId]/page'
const RSC_MANIFEST_PATH = path.join(
  NEXT_DIR,
  'server',
  'app',
  '(protected)',
  'sops',
  '[sopId]',
  'page_client-reference-manifest.js'
)
const BASELINE_FILE = path.join(ROOT, '.bundle-baseline.json')

function fail(msg: string): never {
  console.error(`capture-bundle-baseline: ${msg}`)
  process.exit(1)
}

type BuildManifest = {
  polyfillFiles?: string[]
  rootMainFiles?: string[]
  pages?: Record<string, string[]>
}

if (!fs.existsSync(BUILD_MANIFEST)) {
  fail(
    `missing ${BUILD_MANIFEST}. Run \`npm run build\` first so Next.js emits the manifest.`
  )
}

const buildManifest = JSON.parse(
  fs.readFileSync(BUILD_MANIFEST, 'utf-8')
) as BuildManifest

const chunkSet = new Set<string>()

// Shared shell chunks every route loads.
for (const f of buildManifest.rootMainFiles ?? []) chunkSet.add(f)
for (const f of buildManifest.polyfillFiles ?? []) chunkSet.add(f)

// Turbopack path: app-build-manifest.json keys routes directly.
let foundRouteChunks = false
if (fs.existsSync(APP_BUILD_MANIFEST)) {
  const appManifest = JSON.parse(
    fs.readFileSync(APP_BUILD_MANIFEST, 'utf-8')
  ) as { pages?: Record<string, string[]> }
  const chunks = appManifest.pages?.[ROUTE] ?? []
  if (chunks.length > 0) {
    for (const c of chunks) chunkSet.add(c)
    foundRouteChunks = true
  }
}

// Webpack path: derive per-route chunks from the RSC client-reference-manifest.
if (!foundRouteChunks) {
  if (!fs.existsSync(RSC_MANIFEST_PATH)) {
    fail(
      `Neither ${APP_BUILD_MANIFEST} nor ${RSC_MANIFEST_PATH} present. Run \`npm run build\` against the current branch.`
    )
  }
  const requireFromHere = createRequire(import.meta.url)
  ;(globalThis as unknown as { __RSC_MANIFEST: Record<string, unknown> }).__RSC_MANIFEST = {}
  // Evaluate the side-effect-only manifest file (sets globalThis.__RSC_MANIFEST).
  requireFromHere(RSC_MANIFEST_PATH)
  const rsc = (globalThis as unknown as { __RSC_MANIFEST: Record<string, { clientModules?: Record<string, { chunks?: unknown[] }> }> }).__RSC_MANIFEST
  const routeKey = `/(protected)${ROUTE}`
  const routeManifest = rsc[routeKey] ?? rsc[ROUTE]
  if (!routeManifest) {
    fail(
      `RSC manifest did not contain route ${routeKey}. Keys present: ${Object.keys(rsc).slice(0, 10).join(', ')}`
    )
  }
  const clientModules = routeManifest.clientModules ?? {}
  for (const moduleId of Object.keys(clientModules)) {
    const chunks = clientModules[moduleId].chunks ?? []
    // Chunks are flat [id, file, id, file, ...] pairs in the RSC manifest.
    for (let i = 0; i < chunks.length; i += 2) {
      const file = chunks[i + 1]
      if (typeof file === 'string') chunkSet.add(file)
    }
  }
}

if (chunkSet.size === 0) {
  fail(`No chunks resolved for route ${ROUTE}.`)
}

let totalBytes = 0
const resolved: string[] = []
for (const chunkPath of chunkSet) {
  const fullPath = path.join(NEXT_DIR, chunkPath)
  if (fs.existsSync(fullPath)) {
    totalBytes += fs.statSync(fullPath).size
    resolved.push(chunkPath)
  }
}

const totalKB = Math.round(totalBytes / 1024)
if (totalKB <= 0) {
  fail(`Computed baseline is ${totalKB} KB — refusing to write a useless baseline.`)
}

const payload = {
  capturedAt: new Date().toISOString(),
  note:
    'Pre-Phase-15 First Load JS baseline for the mobile worker route. Wave 4 enforces ≤ +2KB delta. DO NOT edit by hand — regenerate via scripts/capture-bundle-baseline.ts after intentional baseline shifts.',
  routes: {
    [ROUTE]: totalKB,
  },
  chunkCount: resolved.length,
}

fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf-8')

console.log(`Baseline captured: ${ROUTE} = ${totalKB} KB (${resolved.length} chunks)`)
console.log(`Wrote ${BASELINE_FILE}`)
