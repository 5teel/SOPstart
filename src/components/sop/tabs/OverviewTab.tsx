'use client'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import type { SopWithSections } from '@/types/sop'

export function OverviewTab({ sop }: { sop: SopWithSections }) {
  return (
    <BlueprintCanvas>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold">{sop.title ?? 'Untitled SOP'}</h2>
        <p className="text-sm text-[var(--ink-500)] mt-2">
          Overview of this SOP. Section summary + quick facts render here once Wave 3 wires the real blocks.
        </p>
        {sop.category && (
          <p className="text-xs text-[var(--ink-500)] mt-1">Category: {sop.category}</p>
        )}
        {sop.department && (
          <p className="text-xs text-[var(--ink-500)]">Department: {sop.department}</p>
        )}
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
