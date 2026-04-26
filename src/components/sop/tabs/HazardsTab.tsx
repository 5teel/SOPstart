'use client'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import type { SopWithSections } from '@/types/sop'

export function HazardsTab({ sop: _sop }: { sop: SopWithSections }) {
  return (
    <BlueprintCanvas>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold">Hazards &amp; PPE</h2>
        <p className="text-sm text-[var(--ink-500)] mt-2">
          Hazard warnings and PPE requirements render here once Wave 3 wires the HazardCardBlock and PPECardBlock into this tab.
        </p>
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
