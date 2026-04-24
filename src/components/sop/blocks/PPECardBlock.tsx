import { z } from 'zod'
import { ShieldCheck } from 'lucide-react'

export const PPECardBlockPropsSchema = z.object({
  title: z.string().max(120).default('PPE Required'),
  items: z.array(z.string().min(1).max(80)).min(1).default(['Safety equipment']),
})
export type PPECardBlockProps = z.infer<typeof PPECardBlockPropsSchema>

export function PPECardBlock({ title, items }: PPECardBlockProps) {
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={18} className="text-blue-400 flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-blue-400">
          {title}
        </span>
      </div>
      <div className="flex flex-wrap -m-1 mt-2">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-300 text-sm font-medium rounded-lg border border-blue-500/30 m-1"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
