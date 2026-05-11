import { z } from 'zod'
import { Info } from 'lucide-react'

export const CalloutBlockPropsSchema = z.object({
  title: z.string().max(120).default('Note'),
  body: z.string().min(1).max(2000),
})
export type CalloutBlockProps = z.infer<typeof CalloutBlockPropsSchema>

export function CalloutBlock({ title, body }: CalloutBlockProps) {
  return (
    <div className="bg-[var(--accent-decision)]/10 border border-[var(--accent-decision)]/30 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Info size={16} className="text-[var(--accent-decision)] flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-[var(--accent-decision)]">
          {title}
        </span>
      </div>
      <p className="text-base text-[var(--ink-900)] leading-relaxed">{body}</p>
    </div>
  )
}
