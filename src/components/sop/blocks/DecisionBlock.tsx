import { z } from 'zod'

export const DecisionBlockPropsSchema = z.object({
  question: z.string().min(1).max(200),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        nextStepId: z.string().uuid().optional(),
        isEscalation: z.boolean().optional(),
      })
    )
    .min(2)
    .max(6),
})
export type DecisionBlockProps = z.infer<typeof DecisionBlockPropsSchema>

export function DecisionBlock({ question, options }: DecisionBlockProps) {
  return (
    <section
      className="mb-4 border rounded-xl p-5"
      style={{
        borderColor: 'var(--accent-decision)',
        background: 'color-mix(in srgb, var(--accent-decision) 8%, white)',
      }}
      data-block="decision"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--accent-decision)' }}
        >
          Decision
        </span>
      </div>
      <p className="text-base font-semibold mb-3">{question}</p>
      <div className="grid gap-2">
        {options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            className="w-full px-4 py-2.5 rounded-lg border text-sm font-medium text-left"
            style={{
              borderColor: opt.isEscalation
                ? 'var(--accent-escalate, #ef4444)'
                : 'var(--accent-decision)',
              color: opt.isEscalation
                ? 'var(--accent-escalate, #ef4444)'
                : 'var(--accent-decision)',
              background: 'white',
            }}
            data-decision-option={idx}
            data-is-escalation={opt.isEscalation ? 'true' : 'false'}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  )
}
