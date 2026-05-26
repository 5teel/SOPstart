'use client'

import type { Block } from '@/types/sop'
import type { BlockContent } from '@/lib/validators/blocks'
import { HazardCardBlock } from '@/components/sop/blocks/HazardCardBlock'
import { PPECardBlock } from '@/components/sop/blocks/PPECardBlock'
import { StepBlock } from '@/components/sop/blocks/StepBlock'

export type BlockPickerPreviewProps = {
  block: Block | null
  content: BlockContent | null
}

/**
 * Renders the picker's right-pane preview using the SAME worker-facing
 * components the worker sees during walkthrough. The admin route keeps the
 * dark steel-900 admin theme around the wrapper, but the rendered block
 * (severity colours, chip styling, etc.) renders identically to worker view.
 */
export function BlockPickerPreview({ block, content }: BlockPickerPreviewProps) {
  if (!block || !content) {
    return (
      <div className="bg-white border border-[var(--ink-100)] rounded-md p-6 h-full flex items-center justify-center">
        <p className="text-sm text-[var(--ink-500)]">Select an item to preview</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[var(--ink-100)] rounded-md p-4 h-full overflow-y-auto">
      <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-2">
        Preview
      </div>
      <div className="text-[11px] text-[var(--ink-500)] mb-3">
        Workers see this exact content.
      </div>
      <div>
        {renderForKind(block.kind_slug, content)}
      </div>
    </div>
  )
}

function renderForKind(kindSlug: string, content: BlockContent) {
  switch (content.kind) {
    case 'hazard':
      return (
        <HazardCardBlock
          title={block_kind_to_title(kindSlug, 'Hazard')}
          body={content.text}
          severity={content.severity}
        />
      )
    case 'ppe':
      return <PPECardBlock title="PPE Required" items={content.items} />
    case 'step':
      return (
        <div>
          <StepBlock number={1} text={content.text} />
          {content.warning && (
            <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2">
              Warning: {content.warning}
            </div>
          )}
          {content.tip && (
            <div className="mt-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded p-2">
              Tip: {content.tip}
            </div>
          )}
        </div>
      )
    case 'emergency':
      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="text-sm font-bold uppercase tracking-widest text-red-400 mb-2">
            Emergency
          </div>
          <p className="text-base text-[var(--ink-900)] leading-relaxed">{content.text}</p>
          {content.contacts && content.contacts.length > 0 && (
            <ul className="mt-2 text-sm text-[var(--ink-500)] list-disc pl-5">
              {content.contacts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )
    case 'measurement':
      return (
        <div className="bg-[var(--paper)] border border-[var(--ink-100)] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
            Measurement
          </div>
          <div className="text-base text-[var(--ink-900)]">
            {content.label} <span className="text-[var(--ink-500)]">({content.unit})</span>
          </div>
          {content.hint && (
            <div className="mt-2 text-xs text-[var(--ink-500)]">{content.hint}</div>
          )}
        </div>
      )
    // Plan 21-05 — parser-emitted kinds added to the picker preview so
    // admins can pick them from the library after parsing (or after
    // promoting a parsed_inline block manually).
    case 'text':
      return (
        <div className="bg-white border border-[var(--ink-100)] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
            Text
          </div>
          <p className="text-sm text-[var(--ink-900)] leading-relaxed whitespace-pre-wrap line-clamp-6">
            {content.content.slice(0, 200)}
            {content.content.length > 200 ? '…' : ''}
          </p>
        </div>
      )
    case 'heading':
      return (
        <div className="bg-white border border-[var(--ink-100)] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
            Heading ({content.level})
          </div>
          {content.level === 'h3' ? (
            <h3 className="text-lg font-semibold text-[var(--ink-900)]">{content.text}</h3>
          ) : (
            <h2 className="text-xl font-bold text-[var(--ink-900)]">{content.text}</h2>
          )}
        </div>
      )
    case 'photo':
      return (
        <div className="bg-white border border-[var(--ink-100)] rounded-xl p-3">
          <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-2">
            Photo
          </div>
          {content.src ? (
            <div className="text-xs font-mono text-[var(--ink-500)] break-all">
              {content.src}
            </div>
          ) : (
            <div className="text-xs italic text-[var(--ink-500)]">No image source set</div>
          )}
          {content.alt && (
            <div className="text-xs text-[var(--ink-500)] mt-1">alt: {content.alt}</div>
          )}
          {content.caption && (
            <div className="text-xs text-[var(--ink-700)] mt-1">{content.caption}</div>
          )}
        </div>
      )
    case 'callout':
      return (
        <div className="bg-[var(--accent-decision)]/10 border border-[var(--accent-decision)]/30 rounded-xl p-4">
          <div className="text-xs uppercase tracking-widest text-[var(--accent-decision)] mb-1">
            {content.title}
          </div>
          <p className="text-base text-[var(--ink-900)] leading-relaxed">{content.body}</p>
        </div>
      )
    case 'model':
      return (
        <div className="bg-white border border-dashed border-[var(--ink-300)] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-2">
            3D Model
          </div>
          <div className="text-xs font-mono text-[var(--ink-700)] break-all">
            {content.assetUrl}
          </div>
          {content.hotspots && content.hotspots.length > 0 && (
            <div className="text-xs text-[var(--ink-500)] mt-1">
              {content.hotspots.length} hotspot(s)
            </div>
          )}
        </div>
      )
    case 'step_with_photos':
      return (
        <div className="bg-white border border-[var(--ink-100)] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
            Step {content.number} with photos ({content.photos.length})
          </div>
          <p className="text-sm text-[var(--ink-900)] leading-relaxed line-clamp-3">
            {content.text}
          </p>
          <div className="text-xs text-[var(--ink-500)] mt-2">Layout: {content.layout}</div>
        </div>
      )
    case 'photo_grid':
      return (
        <div className="bg-white border border-[var(--ink-100)] rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--ink-500)] mb-1">
            Photo Grid ({content.columns} cols)
          </div>
          <div className="text-sm text-[var(--ink-700)]">
            {content.items.length} photo{content.items.length === 1 ? '' : 's'}
          </div>
        </div>
      )
    default:
      return (
        <div className="text-sm text-[var(--ink-500)]">
          Preview not available for kind &lsquo;{(content as { kind: string }).kind}&rsquo;.
        </div>
      )
  }
}

function block_kind_to_title(kindSlug: string, fallback: string): string {
  if (kindSlug === 'hazard') return 'Hazard'
  if (kindSlug === 'ppe') return 'PPE'
  if (kindSlug === 'step') return 'Step'
  if (kindSlug === 'emergency') return 'Emergency'
  return fallback
}
