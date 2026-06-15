'use client'

/**
 * Phase 25: Block suggestion review surface retired.
 * The block_suggestions table and global model were removed in Phase 25 (A5/A6).
 * This component is kept as a stub — the route that renders it redirects away
 * in global-blocks/suggestions/page.tsx. Full deletion in Wave 4 plan 25-05.
 */

import type { BlockSuggestion } from '@/types/sop'

export type SuggestionReviewRowProps = {
  suggestion: BlockSuggestion
  onDecision?: () => void
}

export function SuggestionReviewRow({ suggestion }: SuggestionReviewRowProps) {
  return (
    <div className="bg-white border border-[var(--ink-100)] rounded-lg p-4 text-sm text-[var(--ink-500)]">
      Block suggestion review retired in Phase 25. (id: {suggestion.id})
    </div>
  )
}
