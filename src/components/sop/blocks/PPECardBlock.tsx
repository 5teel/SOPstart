import { z } from 'zod'
import { ShieldCheck } from 'lucide-react'

export const PPECardBlockPropsSchema = z.object({
  title: z.string().max(120).default('PPE Required'),
  items: z.array(z.string().min(1).max(80)).min(1).default(['Safety equipment']),
})
export type PPECardBlockProps = z.infer<typeof PPECardBlockPropsSchema>

export function PPECardBlock({ title, items }: PPECardBlockProps) {
  return (
    <div className="bg-accent-step/10 border border-accent-step/30 rounded-lg p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={18} className="text-accent-step flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-accent-step">
          {title}
        </span>
      </div>
      <div className="flex flex-wrap -m-1 mt-2">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-step/15 text-accent-step text-sm font-medium rounded-lg border border-accent-step/30 m-1"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
