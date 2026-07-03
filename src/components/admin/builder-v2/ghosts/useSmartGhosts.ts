'use client'

/**
 * Phase 26 (R4) — smart-next predictions with auto-dismissing ghosts.
 *
 * Ported behaviour-for-behaviour from `sketches/sop-builder-redesign/index.html`
 * (`injectGhosts` / `refreshGhosts` / the input + scroll handlers). Split into a
 * PURE state-machine (`computeGhosts` / `resolveGhostVisibility` /
 * `ghostsGoneOnTyping`, no React, no `@/` runtime imports — only `import type`)
 * so the 5-scenario matrix is unit-testable exactly like `inserter-model.ts`,
 * plus a thin `useSmartGhosts` hook that wires the model to the live DOM via
 * rAF-throttled `classList` toggles on refs.
 *
 * PERFORMANCE RULE (RESEARCH Pattern 4): the document NEVER re-renders on
 * scroll. Ghost live/dim/gone is applied by toggling utility classes on ref'd
 * DOM nodes inside a `requestAnimationFrame` — no React state on the scroll path
 * (this hook holds no React render-state). Hydration-clean: no window/navigator at
 * module load or in render; all DOM access is inside effects (client-only).
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { SMART } from '../inserter/inserter-model'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import type { BlockType } from '@/lib/builder/block-registry'

/** A predicted ghost after block `afterIndex` — the predicted type + its "why". */
export interface GhostSpec {
  afterIndex: number
  type: BlockType
  label: string
  why: string
}

/** Viewport-relative geometry of a mounted ghost (from getBoundingClientRect). */
export interface GhostRect {
  bottom: number
  center: number
}

export type GhostVis = 'live' | 'dim' | 'gone'

/**
 * Where do ghosts go? After block `i` iff `SMART[type(i)]` is defined AND the
 * next block is NOT already the predicted type (self-suppress when redundant).
 */
export function computeGhosts(types: (BlockType | null | undefined)[]): GhostSpec[] {
  const out: GhostSpec[] = []
  for (let i = 0; i < types.length; i++) {
    const t = types[i]
    if (!t) continue
    const pred = SMART[t]
    if (!pred) continue
    if (types[i + 1] === pred.type) continue // predicted block already follows → stay quiet
    out.push({ afterIndex: i, type: pred.type, label: humanizeBlockType(pred.type), why: pred.why })
  }
  return out
}

/**
 * Given the mounted ghosts' rects, the persisted `gone` set, the viewport centre
 * and an optionally-hovered ghost, decide each ghost's visibility. Mirrors the
 * sketch's `refreshGhosts`: bottom < 64 → gone permanently; the ghost nearest the
 * viewport centre (or the hovered one) is live; every other is dim.
 */
export function resolveGhostVisibility(
  ghosts: { afterIndex: number }[],
  rects: Record<number, GhostRect>,
  gone: ReadonlySet<number>,
  viewportCenter: number,
  hovered: number | null
): { vis: Record<number, GhostVis>; newlyGone: number[]; liveIndex: number | null } {
  const vis: Record<number, GhostVis> = {}
  const newlyGone: number[] = []

  // Pass 1 — carry forward permanently-gone; mark scrolled-past as gone.
  const candidates: number[] = []
  for (const g of ghosts) {
    const i = g.afterIndex
    if (gone.has(i)) {
      vis[i] = 'gone'
      continue
    }
    const r = rects[i]
    if (r && r.bottom < 64) {
      vis[i] = 'gone'
      newlyGone.push(i)
      continue
    }
    candidates.push(i)
  }

  // Pass 2 — pick the live ghost: hovered wins, else nearest viewport centre.
  let liveIndex: number | null = null
  if (hovered != null && candidates.includes(hovered)) {
    liveIndex = hovered
  } else {
    let best = Infinity
    for (const i of candidates) {
      const r = rects[i]
      const d = r ? Math.abs(r.center - viewportCenter) : Infinity
      if (d < best) {
        best = d
        liveIndex = i
      }
    }
  }

  for (const i of candidates) vis[i] = i === liveIndex ? 'live' : 'dim'
  return { vis, newlyGone, liveIndex }
}

/**
 * Typing inside block `typedIndex` gones every ghost EXCEPT the one immediately
 * after that block. Returns the afterIndexes to mark gone.
 */
export function ghostsGoneOnTyping(ghosts: { afterIndex: number }[], typedIndex: number): number[] {
  return ghosts.filter((g) => g.afterIndex !== typedIndex).map((g) => g.afterIndex)
}

const DIM = 'opacity-30'
const GONE = 'hidden'

export interface SmartGhostsApi {
  ghosts: GhostSpec[]
  registerRef: (afterIndex: number) => (el: HTMLElement | null) => void
  onGhostEnter: (afterIndex: number) => void
  onGhostLeave: (afterIndex: number) => void
  onGhostClick: (afterIndex: number) => void
}

