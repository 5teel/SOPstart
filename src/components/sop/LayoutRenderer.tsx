'use client'
import { Render, type Data } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { SUPPORTED_LAYOUT_VERSIONS } from '@/lib/builder/supported-versions'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { puckConfig, sanitizeLayoutContent } from '@/lib/builder/puck-config'

// Module-level warn-once flags (reset per page load — D-13/D-14/D-15 "once per page")
let warnedUnsupportedVersion = false
let warnedParseFail = false

interface Props {
  layoutData: unknown
  layoutVersion: number
  sectionId: string
  fallback: ReactNode
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
  // BEFORE Puck iterates children, so unknown types never crash <Render>.
  const sanitized = {
    ...parsed.data,
    content: sanitizeLayoutContent(
      (parsed.data.content ?? []) as unknown[]
    ),
  }
  // LayoutDataSchema is permissive; Puck's Data type is narrower. The cast
  // is confined to the worker render-path entry point.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <Render config={puckConfig} data={sanitized as any as Data} />
}
