'use client'
import { useLinkStatus } from 'next/link'
import { Loader2 } from 'lucide-react'

/**
 * Drop inside any <Link> to acknowledge the tap while the navigation is
 * pending (RSC fetch + server data in flight). Must be a descendant of the
 * Link it reports on. The .nav-pending-in delay keeps instant prefetched
 * navigations spinner-free.
 */
export function NavPendingSpinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span className="nav-pending-in inline-flex" aria-hidden="true">
      <Loader2 className={`${className} animate-spin`} />
    </span>
  )
}
