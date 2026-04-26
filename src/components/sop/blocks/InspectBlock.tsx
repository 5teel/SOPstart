import { z } from 'zod'

export const InspectBlockPropsSchema = z.object({
  title: z.string().min(1).max(120),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        requirePhoto: z.boolean().default(false),
      })
    )
    .min(1)
    .max(30),
})
export type InspectBlockProps = z.infer<typeof InspectBlockPropsSchema>

export function InspectBlock({ title, items }: InspectBlockProps) {
  return (
    <section
      className="mb-4 border rounded-xl p-5"
      style={{
        borderColor: 'var(--accent-inspect)',
        background: 'color-mix(in srgb, var(--accent-inspect) 6%, white)',
      }}
      data-block="inspect"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--accent-inspect)' }}
        >
          Inspection
        </span>
      </div>
      <strong className="text-base font-semibold">{title}</strong>
      <ul className="mt-3 space-y-2">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <input
              type="checkbox"
              aria-label={it.label}
              className="w-5 h-5 flex-shrink-0"
            />
            <span className="flex-1 text-sm">{it.label}</span>
            {it.requirePhoto && (
              <button
                type="button"
                aria-label={`Capture photo for ${it.label}`}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border text-base flex-shrink-0"
                style={{
                  borderColor: 'var(--accent-inspect)',
                  color: 'var(--accent-inspect)',
                }}
              >
                📷
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
