import { SopImageInline } from '@/components/sop/SopImageInline'
import type { VisualBlockProps, VisualItem } from './media-adapter'

/**
 * Phase 26 Plan 26-09 (R5, D-03) — the unified Visual block (worker + edit render).
 *
 * One block holding mixed media, each item medium-tagged
 * `visual:photo | visual:diagram | visual:video`. This is the SAME component the
 * worker reads and the admin edit-shell shows (R2) — plain `img` / `video`
 * display only. Already-annotated diagrams keep showing their flat baked image
 * (`bakedSrc`); there is no annotation editor any more, and no Konva import here.
 *
 * Hook-free ⇒ SSR-safe ⇒ render-parity harness renders it identically.
 */
function MediaItem({ item, index }: { item: VisualItem; index: number }) {
  if (item.medium === 'video' && item.src) {
    return (
      <video
        src={item.src}
        controls
        preload="metadata"
        className="mt-3 w-full rounded-lg border border-[var(--ink-300)] max-h-60 bg-black"
      />
    )
  }
  // 26-13: a published/annotated diagram flattens its Konva scene to a baked PNG;
  // the worker serves THAT <img> (baked wins over raw) — never Konva (D-03/R8).
  const displaySrc = item.medium === 'diagram' && item.bakedSrc ? item.bakedSrc : item.src
  if (displaySrc) {
    // photo + baked diagram both display as an image (annotation is baked in).
    return <SopImageInline src={displaySrc} alt={item.alt || `Visual ${index + 1}`} />
  }
  return (
    <div className="bg-white border border-dashed border-[var(--ink-300)] rounded-lg p-6 text-center text-[var(--ink-500)] text-xs">
      Missing
    </div>
  )
}

export function VisualBlock({ items }: VisualBlockProps) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[var(--ink-300)] rounded-lg p-6 text-center text-[var(--ink-500)] text-sm mb-4">
        No media
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
      {items.map((it, i) => (
        <figure key={i} className="flex flex-col items-stretch">
          <MediaItem item={it} index={i} />
          {it.caption && (
            <figcaption className="text-xs text-[var(--ink-500)] mt-1 text-center">
              {it.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}
