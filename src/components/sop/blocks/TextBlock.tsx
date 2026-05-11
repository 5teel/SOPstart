import { z } from 'zod'
import { SopTable, containsMarkdownTable } from '@/components/sop/SopTable'

export const TextBlockPropsSchema = z.object({
  content: z.string().min(1).max(10_000),
})
export type TextBlockProps = z.infer<typeof TextBlockPropsSchema>

export function TextBlock({ content }: TextBlockProps) {
  const hasTable = containsMarkdownTable(content)
  return (
    <div className="bg-white border border-[var(--ink-100)] rounded-xl p-5 mb-4">
      {hasTable ? (
        <SopTable markdown={content} />
      ) : (
        <p className="text-base text-[var(--ink-900)] leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      )}
    </div>
  )
}
