'use client'
import { Render, type Config, type Data } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { SUPPORTED_LAYOUT_VERSIONS } from '@/lib/builder/supported-versions'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'

// Plan 02 replaces with the real block config (7 shared blocks).
const placeholderConfig: Config = { components: {} }

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

  return <Render config={placeholderConfig} data={parsed.data as Data} />
}
