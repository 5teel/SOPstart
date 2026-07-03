/**
 * Phase 26 Plan 26-13 (D-03, R8) — PURE baked-PNG storage-path helpers.
 *
 * Lives OUTSIDE the `'use server'` annotations action on purpose: a 'use server'
 * module may export ONLY async functions — a sync helper there breaks `next build`
 * with "Server Actions must be async functions" (CLAUDE.md 2026-06-27). Being pure
 * (no imports) it also loads in-process in the phase26 Playwright project, which
 * has no `@/` alias.
 *
 * The baked PNG path is CONTENT-VERSIONED (`.v{N}.png`) so a re-published edit
 * gets a brand-new URL and never serves a stale CDN/service-worker copy
 * (v3.0 research §Bake-on-publish).
 */

/** `baked/{sopId}/{imageId}.v{N}.png` — org/sop-scoped, versioned. */
export function bakedStoragePath(sopId: string, imageId: string, version: number): string {
  return `baked/${sopId}/${imageId}.v${version}.png`
}

/** Next version off the current baked path (`.v{N}.png` → N+1; null/none → 1). */
export function nextBakedVersion(currentPath: string | null | undefined): number {
  const m = /\.v(\d+)\.png$/.exec(currentPath ?? '')
  return m ? parseInt(m[1], 10) + 1 : 1
}
