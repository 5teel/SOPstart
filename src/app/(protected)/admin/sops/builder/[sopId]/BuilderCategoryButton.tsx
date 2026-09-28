'use client'

/**
 * Phase 54 (D-09) — the category fix that lived in the retired list detail
 * pane (SopMillerBrowser's CategoryField), now beside "Pick machines for
 * this SOP" in the builder Tools menu so it does not get stranded when the
 * admin `/sops` table replaces the Miller frame. Writes through the exact
 * same setSopCategory() server action the old detail pane used (D-09).
 *
 * Shell copied from BuilderMachinesButton.tsx: Escape closes, backdrop click
 * closes, createPortal to document.body.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { setSopCategory } from '@/actions/sops'
import { SOP_CATEGORIES } from '@/lib/sop-categories'

const SORTED_CATEGORIES = [...SOP_CATEGORIES].sort((a, b) => a.sort - b.sort)

export function BuilderCategoryButton({
  sopId,
  categorySlug,
}: {
  sopId: string
  categorySlug: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const [value, setValue] = useState(categorySlug ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentLabel = SORTED_CATEGORIES.find((c) => c.slug === categorySlug)?.label ?? 'Not set'

  async function save() {
    setSaving(true)
    setError(null)
    const next = value || null
    const res = await setSopCategory(sopId, next)
    setSaving(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setValue(categorySlug ?? '')
          setError(null)
          setOpen(true)
        }}
        className="flex w-full flex-col items-start gap-0.5 rounded px-3 py-2 text-left hover:bg-[var(--paper-2)] transition-colors"
      >
        <span className="text-ui text-[var(--ink-900)]">Change category</span>
        <span className="text-micro text-[var(--ink-500)]">currently: {currentLabel}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              data-testid="builder-category-modal"
              role="dialog"
              aria-label="Change category"
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--paper)] w-full sm:max-w-md sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)] bg-white">
                <h2 className="text-base font-semibold text-[var(--ink-900)]">Change category</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-9 w-9 rounded-lg hover:bg-[var(--paper-2)] flex items-center justify-center text-[var(--ink-500)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="p-4 flex flex-col gap-3">
                <select
                  data-testid="builder-category-select"
                  value={value}
                  disabled={saving}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded border border-[var(--ink-300)] bg-white px-2 py-1.5 text-sm text-[var(--ink-900)] disabled:opacity-60"
                >
                  <option value="">No category</option>
                  {SORTED_CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
                {error && <p className="text-meta text-accent-escalate">{error}</p>}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="min-h-tap rounded-lg bg-[var(--ink-900)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
