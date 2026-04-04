'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useNetworkStore } from '@/stores/network'
import type { VideoGenerationJob } from '@/types/sop'

export function useVideoGeneration(sopId: string) {
  const isOnline = useNetworkStore((s) => s.isOnline)

  return useQuery({
    queryKey: ['video-generation', sopId],
    queryFn: async (): Promise<VideoGenerationJob | null> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('video_generation_jobs')
        .select('*')
        .eq('sop_id', sopId)
        .eq('published', true)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('useVideoGeneration error:', error)
        return null
      }

      return data as VideoGenerationJob | null
    },
    enabled: !!sopId && isOnline,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // No persister — video data is online-only, must not leak into Dexie/IndexedDB (Pitfall 7)
  })
}
