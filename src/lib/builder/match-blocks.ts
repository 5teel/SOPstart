/**
 * Phase 13 — Pure block matching/scoring for the picker.
 *
 * Per D-Pick-01 / 13-CORPUS-ANALYSIS § 8 picker priority signals:
 *  - Hard filter: kind_slug must match the picker's target kind
 *  - Boost: exact category_tag match → +100 (matchReason 'exact-tag')
 *  - Soft fallback: prefix match against shared category prefix → +50 (matchReason 'prefix-tag')
 *  - Hazard cluster preference: +20 per match
 *  - Global blocks: small +10 bias toward curated content
 *  - Usage hints: +1 per (caller-provided; usage count from sop_section_blocks rows)
 *
 * Pure / deterministic. No DB calls. No React. Easily unit-testable.
 */
import type { Block } from '@/types/sop'

export type BlockMatchScore = {
  block: Block
  score: number
  matchReason: 'exact-tag' | 'prefix-tag' | 'kind-only'
}

export type ScoreBlocksOptions = {
  /**
   * Optional area-/cluster-tag from the SOP (e.g. 'area-forming').
   * When null/undefined, no category boost is applied — every result is matchReason 'kind-only'.
   */
  sopCategory?: string | null
  /** Hard filter — only blocks of this kind are considered (e.g. 'hazard'). */
  kindSlug: string
  /** Optional hazard-cluster preference list (e.g. ['crush-entrapment','burns-hot']). */
  preferredHazardClusters?: string[]
  /** Caller-supplied usage counts: blockId → number of sop_section_blocks rows. */
  usageCounts?: Record<string, number>
}

/**
 * Returns the picker grouping result for D-Pick-03 fallback UX:
 *  - exact:     score >= 100 (had exact category_tag match)
 *  - related:   0 < score < 100 (prefix-only, hazard-cluster, global, or usage signal — no exact match)
 *  - allOfKind: kind-filter only (shown when both exact and related are empty)
 *  - totalCount: union size for the picker's "(N matches)" badge
 */
export type GroupForPickerResult = {
  exact: BlockMatchScore[]
  related: BlockMatchScore[]
  allOfKind: BlockMatchScore[]
  totalCount: number
}

/**
 * Split a category slug like 'area-machine-repair' into its prefix tokens
 * (everything before the last '-').
 *  'area-machine-repair' → ['area', 'area-machine']
 *  'area-forming'        → ['area']
 *  'pinch-points'        → ['pinch']
 * Used for soft prefix-grouping fallback when no exact tag matches.
 */
function categoryPrefixes(slug: string): string[] {
  const parts = slug.split('-')
  if (parts.length <= 1) return []
  const out: string[] = []
  for (let i = 1; i < parts.length; i++) {
    out.push(parts.slice(0, i).join('-'))
  }
  return out
}

/**
 * Score a single block against the SOP context. Returns null if the block
 * fails the hard filter (wrong kind or archived).
 */
function scoreOne(
  block: Block,
  options: ScoreBlocksOptions
): BlockMatchScore | null {
  if (block.kind_slug !== options.kindSlug) return null
  if (block.archived_at !== null) return null

  let score = 0
  let matchReason: BlockMatchScore['matchReason'] = 'kind-only'

  const sopCategory = options.sopCategory ?? null
  const blockTags = block.category_tags ?? []

  if (sopCategory) {
    if (blockTags.includes(sopCategory)) {
      score += 100
      matchReason = 'exact-tag'
    } else {
      const sopPrefixes = categoryPrefixes(sopCategory)
      // Find best prefix overlap. Longer matched prefix → higher score.
      let prefixHit = false
      for (const prefix of sopPrefixes) {
        const hasPrefixMatch = blockTags.some(
          (t) => t === prefix || t.startsWith(prefix + '-')
        )
        if (hasPrefixMatch) {
          // Award +50 for any prefix hit; longer prefix = stronger so add a small +10 bonus per token length.
          score += 50 + prefix.split('-').length * 10
          matchReason = 'prefix-tag'
          prefixHit = true
          break
        }
      }
      // If no prefix matched and no exact match, score remains kind-only (0 from category signal).
      if (!prefixHit) {
        // matchReason already 'kind-only'
      }
    }
  }

  // Hazard cluster preference (independent of category match).
  if (options.preferredHazardClusters && options.preferredHazardClusters.length > 0) {
    for (const cluster of options.preferredHazardClusters) {
      if (blockTags.includes(cluster)) score += 20
    }
  }

  // Global block bias (+10) — encourages adoption of curated content.
  if (block.organisation_id === null) {
    score += 10
  }

  // Usage hint (+1 per usage)
  const usage = options.usageCounts?.[block.id] ?? 0
  score += usage

  return { block, score, matchReason }
}

/**
 * Score and rank blocks for the picker. Pure function.
 *
 * Hard-filters by kind_slug + drops archived. Sorts descending by score,
 * ties broken by name ascending.
 */
export function scoreBlocks(
  blocks: Block[],
  options: ScoreBlocksOptions
): BlockMatchScore[] {
  const scored: BlockMatchScore[] = []
  for (const b of blocks) {
    const s = scoreOne(b, options)
    if (s) scored.push(s)
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.block.name.localeCompare(b.block.name)
  })
  return scored
}

/**
 * Group scored blocks into the three picker UX buckets (D-Pick-03):
 *  - exact: matchReason 'exact-tag' (or score >= 100)
 *  - related: matchReason 'prefix-tag' OR (kind-only with positive non-category boost)
 *  - allOfKind: kind-filter only (always populated; the picker shows it as fallback when exact+related are empty)
 */
export function groupForPicker(
  blocks: Block[],
  options: ScoreBlocksOptions
): GroupForPickerResult {
  const scored = scoreBlocks(blocks, options)

  const exact: BlockMatchScore[] = []
  const related: BlockMatchScore[] = []
  const allOfKind: BlockMatchScore[] = []

  for (const s of scored) {
    if (s.matchReason === 'exact-tag') {
      exact.push(s)
    } else if (s.matchReason === 'prefix-tag') {
      related.push(s)
    }
    // allOfKind always contains every kind-filtered, non-archived block.
    allOfKind.push(s)
  }

  return {
    exact,
    related,
    allOfKind,
    totalCount: scored.length,
  }
}
