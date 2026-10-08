'use client'

/**
 * Phase 60 (D-09, NTF-01) -- the bell beside search in the list header.
 *
 * Static and tiny: the icon and a dot when anything is unread (R5: never a number). Unread is the person's own rows read
 * through the browser client (RLS is the only filter), never a server action and never on
 * a timer -- it refreshes on window focus and whenever the overview invalidates the
 * notification keys. Pressing it only asks the shell to select the overview.
 */
import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NOTIFICATIONS_KEY } from '@/lib/shell/query-keys'

interface UnreadRow {
  id: string
  kind: string
}

export function NotificationBell({ onOpen }: { onOpen(): void }) {
  const queryClient = useQueryClient()
  const { data = [] } = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread-ids'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('notifications')
        .select('id, kind')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as UnreadRow[]
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  // A newly asked-of-me notification means the machine badge and Now card are stale.
  const seenAsked = useRef<string>('')
  useEffect(() => {
    const key = data
      .filter((r) => r.kind === 'asked')
      .map((r) => r.id)
      .sort()
      .join(',')
    if (key && key !== seenAsked.current) {
      seenAsked.current = key
      void queryClient.invalidateQueries({ queryKey: ['user-sop-assignments'] })
    }
  }, [data, queryClient])

  const n = data.length
  return (
    <button
      type="button"
      data-testid="shell-bell"
      onClick={onOpen}
      aria-label={n > 0 ? 'Notifications, unread' : 'Notifications'}
      className="relative inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-lg text-ink-700 hover:bg-paper-2 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-accent-step"
    >
      <Bell className="size-5" aria-hidden="true" />
      {n > 0 && <span data-testid="shell-bell-dot" className="absolute right-2 top-2 size-2 rounded-full bg-ink-900" />}
    </button>
  )
}
