'use client'
import type { ReactNode } from 'react'
import { SUPPORTED_LAYOUT_VERSIONS } from '@/lib/builder/supported-versions'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { BLOCK_COMPONENTS, stripMeta, type BlockType } from '@/lib/builder/block-registry'
import {
  sanitizeLayoutContent,
  UnsupportedBlockPlaceholder,
} from '@/lib/builder/sanitize-layout'

// Module-level warn-once flags (reset per page load — D-13/D-14/D-15 "once per page")
let warnedUnsupportedVersion = false
let warnedParseFail = false

interface Props {
  layoutData: unknown
  layoutVersion: number
  sectionId: string
  fallback: ReactNode
}

interface LayoutItem {
  type: string
  props?: Record<string, unknown>
}

export function LayoutRenderer({
  layoutData,
  layoutVersion,
  sectionId,
  fallback,
}: Props) {
  const supported = (SUPPORTED_LAYOUT_VERSIONS as readonly number[]).includes(
    layoutVersion
  )
  if (!supported) {
    if (!warnedUnsupportedVersion) {
      console.warn('[layout] unsupported version', layoutVersion)
      warnedUnsupportedVersion = true
    }
    return <>{fallback}</>
  }

  const parsed = LayoutDataSchema.safeParse(layoutData)
  if (!parsed.success) {
    if (!warnedParseFail) {
      console.warn(
        `[layout] parse failed for section ${sectionId}, fell back to linear`
      )
      warnedParseFail = true
    }
    return <>{fallback}</>
  }

  // D-13: rewrite unknown-type block entries to UnsupportedBlockPlaceholder
  // BEFORE the switch iterates children, so unknown types never crash the render.
  const content = sanitizeLayoutContent(
    (parsed.data.content ?? []) as unknown[]
  ) as LayoutItem[]

  // D-01: bespoke type→component switch — renders the SAME block components the
  // worker saw under the old Puck <Render>, now with Puck removed. `mode` is implicit
  // (read) here; the later admin edit host reuses BLOCK_COMPONENTS with mode=edit.
  return (
    <>
      {content.map((item, i) => {
        const props = stripMeta(item.props)
        const key = (props.id as string) ?? (item.props?.id as string) ?? `block-${i}`
        const Block = BLOCK_COMPONENTS[item.type as BlockType]
        if (!Block) {
          // Unknown type (incl. the sanitize-rewritten placeholder, which carries
          // the original type in props.type).
          const original =
            typeof props.type === 'string' ? (props.type as string) : item.type
          return <UnsupportedBlockPlaceholder key={key} type={original} />
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BlockAny = Block as any
        return <BlockAny key={key} {...props} />
      })}
    </>
  )
}
