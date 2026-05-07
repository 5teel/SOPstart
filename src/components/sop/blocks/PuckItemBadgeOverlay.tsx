'use client'

/**
 * Phase 13 plan 13-04 — PuckItemBadgeOverlay
 *
 * Renders the UpdateAvailableBadge for a canvas-rendered Puck item when
 * the corresponding sop_section_blocks row has update_available=true.
 *
 * Resolution chain:
 *   componentId (Puck) → componentIdToJunctionId map → SopSectionBlockWithUpdate
 *
 * Pre-Phase-13 (inline-authored) blocks have no `props.junctionId` stamped on
 * their layout_data entry, so they will not appear in the map and the overlay
 * is a graceful no-op (no badge).
 */

import type { ReactNode } from 'react'
import type { SopSectionBlockWithUpdate } from '@/types/sop'
import { UpdateAvailableBadge } from '@/components/admin/blocks/UpdateAvailableBadge'

export type PuckItemBadgeOverlayProps = {
  children: ReactNode
  /** Puck-internal item id passed from componentOverlay override (matches layout_data props.id) */
  componentId: string
  /** Map from Puck componentId → SopSectionBlockWithUpdate (rebuilt in BuilderClient when activeSection or junctionMap changes) */
  componentIdToJunction: Map<string, SopSectionBlockWithUpdate>
  /** Refresh callback after Accept / Decline so BuilderClient can re-fetch */
  onReviewed?: () => void
}

export function PuckItemBadgeOverlay({
  children,
  componentId,
  componentIdToJunction,
  onReviewed,
}: PuckItemBadgeOverlayProps) {
  const junction = componentIdToJunction.get(componentId) ?? null
  const showBadge = !!junction && junction.update_available

  return (
    <div className="relative" data-puck-item-overlay={componentId}>
      {children}
      {showBadge && junction && (
        <div className="absolute top-1 right-1 z-30 pointer-events-auto">
          <UpdateAvailableBadge junction={junction} onReviewed={onReviewed} />
        </div>
      )}
    </div>
  )
}
