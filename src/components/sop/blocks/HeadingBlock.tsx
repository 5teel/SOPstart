import { z } from 'zod'

export const HeadingBlockPropsSchema = z.object({
  text: z.string().min(1).max(200),
  level: z.enum(['h2', 'h3']).default('h2'),
})
export type HeadingBlockProps = z.infer<typeof HeadingBlockPropsSchema>

export function HeadingBlock({ text, level }: HeadingBlockProps) {
  if (level === 'h3') {
    return <h3 className="text-xl font-semibold text-steel-100 mb-3">{text}</h3>
  }
  return <h2 className="text-2xl font-bold text-steel-100 mb-4">{text}</h2>
}
