'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { backForPath } from '@/lib/shell/back-path'

/** The one way back from a page the site opens (a page the home opens: settings, new SOP, training). */
export function BackToSite() {
  const href = backForPath(usePathname())
  if (!href) return null
  return (
    <div data-testid="back-to-site" className="flex min-h-tap items-center border-b border-ink-200 bg-paper px-4">
      <Link href={href} className="inline-flex min-h-tap items-center gap-2 text-ui text-ink-700">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
    </div>
  )
}
