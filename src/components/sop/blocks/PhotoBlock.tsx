import { z } from 'zod'
import { SopImageInline } from '@/components/sop/SopImageInline'

export const PhotoBlockPropsSchema = z.object({
  src: z.string().min(1).nullable().default(null),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).optional(),
})
export type PhotoBlockProps = z.infer<typeof PhotoBlockPropsSchema>

export function PhotoBlock({ src, alt, caption }: PhotoBlockProps) {
  if (!src) {
    return (
      <div className="bg-steel-800 border border-dashed border-steel-600 rounded-xl p-8 text-center text-steel-400 text-sm mb-4">
        Photo missing
      </div>
    )
  }
  return (
    <figure className="mb-4">
      <SopImageInline src={src} alt={alt || 'SOP photo'} />
      {caption && (
        <figcaption className="text-xs text-steel-400 mt-2 text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
