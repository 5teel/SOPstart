'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { listBlocks, listBlockCategories } from '@/actions/blocks'
import type { Block, BlockCategory } from '@/types/sop'
import type { BlockContent } from '@/lib/validators/blocks'
import { groupForPicker, type BlockMatchScore } from '@/lib/builder/match-blocks'
import { BlockPickerRow } from './BlockPickerRow'
import { BlockPickerPreview } from './BlockPickerPreview'

export type BlockPickerOnAddInput = {
  blockId: string
  pinMode: 'pinned' | 'follow_latest'
  preview: { name: string; content: BlockContent }
}

export type BlockPickerProps = {
  open: boolean
  onClose: () => void
  /** Hard-filter — picker shows only this kind (e.g. 'hazard'). */
  kindSlug: string
  /** Soft filter — drives matching/boosting (e.g. 'area-forming'). */
  sopCategory?: string | null
  onAdd: (input: BlockPickerOnAddInput) => Promise<void> | void
}

type BlockWithContent = Block & { currentContent?: BlockContent | null }

export function BlockPicker({
  open,
  onClose,
  kindSlug,
  sopCategory,
  onAdd,
}: BlockPickerProps) {
  const [blocks, setBlocks] = useState<BlockWithContent[]>([])
  const [categories, setCategories] = useState<BlockCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pinMode, setPinMode] = useState<'pinned' | 'follow_latest'>('pinned')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load blocks + categories whenever the picker opens or kind changes.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      listBlocks({ kindSlug, includeGlobal: true, includeContent: true }),
      listBlockCategories(),
    ])
      .then(([bs, cs]) => {
        if (cancelled) return
        setBlocks(bs as BlockWithContent[])
        setCategories(cs)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load blocks')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, kindSlug])

  // Reset selection when picker closes/reopens.
  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setPinMode('pinned')
      setCategoryFilter(null)
    }
  }, [open])

  const categoryDisplayMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of categories) m[c.slug] = c.display_name
    return m
  }, [categories])

  // Apply category-chip filter BEFORE grouping so chip filters drill down within
  // exact/related/all groups too.
  const filteredBlocks = useMemo(() => {
    if (!categoryFilter) return blocks
    return blocks.filter((b) => (b.category_tags ?? []).includes(categoryFilter))
  }, [blocks, categoryFilter])

  const grouped = useMemo(
    () => groupForPicker(filteredBlocks, { kindSlug, sopCategory }),
    [filteredBlocks, kindSlug, sopCategory]
  )

  // Auto-select first row when group changes if nothing selected.
  useEffect(() => {
    if (!open) return
    const firstId =
      grouped.exact[0]?.block.id ??
      grouped.related[0]?.block.id ??
      grouped.allOfKind[0]?.block.id ??
      null
    if (firstId && !selectedId) setSelectedId(firstId)
    if (selectedId && !grouped.allOfKind.some((s) => s.block.id === selectedId)) {
      setSelectedId(firstId)
    }
  }, [open, grouped, selectedId])

  const selectedBlockEntry = grouped.allOfKind.find(
    (s) => s.block.id === selectedId
  )
  const selectedContent: BlockContent | null = selectedBlockEntry
    ? ((selectedBlockEntry.block as BlockWithContent).currentContent ?? null)
    : null

  // Categories present on at least one of the loaded blocks (for chip filter row).
  const presentCategories = useMemo(() => {
    const seen = new Map<string, number>()
    for (const b of blocks) {
      for (const t of b.category_tags ?? []) {
        seen.set(t, (seen.get(t) ?? 0) + 1)
      }
    }
    return Array.from(seen.entries()).map(([slug, count]) => ({
      slug,
      display: categoryDisplayMap[slug] ?? slug,
      count,
    }))
  }, [blocks, categoryDisplayMap])

  if (!open) return null

  const sopCategoryLabel = sopCategory
    ? categoryDisplayMap[sopCategory] ?? sopCategory
    : null

  const noCategoryMatches =
    sopCategory && grouped.exact.length === 0 && grouped.related.length === 0

  async function handleAdd() {
    if (!selectedBlockEntry || !selectedContent) return
    setSubmitting(true)
    try {
      await onAdd({
        blockId: selectedBlockEntry.block.id,
        pinMode,
        preview: {
          name: selectedBlockEntry.block.name,
          content: selectedContent,
        },
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="block-picker"
      className="fixed inset-0 z-50 bg-steel-900/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-steel-800 border border-steel-700 rounded-xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-steel-700">
          <h2 className="text-lg font-bold text-steel-100">
            Pick a {kindSlug} from your library
            {grouped.totalCount > 0 && (
              <span className="text-steel-400 font-normal text-sm ml-2">
                ({grouped.totalCount} match{grouped.totalCount === 1 ? '' : 'es'})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-steel-400 hover:text-steel-100"
            aria-label="Close picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter chips */}
        {presentCategories.length > 0 && (
          <div className="px-6 py-3 border-b border-steel-700 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={[
                'text-xs px-2 py-1 rounded border',
                categoryFilter === null
                  ? 'bg-brand-yellow/20 text-brand-yellow border-brand-yellow/40'
                  : 'bg-steel-900 text-steel-300 border-steel-700 hover:text-steel-100',
              ].join(' ')}
            >
              All ({blocks.length})
            </button>
            {presentCategories.map((c) => (
              <button
                type="button"
                key={c.slug}
                onClick={() =>
                  setCategoryFilter((prev) => (prev === c.slug ? null : c.slug))
                }
                className={[
                  'text-xs px-2 py-1 rounded border',
                  categoryFilter === c.slug
                    ? 'bg-brand-yellow/20 text-brand-yellow border-brand-yellow/40'
                    : 'bg-steel-900 text-steel-300 border-steel-700 hover:text-steel-100',
                ].join(' ')}
              >
                {c.display} ({c.count})
              </button>
            ))}
          </div>
        )}

        {/* Two-pane content */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT — list */}
          <div className="w-3/5 overflow-y-auto p-4 border-r border-steel-700 flex flex-col gap-4">
            {loading && (
              <div className="text-sm text-steel-400">Loading library…</div>
            )}
            {error && (
              <div className="text-sm text-red-400 bg-red-950/30 border border-red-700/40 rounded p-3">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {grouped.exact.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs uppercase tracking-wider text-steel-400">
                      Best matches
                      {sopCategoryLabel ? ` for ${sopCategoryLabel}` : ''}
                    </h3>
                    {grouped.exact.map((s) => (
                      <BlockPickerRow
                        key={s.block.id}
                        block={s.block}
                        matchReason={s.matchReason}
                        selected={selectedId === s.block.id}
                        onSelect={() => setSelectedId(s.block.id)}
                        categoryDisplayMap={categoryDisplayMap}
                      />
                    ))}
                  </section>
                )}

                {grouped.related.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-xs uppercase tracking-wider text-steel-400">
                      Related
                    </h3>
                    {grouped.related.map((s) => (
                      <BlockPickerRow
                        key={s.block.id}
                        block={s.block}
                        matchReason={s.matchReason}
                        selected={selectedId === s.block.id}
                        onSelect={() => setSelectedId(s.block.id)}
                        categoryDisplayMap={categoryDisplayMap}
                      />
                    ))}
                  </section>
                )}

                {noCategoryMatches && (
                  <div className="bg-amber-900/30 text-amber-200 p-3 rounded border border-amber-500/40 text-xs">
                    No blocks tagged for {sopCategoryLabel ?? sopCategory}. Showing all {kindSlug} blocks.
                  </div>
                )}

                {/* Always render allOfKind — it is the master list, used as
                    fallback section when exact+related are empty, or as the
                    "Other [kind] blocks" tail when they're populated. */}
                {grouped.allOfKind.length > 0 && (
                  <section className="flex flex-col gap-2">
                    {(grouped.exact.length > 0 || grouped.related.length > 0) && (
                      <h3 className="text-xs uppercase tracking-wider text-steel-400 mt-2">
                        Other {kindSlug} blocks
                      </h3>
                    )}
                    {grouped.allOfKind
                      .filter(
                        (s) =>
                          !grouped.exact.some((e) => e.block.id === s.block.id) &&
                          !grouped.related.some((r) => r.block.id === s.block.id)
                      )
                      .map((s: BlockMatchScore) => (
                        <BlockPickerRow
                          key={s.block.id}
                          block={s.block}
                          matchReason={s.matchReason}
                          selected={selectedId === s.block.id}
                          onSelect={() => setSelectedId(s.block.id)}
                          categoryDisplayMap={categoryDisplayMap}
                        />
                      ))}
                  </section>
                )}

                {grouped.totalCount === 0 && (
                  <div className="text-sm text-steel-400 p-4 border border-dashed border-steel-700 rounded">
                    No {kindSlug} blocks in your library yet. Save one from the builder using the ⋯ menu.
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT — preview pane */}
          <div className="w-2/5 p-4 overflow-y-auto">
            <BlockPickerPreview
              block={selectedBlockEntry?.block ?? null}
              content={selectedContent}
            />
          </div>
        </div>

        {/* Footer — pin/follow toggle + actions */}
        <div className="px-6 py-4 border-t border-steel-700 flex items-center justify-between gap-4">
          <fieldset className="flex flex-col gap-1">
            <legend className="text-[11px] uppercase tracking-wider text-steel-400 mb-1">
              When the source block changes
            </legend>
            <div className="flex items-center gap-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="picker-pin-mode"
                  value="pinned"
                  checked={pinMode === 'pinned'}
                  onChange={() => setPinMode('pinned')}
                  className="mt-0.5 accent-brand-yellow"
                />
                <span className="text-sm text-steel-200">
                  Pinned
                  <span className="block text-[11px] text-steel-500">
                    Lock to the current version forever.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="picker-pin-mode"
                  value="follow_latest"
                  checked={pinMode === 'follow_latest'}
                  onChange={() => setPinMode('follow_latest')}
                  className="mt-0.5 accent-brand-yellow"
                />
                <span className="text-sm text-steel-200">
                  Follow latest
                  <span className="block text-[11px] text-steel-500">
                    Show an &lsquo;update available&rsquo; badge when source changes.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="bg-steel-900 border border-steel-700 text-steel-300 hover:text-steel-100 font-semibold px-4 h-[40px] rounded-lg text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedBlockEntry || !selectedContent || submitting}
              className="bg-brand-yellow text-steel-900 font-semibold px-4 h-[40px] rounded-lg hover:bg-amber-400 text-sm disabled:opacity-50"
              data-testid="block-picker-add"
            >
              {submitting ? 'Adding…' : 'Add to section'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
