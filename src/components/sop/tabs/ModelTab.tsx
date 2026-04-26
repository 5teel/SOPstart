'use client'
import { BlueprintCanvas } from '@/components/ui/BlueprintCanvas'
import { BlueprintFrame } from '@/components/ui/BlueprintFrame'
import type { SopWithSections } from '@/types/sop'

export function ModelTab({ sop: _sop }: { sop: SopWithSections }) {
  const modelEnabled = process.env.NEXT_PUBLIC_MODEL_BLOCK_ENABLED === 'true'

  return (
    <BlueprintCanvas>
      <BlueprintFrame>
        <h2 className="text-lg font-semibold">3D Model</h2>
        {modelEnabled ? (
          <p className="text-sm text-[var(--ink-500)] mt-2">
            3D viewer — Phase 12.6 pending
          </p>
        ) : (
          <p className="text-sm text-[var(--ink-500)] mt-2">
            3D viewer disabled — enable{' '}
            <code className="mono text-xs">NEXT_PUBLIC_MODEL_BLOCK_ENABLED</code> to load
          </p>
        )}
      </BlueprintFrame>
    </BlueprintCanvas>
  )
}
