'use client'

/**
 * Phase 21 (Plan 21-03 Task 3) — Inline per-block flag panel.
 *
 * Mounted inline beneath each block in the Puck canvas (NOT a global
 * sidebar). Renders 0..N `<FlagBadge>` rows. Empty state renders nothing
 * (no chrome) so verified blocks stay visually quiet.
 *
 * Flag click handler:
 *  1. Resolves the flag's source_location_hint to a `SourceProvenanceRegion`
 *     by reading the block's `block_provenance` if available (best-effort).
 *  2. Calls `useSelectionSync.setActiveProvenance(region, blockId)` — this
 *     scrolls the SOURCE VIEWER to the matching region (per Wave 2 wiring)
 *     AND because BuilderClient registers a click handler, the BUILDER
 *     CANVAS scrolls to the block via `[data-puck-item-id]`.
 *  3. When provenance is absent (pre-Phase-21 SOPs), passes a synthetic
 *     `null` region so the pane stays put and the canvas still scrolls.
 *
 * D-21-09 isolation — admin-only; never imported by worker-side routes.
 */

import { useCallback } from 'react'
import type { ReviewerFlag } from '@/lib/parsers/ai-reviewer'
import { useSelectionSync } from '@/components/admin/source-viewer/useSelectionSync'
import { useReviewerFlags } from './useReviewerFlags'
import { FlagBadge } from './FlagBadge'

export type ReviewerFlagsPanelProps = {
  sopId: string
  blockId: string
  /**
   * Optional override: when the parent already has the block's provenance,
   * pass it in so we skip the lookup. The selection-sync provider's
   * `setActiveProvenance` accepts `null` so omitting this is fine.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockProvenance?: any
}

export function ReviewerFlagsPanel({
  sopId,
  blockId,
  blockProvenance,
}: ReviewerFlagsPanelProps): React.JSX.Element | null {
  const { byBlockId } = useReviewerFlags(sopId)
  const { setActiveProvenance } = useSelectionSync()

  const blockFlags = byBlockId.get(blockId) ?? []

  const handleClick = useCallback(
    (flag: ReviewerFlag) => {
      // Best-effort jump to provenance. The selection-sync provider also
      // fans out the blockId to any builder-canvas registered handler, so
      // the canvas scrolls into view independent of pane availability.
      const region = blockProvenance?.region ?? null
      setActiveProvenance(region, blockId)
      // Reserved: future ergonomics could surface flag.description in a
      // tooltip pinned to the source pane. For now, the badge title attr
      // carries the full context.
      void flag
    },
    [setActiveProvenance, blockProvenance, blockId],
  )

  if (blockFlags.length === 0) return null

  return (
    <div
      data-testid="reviewer-flags-panel"
      data-block-id={blockId}
      className="mt-2 flex flex-col gap-1"
    >
      {blockFlags.map((flag, i) => (
        <FlagBadge
          key={`${blockId}-${i}-${flag.kind}`}
          flag={flag}
          onClick={handleClick}
        />
      ))}
    </div>
  )
}
