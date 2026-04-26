import { z } from 'zod'

export const SignOffBlockPropsSchema = z.object({
  title: z.string().min(1).max(120).default('Supervisor sign-off'),
  requiredRole: z
    .enum(['supervisor', 'safety_manager', 'admin'])
    .default('supervisor'),
  acknowledgementText: z.string().max(500).optional(),
})
export type SignOffBlockProps = z.infer<typeof SignOffBlockPropsSchema>

export function SignOffBlock({
  title = 'Supervisor sign-off',
  requiredRole = 'supervisor',
  acknowledgementText,
}: SignOffBlockProps) {
  return (
    <section
      className="mb-4 border rounded-xl p-5"
      style={{
        borderColor: 'var(--accent-signoff)',
        background: 'color-mix(in srgb, var(--accent-signoff) 6%, white)',
      }}
      data-block="signoff"
      data-required-role={requiredRole}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--accent-signoff)' }}
        >
          Sign off
        </span>
      </div>
      <strong className="text-base font-semibold">{title}</strong>
      {acknowledgementText && (
        <p
          className="text-sm mt-2"
          style={{ color: 'var(--ink-700, #374151)' }}
        >
          {acknowledgementText}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <input
          type="text"
          placeholder="Supervisor name"
          aria-label="Supervisor name"
          className="flex-1 px-2 py-1.5 border border-[var(--ink-300,#d1d5db)] rounded bg-white text-sm"
        />
        <button
          type="button"
          className="px-4 py-1.5 rounded-lg border text-sm font-medium"
          style={{
            borderColor: 'var(--accent-signoff)',
            color: 'var(--accent-signoff)',
            background: 'white',
          }}
          data-signoff-trigger
        >
          Sign
        </button>
      </div>
    </section>
  )
}
