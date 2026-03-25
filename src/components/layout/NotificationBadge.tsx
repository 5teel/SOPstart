'use client'

import { useNotifications } from '@/hooks/useNotifications'

export function NotificationBadge() {
  const { unreadCount } = useNotifications()

  if (unreadCount === 0) {
    return null
  }

  const displayCount = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <span
      aria-label={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1"
    >
      {displayCount}
    </span>
  )
}
