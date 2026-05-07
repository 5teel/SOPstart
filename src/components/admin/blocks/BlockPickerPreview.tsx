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
      <div className="bg-steel-800 border border-steel-700 rounded-md p-6 h-full flex items-center justify-center">
        <p className="text-sm text-steel-500">Select a block to preview</p>
      </div>
    )
  }

  return (
    <div className="bg-steel-800 border border-steel-700 rounded-md p-4 h-full overflow-y-auto">
      <div className="text-xs uppercase tracking-wider text-steel-400 mb-2">
        Preview
      </div>
      <div className="text-[11px] text-steel-500 mb-3">
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
          <p className="text-base text-steel-100 leading-relaxed">{content.text}</p>
          {content.contacts && content.contacts.length > 0 && (
            <ul className="mt-2 text-sm text-steel-300 list-disc pl-5">
              {content.contacts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )
    case 'measurement':
      return (
        <div className="bg-steel-900 border border-steel-700 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-steel-400 mb-1">
            Measurement
          </div>
          <div className="text-base text-steel-100">
            {content.label} <span className="text-steel-400">({content.unit})</span>
          </div>
          {content.hint && (
            <div className="mt-2 text-xs text-steel-400">{content.hint}</div>
          )}
        </div>
      )
    default:
      return (
        <div className="text-sm text-steel-400">
          Preview not available for kind &lsquo;{content.kind}&rsquo;.
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