/**
 * Wire the pure ghost model to the live DOM. Recomputes ghost positions only
 * when the block-type sequence changes; applies live/dim/gone via rAF-throttled
 * `classList` toggles on refs. Tab accepts the live ghost (inert while `disabled`
 * — e.g. the inserter menu is open — so it never collides with menu keyboard
 * nav). Typing in a block gones sibling ghosts; scroll-past gones for good.
 */
export function useSmartGhosts(
  types: (BlockType | null | undefined)[],
  onAccept: (afterIndex: number, type: BlockType) => void,
  opts: { disabled?: boolean } = {}
): SmartGhostsApi {
  // Recompute only when the type sequence actually changes (not every render).
  const typeKey = types.join('|')
  const ghosts = useMemo(() => computeGhosts(types), [typeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refs = useRef<Map<number, HTMLElement>>(new Map())
  const goneRef = useRef<Set<number>>(new Set())
  const hoveredRef = useRef<number | null>(null)
  const liveRef = useRef<number | null>(null)
  const rafRef = useRef(0)

  // Keep the latest accept handler + ghost list addressable from stable listeners.
  const onAcceptRef = useRef(onAccept)
  onAcceptRef.current = onAccept
  const ghostsRef = useRef<GhostSpec[]>(ghosts)
  ghostsRef.current = ghosts
  const disabledRef = useRef(!!opts.disabled)
  disabledRef.current = !!opts.disabled

  // Ghost identities changed (insert/delete/reorder) → reset the gone/live state.
  const ghostKey = ghosts.map((g) => g.afterIndex).join(',')
  useEffect(() => {
    goneRef.current = new Set()
    hoveredRef.current = null
    liveRef.current = null
  }, [ghostKey])

  const refresh = useCallback(() => {
    const gs = ghostsRef.current
    if (!gs.length) {
      liveRef.current = null
      return
    }
    const rects: Record<number, GhostRect> = {}
    for (const g of gs) {
      const el = refs.current.get(g.afterIndex)
      if (!el) continue
      const r = el.getBoundingClientRect()
      rects[g.afterIndex] = { bottom: r.bottom, center: (r.top + r.bottom) / 2 }
    }
    const { vis, newlyGone, liveIndex } = resolveGhostVisibility(
      gs,
      rects,
      goneRef.current,
      window.innerHeight * 0.5,
      hoveredRef.current
    )
    for (const i of newlyGone) goneRef.current.add(i)
    liveRef.current = liveIndex
    for (const g of gs) {
      const el = refs.current.get(g.afterIndex)
      if (!el) continue
      const v = vis[g.afterIndex]
      el.classList.toggle(GONE, v === 'gone')
      el.classList.toggle(DIM, v === 'dim')
    }
  }, [])

  // rAF-throttled scroll + Tab-accept + typing-dismiss listeners (client-only).
  useEffect(() => {
    refresh()
    const onScroll = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        refresh()
      })
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || disabledRef.current) return
      const live = liveRef.current
      if (live == null || goneRef.current.has(live)) return
      const g = ghostsRef.current.find((x) => x.afterIndex === live)
      if (!g) return
      e.preventDefault()
      onAcceptRef.current(g.afterIndex, g.type)
    }
    const onInput = (e: Event) => {
      const target = e.target as HTMLElement | null
      const blk = target?.closest?.('[data-block-index]') as HTMLElement | null
      if (!blk) return
      const typedIndex = Number(blk.dataset.blockIndex)
      if (Number.isNaN(typedIndex)) return
      for (const i of ghostsGoneOnTyping(ghostsRef.current, typedIndex)) goneRef.current.add(i)
      refresh()
    }
    // capture:true — catch scroll on nested overflow containers too (sketch parity).
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('input', onInput, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('input', onInput, true)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [refresh, ghostKey])

  const registerRef = useCallback(
    (afterIndex: number) => (el: HTMLElement | null) => {
      if (el) refs.current.set(afterIndex, el)
      else refs.current.delete(afterIndex)
    },
    []
  )

  const onGhostEnter = useCallback(
    (afterIndex: number) => {
      hoveredRef.current = afterIndex
      refresh()
    },
    [refresh]
  )
  const onGhostLeave = useCallback(
    (afterIndex: number) => {
      if (hoveredRef.current === afterIndex) hoveredRef.current = null
      refresh()
    },
    [refresh]
  )
  const onGhostClick = useCallback(
    (afterIndex: number) => {
      const g = ghostsRef.current.find((x) => x.afterIndex === afterIndex)
      if (g) onAcceptRef.current(g.afterIndex, g.type)
    },
    []
  )

  return { ghosts, registerRef, onGhostEnter, onGhostLeave, onGhostClick }
}
