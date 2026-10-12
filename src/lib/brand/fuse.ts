/**
 * Phase 63 (FUSE-01), ADR-0012 -- the start merge, the small half. Plain client-safe module, no directive.
 *
 * The animation itself is fuse-engine.ts, a lazy module reached only through the
 * dynamic import below (it keeps the merge out of the gated bundles). The engine
 * draws into the empty #fuse-layer element the root layout always keeps, over the
 * SOP's pane; the run opens underneath it on the same page.
 */

export interface FuseInput {
  chip: DOMRect
  label: DOMRect
  button: DOMRect
  /** The SOP's pane: the merge plays centred in it (ADR-0012). */
  pane: DOMRect
  mode: 'short' | 'full'
  factor: number
}

const DAY_KEY = 'sopstart-fuse-day'
const SLOW_KEY = 'sopstart-fuse-slow'
const COVER_MAX_MS = 3000

/** off = no animation (reduced motion), full = first start of the day, short = every other. */
export function motionMode(): 'off' | 'short' | 'full' {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off'
    const today = new Date().toDateString()
    if (window.localStorage.getItem(DAY_KEY) === today) return 'short'
    window.localStorage.setItem(DAY_KEY, today)
  } catch {
    /* storage blocked: play in full */
  }
  return 'full'
}

/** Judging aid: ?fuse=slow on the page the person lands on slows the merge x4 for this tab. Not shipped UI. */
export function captureSlowFlag(): void {
  try {
    if (new URLSearchParams(window.location.search).get('fuse') === 'slow') window.sessionStorage.setItem(SLOW_KEY, '1')
  } catch {
    /* storage blocked */
  }
}

export function slowFactor(): number {
  try {
    return window.sessionStorage.getItem(SLOW_KEY) === '1' ? 4 : 1
  } catch {
    return 1
  }
}

/** Warm the engine chunk while Read is open so the first tap does not wait for it. */
export function prefetchFuse(): void {
  void import('./fuse-engine').catch(() => undefined)
}

let playing = false

/**
 * Plays the merge and calls `onCovered` once the pane is paper (the moment to open the run
 * underneath). Resolves when the merge is over. `onCovered` always runs exactly once: at once
 * on an engine failure, and after COVER_MAX_MS whatever happens, so a slow chunk can never
 * strand the start.
 */
export function playFuse(input: FuseInput, onCovered: () => Promise<void>): Promise<void> {
  let once: Promise<void> | null = null
  const cover = () => (once ??= onCovered())
  if (playing) return cover()
  playing = true
  const guard = setTimeout(cover, COVER_MAX_MS)
  return import('./fuse-engine')
    .then((m) => m.run(input, cover))
    .catch(() => undefined)
    .then(() => cover())
    .finally(() => {
      playing = false
      clearTimeout(guard)
    })
}
