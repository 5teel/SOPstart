/**
 * Phase 63 (FUSE-01) -- the Start merge, the small half. Plain client-safe module, no directive.
 *
 * The animation itself is fuse-engine.ts, a lazy module reached only through the
 * dynamic import below (it keeps the merge out of both gated bundles). The engine
 * draws into the empty #fuse-layer element the root layout always keeps, so it
 * survives the route change that happens mid-animation (no View Transitions, R9).
 */
import type { QueryClient } from '@tanstack/react-query'

export interface FuseInput {
  chip: DOMRect
  label: DOMRect
  button: DOMRect
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

/**
 * Resolves when no query or mutation is in flight, or after maxMs. The start click never
 * runs a server action itself; if one is already in flight the push waits for it so the
 * Next 16.2.1 action queue cannot orphan the navigation (CLAUDE.md 2026-09-29).
 */
export function whenQueriesIdle(qc: QueryClient, maxMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const idle = () => qc.isFetching() === 0 && qc.isMutating() === 0
    if (idle()) return resolve()
    let timer: ReturnType<typeof setTimeout> | undefined
    const stops: Array<() => void> = []
    const finish = () => {
      clearTimeout(timer)
      stops.forEach((stop) => stop())
      resolve()
    }
    const check = () => idle() && finish()
    stops.push(qc.getQueryCache().subscribe(check), qc.getMutationCache().subscribe(check))
    timer = setTimeout(finish, maxMs)
  })
}

/** Warm the engine chunk while Read is open so the first tap does not wait for it. */
export function prefetchFuse(): void {
  void import('./fuse-engine').catch(() => undefined)
}

let playing = false

/**
 * Starts the merge. Resolves when the screen has faded to paper (the first stage is over), which is the
 * moment to navigate: pushing earlier swaps Read for the next page's loading skeleton while it is still
 * half visible. Always resolves: on an engine failure at once, and after COVER_MAX_MS whatever happens,
 * so a slow chunk can never strand the start.
 */
export function playFuse(input: FuseInput): Promise<void> {
  return new Promise((resolve) => {
    if (playing) return resolve()
    playing = true
    const guard = setTimeout(resolve, COVER_MAX_MS)
    void import('./fuse-engine')
      .then((m) => m.run(input, resolve))
      .catch(() => undefined)
      .finally(() => {
        playing = false
        clearTimeout(guard)
        resolve()
      })
  })
}
