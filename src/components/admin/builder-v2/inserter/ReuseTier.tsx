'use client'

import { useState } from 'react'
import { BlockPicker, type BlockPickerOnAddInput } from '@/components/admin/blocks/BlockPicker'
import { addBlockToSection } from '@/actions/sop-section-blocks'
import { reuseSopCategory, type ReuseScope } from './inserter-model'

/**
 * Reuse tier (R3, TIER 3) — the dept-scoped library. This is NOT rebuilt: it
 * wraps the existing Phase 13 `BlockPicker` and routes selection through the
 * existing `addBlockToSection` junction path (org-scoped, T-26-08-01). A
 * segmented toggle maps to the picker's `sopCategory` soft-filter:
 *   - "This department" → the SOP's `category_tag` (narrows to this dept),
 *   - "All departments" → null (every department).
 *
 * The toggle floats above the picker's full-screen modal (z above its z-50).
 */
interface ReuseTierProps {
  open: boolean
  /** The section receiving the reused block (junction target). */
  sopSectionId: string
  /** The SOP's category — the "this department" scope. */
  categoryTag: string | null
  onClose: () => void
}

export function ReuseTier({ open, sopSectionId, categoryTag, onClose }: ReuseTierProps) {
  const [scope, setScope] = useState<ReuseScope>('dept')
  if (!open) return null

  async function handleAdd(input: BlockPickerOnAddInput) {
    // Existing Phase 13 path — creates the org-scoped sop_section_blocks junction.
    const result = await addBlockToSection({
      sopSectionId,
      blockId: input.blockId,
      pinMode: input.pinMode,
    })
    if ('error' in result) {
      console.warn('[ReuseTier] addBlockToSection failed', result.error)
      return
    }
    onClose()
  }

  const scopeBtn = (value: ReuseScope, label: string) => (
    <button
      type="button"
      data-scope={value}
      aria-pressed={scope === value}
      onClick={() => setScope(value)}
      className={[
        'px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors',
        scope === value
          ? 'bg-[var(--ink-900,#18181b)] text-white'
          : 'bg-[var(--paper,#fff)] text-[var(--ink-500,#71717a)] hover:text-[var(--ink-900,#18181b)]',
      ].join(' ')}
    >
      {label}
    </button>
  )

  return (
    <>
      <div
        role="group"
        aria-label="Reuse scope"
        className="fixed left-1/2 top-3 z-[60] flex -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--ink-300,#d4d4d8)] shadow-lg"
      >
        {scopeBtn('dept', 'This department')}
        {scopeBtn('all', 'All departments')}
      </div>
      <BlockPicker
        open
        onClose={onClose}
        kindSlug="step"
        sopCategory={reuseSopCategory(scope, categoryTag)}
        onAdd={handleAdd}
      />
    </>
  )
}
