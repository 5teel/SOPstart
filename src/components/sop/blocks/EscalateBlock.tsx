import { z } from 'zod'

export const EscalateBlockPropsSchema = z.object({
  title: z.string().min(1).max(120).default('Escalate'),
  reason: z.string().max(500).optional(),
  escalationMode: z.enum(['alert', 'lock', 'form']).default('form'),
  recipients: z
    .array(z.enum(['supervisor', 'safety_manager', 'admin']))
    .optional(),
})
export type EscalateBlockProps = z.infer<typeof EscalateBlockPropsSchema>

export function EscalateBlock({
  title = 'Escalate',
  reason,
  escalationMode = 'form',
  recipients,
}: EscalateBlockProps) {
  return (
    <section
      className="mb-4 border-2 rounded-xl p-5"
      style={{
        borderColor: 'var(--accent-escalate)',
        background: 'color-mix(in srgb, var(--accent-escalate) 8%, white)',
      }}
      data-block="escalate"
      data-escalation-mode={escalationMode}
      data-wave4-wiring="escalation-dispatch"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--accent-escalate)' }}
        >
          Escalate · {escalationMode}
        </span>
      </div>
      <strong className="text-base font-semibold">{title}</strong>
      {reason && (
        <p
          className="text-sm mt-2"
          style={{ color: 'var(--ink-700, #374151)' }}
        >
          {reason}
        </p>
      )}
      {recipients && recipients.length > 0 && (
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--ink-500, #6b7280)' }}
        >
          Notifies: {recipients.join(', ')}
        </p>
      )}
      <button
        type="button"
        className="mt-3 px-4 py-2 rounded-lg border text-sm font-medium"
        style={{
          borderColor: 'var(--accent-escalate)',
          color: 'var(--accent-escalate)',
          background: 'white',
        }}
        data-escalate-trigger
      >
        Escalate now
      </button>
    </section>
  )
}
