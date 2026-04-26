import { z } from 'zod'

// ModelBlock is feature-flagged via NEXT_PUBLIC_MODEL_BLOCK_ENABLED.
// Three.js is NOT imported — Phase 12.6 will add the actual viewer.
// This block is registered in puckConfig.components + BLOCK_REGISTRY but
// intentionally NOT in BlockContentSchema discriminated union — it lives
// only in layout_data (Puck JSON), never in sop_section_blocks.

export const ModelBlockPropsSchema = z.object({
  assetUrl: z.string().url(),
  hotspots: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1).max(120),
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
      })
    )
    .default([]),
  defaultLayers: z.array(z.string()).default([]),
})
export type ModelBlockProps = z.infer<typeof ModelBlockPropsSchema>

export function ModelBlock({
  assetUrl,
  hotspots = [],
  defaultLayers = [],
}: ModelBlockProps) {
  const enabled = process.env.NEXT_PUBLIC_MODEL_BLOCK_ENABLED === 'true'
  if (!enabled) {
    return (
      <section
        className="mb-4 border border-dashed rounded-xl p-6 text-center"
        style={{
          borderColor: 'var(--ink-300, #d1d5db)',
          background: 'var(--paper-2, #f9fafb)',
        }}
        data-block="model"
        data-layout-placeholder="true"
      >
        <p
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--ink-500, #6b7280)' }}
        >
          3D model — disabled
        </p>
        <p
          className="text-sm mt-2"
          style={{ color: 'var(--ink-700, #374151)' }}
        >
          Enable{' '}
          <code className="font-mono text-xs">
            NEXT_PUBLIC_MODEL_BLOCK_ENABLED
          </code>{' '}
          to load the 3D viewer.
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--ink-500, #6b7280)' }}
        >
          Asset: {assetUrl}
        </p>
        {hotspots.length > 0 && (
          <p
            className="text-xs"
            style={{ color: 'var(--ink-500, #6b7280)' }}
          >
            {hotspots.length} hotspot(s)
          </p>
        )}
        {defaultLayers.length > 0 && (
          <p
            className="text-xs"
            style={{ color: 'var(--ink-500, #6b7280)' }}
          >
            Layers: {defaultLayers.join(', ')}
          </p>
        )}
      </section>
    )
  }
  // Phase 12.6 will replace this branch with the three.js viewer.
  return (
    <section
      className="mb-4 border rounded-xl p-6"
      data-block="model"
    >
      <p
        className="text-[11px] font-mono uppercase tracking-wider"
        style={{ color: 'var(--ink-500, #6b7280)' }}
      >
        3D viewer — Phase 12.6 pending
      </p>
    </section>
  )
}
