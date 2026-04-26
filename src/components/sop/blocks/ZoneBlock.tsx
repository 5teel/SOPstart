import { z } from 'zod'

const ZONE_COLORS: Record<'danger' | 'warning' | 'safe' | 'pedestrian', string> = {
  danger: 'var(--accent-escalate)',
  warning: 'var(--accent-decision)',
  safe: 'var(--accent-signoff)',
  pedestrian: 'var(--accent-zone, #06b6d4)',
}

export const ZoneBlockPropsSchema = z.object({
  label: z.string().min(1).max(120),
  zoneType: z.enum(['danger', 'warning', 'safe', 'pedestrian']),
  notes: z.string().max(500).optional(),
})
export type ZoneBlockProps = z.infer<typeof ZoneBlockPropsSchema>

export function ZoneBlock({ label, zoneType, notes }: ZoneBlockProps) {
  const color = ZONE_COLORS[zoneType]
  return (
    <section
      className="mb-4 border rounded-xl p-4"
      style={{
        borderColor: color,
        background: `color-mix(in srgb, ${color} 8%, white)`,
      }}
      data-block="zone"
      data-zone-type={zoneType}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color }}
        >
          {zoneType} zone
        </span>
      </div>
      <strong className="text-base font-semibold">{label}</strong>
      {notes && (
        <p
          className="text-sm mt-2"
          style={{ color: 'var(--ink-700, #374151)' }}
        >
          {notes}
        </p>
      )}
    </section>
  )
}
