'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SectionKindPicker } from '@/components/admin/SectionKindPicker'
import { createSection } from '@/actions/sections'

interface AddSectionButtonProps {
  sopId: string
  /** Parent callback fired after a successful insert so it can refetch. */
  onCreated: () => void
}

export function AddSectionButton({ sopId, onCreated }: AddSectionButtonProps) {
  const [open, setOpen] = useState(false)

  const handleSubmit = async (input: { sectionKindId: string; title: string }) => {
    await createSection({
      sopId,
      sectionKindId: input.sectionKindId,
      title: input.title,
    })
    setOpen(false)
    onCreated()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 h-[72px] mt-4 border-2 border-dashed border-steel-700 rounded-lg text-steel-400 hover:text-steel-100 hover:border-steel-500 transition-colors"
      >
        <Plus size={20} />
        <span className="text-sm font-semibold">Add section</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add section"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-lg bg-steel-900 border border-steel-700 rounded-xl p-5">
            <h2 className="text-lg font-bold text-steel-100 mb-3">Add section</h2>
            <SectionKindPicker
              onSubmit={handleSubmit}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
