'use client'

import { useState } from 'react'
import { ImagePlus, PenLine, Video } from 'lucide-react'
import type { BlockType } from '@/lib/builder/block-registry'
import type { LayoutItem } from '@/lib/builder/content-ops'
import {
  toVisualItems,
  fromVisualItems,
  newVisualItem,
  mediaFieldKey,
  supportsMultiple,
  supportsMediumPicker,
  mediumTag,
  MEDIUM_ACCENT,
  type MediaFieldType,
  type VisualMedium,
} from './media-adapter'

/**
 * Phase 26 Plan 26-09 (R5, D-03) — Pattern E: the media grid + medium sub-picker.
 *
 * The shared editing affordance for EVERY media field, unifying the legacy photo
 * blocks and the new Visual block behind one control (UI-SPEC §Field-Editor
 * Pattern E). It reads/writes through `media-adapter` so the legacy
 * PhotoBlock / PhotoGridBlock / StepWithPhotosBlock edit THROUGH the Visual UI
 * while their stored `layout_data` `kind` stays UNCHANGED (A3 convert-safety) —
 * every commit routes the block's NATIVE field value to the caller's lossless,
 * Zod-validated `onCommitField` (junctionId / block_provenance survive, P4/R7).
 *
 * Konva-FREE: diagram annotation editing is admin-only and code-split behind
 * `AnnotationEditorLoader` (26-11); this control only tags/orders/captions items.
 * SSR-safe (document/window untouched at init; menu state via useState).
 */
const MEDIUM_PICKER: { medium: VisualMedium; label: string; Icon: typeof ImagePlus }[] = [
  { medium: 'photo', label: 'Photo', Icon: ImagePlus },
  { medium: 'diagram', label: 'Diagram', Icon: PenLine },
  { medium: 'video', label: 'Video', Icon: Video },
]

interface MediaGridProps {
  item: LayoutItem
  field: string
  onCommitField: (field: string, value: unknown) => void
}

export function MediaGrid({ item, onCommitField }: MediaGridProps) {
  const type = item.type as BlockType as MediaFieldType
  const field = mediaFieldKey(type)
  const items = toVisualItems(type, item.props)
  const [picking, setPicking] = useState(false)

  function commit(next: ReturnType<typeof toVisualItems>) {
    onCommitField(field, fromVisualItems(type, next))
  }

  function addMedium(medium: VisualMedium) {
    commit([...items, newVisualItem(medium)])
    setPicking(false)
  }

  function updateCaption(index: number, caption: string) {
    commit(items.map((it, i) => (i === index ? { ...it, caption: caption || null } : it)))
  }

  function removeItem(index: number) {
    commit(items.filter((_, i) => i !== index))
  }

  const canAddMedium = supportsMediumPicker(type)
  const canAdd = supportsMultiple(type) || items.length === 0

  return (
    <div data-media-grid className="flex-1 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it, i) => (
          <div
            key={i}
            data-media-item
            data-medium={it.medium}
            className="group/media relative flex flex-col overflow-hidden rounded-md border border-[var(--ink-300,#d4d4d8)] bg-[var(--paper-2,#f4f4f5)]"
          >
            <div className="relative aspect-video w-full bg-[var(--ink-100,#f4f4f5)]">
              {it.src && it.medium === 'video' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={it.src} className="h-full w-full object-cover" preload="metadata" />
              ) : it.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.src} alt={it.alt} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center font-mono text-[9px] uppercase text-[var(--ink-500,#71717a)]">
                  empty
                </div>
              )}
              {/* Medium tag pill — visual:{medium}, colour-coded per UI-SPEC. */}
              <span
                data-medium-tag
                className="absolute left-1 top-1 rounded px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-white"
                style={{ backgroundColor: MEDIUM_ACCENT[it.medium] }}
              >
                {mediumTag(it.medium)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${it.medium} item ${i + 1}`}
                onClick={() => removeItem(i)}
                className="absolute right-1 top-1 hidden rounded bg-[var(--ink-900,#09090b)]/70 px-1 font-mono text-[9px] text-white group-hover/media:block"
              >
                ×
              </button>
            </div>
            <input
              type="text"
              aria-label={`Caption for ${it.medium} item ${i + 1}`}
              placeholder="Caption"
              defaultValue={it.caption ?? ''}
              onBlur={(e) => updateCaption(i, e.target.value)}
              className="border-t border-[var(--ink-300,#d4d4d8)] bg-transparent px-1.5 py-1 text-[11px] outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.22)]"
            />
          </div>
        ))}
      </div>

      {/* ＋ add media — opens the medium sub-picker (Visual) or adds a photo slot. */}
      {canAdd && !canAddMedium && (
        <button
          type="button"
          data-add-media
          aria-label="Add media"
          onClick={() => addMedium('photo')}
          className="inline-flex items-center gap-1 rounded border border-dashed border-[var(--ink-300,#d4d4d8)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-500,#71717a)] hover:border-[var(--accent-step,#3b82f6)] hover:text-[var(--accent-step,#3b82f6)]"
        >
          <ImagePlus size={11} /> add media
        </button>
      )}

      {canAdd && canAddMedium && (
        <div className="relative inline-block">
          <button
            type="button"
            data-add-media
            aria-haspopup="menu"
            aria-expanded={picking}
            aria-label="Add media"
            onClick={() => setPicking((o) => !o)}
            className="inline-flex items-center gap-1 rounded border border-dashed border-[var(--ink-300,#d4d4d8)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-500,#71717a)] hover:border-[var(--accent-step,#3b82f6)] hover:text-[var(--accent-step,#3b82f6)]"
          >
            <ImagePlus size={11} /> add media
          </button>
          {picking && (
            <div
              role="menu"
              data-medium-picker
              className="absolute left-0 z-30 mt-1 flex gap-1 rounded-[10px] border-[1.5px] border-[var(--ink-900,#09090b)] bg-[var(--paper,#fafafa)] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
            >
              {MEDIUM_PICKER.map(({ medium, label, Icon }) => (
                <button
                  key={medium}
                  type="button"
                  role="menuitem"
                  data-add-medium={medium}
                  onClick={() => addMedium(medium)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] text-[var(--ink-900,#09090b)] hover:bg-[var(--paper-2,#f4f4f5)]"
                  style={{ color: MEDIUM_ACCENT[medium] }}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
