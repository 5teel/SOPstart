import { z } from 'zod'
import { containsMarkdownTable, SopTable } from '@/components/sop/SopTable'

export const StepBlockPropsSchema = z.object({
  number: z.number().int().min(1).default(1),
  text: z.string().min(1).max(5000),
})
export type StepBlockProps = z.infer<typeof StepBlockPropsSchema>

export function StepBlock({ number, text }: StepBlockProps) {
  const hasTable = containsMarkdownTable(text)
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-[var(--ink-100)] mb-3">
      <span className="text-[13px] font-bold text-[var(--ink-500)] w-6 flex-shrink-0 pt-0.5 tabular-nums">
        {number}
      </span>
      <div className="flex-1 min-w-0">
        {hasTable ? (
          <SopTable markdown={text} />
        ) : (
          <p className="text-base text-[var(--ink-900)] leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  )
}
