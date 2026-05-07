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
 * D-Save-02 modal — field order:
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
  const [scope, setScope] = useState<'org' | 'suggest_global'>('org')
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
      const msg =
        scope === 'suggest_global'
          ? 'Saved to your library and submitted to Summit for global review.'
          : 'Saved to library.'
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
      className="fixed inset-0 z-50 bg-steel-900/80 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-steel-800 border border-steel-700 rounded-xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-steel-100">Save to library</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-steel-400 hover:text-steel-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Name */}
        <div className="mb-4">
          <label htmlFor="save-name" className="block text-xs uppercase tracking-wider text-steel-400 mb-1">
            Name *
          </label>
          <input
            id="save-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Crush hazard — section forming"
            className="w-full bg-steel-900 border border-steel-700 rounded-md px-3 py-2 text-steel-100 focus:border-brand-yellow focus:outline-none"
          />
        </div>

        {/* 2. Categories */}
        <div className="mb-4">
          <label className="block text-xs uppercase tracking-wider text-steel-400 mb-2">
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
                      ? 'bg-brand-yellow/20 text-brand-yellow border-brand-yellow/40'
                      : 'bg-steel-900 text-steel-300 border-steel-700 hover:text-steel-100',
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
          <label htmlFor="save-tags" className="block text-xs uppercase tracking-wider text-steel-400 mb-1">
            Free-text tags (comma-separated)
          </label>
          <input
            id="save-tags"
            type="text"
            value={freeTextTagsRaw}
            onChange={(e) => setFreeTextTagsRaw(e.target.value)}
            placeholder="e.g. forming, swab, gob"
            className="w-full bg-steel-900 border border-steel-700 rounded-md px-3 py-2 text-steel-100 focus:border-brand-yellow focus:outline-none"
          />
        </div>

        {/* 4. Scope */}
        <fieldset className="mb-5">
          <legend className="block text-xs uppercase tracking-wider text-steel-400 mb-2">
            Scope
          </legend>
          <label className="flex items-start gap-2 mb-2 cursor-pointer">
            <input
              type="radio"
              name="scope"
              value="org"
              checked={scope === 'org'}
              onChange={() => setScope('org')}
              className="mt-0.5 accent-brand-yellow"
            />
            <span className="text-sm text-steel-100">
              My org only
              <span className="block text-xs text-steel-400">
                Save just to your organisation&apos;s library.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="scope"
              value="suggest_global"
              checked={scope === 'suggest_global'}
              onChange={() => setScope('suggest_global')}
              className="mt-0.5 accent-brand-yellow"
            />
            <span className="text-sm text-steel-100">
              Suggest for global
              <span className="block text-xs text-steel-400">
                Submit to Summit Insights for review and possible promotion to the global library.
              </span>
            </span>
          </label>
        </fieldset>

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
            className="bg-steel-900 border border-steel-700 text-steel-300 hover:text-steel-100 font-semibold px-4 h-[40px] rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-brand-yellow text-steel-900 font-semibold px-4 h-[40px] rounded-lg hover:bg-amber-400 transition-colors text-sm disabled:opacity-50"
          >
            Save to library
          </button>
        </div>
      </div>
    </div>
  )
}
