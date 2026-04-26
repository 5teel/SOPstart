'use client'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import type { SopWithSections } from '@/types/sop'

export function FlowTab({ sop: _sop }: { sop: SopWithSections }) {
  return (
    <BlueprintCanvas fullBleed>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold">Flow</h2>
        <p className="text-sm text-[var(--ink-500)] mt-2">
          Flow graph — Wave 5 wires FlowCanvas here. The SVG renderer will derive nodes + edges from
          sections/steps and honour the explicit <code>sops.flow_graph</code> JSONB column when present.
        </p>
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
