'use client'

import { useNotifications } from '@/hooks/useNotifications'

/**
 * Unread count next to the SOPs nav label. Inline, after the text — it used
 * to be absolutely positioned at the label's top-right corner, which sat the
 * red dot on top of the last letter of "SOPS" (2026-09-28).
 */
export function NotificationBadge() {
  const { unreadCount } = useNotifications()

  if (unreadCount === 0) {
    return null
  }

  const displayCount = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <span
      aria-label={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
      className="ml-1.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-accent-escalate px-1 align-middle text-[10px] font-bold leading-none tracking-normal text-white"
    >
      {displayCount}
    </span>
  )
}
