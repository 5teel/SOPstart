'use client'

/**
 * Phase 13 plan 13-04 — Update Available badge.
 *
 * Small amber dot rendered absolute-top-right on a builder block whose
 * underlying source has advanced (junction.update_available === true). Click
 * opens BlockUpdateReviewModal with side-by-side diff + Accept / Decline.
 *
 * D-CONTEXT specifics: "Small dot + tooltip, not a banner."
 */

import { useState } from 'react'
import type { SopSectionBlockWithUpdate } from '@/types/sop'
import { BlockUpdateReviewModal } from './BlockUpdateReviewModal'

export type UpdateAvailableBadgeProps = {
  junction: SopSectionBlockWithUpdate
  /** Optional callback fired after Accept / Decline — caller refreshes junction list. */
  onReviewed?: () => void
}

export function UpdateAvailableBadge({
  junction,
  onReviewed,
}: UpdateAvailableBadgeProps) {
  const [modalOpen, setModalOpen] = useState(false)

  if (!junction.update_available) return null

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setModalOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Update available — click to review"
        aria-label="Update available — click to review"
        data-testid="update-available-badge"
        className="relative inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-400 ring-2 ring-amber-300/30 hover:ring-amber-300/60 transition-shadow cursor-pointer"
      >
        <span className="sr-only">Update available — click to review</span>
        <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-50" />
      </button>
      {modalOpen && (
        <BlockUpdateReviewModal
          open={modalOpen}
          junction={junction}
          onClose={() => setModalOpen(false)}
          onReviewed={() => {
            onReviewed?.()
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}
