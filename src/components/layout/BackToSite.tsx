'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { placeForPath } from '@/lib/shell/place'

/** The one way back from a page the site opens (Office, Smoko room, new SOP, SOP page, builder). */
export function BackToSite() {
  const href = placeForPath(usePathname())
  if (!href) return null
  return (
    <div data-testid="back-to-site" className="flex min-h-tap items-center border-b border-ink-200 bg-paper px-4">
      <Link href={href} className="inline-flex min-h-tap items-center gap-2 text-ui text-ink-700">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the site
      </Link>
    </div>
  )
}
