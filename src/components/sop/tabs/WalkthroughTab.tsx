'use client'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import type { SopWithSections } from '@/types/sop'

export function WalkthroughTab({ sop: _sop }: { sop: SopWithSections }) {
  return (
    <BlueprintCanvas>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold">Walkthrough</h2>
        <p className="text-sm text-[var(--ink-500)] mt-2">
          Walkthrough — Wave 4 wires ImmersiveStepCard + ViewModeToggle here. On phones (≤430px),
          the immersive full-screen step card renders; on desktop, a mode toggle switches between
          immersive and list views.
        </p>
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
