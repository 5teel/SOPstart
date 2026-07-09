/**
 * Phase 26 Plan 26-12 (P12 RE-WIRE) — selection-sync bridge helpers.
 *
 * Puck's `componentOverlay` fired `onItemSelected` on select and the old
 * `BuilderClient` resolved it to `setActiveProvenance(region, junctionId)` and
 * ran a reverse `[data-puck-item-id]` DOM lookup. The bespoke canvas (D-01)
 * re-earns both directions with these three pure helpers so the wiring is
 * BEHAVIOURALLY testable (CLAUDE.md 2026-06-05) instead of a grep:
 *
 *   - `selectBlock`               forward: block focus → source region highlight
 *   - `resolveComponentIdFromSource`  reverse: source id → canvas componentId
 *   - `focusCanvasBlock`          reverse DOM shim: focus/scroll `[data-block-id]`
 *
 * `useSelectionSync` itself is UNCHANGED — only the caller moved off Puck.
 */
import type { SopSectionBlockWithUpdate } from '@/types/sop'
import type { SourceProvenanceRegion } from '@/lib/parsers/source-viewer'

type SetActiveProvenance = (
  region: SourceProvenanceRegion | null,
  blockId?: string | null,
) => void

/**
 * Forward binding (BlockEditShell focus → source pane). A converted block
 * highlights its provenance region; an inline-authored block (no junctionId)
 * clears any prior highlight. This is the EXACT expression the shell's focus
 * handler runs, extracted so the parity spec can assert it with a spy.
 */
export function selectBlock(
  setActiveProvenance: SetActiveProvenance,
  region: SourceProvenanceRegion | null | undefined,
  junctionId: string | null | undefined,
): void {
  if (!junctionId) {
    setActiveProvenance(null, null)
    return
  }
  setActiveProvenance(region ?? null, junctionId)
}

/**
 * Reverse binding (source-pane click → canvas). The source pane forwards a
 * junction row id; resolve it back to the layout `props.id` (componentId) so
 * the caller can focus `[data-block-id="…"]`. Returns null when no block on
 * the active section maps to that junction.
 */
export function resolveComponentIdFromSource(
  componentIdToJunction: Map<string, SopSectionBlockWithUpdate>,
  idFromSource: string,
): string | null {
  for (const [componentId, junction] of componentIdToJunction.entries()) {
    if (junction.id === idFromSource) return componentId
  }
  return null
}

/**
 * Forward-resolution helper used by the canvas host: given a block's
 * junctionId, read its `block_provenance` region from the junction map.
 * Inline-authored blocks (no junctionId / not in the map) → null.
 */
export function resolveRegion(
  junctionMap: Map<string, SopSectionBlockWithUpdate>,
  junctionId: string | null | undefined,
): SourceProvenanceRegion | null {
  if (!junctionId) return null
  return junctionMap.get(junctionId)?.block_provenance ?? null
}

/**
 * Reverse-binding DOM shim — repoints the old Puck `[data-puck-item-id]`
 * selector at the bespoke shell's `[data-block-id]` and focuses/scrolls it.
 * The mapping in `resolveComponentIdFromSource` is the load-bearing (tested)
 * part; this is the thin browser-only tail.
 */
export function focusCanvasBlock(componentId: string): void {
  if (typeof document === 'undefined') return
  const escaped =
    typeof window !== 'undefined' && typeof window.CSS?.escape === 'function'
      ? window.CSS.escape(componentId)
      : componentId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
  const el = document.querySelector<HTMLElement>(`[data-block-id="${escaped}"]`)
  if (!el) return
  if (typeof el.focus === 'function') el.focus({ preventScroll: true })
  requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  // Flash the target so navigation is confirmed even when it's already visible
  // (short sections that need no scroll). Restart the animation on re-click.
  el.classList.remove('block-focus-flash')
  void el.offsetWidth // force reflow so re-adding the class replays the animation
  el.classList.add('block-focus-flash')
  window.setTimeout(() => el.classList.remove('block-focus-flash'), 1300)
}
