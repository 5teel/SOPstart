import { z } from 'zod'
import { Info } from 'lucide-react'

export const CalloutBlockPropsSchema = z.object({
  title: z.string().max(120).default('Note'),
  body: z.string().min(1).max(2000),
})
export type CalloutBlockProps = z.infer<typeof CalloutBlockPropsSchema>

export function CalloutBlock({ title, body }: CalloutBlockProps) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Info size={16} className="text-amber-400 flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-amber-400">
          {title}
        </span>
      </div>
      <p className="text-base text-steel-100 leading-relaxed">{body}</p>
    </div>
  )
}
