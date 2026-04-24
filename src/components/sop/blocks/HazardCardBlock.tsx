import { z } from 'zod'
import { AlertTriangle, Siren } from 'lucide-react'

export const HazardCardBlockPropsSchema = z.object({
  title: z.string().max(120).default('Untitled hazard'),
  body: z.string().min(1).max(2000),
  severity: z.enum(['critical', 'warning', 'notice']).default('warning'),
})
export type HazardCardBlockProps = z.infer<typeof HazardCardBlockPropsSchema>

export function HazardCardBlock({ title, body, severity }: HazardCardBlockProps) {
  const Icon = severity === 'critical' ? Siren : AlertTriangle
  const lines = body
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-red-400 flex-shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-red-400">
          {title}
        </span>
      </div>
      {lines.length > 1 ? (
        <ul className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-base text-steel-100 leading-relaxed"
            >
              <span className="text-red-400 mt-1.5 flex-shrink-0">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-steel-100 leading-relaxed">{body}</p>
      )}
    </div>
  )
}
