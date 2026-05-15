'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { SaveToLibraryModal } from '@/components/admin/blocks/SaveToLibraryModal'
import type { BlockCategory } from '@/types/sop'
import type { BlockContent } from '@/lib/validators/blocks'

export type BlockOverflowMenuProps = {
  /** BlockContent kind — 'hazard' | 'ppe' | 'step' | etc. (must be in BlockContentSchema discriminator) */
  kindSlug: BlockContent['kind']
  /** Current block content captured from the builder's authored state. */
  content: BlockContent
  /** Optional pre-fill for the modal name field (e.g. existing block.title). */
  blockName?: string
  /** Lazy-loader for category vocab — only invoked when modal opens. */
  onSaveCategoriesNeeded: () => Promise<BlockCategory[]>
  /** Optional builder-side hooks (delete/duplicate). Currently advisory only. */
  onDelete?: () => void
  onDuplicate?: () => void
}

/**
 * Three-dot overflow menu attached to every hazard / PPE / step block in the
 * builder. Opens SaveToLibraryModal with kind + content prefilled (D-Save-01).
 *
 * Categories are loaded lazily on first menu open to avoid eagerly fetching
 * for every block in the builder palette.
 */
export function BlockOverflowMenu({
  kindSlug,
  content,
  blockName,
  onSaveCategoriesNeeded,
  onDelete,
  onDuplicate,
}: BlockOverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [categories, setCategories] = useState<BlockCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close menu on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      window.addEventListener('mousedown', handler)
      return () => window.removeEventListener('mousedown', handler)
    }
  }, [open])

  async function handleSaveClick(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(false)
    if (categories.length === 0) {
      setLoadingCategories(true)
      try {
        const cs = await onSaveCategoriesNeeded()
        setCategories(cs)
      } finally {
        setLoadingCategories(false)
      }
    }
    setModalOpen(true)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(false)
    if (onDelete) {
      // eslint-disable-next-line no-alert
      if (window.confirm('Delete this item?')) onDelete()
    }
  }

  function handleDuplicateClick(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(false)
    onDuplicate?.()
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        aria-label="Item actions"
        data-testid="block-overflow-trigger"
        className="p-1.5 rounded-md bg-[var(--paper)]/80 border border-[var(--ink-100)] text-[var(--ink-500)] hover:text-[var(--ink-900)] hover:bg-white backdrop-blur-sm shadow"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="block-overflow-menu"
          className="absolute top-full right-0 mt-1 w-44 bg-white border border-[var(--ink-100)] rounded-md shadow-xl z-30 py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleSaveClick}
            disabled={loadingCategories}
            className="w-full text-left px-3 py-1.5 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)] disabled:opacity-60"
          >
            {loadingCategories ? 'Loading…' : 'Save to library'}
          </button>
          {onDuplicate && (
            <button
              type="button"
              role="menuitem"
              onClick={handleDuplicateClick}
              className="w-full text-left px-3 py-1.5 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
            >
              Duplicate
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={handleDeleteClick}
              className="w-full text-left px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
        </div>
      )}

      <SaveToLibraryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        kindSlug={kindSlug}
        content={content}
        suggestedName={blockName}
        categories={categories}
      />
    </div>
  )
}
