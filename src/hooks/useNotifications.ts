'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead } from '@/actions/versioning'

export interface Notification {
  id: string
  sop_id: string
  type: string
  read: boolean
  created_at: string
  organisation_id: string
  user_id: string
}

export function useNotifications() {
  const queryClient = useQueryClient()

  const query = useQuery<Notification[]>({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('worker_notifications')
        .select('id, sop_id, type, read, created_at, organisation_id, user_id')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Notifications fetch error:', error)
        return []
      }

      return (data ?? []) as Notification[]
    },
    refetchInterval: 60_000, // poll every 60 seconds
    refetchOnWindowFocus: true,
  })

  const markRead = useCallback(
    async (notificationId: string) => {
      await markNotificationRead(notificationId)
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
    },
    [queryClient]
  )

  const notifications: Notification[] = query.data ?? []
  const unreadCount = notifications.length

  return { notifications, unreadCount, markRead }
}
