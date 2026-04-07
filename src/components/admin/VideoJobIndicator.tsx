'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACTIVE_STATUSES = ['queued', 'analyzing', 'generating_audio', 'rendering']

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  analyzing: 'Analysing',
  generating_audio: 'Narrating',
  rendering: 'Rendering',
  rendering_pending: 'Rendering',
}

type JobState =
  | { type: 'none' }
  | { type: 'generating'; label: string }
  | { type: 'ready' }

export function VideoJobIndicator({ sopId }: { sopId: string }) {
  const [state, setState] = useState<JobState>({ type: 'none' })

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function check() {
      // Check for active job first
      const { data: active } = await supabase
        .from('video_generation_jobs')
        .select('id, status, current_stage')
        .eq('sop_id', sopId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { id: string; status: string; current_stage: string | null } | null }

      if (!cancelled && active) {
        const label = STAGE_LABELS[active.current_stage ?? active.status] ?? 'Generating'
        setState({ type: 'generating', label })
        return
      }

      // Check for ready + published video
      const { data: ready } = await supabase
        .from('video_generation_jobs')
        .select('id')
        .eq('sop_id', sopId)
        .eq('status', 'ready')
        .eq('published', true)
        .limit(1)
        .maybeSingle() as { data: { id: string } | null }

      if (!cancelled && ready) {
        setState({ type: 'ready' })
        return
      }

      if (!cancelled) setState({ type: 'none' })
    }

    check()
    const interval = setInterval(check, 10_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [sopId])

  if (state.type === 'none') return null

  if (state.type === 'generating') {
    return (
      <Link
        href={`/admin/sops/${sopId}/video`}
        className="flex flex-col items-center justify-center w-[72px] min-h-[72px] rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-colors flex-shrink-0"
        title="Video generation in progress — tap to view"
      >
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[10px] font-semibold mt-1">{state.label}</span>
      </Link>
    )
  }

  // Ready — show play button
  return (
    <Link
      href={`/admin/sops/${sopId}/video`}
      className="flex flex-col items-center justify-center w-[72px] min-h-[72px] rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-colors flex-shrink-0"
      title="Video ready — tap to view"
    >
      <Play size={24} fill="currentColor" />
      <span className="text-[10px] font-semibold mt-1">Video</span>
    </Link>
  )
}
