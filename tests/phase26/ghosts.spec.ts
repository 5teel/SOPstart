/**
 * Phase 26 Plan 26-10 (R4) — smart-next predictions with auto-dismissing ghosts.
 *
 * Behavioural proof against the PURE ghost state-machine (`computeGhosts` /
 * `resolveGhostVisibility` / `ghostsGoneOnTyping`) — the same functions the
 * `useSmartGhosts` React hook drives via rAF + ref class-toggles. This is the
 * established phase26 pattern (pure model, Node-run, no `@/` alias): the model
 * carries every rule so the 5-scenario sketch matrix is provable without a DOM.
 *
 * The 5 scenarios (from sketches/sop-builder-redesign/index.html
 * injectGhosts/refreshGhosts):
 *   (a) appears for confident predictions,
 *   (b) self-suppresses when the predicted block already follows,
 *   (c) exactly one "live" ghost (nearest viewport centre); others dim,
 *   (d) scrolled-past (bottom < 64) → gone permanently,
 *   (e) typing inside a block gones every ghost except the one right after it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import {
  computeGhosts,
  resolveGhostVisibility,
  ghostsGoneOnTyping,
} from '../../src/components/admin/builder-v2/ghosts/useSmartGhosts'
import { SMART } from '../../src/components/admin/builder-v2/inserter/inserter-model'

test.describe('smart ghosts — prediction + self-suppress (scenarios a, b)', () => {
  test('(a) a ghost appears after a Hazard block, predicting PPE from the SMART map', () => {
    const ghosts = computeGhosts(['HazardCardBlock'])
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]).toMatchObject({ afterIndex: 0, type: 'PPECardBlock' })
    // Prediction source is the shared SMART map (one source with the inserter row).
    expect(ghosts[0].type).toBe(SMART.HazardCardBlock?.type)
    expect(ghosts[0].why).toBe(SMART.HazardCardBlock?.why)
  })

  test('(b) the ghost is ABSENT when the predicted block already follows (self-suppress)', () => {
    // Hazard → PPE, but a PPE block already follows → stay quiet.
    expect(computeGhosts(['HazardCardBlock', 'PPECardBlock'])).toHaveLength(0)
    // Hazard → PPE, followed by something else → ghost re-appears.
    expect(computeGhosts(['HazardCardBlock', 'TextBlock'])).toHaveLength(1)
    // Blocks with no prediction never emit a ghost.
    expect(computeGhosts(['TextBlock', 'HeadingBlock'])).toHaveLength(0)
    // Every SMART entry drives a ghost when non-redundant.
    for (const [prev, pred] of Object.entries(SMART)) {
      const gs = computeGhosts([prev as never])
      expect(gs).toHaveLength(1)
      expect(gs[0].type).toBe(pred!.type)
    }
  })
})

test.describe('smart ghosts — one live, dim others, scroll-past gone (scenarios c, d)', () => {
  const ghosts = [{ afterIndex: 0 }, { afterIndex: 2 }]
  const viewportCenter = 400

  test('(c) exactly one ghost is live (nearest viewport centre); the other is dim', () => {
    const r = resolveGhostVisibility(
      ghosts,
      { 0: { bottom: 420, center: 410 }, 2: { bottom: 800, center: 790 } },
      new Set(),
      viewportCenter,
      null
    )
    expect(r.liveIndex).toBe(0)
    expect(r.vis[0]).toBe('live')
    expect(r.vis[2]).toBe('dim')
    // Exactly one live.
    expect(Object.values(r.vis).filter((v) => v === 'live')).toHaveLength(1)
  })

  test('a hovered ghost is forced live even when not nearest centre', () => {
    const r = resolveGhostVisibility(
      ghosts,
      { 0: { bottom: 420, center: 410 }, 2: { bottom: 800, center: 790 } },
      new Set(),
      viewportCenter,
      2 // hovered
    )
    expect(r.vis[2]).toBe('live')
  })

  test('(d) a ghost scrolled past (bottom < 64) becomes gone — and stays gone permanently', () => {
    const r = resolveGhostVisibility(
      ghosts,
      { 0: { bottom: 40, center: 30 }, 2: { bottom: 500, center: 490 } },
      new Set(),
      viewportCenter,
      null
    )
    expect(r.newlyGone).toContain(0)
    expect(r.vis[0]).toBe('gone')
    // The now-only remaining ghost is live.
    expect(r.vis[2]).toBe('live')

    // Persisted: once gone, it never comes back even if it scrolls into view.
    const r2 = resolveGhostVisibility(
      ghosts,
      { 0: { bottom: 420, center: 410 }, 2: { bottom: 500, center: 490 } },
      new Set([0]),
      viewportCenter,
      null
    )
    expect(r2.vis[0]).toBe('gone')
    expect(r2.liveIndex).toBe(2)
  })
})

test.describe('smart ghosts — typing dismiss (scenario e)', () => {
  test('(e) typing inside a block gones every ghost except the one immediately after it', () => {
    const ghosts = [{ afterIndex: 0 }, { afterIndex: 2 }, { afterIndex: 4 }]
    // Typing in block 2 keeps only the ghost after block 2.
    expect(ghostsGoneOnTyping(ghosts, 2).sort()).toEqual([0, 4])
    // Typing in a block with no ghost after it gones them all.
    expect(ghostsGoneOnTyping(ghosts, 3).sort()).toEqual([0, 2, 4])
  })
})

test.describe('smart ghosts — no scroll-driven re-render (RESEARCH Pattern 4)', () => {
  test('the hook drives scroll via rAF + ref class toggles, never React state', () => {
    const src = readFileSync(
      join(__dirname, '../../src/components/admin/builder-v2/ghosts/useSmartGhosts.ts'),
      'utf8'
    )
    // Scroll path uses requestAnimationFrame throttling + classList toggles on refs …
    expect(src).toContain('requestAnimationFrame')
    expect(src).toContain('classList')
    expect(src).toContain('useRef')
    // … and NO React state that would re-render the document on scroll.
    expect(src).not.toContain('useState')
  })
})
