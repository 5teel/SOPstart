/**
 * Phase 15 / Wave 0 — Capture pre-Phase-15 First Load JS baseline.
 * Phase 41 / Plan 41-01 — generalised to a route array (see
 * scripts/check-bundle-size.ts header for why: SB-LINE-06 now gates BOTH
 * `/sops/[sopId]/page` and `/sops/page`).
 *
 * Reads Next.js 16 webpack build artifacts, sums the client chunk byte
 * sizes for each route in GATED_ROUTES, and MERGES the results into
 * `.bundle-baseline.json` at the repo root — a re-capture of one route
 * must never delete another route's already-committed floor.
 *
 * The baseline is committed to git so it cannot drift mid-phase.
 * `scripts/check-bundle-size.ts` compares post-build size against this
 * baseline with a 2-KB tolerance, per route.
 *
 * Usage (after `npm run build`):
 *   npx tsx scripts/capture-bundle-baseline.ts               # capture all routes
 *   npx tsx scripts/capture-bundle-baseline.ts --route=/sops/page   # capture one
 *
 * Acceptance: `.bundle-baseline.json` contains a positive integer KB value
 * under `routes[<route>]` for every captured route.
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

type GatedRoute = { route: string; rscManifestPath: string }

// Kept in sync with scripts/check-bundle-size.ts's GATED_ROUTES (the gate
// script owns the forbidden-marker lists; this script only needs route +
// manifest path to compute a KB total).
const GATED_ROUTES: GatedRoute[] = [
  {
    route: '/sops/[sopId]/page',
    rscManifestPath: path.join(
      NEXT_DIR, 'server', 'app', '(protected)', 'sops', '[sopId]',
      'page_client-reference-manifest.js'
    ),
  },
  {
    route: '/sops/page',
    rscManifestPath: path.join(
      NEXT_DIR, 'server', 'app', '(protected)', 'sops', 'page_client-reference-manifest.js'
    ),
  },
]

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
  fail(`missing ${BUILD_MANIFEST}. Run \`npm run build\` first so Next.js emits the manifest.`)
}

const buildManifest = JSON.parse(fs.readFileSync(BUILD_MANIFEST, 'utf-8')) as BuildManifest

const sharedChunks = new Set<string>()
for (const f of buildManifest.rootMainFiles ?? []) sharedChunks.add(f)
for (const f of buildManifest.polyfillFiles ?? []) sharedChunks.add(f)

let appBuildManifest: { pages?: Record<string, string[]> } | null = null
if (fs.existsSync(APP_BUILD_MANIFEST)) {
  appBuildManifest = JSON.parse(fs.readFileSync(APP_BUILD_MANIFEST, 'utf-8'))
}

function computeKB(entry: GatedRoute): number {
  const chunkSet = new Set(sharedChunks)
  const appChunks = appBuildManifest?.pages?.[entry.route] ?? []
  if (appChunks.length > 0) {
    for (const c of appChunks) chunkSet.add(c)
  } else {
    if (!fs.existsSync(entry.rscManifestPath)) {
      fail(
        `Neither ${APP_BUILD_MANIFEST} nor ${entry.rscManifestPath} present for route ${entry.route}. Run \`npm run build\` against the current branch.`
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
      fail(
        `RSC manifest did not contain route ${routeKey}. Keys present: ${Object.keys(rsc).slice(0, 10).join(', ')}`
      )
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

  if (chunkSet.size === 0) {
    fail(`No chunks resolved for route ${entry.route}.`)
  }

  let totalBytes = 0
  for (const chunkPath of chunkSet) {
    const fullPath = path.join(NEXT_DIR, chunkPath)
    if (fs.existsSync(fullPath)) totalBytes += fs.statSync(fullPath).size
  }
  const totalKB = Math.round(totalBytes / 1024)
  if (totalKB <= 0) {
    fail(`Computed baseline is ${totalKB} KB for route ${entry.route} — refusing to write a useless baseline.`)
  }
  return totalKB
}

const routeArg = process.argv.find((a) => a.startsWith('--route='))
const onlyRoute = routeArg ? routeArg.slice('--route='.length) : undefined
const targets = onlyRoute ? GATED_ROUTES.filter((r) => r.route === onlyRoute) : GATED_ROUTES
if (onlyRoute && targets.length === 0) {
  fail(`--route=${onlyRoute} does not match any entry in GATED_ROUTES.`)
}

// Read the existing baseline so a partial (or full) re-capture MERGES into
// it rather than replacing it — capturing /sops/page must not delete the
// /sops/[sopId]/page floor, and vice versa.
type PriorBaseline = {
  capturedAt?: string
  note?: string
  routes?: Record<string, number>
}
let priorRoutes: Record<string, number> = {}
let priorFile: PriorBaseline | undefined
if (fs.existsSync(BASELINE_FILE)) {
  try {
    priorFile = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8')) as PriorBaseline
    priorRoutes = { ...(priorFile.routes ?? {}) }
  } catch {
    // Corrupt/absent prior baseline — capture fresh, no history.
  }
}

const previousBaselineHistory: Record<string, { value: number; capturedAt?: string; note?: string }> = {}
const mergedRoutes: Record<string, number> = { ...priorRoutes }

for (const entry of targets) {
  const totalKB = computeKB(entry)
  const priorValue = priorRoutes[entry.route]
  if (typeof priorValue === 'number') {
    previousBaselineHistory[entry.route] = {
      value: priorValue,
      capturedAt: priorFile?.capturedAt,
      note: priorFile?.note,
    }
  }
  mergedRoutes[entry.route] = totalKB
  console.log(`Baseline captured: ${entry.route} = ${totalKB} KB`)
}

const payload = {
  capturedAt: new Date().toISOString(),
  note:
    'First Load JS baseline for the SB-LINE-06 gated routes. Postbuild check-bundle-size enforces ≤ +2KB delta per route. DO NOT edit by hand — regenerate via scripts/capture-bundle-baseline.ts after intentional baseline shifts.',
  ...(Object.keys(previousBaselineHistory).length > 0
    ? { previousBaseline: previousBaselineHistory }
    : {}),
  routes: mergedRoutes,
}

fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
console.log(`Wrote ${BASELINE_FILE}`)
