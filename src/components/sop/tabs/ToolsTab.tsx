'use client'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import type { SopWithSections } from '@/types/sop'

export function ToolsTab({ sop: _sop }: { sop: SopWithSections }) {
  return (
    <BlueprintCanvas>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold">Tools &amp; Equipment</h2>
        <p className="text-sm text-[var(--ink-500)] mt-2">
          Required tools and equipment render here once Wave 3 wires the ToolBlock and related blocks.
        </p>
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
