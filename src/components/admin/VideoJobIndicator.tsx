'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACTIVE_STATUSES = ['queued', 'analyzing', 'generating_audio', 'rendering']

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  analyzing: 'Analysing',
  generating_audio: 'Narrating',
  rendering: 'Rendering',
  rendering_pending: 'Rendering',
}

/**
 * Shows a spinning indicator + link on the SOP library row when a video
 * generation job is active for that SOP.
 */
export function VideoJobIndicator({ sopId }: { sopId: string }) {
  const [activeJob, setActiveJob] = useState<{ id: string; status: string; current_stage: string | null } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function check() {
      const { data } = await supabase
        .from('video_generation_jobs')
        .select('id, status, current_stage')
        .eq('sop_id', sopId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { id: string; status: string; current_stage: string | null } | null }

      if (!cancelled && data) setActiveJob(data)
    }

    check()
    const interval = setInterval(check, 10_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [sopId])

  if (!activeJob) return null

  const label = STAGE_LABELS[activeJob.current_stage ?? activeJob.status] ?? 'Generating'

  return (
    <Link
      href={`/admin/sops/${sopId}/video`}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors flex-shrink-0"
      title="Video generation in progress — tap to view"
    >
      <Loader2 size={12} className="animate-spin" />
      {label}
    </Link>
  )
}
