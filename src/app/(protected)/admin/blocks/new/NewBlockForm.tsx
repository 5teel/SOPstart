'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBlock } from '@/actions/blocks'
import { BLOCK_KINDS, seedBlockContent, type BlockKindSlug } from '@/lib/blocks/block-kinds'
import type { BlockCategory } from '@/types/sop'

interface Props {
  categories: BlockCategory[]
}

export function NewBlockForm({ categories }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<BlockKindSlug>('hazard')
  const [text, setText] = useState('')
  const [categoryTags, setCategoryTags] = useState<string[]>([])
  const [tagsRaw, setTagsRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Pickable categories: hazard + area groups (matches SaveToLibraryModal / BlockEditorClient).
  const pickableCategories = categories.filter(
    (c) => c.category_group === 'hazard' || c.category_group === 'area'
  )
  const activeKind = BLOCK_KINDS.find((k) => k.value === kind)

  function toggleCategory(slug: string) {
    setCategoryTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!text.trim()) {
      setError('Text is required')
      return
    }
    const freeTextTags = tagsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    startTransition(async () => {
      const res = await createBlock({
        kindSlug: kind,
        name: name.trim(),
        categoryTags,
        freeTextTags,
        content: seedBlockContent(kind, text),
        scope: 'org',
      })
      if ('error' in res) {
        setError(res.error)
        return
      }
      router.push(`/admin/blocks/${res.block.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Name */}
      <div className="mb-4">
        <label htmlFor="new-block-name" className="block text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
          Name
        </label>
        <input
          id="new-block-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Crush hazard — section forming"
          className="w-full bg-white border border-[var(--ink-100)] rounded-lg px-3 py-2 text-[var(--ink-900)] focus:border-[var(--ink-900)] focus:outline-none"
        />
      </div>

      {/* Kind */}
      <fieldset className="mb-4">
        <legend className="block text-xs uppercase tracking-wider text-[var(--ink-500)] mb-2">Kind</legend>
        <div className="flex flex-wrap gap-2">
          {BLOCK_KINDS.map((k) => {
            const selected = kind === k.value
            return (
              <label
                key={k.value}
                className={[
                  'min-h-tap px-3 rounded-lg border inline-flex items-center cursor-pointer transition-colors',
                  selected
                    ? 'border-[var(--ink-900)] bg-[var(--ink-900)]/10'
                    : 'border-[var(--ink-100)] bg-white',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={selected}
                  onChange={() => setKind(k.value)}
                  className="sr-only"
                />
                {k.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      {/* Text */}
      <div className="mb-1">
        <label htmlFor="new-block-text" className="block text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
          Text
        </label>
        <textarea
          id="new-block-text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-white border border-[var(--ink-100)] rounded-lg px-3 py-2 text-[var(--ink-900)] focus:border-[var(--ink-900)] focus:outline-none"
        />
      </div>
      {activeKind && <p className="text-xs text-[var(--ink-500)] mb-4">{activeKind.hint}</p>}

      {/* Categories */}
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
                aria-pressed={active}
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

      {/* Tags */}
      <div className="mb-4">
        <label htmlFor="new-block-tags" className="block text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
          Tags (comma-separated)
        </label>
        <input
          id="new-block-tags"
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="e.g. forming, swab, gob"
          className="w-full bg-white border border-[var(--ink-100)] rounded-lg px-3 py-2 text-[var(--ink-900)] focus:border-[var(--ink-900)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="text-sm text-accent-escalate bg-accent-escalate/10 border border-accent-escalate/40 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/admin/blocks"
          className="bg-[var(--paper)] border border-[var(--ink-100)] text-[var(--ink-500)] hover:text-[var(--ink-900)] font-semibold px-4 h-tap rounded-lg transition-colors text-sm inline-flex items-center"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="bg-[var(--ink-900)] text-white font-semibold px-4 h-tap rounded-lg hover:bg-[var(--ink-700)] transition-colors text-sm disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}
