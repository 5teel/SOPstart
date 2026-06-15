'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { saveFromSection } from '@/actions/blocks'
import type { BlockCategory } from '@/types/sop'
import type { BlockContent } from '@/lib/validators/blocks'

interface Props {
  open: boolean
  onClose: () => void
  kindSlug: string
  suggestedName?: string
  content: BlockContent
  categories: BlockCategory[]
  onSaved?: (blockId: string) => void
}

/**
 * D-Save-02 modal â€” field order:
 *   1. Name (required)
 *   2. Categories (multi-select chips)
 *   3. Free-text tags (comma-separated)
 *   4. Scope radio: My org only | Suggest for global
 *
 * Calls saveFromSection() server action; on success posts toast + closes.
 * Builder integration (three-dot menu trigger) lands in plan 13-03.
 */
export function SaveToLibraryModal({
  open,
  onClose,
  kindSlug,
  suggestedName,
  content,
  categories,
  onSaved,
}: Props) {
  const [name, setName] = useState(suggestedName ?? '')
  const [categoryTags, setCategoryTags] = useState<string[]>([])
  const [freeTextTagsRaw, setFreeTextTagsRaw] = useState('')
  // Phase 25: only 'org' scope — global suggestion model retired (A5/A6).
  const scope = 'org' as const
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  // Pickable categories: hazard + area groups (matches BlockEditorClient).
  const pickableCategories = categories.filter(
    (c) => c.category_group === 'hazard' || c.category_group === 'area'
  )

  function toggleCategory(slug: string) {
    setCategoryTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  function handleSave() {
    setError(null)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const freeTextTags = freeTextTagsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    startTransition(async () => {
      const res = await saveFromSection({
        kindSlug,
        name: name.trim(),
        categoryTags,
        freeTextTags,
        content,
        scope,
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      // Lightweight toast via window.alert; production toast hook lives in
      // src/components/providers (deferred to integration plan 13-03).
      const msg = 'Saved to library.'
      // eslint-disable-next-line no-alert
      alert(msg)
      onSaved?.(res.block.id)
      onClose()
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[var(--paper)]/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[var(--ink-100)] rounded-xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--ink-900)]">Save to library</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Name */}
        <div className="mb-4">
          <label htmlFor="save-name" className="block text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
            Name *
          </label>
          <input
            id="save-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crush hazard â€” section forming"
            className="w-full bg-[var(--paper)] border border-[var(--ink-100)] rounded-md px-3 py-2 text-[var(--ink-900)] focus:border-[var(--ink-900)] focus:outline-none"
          />
        </div>

        {/* 2. Categories */}
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-[var(--ink-500)] mb-2">
            Categories
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {pickableCategories.map((c) => {
              const active = categoryTags.includes(c.slug)
              return (
                <button
                  type="button"
                  key={c.slug}
                  onClick={() => toggleCategory(c.slug)}
                  className={[
                    'text-xs px-2 py-1 rounded border transition-colors',
                    active
                      ? 'bg-[var(--ink-900)]/20 text-[var(--ink-900)] border-[var(--ink-900)]/40'
                      : 'bg-[var(--paper)] text-[var(--ink-500)] border-[var(--ink-100)] hover:text-[var(--ink-900)]',
                  ].join(' ')}
                >
                  {c.display_name}
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Free-text tags */}
        <div className="mb-4">
          <label htmlFor="save-tags" className="block text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
            Free-text tags (comma-separated)
          </label>
          <input
            id="save-tags"
            type="text"
            value={freeTextTagsRaw}
            onChange={(e) => setFreeTextTagsRaw(e.target.value)}
            placeholder="e.g. forming, swab, gob"
            className="w-full bg-[var(--paper)] border border-[var(--ink-100)] rounded-md px-3 py-2 text-[var(--ink-900)] focus:border-[var(--ink-900)] focus:outline-none"
          />
        </div>

        {/* Phase 25: Scope field removed — all blocks are org-owned (global model retired). */}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-700/40 rounded-md p-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="bg-[var(--paper)] border border-[var(--ink-100)] text-[var(--ink-500)] hover:text-[var(--ink-900)] font-semibold px-4 h-[40px] rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-[var(--ink-900)] text-white font-semibold px-4 h-[40px] rounded-lg hover:bg-[var(--ink-700)] transition-colors text-sm disabled:opacity-50"
          >
            Save to library
          </button>
        </div>
      </div>
    </div>
  )
}
